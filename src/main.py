"""Entry-point script that wires together the trading agent, data feeds, and API."""

import sys
import argparse
import pathlib
sys.path.append(str(pathlib.Path(__file__).parent.parent))
from src.agent.decision_maker import TradingAgent
from src.indicators.local_indicators import LocalIndicatorCalculator
from src.trading.hyperliquid_api import HyperliquidAPI
import asyncio
import logging
import random
from collections import deque, OrderedDict
from datetime import datetime, timezone
import math  # For Sharpe
from dotenv import load_dotenv
import os
import json
from aiohttp import web
from src.utils.formatting import format_number as fmt, format_size as fmt_sz
from src.utils.prompt_utils import json_default, round_or_none, round_series


def generate_debug_trades(assets, asset_prices, positions):
    """Generate random buy/sell trades for debug mode - no LLM needed.

    This generates rapid random trades to stress test the trading system.
    Every asset gets a trade action (never hold) with tight TP/SL.
    """
    decisions = []
    for asset in assets:
        price = asset_prices.get(asset, 0)
        if price <= 0:
            continue

        # Check existing position
        existing_pos = None
        for pos in positions:
            if pos.get('coin') == asset:
                existing_pos = pos
                break

        existing_size = float(existing_pos.get('szi', 0)) if existing_pos else 0

        # If we have a position, flip it. If not, random direction.
        if existing_size > 0:
            # Have long, close it (sell)
            action = "sell"
        elif existing_size < 0:
            # Have short, close it (buy)
            action = "buy"
        else:
            # No position, random direction
            action = random.choice(["buy", "sell"])

        is_buy = action == "buy"

        # Tight TP/SL for quick closes (0.5% TP, 1% SL)
        if is_buy:
            tp_price = round(price * 1.005, 2)  # 0.5% profit
            sl_price = round(price * 0.99, 2)   # 1% loss
        else:
            tp_price = round(price * 0.995, 2)  # 0.5% profit
            sl_price = round(price * 1.01, 2)   # 1% loss

        decisions.append({
            "asset": asset,
            "action": action,
            "allocation_usd": 12.0,  # Minimum order size
            "tp_price": tp_price,
            "sl_price": sl_price,
            "exit_plan": "Debug trade - auto close on tight TP/SL",
            "rationale": f"Debug/test trade - random {action} for stress testing"
        })

    return {
        "reasoning": "Debug mode - generating random trades for UI stress testing",
        "summary": f"Debug mode: placing {len(decisions)} random trades on {', '.join(assets)}",
        "trade_decisions": decisions
    }

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


def clear_terminal():
    """Clear the terminal screen on Windows or POSIX systems."""
    os.system('cls' if os.name == 'nt' else 'clear')


def get_interval_seconds(interval_str):
    """Convert interval strings like '5m' or '1h' to seconds."""
    if interval_str.endswith('s'):
        return int(interval_str[:-1])
    elif interval_str.endswith('m'):
        return int(interval_str[:-1]) * 60
    elif interval_str.endswith('h'):
        return int(interval_str[:-1]) * 3600
    elif interval_str.endswith('d'):
        return int(interval_str[:-1]) * 86400
    else:
        raise ValueError(f"Unsupported interval: {interval_str}")

