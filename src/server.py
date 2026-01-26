"""Multi-user backend server that manages agent instances per user session."""

import asyncio
import os
import sys
import pathlib
import logging
from datetime import datetime, timezone
from typing import Dict, Optional
from contextlib import asynccontextmanager

sys.path.append(str(pathlib.Path(__file__).parent.parent))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import multiprocessing

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Directory for log files
LOG_DIR = pathlib.Path("/tmp/rez_logs")
LOG_DIR.mkdir(exist_ok=True)


class AgentConfig(BaseModel):
    assets: list[str]
    interval: str
    risk_profile: str = "conservative"
    private_key: str
    public_key: str


class AgentInstance:
    """Represents a running agent for a specific user session."""

    def __init__(self, session_id: str, config: AgentConfig):
        self.session_id = session_id
        self.config = config
        self.process: Optional[multiprocessing.Process] = None
        self.started_at: Optional[datetime] = None
        self.paused: bool = False
        self.log_file = LOG_DIR / f"{session_id}.log"

    def is_running(self) -> bool:
        return self.process is not None and self.process.is_alive()

    def get_logs(self, limit: int = 500) -> list[str]:
        """Read logs from file."""
        if not self.log_file.exists():
            return []
        try:
            with open(self.log_file, 'r') as f:
                lines = f.readlines()
                return [line.strip() for line in lines[-limit:] if line.strip()]
        except Exception:
            return []

    def append_log(self, msg: str):
        """Append a log message to the file."""
        try:
            with open(self.log_file, 'a') as f:
                f.write(msg + "\n")
        except Exception:
            pass

    def clear_logs(self):
        """Clear the log file."""
        try:
            if self.log_file.exists():
                self.log_file.unlink()
        except Exception:
            pass


# Global agent registry: session_id -> AgentInstance
agent_registry: Dict[str, AgentInstance] = {}


