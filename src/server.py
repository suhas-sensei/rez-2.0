"""Multi-user backend server that manages agent instances per user session."""

import asyncio
import os
import sys
import pathlib
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Any
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

# File for persisting agent registry
REGISTRY_FILE = LOG_DIR / "agent_registry.json"
import json as _json


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


def save_registry():
    """Save agent registry to disk for persistence."""
    try:
        data = {}
        for session_id, agent in agent_registry.items():
            data[session_id] = {
                "assets": agent.config.assets,
                "interval": agent.config.interval,
                "risk_profile": agent.config.risk_profile,
                "private_key": agent.config.private_key,
                "public_key": agent.config.public_key,
                "paused": agent.paused,
                "running": agent.is_running(),
                "started_at": agent.started_at.isoformat() if agent.started_at else None,
            }
        with open(REGISTRY_FILE, 'w') as f:
            _json.dump(data, f)
        logger.info(f"Saved registry with {len(data)} agents")
    except Exception as e:
        logger.error(f"Failed to save registry: {e}")


def load_registry() -> dict:
    """Load agent registry from disk."""
    try:
        if REGISTRY_FILE.exists():
            with open(REGISTRY_FILE, 'r') as f:
                data = _json.load(f)
            logger.info(f"Loaded registry with {len(data)} agents")
            return data
    except Exception as e:
        logger.error(f"Failed to load registry: {e}")
    return {}