def main():
    """Parse CLI args, bootstrap dependencies, and launch the trading loop."""
    clear_terminal()
    parser = argparse.ArgumentParser(description="LLM-based Trading Agent on Hyperliquid")
    parser.add_argument("--assets", type=str, nargs="+", required=False, help="Assets to trade, e.g., BTC ETH")
    parser.add_argument("--interval", type=str, required=False, help="Interval period, e.g., 1h")
    parser.add_argument("--risk-profile", type=str, choices=["conservative", "moderate", "high", "debug"], required=False, help="Risk profile: conservative (default), moderate, high, or debug (for testing)")
    args = parser.parse_args()

    # Allow assets/interval/risk-profile via .env (CONFIG) if CLI not provided
    from src.config_loader import CONFIG
    assets_env = CONFIG.get("assets")
    interval_env = CONFIG.get("interval")
    risk_profile_env = CONFIG.get("risk_profile", "conservative")

    if (not args.assets or len(args.assets) == 0) and assets_env:
        # Support space or comma separated
        if "," in assets_env:
            args.assets = [a.strip() for a in assets_env.split(",") if a.strip()]
        else:
            args.assets = [a.strip() for a in assets_env.split(" ") if a.strip()]
    if not args.interval and interval_env:
        args.interval = interval_env
    if not args.risk_profile:
        args.risk_profile = risk_profile_env

    if not args.assets or not args.interval:
        parser.error("Please provide --assets and --interval, or set ASSETS and INTERVAL in .env")

    taapi = LocalIndicatorCalculator()
    hyperliquid = HyperliquidAPI()
    agent = TradingAgent(risk_profile=args.risk_profile)


    start_time = datetime.now(timezone.utc)
    invocation_count = 0
    trade_log = []  # For Sharpe: list of returns
    active_trades = []  # {'asset','is_long','amount','entry_price','tp_oid','sl_oid','exit_plan'}
    recent_events = deque(maxlen=200)
    diary_path = "diary.jsonl"
    initial_account_value = None
    # Perp mid-price history sampled each loop (authoritative, avoids spot/perp basis mismatch)
    price_history = {}
    # Track assets we just traded to avoid immediate reconciliation
    just_traded_assets = set()

    # Override interval for debug mode - use 30 seconds for rapid testing
    if args.risk_profile == "debug":
        args.interval = "30s"  # Force 30 second interval in debug mode
        print(f"⚠️ DEBUG MODE: Forcing 30-second interval for rapid trade testing")

    print(f"Starting trading agent for assets: {args.assets} at interval: {args.interval}")
    profile_desc = {
        'debug': '⚠️ DEBUG MODE - Random frequent trades for testing (30s interval)',
        'high': 'AGGRESSIVE TRADING MODE',
        'moderate': 'Balanced trading',
        'conservative': 'Conservative trading'
    }
    print(f"Risk Profile: {args.risk_profile.upper()} - {profile_desc.get(args.risk_profile, 'Unknown')}")

    def add_event(msg: str):
        """Log an informational event and push it into the recent events deque."""
        logging.info(msg)

    async def run_loop():
        """Main trading loop that gathers data, calls the agent, and executes trades."""
        nonlocal invocation_count, initial_account_value
        while True:
            invocation_count += 1
            minutes_since_start = (datetime.now(timezone.utc) - start_time).total_seconds() / 60

            # Clear just-traded tracking from previous iteration
            just_traded_assets.clear()

            # Global account state
            state = await hyperliquid.get_user_state()
            total_value = state.get('total_value') or state['balance'] + sum(p.get('pnl', 0) for p in state['positions'])
            sharpe = calculate_sharpe(trade_log)

            account_value = total_value
            if initial_account_value is None:
                initial_account_value = account_value
            total_return_pct = ((account_value - initial_account_value) / initial_account_value * 100.0) if initial_account_value else 0.0

            positions = []
            for pos_wrap in state['positions']:
                pos = pos_wrap
                coin = pos.get('coin')
                current_px = await hyperliquid.get_current_price(coin) if coin else None
                positions.append({
                    "symbol": coin,
                    "quantity": round_or_none(pos.get('szi'), 6),
                    "entry_price": round_or_none(pos.get('entryPx'), 2),
                    "current_price": round_or_none(current_px, 2),
                    "liquidation_price": round_or_none(pos.get('liquidationPx') or pos.get('liqPx'), 2),
                    "unrealized_pnl": round_or_none(pos.get('pnl'), 4),
                    "leverage": pos.get('leverage')
                })

            recent_diary = []
            try:
                with open(diary_path, "r") as f:
                    lines = f.readlines()
                    for line in lines[-10:]:
                        entry = json.loads(line)
                        recent_diary.append(entry)
            except Exception:
                pass

            open_orders_struct = []
            try:
                open_orders = await hyperliquid.get_open_orders()
                for o in open_orders[:50]:
                    open_orders_struct.append({
                        "coin": o.get('coin'),
                        "oid": o.get('oid'),
                        "is_buy": o.get('isBuy'),
                        "size": round_or_none(o.get('sz'), 6),
                        "price": round_or_none(o.get('px'), 2),
                        "trigger_price": round_or_none(o.get('triggerPx'), 2),
                        "order_type": o.get('orderType')
                    })
            except Exception:
                open_orders = []

            # Reconcile active trades (but skip assets we just traded)
            try:
                assets_with_positions = set()
                for pos in state['positions']:
                    try:
                        if abs(float(pos.get('szi') or 0)) > 0:
                            assets_with_positions.add(pos.get('coin'))
                    except Exception:
                        continue
                assets_with_orders = {o.get('coin') for o in (open_orders or []) if o.get('coin')}
                for tr in active_trades[:]:
                    asset = tr.get('asset')
                    # Skip reconciliation for assets we just traded this iteration
                    if asset in just_traded_assets:
                        continue
                    if asset not in assets_with_positions and asset not in assets_with_orders:
                        add_event(f"Reconciling stale active trade for {asset} (no position, no orders)")
                        active_trades.remove(tr)
                        with open(diary_path, "a") as f:
                            f.write(json.dumps({
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "asset": asset,
                                "action": "reconcile_close",
                                "reason": "no_position_no_orders",
                                "opened_at": tr.get('opened_at')
                            }) + "\n")
            except Exception:
                pass

            recent_fills_struct = []
            try:
                fills = await hyperliquid.get_recent_fills(limit=50)
                for f_entry in fills[-20:]:
                    try:
                        t_raw = f_entry.get('time') or f_entry.get('timestamp')
                        timestamp = None
                        if t_raw is not None:
                            try:
                                t_int = int(t_raw)
                                if t_int > 1e12:
                                    timestamp = datetime.fromtimestamp(t_int / 1000, tz=timezone.utc).isoformat()
                                else:
                                    timestamp = datetime.fromtimestamp(t_int, tz=timezone.utc).isoformat()
                            except Exception:
                                timestamp = str(t_raw)
                        recent_fills_struct.append({
                            "timestamp": timestamp,
                            "coin": f_entry.get('coin') or f_entry.get('asset'),
                            "is_buy": f_entry.get('isBuy'),
                            "size": round_or_none(f_entry.get('sz') or f_entry.get('size'), 6),
                            "price": round_or_none(f_entry.get('px') or f_entry.get('price'), 2)
                        })
                    except Exception:
                        continue
            except Exception:
                pass

            dashboard = {
                "total_return_pct": round(total_return_pct, 2),
                "balance": round_or_none(state['balance'], 2),
                "account_value": round_or_none(account_value, 2),
                "sharpe_ratio": round_or_none(sharpe, 3),
                "positions": positions,
                "active_trades": [
                    {
                        "asset": tr.get('asset'),
                        "is_long": tr.get('is_long'),
                        "amount": round_or_none(tr.get('amount'), 6),
                        "entry_price": round_or_none(tr.get('entry_price'), 2),
                        "tp_oid": tr.get('tp_oid'),
                        "sl_oid": tr.get('sl_oid'),
                        "exit_plan": tr.get('exit_plan'),
                        "opened_at": tr.get('opened_at')
                    }
                    for tr in active_trades
                ],
                "open_orders": open_orders_struct,
                "recent_diary": recent_diary,
                "recent_fills": recent_fills_struct,
            }

            # Gather data for ALL assets first
            market_sections = []
            asset_prices = {}
            for asset in args.assets:
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
                    lt_atr3 = taapi.fetch_value("atr", f"{asset}/USDT", "4h", params={"period": 3}, key="value")
                    lt_atr14 = taapi.fetch_value("atr", f"{asset}/USDT", "4h", params={"period": 14}, key="value")
                    lt_macd_series = taapi.fetch_series("macd", f"{asset}/USDT", "4h", results=10, value_key="valueMACD")
                    lt_rsi_series = taapi.fetch_series("rsi", f"{asset}/USDT", "4h", results=10, params={"period": 14}, value_key="value")

                    recent_mids = [entry["mid"] for entry in list(price_history.get(asset, []))[-10:]]
                    funding_annualized = round(funding * 24 * 365 * 100, 2) if funding else None

                    market_sections.append({
                        "asset": asset,
                        "current_price": round_or_none(current_price, 2),
                        "intraday": {
                            "ema20": round_or_none(ema_series[-1], 2) if ema_series else None,
                            "macd": round_or_none(macd_series[-1], 2) if macd_series else None,
                            "rsi7": round_or_none(rsi7_series[-1], 2) if rsi7_series else None,
                            "rsi14": round_or_none(rsi14_series[-1], 2) if rsi14_series else None,
                            "series": {
                                "ema20": round_series(ema_series, 2),
                                "macd": round_series(macd_series, 2),
                                "rsi7": round_series(rsi7_series, 2),
                                "rsi14": round_series(rsi14_series, 2)
                            }
                        },
                        "long_term": {
                            "ema20": round_or_none(lt_ema20, 2),
                            "ema50": round_or_none(lt_ema50, 2),
                            "atr3": round_or_none(lt_atr3, 2),
                            "atr14": round_or_none(lt_atr14, 2),
                            "macd_series": round_series(lt_macd_series, 2),
                            "rsi_series": round_series(lt_rsi_series, 2)
                        },
                        "open_interest": round_or_none(oi, 2),
                        "funding_rate": round_or_none(funding, 8),
                        "funding_annualized_pct": funding_annualized,
                        "recent_mid_prices": recent_mids
                    })
                except Exception as e:
                    add_event(f"Data gather error {asset}: {e}")
                    continue

            # Single LLM call with all assets
            context_payload = OrderedDict([
                ("invocation", {
                    "minutes_since_start": round(minutes_since_start, 2),
                    "current_time": datetime.now(timezone.utc).isoformat(),
                    "invocation_count": invocation_count
                }),
                ("account", dashboard),
                ("market_data", market_sections),
                ("instructions", {
                    "assets": args.assets,
                    "requirement": "Decide actions for all assets and return a strict JSON array matching the schema."
                })
            ])
            context = json.dumps(context_payload, default=json_default)
            add_event(f"Combined prompt length: {len(context)} chars for {len(args.assets)} assets")
            with open("prompts.log", "a") as f:
                f.write(f"\n\n--- {datetime.now()} - ALL ASSETS ---\n{json.dumps(context_payload, indent=2, default=json_default)}\n")

            def _is_failed_outputs(outs):
                """Return True when outputs are missing or clearly invalid."""
                if not isinstance(outs, dict):
                    return True
                decisions = outs.get("trade_decisions")
                if not isinstance(decisions, list) or not decisions:
                    return True
                try:
                    return all(
                        isinstance(o, dict)
                        and (o.get('action') == 'hold')
                        and ('parse error' in (o.get('rationale', '').lower()))
                        for o in decisions
                    )
                except Exception:
                    return True

            # In debug mode, skip LLM and generate random trades for speed
            if args.risk_profile == "debug":
                add_event("DEBUG MODE: Generating random trades (skipping LLM)")
                outputs = generate_debug_trades(args.assets, asset_prices, state['positions'])
            else:
                try:
                    outputs = agent.decide_trade(args.assets, context)
                    if not isinstance(outputs, dict):
                        add_event(f"Invalid output format (expected dict): {outputs}")
                        outputs = {}
                except Exception as e:
                    import traceback
                    add_event(f"Agent error: {e}")
                    add_event(f"Traceback: {traceback.format_exc()}")
                    outputs = {}

                # Retry once on failure/parse error with a stricter instruction prefix
                if _is_failed_outputs(outputs):
                    add_event("Retrying LLM once due to invalid/parse-error output")
                    context_retry_payload = OrderedDict([
                        ("retry_instruction", "Return ONLY the JSON array per schema with no prose."),
                        ("original_context", context_payload)
                    ])
                    context_retry = json.dumps(context_retry_payload, default=json_default)
                    try:
                        outputs = agent.decide_trade(args.assets, context_retry)
                        if not isinstance(outputs, dict):
                            add_event(f"Retry invalid format: {outputs}")
                            outputs = {}
                    except Exception as e:
                        import traceback
                        add_event(f"Retry agent error: {e}")
                        add_event(f"Retry traceback: {traceback.format_exc()}")
                        outputs = {}

            summary_text = outputs.get("summary", "") if isinstance(outputs, dict) else ""
            if summary_text:
                add_event(f"LLM reasoning summary: {summary_text}")

            # Execute trades for each asset
            for output in outputs.get("trade_decisions", []) if isinstance(outputs, dict) else []:
                try:
                    asset = output.get("asset")
                    if not asset or asset not in args.assets:
                        continue
                    action = output.get("action")
                    current_price = asset_prices.get(asset, 0)
                    action = output["action"]
                    rationale = output.get("rationale", "")
                    if rationale:
                        add_event(f"Decision rationale for {asset}: {rationale}")
                    if action in ("buy", "sell"):
                        is_buy = action == "buy"
                        alloc_usd = float(output.get("allocation_usd", 0.0))
                        if alloc_usd <= 0:
                            add_event(f"Holding {asset}: zero/negative allocation")
                            continue
                        # Ensure minimum order value of $12 to avoid exchange rejection ($10 minimum)
                        if alloc_usd < 12:
                            alloc_usd = 12.0
                            add_event(f"Bumped allocation to ${alloc_usd} to meet exchange minimum")

                        # Check if we have an existing position
                        existing_position = None
                        for pos in state['positions']:
                            if pos.get('coin') == asset:
                                existing_position = pos
                                break

                        # Determine amount and action type
                        if existing_position:
                            existing_size = float(existing_position.get('szi', 0))
                            existing_is_long = existing_size > 0
                            abs_size = abs(existing_size)

                            if (is_buy and existing_is_long) or (not is_buy and not existing_is_long):
                                # Same direction - adding to position
                                amount = alloc_usd / current_price
                                add_event(f"Adding to existing {asset} {'LONG' if is_buy else 'SHORT'} position")
                            else:
                                # Opposite direction - closing position (possibly flipping)
                                amount = abs_size  # Use exact position size to close
                                add_event(f"Closing existing {asset} {'LONG' if existing_is_long else 'SHORT'} position (size: {amount})")
                        else:
                            # No existing position - opening new
                            amount = alloc_usd / current_price
                            add_event(f"Opening new {asset} {'LONG' if is_buy else 'SHORT'} position")

                        # Mark asset as traded
                        just_traded_assets.add(asset)

                        order = await hyperliquid.place_buy_order(asset, amount) if is_buy else await hyperliquid.place_sell_order(asset, amount)
                        # Confirm by checking recent fills for this asset shortly after placing
                        await asyncio.sleep(1)
                        fills_check = await hyperliquid.get_recent_fills(limit=10)
                        filled = False
                        for fc in reversed(fills_check):
                            try:
                                if (fc.get('coin') == asset or fc.get('asset') == asset):
                                    filled = True
                                    break
                            except Exception:
                                continue
                        trade_log.append({"type": action, "price": current_price, "amount": amount, "exit_plan": output["exit_plan"], "filled": filled})
                        tp_oid = None
                        sl_oid = None
                        if output["tp_price"]:
                            tp_order = await hyperliquid.place_take_profit(asset, is_buy, amount, output["tp_price"])
                            tp_oids = hyperliquid.extract_oids(tp_order)
                            tp_oid = tp_oids[0] if tp_oids else None
                            add_event(f"TP placed {asset} at {output['tp_price']}")
                        if output["sl_price"]:
                            sl_order = await hyperliquid.place_stop_loss(asset, is_buy, amount, output["sl_price"])
                            sl_oids = hyperliquid.extract_oids(sl_order)
                            sl_oid = sl_oids[0] if sl_oids else None
                            add_event(f"SL placed {asset} at {output['sl_price']}")
                        # Update active_trades tracking
                        # Remove old tracking for this asset
                        for existing in active_trades[:]:
                            if existing.get('asset') == asset:
                                try:
                                    active_trades.remove(existing)
                                except ValueError:
                                    pass

                        # Only add to active_trades if we're opening/adding to a position
                        # If we closed a position (existing_position and opposite direction), don't track it
                        should_track = True
                        if existing_position:
                            existing_size = float(existing_position.get('szi', 0))
                            existing_is_long = existing_size > 0
                            if (is_buy and not existing_is_long) or (not is_buy and existing_is_long):
                                # We closed the position
                                should_track = False
                                add_event(f"Position closed for {asset}")

                        if should_track:
                            active_trades.append({
                                "asset": asset,
                                "is_long": is_buy,
                                "amount": amount,
                                "entry_price": current_price,
                                "tp_oid": tp_oid,
                                "sl_oid": sl_oid,
                                "exit_plan": output["exit_plan"],
                                "opened_at": datetime.now().isoformat()
                            })

                        add_event(f"{action.upper()} {asset} amount {amount:.4f} at ~{current_price}")
                        if rationale:
                            add_event(f"Post-trade rationale for {asset}: {rationale}")
                        # Write to diary after confirming fills status
                        with open(diary_path, "a") as f:
                            diary_entry = {
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "asset": asset,
                                "action": action,
                                "allocation_usd": alloc_usd,
                                "amount": amount,
                                "entry_price": current_price,
                                "tp_price": output.get("tp_price"),
                                "tp_oid": tp_oid,
                                "sl_price": output.get("sl_price"),
                                "sl_oid": sl_oid,
                                "exit_plan": output.get("exit_plan", ""),
                                "rationale": output.get("rationale", ""),
                                "order_result": str(order),
                                "opened_at": datetime.now(timezone.utc).isoformat(),
                                "filled": filled
                            }
                            f.write(json.dumps(diary_entry) + "\n")
                    else:
                        add_event(f"Hold {asset}: {output.get('rationale', '')}")
                        # Write hold to diary
                        with open(diary_path, "a") as f:
                            diary_entry = {
                                "timestamp": datetime.now().isoformat(),
                                "asset": asset,
                                "action": "hold",
                                "rationale": output.get("rationale", "")
                            }
                            f.write(json.dumps(diary_entry) + "\n")
                except Exception as e:
                    import traceback
                    add_event(f"Execution error {asset}: {e}")

            # In debug mode, also run rapid mini-trades within the interval
            if args.risk_profile == "debug":
                add_event("DEBUG: Waiting 30s with mini-trade bursts every 10s")
                for burst in range(3):  # 3 bursts within the 30s interval
                    await asyncio.sleep(10)
                    # Quick state refresh
                    try:
                        burst_state = await hyperliquid.get_user_state()
                        burst_prices = {}
                        for asset in args.assets:
                            try:
                                burst_prices[asset] = await hyperliquid.get_current_price(asset)
                            except:
                                burst_prices[asset] = asset_prices.get(asset, 0)

                        burst_outputs = generate_debug_trades(args.assets, burst_prices, burst_state['positions'])
                        add_event(f"DEBUG BURST {burst+1}/3: Placing {len(burst_outputs.get('trade_decisions', []))} trades")

                        for output in burst_outputs.get("trade_decisions", []):
                            try:
                                asset = output.get("asset")
                                if not asset:
                                    continue
                                action = output.get("action")
                                current_price = burst_prices.get(asset, 0)
                                if action in ("buy", "sell") and current_price > 0:
                                    is_buy = action == "buy"
                                    alloc_usd = float(output.get("allocation_usd", 12.0))
                                    if alloc_usd < 12:
                                        alloc_usd = 12.0

                                    # Check existing position
                                    existing_position = None
                                    for pos in burst_state['positions']:
                                        if pos.get('coin') == asset:
                                            existing_position = pos
                                            break

                                    if existing_position:
                                        existing_size = float(existing_position.get('szi', 0))
                                        existing_is_long = existing_size > 0
                                        if (is_buy and not existing_is_long) or (not is_buy and existing_is_long):
                                            amount = abs(existing_size)
                                        else:
                                            amount = alloc_usd / current_price
                                    else:
                                        amount = alloc_usd / current_price

                                    just_traded_assets.add(asset)
                                    order = await hyperliquid.place_buy_order(asset, amount) if is_buy else await hyperliquid.place_sell_order(asset, amount)
                                    add_event(f"DEBUG BURST: {action.upper()} {asset} @ {current_price}")

                                    # Log to diary
                                    with open(diary_path, "a") as f:
                                        diary_entry = {
                                            "timestamp": datetime.now(timezone.utc).isoformat(),
                                            "asset": asset,
                                            "action": action,
                                            "allocation_usd": alloc_usd,
                                            "amount": amount,
                                            "entry_price": current_price,
                                            "rationale": "Debug burst trade",
                                            "order_result": str(order),
                                            "debug_burst": burst + 1
                                        }
                                        f.write(json.dumps(diary_entry) + "\n")
                            except Exception as e:
                                add_event(f"DEBUG BURST error {asset}: {e}")
                    except Exception as e:
                        add_event(f"DEBUG BURST {burst+1} failed: {e}")
            else:
                await asyncio.sleep(get_interval_seconds(args.interval))

    async def handle_diary(request):
        """Return diary entries as JSON or newline-delimited text."""
        try:
            raw = request.query.get('raw')
            download = request.query.get('download')
            if raw or download:
                if not os.path.exists(diary_path):
                    return web.Response(text="", content_type="text/plain")
                with open(diary_path, "r") as f:
                    data = f.read()
                headers = {}
                if download:
                    headers["Content-Disposition"] = f"attachment; filename=diary.jsonl"
                return web.Response(text=data, content_type="text/plain", headers=headers)
            limit = int(request.query.get('limit', '200'))
            with open(diary_path, "r") as f:
                lines = f.readlines()
            start = max(0, len(lines) - limit)
            entries = [json.loads(l) for l in lines[start:]]
            return web.json_response({"entries": entries})
        except FileNotFoundError:
            return web.json_response({"entries": []})
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    async def handle_logs(request):
        """Stream log files with optional download or tailing behaviour."""
        try:
            path = request.query.get('path', 'llm_requests.log')
            download = request.query.get('download')
            limit_param = request.query.get('limit')
            if not os.path.exists(path):
                return web.Response(text="", content_type="text/plain")
            with open(path, "r") as f:
                data = f.read()
            if download or (limit_param and (limit_param.lower() == 'all' or limit_param == '-1')):
                headers = {}
                if download:
                    headers["Content-Disposition"] = f"attachment; filename={os.path.basename(path)}"
                return web.Response(text=data, content_type="text/plain", headers=headers)
            limit = int(limit_param) if limit_param else 2000
            return web.Response(text=data[-limit:], content_type="text/plain")
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    async def handle_close_all(request):
        """Close all open positions in parallel using market orders."""
        try:
            state = await hyperliquid.get_user_state()
            positions = state.get('positions', [])

            # Filter to positions with actual size
            active_positions = [p for p in positions if float(p.get('szi', 0)) != 0]

            if not active_positions:
                return web.json_response({"success": True, "message": "No positions to close", "closed": 0})

            async def close_position(pos):
                """Close a single position using opposite market order."""
                coin = pos.get('coin')
                size = float(pos.get('szi', 0))
                is_long = size > 0
                close_size = abs(size)
                try:
                    # Close by placing opposite direction market order
                    if is_long:
                        result = await hyperliquid.place_sell_order(coin, close_size, slippage=0.05)
                    else:
                        result = await hyperliquid.place_buy_order(coin, close_size, slippage=0.05)
                    add_event(f"Closed {coin} position: {'LONG' if is_long else 'SHORT'} {close_size}")
                    return {"coin": coin, "size": close_size, "success": True, "result": str(result)}
                except Exception as e:
                    add_event(f"Failed to close {coin}: {e}")
                    return {"coin": coin, "size": close_size, "success": False, "error": str(e)}

            # Close all positions in parallel
            results = await asyncio.gather(*[close_position(p) for p in active_positions])

            closed = [r for r in results if r.get("success")]
            errors = [r for r in results if not r.get("success")]

            return web.json_response({
                "success": len(errors) == 0,
                "closed": len(closed),
                "positions_closed": closed,
                "errors": errors
            })
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    async def handle_close_position(request):
        """Close a single position by asset."""
        try:
            data = await request.json()
            asset = data.get('asset')
            side = data.get('side')
            size = float(data.get('size', 0))

            if not asset or not size:
                return web.json_response({"error": "Missing asset or size"}, status=400)

            # Get the coin symbol
            coin = asset.upper()

            # Determine if this is a long or short position
            is_long = side.upper() == 'LONG' if side else size > 0
            close_size = abs(size)

            try:
                # Close by placing opposite direction market order
                if is_long:
                    result = await hyperliquid.place_sell_order(coin, close_size, slippage=0.05)
                else:
                    result = await hyperliquid.place_buy_order(coin, close_size, slippage=0.05)
                add_event(f"Closed {coin} position: {'LONG' if is_long else 'SHORT'} {close_size}")
                return web.json_response({
                    "success": True,
                    "coin": coin,
                    "size": close_size,
                    "side": 'LONG' if is_long else 'SHORT',
                    "result": str(result)
                })
            except Exception as e:
                add_event(f"Failed to close {coin}: {e}")
                return web.json_response({"success": False, "error": str(e)}, status=500)
        except Exception as e:
            return web.json_response({"error": str(e)}, status=500)

    async def start_api(app):
        """Register HTTP endpoints for observing diary entries and logs."""
        app.router.add_get('/diary', handle_diary)
        app.router.add_get('/logs', handle_logs)
        app.router.add_post('/close-all', handle_close_all)
        app.router.add_post('/close-position', handle_close_position)

    async def main_async():
        """Start the aiohttp server and kick off the trading loop."""
        import socket
        import subprocess

        from src.config_loader import CONFIG as CFG
        port = int(CFG.get("api_port"))
        host = CFG.get("api_host")

        # Kill any existing process on this port
        try:
            result = subprocess.run(
                ["lsof", "-t", f"-i:{port}"],
                capture_output=True, text=True
            )
            if result.stdout.strip():
                pids = result.stdout.strip().split('\n')
                for pid in pids:
                    if pid:
                        subprocess.run(["kill", "-9", pid], capture_output=True)
                        logging.info(f"Killed existing process {pid} on port {port}")
                import time
                time.sleep(1)
        except Exception as e:
            logging.warning(f"Could not check/kill existing process: {e}")

        app = web.Application()
        await start_api(app)
        runner = web.AppRunner(app)
        await runner.setup()

        # Create socket with SO_REUSEADDR to allow quick restart
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))
        sock.listen(128)
        sock.setblocking(False)

        site = web.SockSite(runner, sock)
        await site.start()
        logging.info(f"API server started on {host}:{port}")
        await run_loop()

    def calculate_total_return(state, trade_log):
        """Compute percent return relative to an assumed initial balance."""
        initial = 10000
        current = state['balance'] + sum(p.get('pnl', 0) for p in state.get('positions', []))
        return ((current - initial) / initial) * 100 if initial else 0

    def calculate_sharpe(returns):
        """Compute a naive Sharpe-like ratio from the trade log."""
        if not returns:
            return 0
        vals = [r.get('pnl', 0) if 'pnl' in r else 0 for r in returns]
        if not vals:
            return 0
        mean = sum(vals) / len(vals)
        var = sum((v - mean) ** 2 for v in vals) / len(vals)
        std = math.sqrt(var) if var > 0 else 0
        return mean / std if std > 0 else 0

    async def check_exit_condition(trade, taapi, hyperliquid):
        """Evaluate whether a given trade's exit plan triggers a close."""
        plan = (trade.get("exit_plan") or "").lower()
        if not plan:
            return False
        try:
            if "macd" in plan and "below" in plan:
                macd = taapi.get_indicators(trade["asset"], "4h")["macd"]["valueMACD"]
                threshold = float(plan.split("below")[-1].strip())
                return macd < threshold
            if "close above ema50" in plan:
                ema50 = taapi.get_historical_indicator("ema", f"{trade['asset']}/USDT", "4h", results=1, params={"period": 50})[0]["value"]
                current = await hyperliquid.get_current_price(trade["asset"])
                return current > ema50
        except Exception:
            return False
        return False

    asyncio.run(main_async())


if __name__ == "__main__":
    main()