def run_agent_process(config: AgentConfig, log_file_path: str):
    """Run the trading agent in a subprocess."""
    import sys
    import pathlib
    sys.path.append(str(pathlib.Path(__file__).parent.parent))

    # Set environment variables for this agent BEFORE importing config_loader
    # This ensures the correct wallet is used for this session
    os.environ['HYPERLIQUID_PRIVATE_KEY'] = config.private_key
    os.environ['HYPERLIQUID_ACCOUNT_ADDRESS'] = config.public_key

    # Import config_loader and update CONFIG with our wallet
    from src import config_loader
    config_loader.CONFIG['hyperliquid_private_key'] = config.private_key
    config_loader.CONFIG['hyperliquid_account_address'] = config.public_key

    # Now import the rest - they'll use the updated CONFIG
    from src.agent.decision_maker import TradingAgent
    from src.indicators.local_indicators import LocalIndicatorCalculator
    from src.trading.hyperliquid_api import HyperliquidAPI
    from src.utils.formatting import format_number as fmt
    from src.utils.prompt_utils import json_default, round_or_none, round_series
    import json
    import math
    from collections import OrderedDict, deque

    def log(msg: str):
        """Write log message to file."""
        timestamp = datetime.now(timezone.utc).isoformat()
        log_msg = f"[{timestamp}] {msg}"
        try:
            # Ensure parent directory exists
            log_path = pathlib.Path(log_file_path)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(log_file_path, 'a') as f:
                f.write(log_msg + "\n")
                f.flush()  # Ensure immediate write
                os.fsync(f.fileno())  # Force write to disk
        except Exception as e:
            logger.error(f"Failed to write log: {e}")
        logger.info(msg)

    def get_interval_seconds(interval_str):
        if interval_str.endswith('m'):
            return int(interval_str[:-1]) * 60
        elif interval_str.endswith('h'):
            return int(interval_str[:-1]) * 3600
        elif interval_str.endswith('d'):
            return int(interval_str[:-1]) * 86400
        else:
            raise ValueError(f"Unsupported interval: {interval_str}")

    taapi = LocalIndicatorCalculator()
    hyperliquid = HyperliquidAPI()
    agent = TradingAgent(risk_profile=config.risk_profile)

    start_time = datetime.now(timezone.utc)
    invocation_count = 0
    trade_log = []
    active_trades = []
    price_history = {}
    initial_account_value = None

    log(f"Agent started for session with assets: {config.assets}, interval: {config.interval}")
    log(f"Config wallet: {config.public_key}")
    log(f"HyperliquidAPI wallet: {hyperliquid.wallet.address}")
    log(f"HyperliquidAPI account: {hyperliquid.account_address}")
    log(f"Risk profile: {config.risk_profile}")

    async def run_loop():
        nonlocal invocation_count, initial_account_value

        while True:
            try:
                invocation_count += 1
                minutes_since_start = (datetime.now(timezone.utc) - start_time).total_seconds() / 60

                # Get account state
                state = await hyperliquid.get_user_state()
                total_value = state.get('total_value') or state['balance'] + sum(p.get('pnl', 0) for p in state['positions'])

                if initial_account_value is None:
                    initial_account_value = total_value

                total_return_pct = ((total_value - initial_account_value) / initial_account_value * 100.0) if initial_account_value else 0.0

                log(f"Invocation #{invocation_count} | Balance: ${total_value:.2f} | Return: {total_return_pct:.2f}%")

                positions = []
                for pos_wrap in state['positions']:
                    pos = pos_wrap
                    coin = pos.get('coin')
                    if coin:
                        current_px = await hyperliquid.get_current_price(coin)
                        szi = pos.get('szi', 0)
                        if szi != 0:  # Only log non-zero positions
                            side = "LONG" if szi > 0 else "SHORT"
                            pnl = round_or_none(pos.get('pnl'), 4) or 0
                            log(f"Position {coin}: {side} {abs(szi):.6f} @ ${round_or_none(pos.get('entryPx'), 2)} | PnL: ${pnl:.2f}")

                        positions.append({
                            "symbol": coin,
                            "quantity": round_or_none(szi, 6),
                            "entry_price": round_or_none(pos.get('entryPx'), 2),
                            "current_price": round_or_none(current_px, 2),
                            "unrealized_pnl": round_or_none(pos.get('pnl'), 4),
                        })

                # Gather market data for all assets
                market_sections = []
                asset_prices = {}

                for asset in config.assets:
                    try:
                        current_price = await hyperliquid.get_current_price(asset)
                        asset_prices[asset] = current_price

                        if asset not in price_history:
                            price_history[asset] = deque(maxlen=60)
                        price_history[asset].append({"t": datetime.now(timezone.utc).isoformat(), "mid": round_or_none(current_price, 2)})

                        oi = await hyperliquid.get_open_interest(asset)
                        funding = await hyperliquid.get_funding_rate(asset)

                        intraday_tf = "5m"
                        ema_series = taapi.fetch_series("ema", f"{asset}/USDT", intraday_tf, results=10, params={"period": 20}, value_key="value")
                        macd_series = taapi.fetch_series("macd", f"{asset}/USDT", intraday_tf, results=10, value_key="valueMACD")
                        rsi7_series = taapi.fetch_series("rsi", f"{asset}/USDT", intraday_tf, results=10, params={"period": 7}, value_key="value")
                        rsi14_series = taapi.fetch_series("rsi", f"{asset}/USDT", intraday_tf, results=10, params={"period": 14}, value_key="value")

                        lt_ema20 = taapi.fetch_value("ema", f"{asset}/USDT", "4h", params={"period": 20}, key="value")
                        lt_ema50 = taapi.fetch_value("ema", f"{asset}/USDT", "4h", params={"period": 50}, key="value")
                        lt_atr14 = taapi.fetch_value("atr", f"{asset}/USDT", "4h", params={"period": 14}, key="value")

                        funding_annualized = round(funding * 24 * 365 * 100, 2) if funding else None

                        market_sections.append({
                            "asset": asset,
                            "current_price": round_or_none(current_price, 2),
                            "intraday": {
                                "ema20": round_or_none(ema_series[-1], 2) if ema_series else None,
                                "macd": round_or_none(macd_series[-1], 2) if macd_series else None,
                                "rsi7": round_or_none(rsi7_series[-1], 2) if rsi7_series else None,
                                "rsi14": round_or_none(rsi14_series[-1], 2) if rsi14_series else None,
                            },
                            "long_term": {
                                "ema20": round_or_none(lt_ema20, 2),
                                "ema50": round_or_none(lt_ema50, 2),
                                "atr14": round_or_none(lt_atr14, 2),
                            },
                            "funding_annualized_pct": funding_annualized,
                        })

                        rsi_val = f"{rsi14_series[-1]:.1f}" if rsi14_series else "N/A"
                        log(f"{asset}: ${current_price:.2f} | RSI14: {rsi_val}")

                    except Exception as e:
                        log(f"Data gather error {asset}: {e}")
                        continue

                # Build context for LLM
                dashboard = {
                    "total_return_pct": round(total_return_pct, 2),
                    "balance": round_or_none(state['balance'], 2),
                    "account_value": round_or_none(total_value, 2),
                    "positions": positions,
                    "active_trades": active_trades,
                }

                context_payload = OrderedDict([
                    ("invocation", {
                        "minutes_since_start": round(minutes_since_start, 2),
                        "current_time": datetime.now(timezone.utc).isoformat(),
                        "invocation_count": invocation_count
                    }),
                    ("account", dashboard),
                    ("market_data", market_sections),
                    ("instructions", {
                        "assets": config.assets,
                        "requirement": "Decide actions for all assets and return a strict JSON array matching the schema."
                    })
                ])

                context = json.dumps(context_payload, default=json_default)
                log(f"Calling LLM with {len(context)} chars context...")

                try:
                    outputs = agent.decide_trade(config.assets, context)
                    if not isinstance(outputs, dict):
                        log(f"Invalid output format: {outputs}")
                        outputs = {}
                    else:
                        # Log the LLM reasoning summary so frontend can display it
                        summary = outputs.get("summary", "")
                        if summary:
                            log(f"LLM reasoning summary: {summary}")
                except Exception as e:
                    log(f"Agent error: {e}")
                    outputs = {}

                # Execute trades
                for output in outputs.get("trade_decisions", []) if isinstance(outputs, dict) else []:
                    try:
                        asset = output.get("asset")
                        if not asset or asset not in config.assets:
                            continue

                        action = output.get("action")
                        rationale = output.get("rationale", "")
                        exit_plan = output.get("exit_plan", "")

                        # Log decision rationale for frontend display
                        log(f"Decision rationale for {asset}: {rationale}")

                        if action in ("buy", "sell"):
                            is_buy = action == "buy"
                            alloc_usd = float(output.get("allocation_usd", 0.0))

                            if alloc_usd < 12:
                                alloc_usd = 12.0

                            current_price = asset_prices.get(asset, 0)
                            amount = alloc_usd / current_price if current_price > 0 else 0

                            tp_price = output.get("tp_price")
                            sl_price = output.get("sl_price")

                            log(f"Executing {action.upper()} {asset}: ${alloc_usd:.2f} @ ${current_price:.2f} | TP: {tp_price} | SL: {sl_price}")

                            if is_buy:
                                order = await hyperliquid.place_buy_order(asset, amount)
                            else:
                                order = await hyperliquid.place_sell_order(asset, amount)

                            log(f"Order result for {asset}: {order}")

                            # Place TP/SL if specified
                            if tp_price:
                                await hyperliquid.place_take_profit(asset, is_buy, amount, tp_price)
                                log(f"{asset} TP placed at ${tp_price}")

                            if sl_price:
                                await hyperliquid.place_stop_loss(asset, is_buy, amount, sl_price)
                                log(f"{asset} SL placed at ${sl_price}")

                            trade_log.append({
                                "asset": asset,
                                "action": action,
                                "amount": amount,
                                "price": current_price,
                            })
                        else:
                            log(f"HOLD {asset}: {rationale}")

                    except Exception as e:
                        log(f"Execution error {asset}: {e}")

                log(f"Sleeping for {config.interval}...")
                await asyncio.sleep(get_interval_seconds(config.interval))

            except Exception as e:
                log(f"Loop error: {e}")
                await asyncio.sleep(60)

    asyncio.run(run_loop())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    logger.info("Multi-user agent server starting...")
    yield
    # Cleanup: stop all agents
    for session_id, agent in list(agent_registry.items()):
        if agent.is_running():
            agent.process.terminate()
            logger.info(f"Stopped agent for session {session_id}")
    logger.info("Server shutdown complete")