def run_agent_process(config: AgentConfig, log_file_path: str):
    """Run the trading agent in a subprocess."""
    import sys
    import pathlib
    import traceback
    import json

    # Diary file for trade history (same directory as log file)
    diary_file_path = log_file_path.replace('.log', '_diary.jsonl')

    # Define log function FIRST so we can catch import errors
    def log(msg: str):
        """Write log message to file."""
        timestamp = datetime.now(timezone.utc).isoformat()
        log_msg = f"[{timestamp}] {msg}"
        try:
            log_path = pathlib.Path(log_file_path)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(log_file_path, 'a') as f:
                f.write(log_msg + "\n")
                f.flush()
        except Exception as e:
            print(f"Log error: {e}")

    def write_trade(trade_entry: dict):
        """Write trade entry to diary file for stats tracking."""
        try:
            trade_entry['timestamp'] = datetime.now(timezone.utc).isoformat()
            diary_path = pathlib.Path(diary_file_path)
            diary_path.parent.mkdir(parents=True, exist_ok=True)
            with open(diary_file_path, 'a') as f:
                f.write(json.dumps(trade_entry) + "\n")
                f.flush()
        except Exception as e:
            log(f"Failed to write trade: {e}")

    log("Subprocess started, beginning imports...")

    try:
        sys.path.append(str(pathlib.Path(__file__).parent.parent))

        # Set environment variables for this agent BEFORE importing config_loader
        os.environ['HYPERLIQUID_PRIVATE_KEY'] = config.private_key
        os.environ['HYPERLIQUID_ACCOUNT_ADDRESS'] = config.public_key

        log("Importing config_loader...")
        from src import config_loader
        config_loader.CONFIG['hyperliquid_private_key'] = config.private_key
        config_loader.CONFIG['hyperliquid_account_address'] = config.public_key

        log("Importing TradingAgent...")
        from src.agent.decision_maker import TradingAgent
        log("Importing LocalIndicatorCalculator...")
        from src.indicators.local_indicators import LocalIndicatorCalculator
        log("Importing HyperliquidAPI...")
        from src.trading.hyperliquid_api import HyperliquidAPI
        from src.utils.formatting import format_number as fmt
        from src.utils.prompt_utils import json_default, round_or_none, round_series
        import json
        import math
        from collections import OrderedDict, deque
        log("All imports successful!")
    except Exception as e:
        log(f"FATAL import error: {e}")
        log(traceback.format_exc())
        return

    def get_interval_seconds(interval_str):
        if interval_str.endswith('m'):
            return int(interval_str[:-1]) * 60
        elif interval_str.endswith('h'):
            return int(interval_str[:-1]) * 3600
        elif interval_str.endswith('d'):
            return int(interval_str[:-1]) * 86400
        else:
            raise ValueError(f"Unsupported interval: {interval_str}")

    try:
        log("Initializing indicators...")
        taapi = LocalIndicatorCalculator()
        log("Initializing Hyperliquid API...")
        hyperliquid = HyperliquidAPI()
        log("Initializing trading agent...")
        agent = TradingAgent(risk_profile=config.risk_profile)
    except Exception as e:
        log(f"FATAL: Failed to initialize: {e}")
        import traceback
        log(traceback.format_exc())
        return

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
                        szi_raw = pos.get('szi', 0)
                        szi = float(szi_raw) if szi_raw else 0.0
                        if szi != 0:  # Only log non-zero positions
                            side = "LONG" if szi > 0 else "SHORT"
                            pnl = float(pos.get('pnl', 0) or 0)
                            log(f"Position {coin}: {side} {abs(szi):.6f} @ ${round_or_none(pos.get('entryPx'), 2)} | PnL: ${pnl:.2f}")

                        positions.append({
                            "symbol": coin,
                            "quantity": round(szi, 6) if szi else 0,
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

                            # Check if order was filled
                            order_filled = False
                            fill_price = current_price
                            fill_size = amount
                            if isinstance(order, dict) and order.get('status') == 'ok':
                                response = order.get('response', {})
                                if response.get('type') == 'order':
                                    statuses = response.get('data', {}).get('statuses', [])
                                    if statuses and 'filled' in statuses[0]:
                                        order_filled = True
                                        fill_price = float(statuses[0]['filled'].get('avgPx', current_price))
                                        fill_size = float(statuses[0]['filled'].get('totalSz', amount))

                            # Write trade to diary for stats
                            if order_filled:
                                write_trade({
                                    "asset": asset,
                                    "action": action,
                                    "side": "LONG" if is_buy else "SHORT",
                                    "amount": fill_size,
                                    "entry_price": fill_price,
                                    "allocation_usd": alloc_usd,
                                    "notional": fill_price * fill_size,
                                    "tp_price": tp_price,
                                    "sl_price": sl_price,
                                    "rationale": rationale,
                                    "order_result": str(order),
                                    "filled": True,
                                })

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

                # Debug mode: run every 15 seconds for rapid trading
                if config.risk_profile == "debug":
                    log("Debug mode: sleeping 15 seconds...")
                    await asyncio.sleep(15)
                else:
                    log(f"Sleeping for {config.interval}...")
                    await asyncio.sleep(get_interval_seconds(config.interval))

            except Exception as e:
                log(f"Loop error: {e}")
                await asyncio.sleep(60)

    try:
        asyncio.run(run_loop())
    except Exception as e:
        log(f"FATAL: run_loop crashed: {e}")
        import traceback
        log(traceback.format_exc())


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic."""
    logger.info("Multi-user agent server starting...")

    # Restore agents from disk
    saved_data = load_registry()
    for session_id, agent_data in saved_data.items():
        if agent_data.get("running", False):
            logger.info(f"Restoring agent for session {session_id}...")
            try:
                config = AgentConfig(
                    assets=agent_data["assets"],
                    interval=agent_data["interval"],
                    risk_profile=agent_data.get("risk_profile", "conservative"),
                    private_key=agent_data["private_key"],
                    public_key=agent_data["public_key"],
                )
                agent = AgentInstance(session_id, config)
                agent.paused = agent_data.get("paused", False)

                # Restart the agent process
                agent.process = multiprocessing.Process(
                    target=run_agent_process,
                    args=(config, str(agent.log_file)),
                    daemon=True
                )
                agent.process.start()
                agent.started_at = datetime.now(timezone.utc)
                agent_registry[session_id] = agent

                logger.info(f"Restored and started agent for session {session_id}")
            except Exception as e:
                logger.error(f"Failed to restore agent {session_id}: {e}")

    yield

    # Save registry before shutdown
    save_registry()

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

    # Save to disk for persistence
    save_registry()

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

    # Keep config in registry but mark as stopped (process is None now)
    agent.process = None

    # Save to disk for persistence (keeps the config for UI restoration)
    save_registry()

    logger.info(f"Stopped agent for session {session_id}")

    return {"success": True, "message": "Agent stopped"}


@app.get("/agent-status/{session_id}")
async def get_agent_status(session_id: str):
    """Get status of an agent."""
    if session_id not in agent_registry:
        # Check if we have saved config for this session (agent was stopped but config remembered)
        saved_data = load_registry()
        if session_id in saved_data:
            saved = saved_data[session_id]
            return {
                "running": False,
                "paused": False,
                "session_id": session_id,
                "assets": saved.get("assets"),
                "interval": saved.get("interval"),
                "risk_profile": saved.get("risk_profile"),
            }
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
        "risk_profile": agent.config.risk_profile,
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
    save_registry()

    return {"success": True, "message": "Agent paused"}


@app.post("/resume-agent")
async def resume_agent(req: StopAgentRequest):
    """Resume a paused agent."""
    session_id = req.session_id

    if session_id not in agent_registry:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent = agent_registry[session_id]
    agent.paused = False
    save_registry()

    return {"success": True, "message": "Agent resumed"}


class ClosePositionRequest(BaseModel):
    asset: str
    private_key: str
    public_key: str
    size: Optional[float] = None  # Position size (avoids extra API call if provided)
    side: Optional[str] = None    # "LONG" or "SHORT" (avoids extra API call if provided)


class CloseAllPositionsRequest(BaseModel):
    private_key: str
    public_key: str


# Cache for HyperliquidAPI instances (keyed by public_key)
_api_cache: Dict[str, Any] = {}


@app.post("/close-position")
async def close_position(req: ClosePositionRequest):
    """Close a specific position for an asset."""
    global _api_cache
    try:
        # Set environment variables for this request
        os.environ['HYPERLIQUID_PRIVATE_KEY'] = req.private_key
        os.environ['HYPERLIQUID_ACCOUNT_ADDRESS'] = req.public_key

        # Import and configure
        from src import config_loader
        config_loader.CONFIG['hyperliquid_private_key'] = req.private_key
        config_loader.CONFIG['hyperliquid_account_address'] = req.public_key
        network = os.getenv('HYPERLIQUID_NETWORK', 'mainnet')
        config_loader.CONFIG['hyperliquid_network'] = network

        from src.trading.hyperliquid_api import HyperliquidAPI

        logger.info(f"Closing {req.asset} | size={req.size} side={req.side}")

        # Use cached API instance or create new one
        cache_key = req.public_key
        if cache_key not in _api_cache:
            _api_cache[cache_key] = HyperliquidAPI()
            logger.info(f"Created new HyperliquidAPI for {cache_key[:10]}...")
        api = _api_cache[cache_key]

        # If size and side provided, skip the get_user_state API call
        if req.size and req.side:
            size = req.size
            is_buy = req.side == "SHORT"  # If SHORT, buy to close; if LONG, sell to close
            logger.info(f"Using provided size={size}, is_buy={is_buy} (skipped state fetch)")
        else:
            # Fallback: fetch state to get position info
            logger.info(f"No size/side provided, fetching user state...")
            state = await api.get_user_state()
            positions = state.get('positions', [])

            position = None
            for pos in positions:
                if pos.get('coin') == req.asset:
                    position = pos
                    break

            if not position:
                return {"success": False, "error": f"No open position for {req.asset}", "asset": req.asset}

            szi = float(position.get('szi', 0))
            if szi == 0:
                return {"success": False, "error": f"Position size is 0 for {req.asset}", "asset": req.asset}

            is_buy = szi < 0
            size = abs(szi)

        logger.info(f"Closing {req.asset}: {'BUY' if is_buy else 'SELL'} {size}")

        # Use market_open with the opposite direction to close the position
        # This is more reliable than market_close which relies on SDK's internal position cache
        # Using 15% slippage to handle volatile testnet oracle prices
        result = await api._retry(
            lambda: api.exchange.market_open(req.asset, is_buy, size, None, 0.15)
        )

        logger.info(f"Close result for {req.asset}: {result}")
        logger.info(f"Result type: {type(result)}")
        if isinstance(result, dict):
            logger.info(f"Result keys: {result.keys()}")
            logger.info(f"Result status: {result.get('status')}")
            logger.info(f"Result response: {result.get('response')}")

        # Check if result indicates an error
        if result and isinstance(result, dict):
            status = result.get('status')
            if status == 'err':
                error_msg = result.get('response', 'Unknown error from exchange')
                logger.error(f"Exchange error closing {req.asset}: {error_msg}")
                return {"success": False, "error": str(error_msg), "asset": req.asset}

        return {"success": True, "result": result, "asset": req.asset}
    except Exception as e:
        logger.error(f"Failed to close position for {req.asset}: {e}")
        return {"success": False, "error": str(e)}


@app.post("/close-all")
async def close_all_positions(req: CloseAllPositionsRequest):
    """Close all open positions."""
    try:
        # Set environment variables for this request
        os.environ['HYPERLIQUID_PRIVATE_KEY'] = req.private_key
        os.environ['HYPERLIQUID_ACCOUNT_ADDRESS'] = req.public_key

        # Import and configure
        from src import config_loader
        config_loader.CONFIG['hyperliquid_private_key'] = req.private_key
        config_loader.CONFIG['hyperliquid_account_address'] = req.public_key
        # Ensure network is set from environment
        network = os.getenv('HYPERLIQUID_NETWORK', 'mainnet')
        config_loader.CONFIG['hyperliquid_network'] = network

        from src.trading.hyperliquid_api import HyperliquidAPI

        logger.info(f"=== CLOSE ALL POSITIONS DEBUG ===")
        logger.info(f"Network: {network}")
        logger.info(f"Account: {req.public_key}")

        api = HyperliquidAPI()
        logger.info(f"API base_url: {api.base_url}")
        logger.info(f"API account_address: {api.account_address}")

        # Get all positions
        state = await api.get_user_state()
        logger.info(f"User state positions: {state.get('positions', [])}")
        positions = state.get('positions', [])
        logger.info(f"Found {len(positions)} positions to close")

        closed = []
        errors = []

        for pos in positions:
            coin = pos.get('coin')
            szi = float(pos.get('szi', 0))

            if coin and szi != 0:
                try:
                    logger.info(f"Closing {coin} position (size: {szi})...")

                    # Instead of market_close, place a market order in opposite direction
                    # szi > 0 means LONG, need to SELL to close
                    # szi < 0 means SHORT, need to BUY to close
                    is_buy = szi < 0  # If short (negative), buy to close
                    size = abs(szi)

                    logger.info(f"Placing {'BUY' if is_buy else 'SELL'} order for {size} {coin} to close position")

                    # Use market_open with reduce_only behavior via the exchange directly
                    result = await api._retry(
                        lambda: api.exchange.market_open(coin, is_buy, size, None, 0.05)
                    )
                    logger.info(f"Close result for {coin}: {result}")

                    # Check if result is None
                    if result is None:
                        errors.append({"asset": coin, "error": "Order returned None"})
                        logger.error(f"Order returned None for {coin}")
                        continue

                    # Check if result indicates an error
                    if isinstance(result, dict):
                        status = result.get('status')
                        if status == 'err':
                            error_msg = result.get('response', 'Unknown error')
                            errors.append({"asset": coin, "error": str(error_msg)})
                            logger.error(f"Exchange error closing {coin}: {error_msg}")
                            continue

                    closed.append({"asset": coin, "result": result})
                except Exception as e:
                    errors.append({"asset": coin, "error": str(e)})
                    logger.error(f"Failed to close {coin}: {e}")

        return {
            "success": len(errors) == 0,
            "closed": len(closed),
            "closed_positions": closed,
            "errors": errors,
        }
    except Exception as e:
        logger.error(f"Failed to close all positions: {e}")
        return {"success": False, "error": str(e)}


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