app = FastAPI(title="Rez Trading Agent API", lifespan=lifespan)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StartAgentRequest(BaseModel):
    session_id: str
    assets: list[str]
    interval: str
    risk_profile: str = "conservative"
    private_key: str
    public_key: str


class StopAgentRequest(BaseModel):
    session_id: str


@app.post("/start-agent")
async def start_agent(req: StartAgentRequest):
    """Start a new agent for a user session."""
    session_id = req.session_id

    # Stop existing agent if any
    if session_id in agent_registry:
        existing = agent_registry[session_id]
        if existing.is_running():
            existing.process.terminate()
            existing.process.join(timeout=5)
        existing.clear_logs()
        logger.info(f"Stopped existing agent for session {session_id}")

    config = AgentConfig(
        assets=req.assets,
        interval=req.interval,
        risk_profile=req.risk_profile,
        private_key=req.private_key,
        public_key=req.public_key,
    )

    agent = AgentInstance(session_id, config)
    agent.clear_logs()  # Clear old logs
    agent.append_log(f"[{datetime.now(timezone.utc).isoformat()}] Starting agent...")

    # Start agent in subprocess with log file path
    agent.process = multiprocessing.Process(
        target=run_agent_process,
        args=(config, str(agent.log_file)),
        daemon=True
    )
    agent.process.start()
    agent.started_at = datetime.now(timezone.utc)

    agent_registry[session_id] = agent

    logger.info(f"Started agent for session {session_id} with assets {req.assets}")

    return {
        "success": True,
        "message": "Agent started",
        "session_id": session_id,
        "assets": req.assets,
        "interval": req.interval,
    }


@app.post("/stop-agent")
async def stop_agent(req: StopAgentRequest):
    """Stop an agent for a user session."""
    session_id = req.session_id

    if session_id not in agent_registry:
        return {"success": True, "message": "No agent running"}

    agent = agent_registry[session_id]

    if agent.is_running():
        agent.process.terminate()
        agent.process.join(timeout=5)
        agent.append_log(f"[{datetime.now(timezone.utc).isoformat()}] Agent stopped")

    del agent_registry[session_id]
    logger.info(f"Stopped agent for session {session_id}")

    return {"success": True, "message": "Agent stopped"}


@app.get("/agent-status/{session_id}")
async def get_agent_status(session_id: str):
    """Get status of an agent."""
    if session_id not in agent_registry:
        return {
            "running": False,
            "paused": False,
            "session_id": session_id,
        }

    agent = agent_registry[session_id]

    return {
        "running": agent.is_running(),
        "paused": agent.paused,
        "session_id": session_id,
        "started_at": agent.started_at.isoformat() if agent.started_at else None,
        "assets": agent.config.assets,
        "interval": agent.config.interval,
    }


@app.get("/logs/{session_id}")
async def get_logs(session_id: str, limit: int = 100):
    """Get logs for an agent."""
    log_file = LOG_DIR / f"{session_id}.log"

    # Debug: check file status
    file_exists = log_file.exists()
    file_size = log_file.stat().st_size if file_exists else 0
    logger.info(f"GET /logs/{session_id}: file_exists={file_exists}, file_size={file_size}")

    if session_id not in agent_registry:
        # Check if there's a log file even if no agent registered
        if file_exists:
            try:
                with open(log_file, 'r') as f:
                    lines = f.readlines()
                    logs = [line.strip() for line in lines[-limit:] if line.strip()]
                logger.info(f"GET /logs/{session_id}: returning {len(logs)} logs (no agent)")
                return {"logs": logs, "session_id": session_id, "running": False}
            except Exception as e:
                logger.error(f"GET /logs/{session_id}: error reading file: {e}")
        return {"logs": [], "session_id": session_id, "running": False}

    agent = agent_registry[session_id]
    logs = agent.get_logs(limit)
    logger.info(f"GET /logs/{session_id}: returning {len(logs)} logs (agent running={agent.is_running()})")

    return {
        "logs": logs,
        "session_id": session_id,
        "running": agent.is_running(),
    }


@app.post("/pause-agent")
async def pause_agent(req: StopAgentRequest):
    """Pause an agent (not fully implemented - would need IPC)."""
    session_id = req.session_id

    if session_id not in agent_registry:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agent_registry[session_id]
    agent.paused = True

    return {"success": True, "message": "Agent paused"}


@app.post("/resume-agent")
async def resume_agent(req: StopAgentRequest):
    """Resume a paused agent."""
    session_id = req.session_id

    if session_id not in agent_registry:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agent_registry[session_id]
    agent.paused = False

    return {"success": True, "message": "Agent resumed"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "active_agents": len([a for a in agent_registry.values() if a.is_running()]),
        "total_sessions": len(agent_registry),
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_PORT", "8000"))
    host = os.getenv("API_HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
