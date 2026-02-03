"""Decision-making agent that orchestrates LLM prompts and indicator lookups."""

import requests
from src.config_loader import CONFIG
from src.indicators.local_indicators import LocalIndicatorCalculator
import json
import logging
from datetime import datetime

class TradingAgent:
    """High-level trading agent that delegates reasoning to an LLM service."""

    def __init__(self, risk_profile="conservative"):
        """Initialize LLM configuration, metadata headers, and indicator helper."""
        self.model = CONFIG["llm_model"]
        self.provider = CONFIG.get("llm_provider", "openai")

        if self.provider == "openai":
            self.api_key = CONFIG["openai_api_key"]
            self.base_url = "https://api.openai.com/v1/chat/completions"
            self.referer = None
            self.app_title = None
        else:  # openrouter
            self.api_key = CONFIG["openrouter_api_key"]
            base = CONFIG["openrouter_base_url"]
            self.base_url = f"{base}/chat/completions"
            self.referer = CONFIG.get("openrouter_referer")
            self.app_title = CONFIG.get("openrouter_app_title")

        self.indicator_calc = LocalIndicatorCalculator()
        self.risk_profile = risk_profile
        # Fast/cheap sanitizer model to normalize outputs on parse failures
        self.sanitize_model = CONFIG.get("sanitize_model") or "gpt-4o-mini"

    def decide_trade(self, assets, context):
        """Decide for multiple assets in one call.

        Args:
            assets: Iterable of asset tickers to score.
            context: Structured market/account state forwarded to the LLM.

        Returns:
            List of trade decision payloads, one per asset.
        """
        return self._decide(context, assets=assets)

    def _decide(self, context, assets):
        """Dispatch decision request to the LLM and enforce output contract."""

        # Risk-profile specific guidance
        if self.risk_profile == "debug":
            risk_guidance = (
                "RISK PROFILE: DEBUG - FAST TESTING MODE\n"
                "This is debug/testing mode. Analyze the market data normally and make decisions, but:\n\n"
                "TRADING RULES FOR DEBUG:\n"
                "1. BE AGGRESSIVE - Take trades on even moderate signals. Don't wait for perfect setups.\n"
                "2. SMALL SIZE: Allocate exactly $12 per trade (minimum to test order flow).\n"
                "3. NO COOLDOWN: You can trade the same asset every cycle.\n"
                "4. TIGHT TP/SL: Use 0.5% take profit and 1% stop loss.\n"
                "5. PREFER TRADING: If signals are neutral, lean towards taking a small position anyway.\n\n"
                "STILL ANALYZE INDICATORS:\n"
                "- Look at EMA, MACD, RSI as usual\n"
                "- Explain your reasoning in the summary\n"
                "- Make decisions based on the data, just with lower thresholds\n\n"
                "SUMMARY FORMAT:\n"
                "Write a natural first-person summary explaining your analysis and decision.\n"
                "Example: 'BTC is showing bullish momentum with RSI at 58 and MACD positive. Going long with a small test position.'\n\n"
            )
        elif self.risk_profile == "high":
            risk_guidance = (
                "RISK PROFILE: HIGH - AGGRESSIVE TRADING MODE\n"
                "- TAKE TRADES FREQUENTLY - Don't wait for perfect setups. Trade on moderate signals.\n"
                "- REDUCED COOLDOWN: Only 1 bar cooldown (5m) between trades. Be active.\n"
                "- LOWER CONFLUENCE REQUIRED: RSI >55 or <45 is enough for entry. Don't need all indicators aligned.\n"
                "- ALLOCATE 60-80% of available balance per trade for meaningful exposure.\n"
                "- USE 10-20X LEVERAGE to maximize returns on small moves.\n"
                "- TIGHT STOPS: Use 0.3-0.5% stop losses to churn positions frequently.\n"
                "- QUICK EXITS: Take profit at 0.5-1% gains. Don't wait for big moves.\n"
                "- IGNORE HYSTERESIS: Trade both directions actively based on current signals.\n"
                "- FUNDING IRRELEVANT: Trade regardless of funding rates.\n"
                "- BE DECISIVE: When in doubt, take a position. Holding is losing opportunity.\n\n"
            )
        elif self.risk_profile == "moderate":
            risk_guidance = (
                "RISK PROFILE: MODERATE - BALANCED TRADING\n"
                "- ALLOCATE 40-60% of available balance per trade.\n"
                "- USE 5-10X LEVERAGE for enhanced returns.\n"
                "- COOLDOWN: 2 bars (10m) between direction changes.\n"
                "- MODERATE CONFLUENCE: Need 2 out of 3 indicators aligned (EMA, RSI, MACD).\n"
                "- NORMAL STOPS: 0.5-1% stop losses.\n"
                "- Take profits at 1-2% gains.\n\n"
            )
        else:  # conservative
            risk_guidance = (
                "RISK PROFILE: CONSERVATIVE - CAREFUL TRADING\n"
                "- ALLOCATE 20-40% of available balance per trade.\n"
                "- USE 3-5X LEVERAGE maximum.\n"
                "- COOLDOWN: 3 bars (15m) between direction changes.\n"
                "- HIGH CONFLUENCE: Need multiple timeframes and indicators aligned.\n"
                "- WIDE STOPS: 1-2% stop losses for room to breathe.\n"
                "- Take profits at 2-4% gains.\n\n"
            )

        system_prompt = (
            "You are a rigorous QUANTITATIVE TRADER and interdisciplinary MATHEMATICIAN-ENGINEER optimizing risk-adjusted returns for perpetual futures under real execution, margin, and funding constraints.\n"
            "You will receive market + account context for SEVERAL assets, including:\n"
            f"- assets = {json.dumps(assets)}\n"
            "- per-asset intraday (5m) and higher-timeframe (4h) metrics\n"
            "- Active Trades with Exit Plans\n"
            "- Recent Trading History\n\n"
            f"{risk_guidance}"
            "Always use the 'current time' provided in the user message to evaluate any time-based conditions, such as cooldown expirations or timed exit plans.\n\n"
            "Your goal: make decisive, first-principles decisions per asset that balance risk and reward according to the risk profile.\n\n"
            "Core policy\n"
            "1) Respect prior plans: If an active trade has an exit_plan with explicit invalidation, honor it unless invalidation occurred.\n"
            "2) Trade frequency: Follow the cooldown guidance from your risk profile.\n"
            "3) Confluence requirements: Follow the signal strength requirements from your risk profile.\n"
            "4) Position sizing: Follow the allocation guidance from your risk profile.\n\n"
            "Decision discipline (per asset)\n"
            "- Choose one: buy / sell / hold.\n"
            "- You control allocation_usd.\n"
            "- TP/SL sanity:\n"
            "  • BUY: tp_price > current_price, sl_price < current_price\n"
            "  • SELL: tp_price < current_price, sl_price > current_price\n"
            "  If sensible TP/SL cannot be set, use null and explain the logic.\n"
            "- exit_plan must include at least ONE explicit invalidation trigger.\n\n"
            "Leverage policy (perpetual futures)\n"
            "- Follow leverage guidance from your risk profile.\n"
            "- Treat allocation_usd as notional exposure.\n\n"
            "Tool usage\n"
            "- Aggressively leverage fetch_indicator whenever an additional datapoint could sharpen your thesis; keep parameters minimal (indicator, symbol like \"BTC/USDT\", interval \"5m\"/\"4h\", optional period).\n"
            "- Incorporate tool findings into your reasoning, but NEVER paste raw tool responses into the final JSON—summarize the insight instead.\n"
            "- Use tools to upgrade your analysis; lack of confidence is a cue to query them before deciding."
            "Reasoning recipe (first principles)\n"
            "- Structure (trend, EMAs slope/cross, HH/HL vs LH/LL), Momentum (MACD regime, RSI slope), Liquidity/volatility (ATR, volume), Positioning tilt (funding, OI).\n"
            "- Favor alignment across 4h and 5m. Counter-trend scalps require stronger intraday confirmation and tighter risk.\n\n"
            "Output contract\n"
            "- Output a STRICT JSON object with exactly three properties in this order:\n"
            "  • reasoning: long-form string capturing detailed, step-by-step analysis (be verbose, for internal use).\n"
            "  • summary: A SHORT (2-4 sentences) first-person conversational summary of your decision. Write like a human trader talking about their positions. Examples:\n"
            "    - \"I'm holding my BTC position - the bearish momentum hasn't reversed yet and I don't see a clear entry signal.\"\n"
            "    - \"I'm adding to my ETH long here. The RSI divergence looks bullish and funding is favorable for longs.\"\n"
            "    - \"Closing my short on BTC - the oversold RSI suggests a bounce is coming and I don't want to fight the trend.\"\n"
            "  • trade_decisions: array ordered to match the provided assets list.\n"
            "- Each item inside trade_decisions must contain the keys {asset, action, allocation_usd, tp_price, sl_price, exit_plan, rationale}.\n"
            "- Do not emit Markdown or any extra properties.\n"
        )
        user_prompt = context
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        tools = [{
            "type": "function",
            "function": {
                "name": "fetch_indicator",
                "description": ("Calculate technical indicator from live Binance data. Available: ema, sma, rsi, macd, atr, "
                    "bbands, stochastic, adx, and other common indicators. "
                    "Specify indicator name, symbol (e.g. 'BTC/USDT'), interval (e.g. '5m', '1h', '4h'), and optional period."),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "indicator": {"type": "string"},
                        "symbol": {"type": "string"},
                        "interval": {"type": "string"},
                        "period": {"type": "integer"},
                        "backtrack": {"type": "integer"},
                        "other_params": {"type": "object", "additionalProperties": {"type": ["string", "number", "boolean"]}},
                    },
                    "required": ["indicator", "symbol", "interval"],
                    "additionalProperties": False,
                },
            },
        }]

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.referer:
            headers["HTTP-Referer"] = self.referer
        if self.app_title:
            headers["X-Title"] = self.app_title

        def _post(payload):
            """Send a POST request to OpenRouter, logging request and response metadata."""
            # Log the full request payload for debugging
            logging.info("Sending request to OpenRouter (model: %s)", payload.get('model'))
            with open("llm_requests.log", "a", encoding="utf-8") as f:
                f.write(f"\n\n=== {datetime.now()} ===\n")
                f.write(f"Model: {payload.get('model')}\n")
                f.write(f"Headers: {json.dumps({k: v for k, v in headers.items() if k != 'Authorization'})}\n")
                f.write(f"Payload:\n{json.dumps(payload, indent=2)}\n")
            resp = requests.post(self.base_url, headers=headers, json=payload, timeout=60)
            logging.info("Received response from OpenRouter (status: %s)", resp.status_code)
            if resp.status_code != 200:
                logging.error("OpenRouter error: %s - %s", resp.status_code, resp.text)
                with open("llm_requests.log", "a", encoding="utf-8") as f:
                    f.write(f"ERROR Response: {resp.status_code} - {resp.text}\n")
            resp.raise_for_status()
            return resp.json()

        def _sanitize_output(raw_content: str, assets_list):
            """Coerce arbitrary LLM output into the required reasoning + summary + decisions schema."""
            try:
                schema = {
                    "type": "object",
                    "properties": {
                        "reasoning": {"type": "string"},
                        "summary": {"type": "string"},
                        "trade_decisions": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "asset": {"type": "string", "enum": assets_list},
                                    "action": {"type": "string", "enum": ["buy", "sell", "hold"]},
                                    "allocation_usd": {"type": "number"},
                                    "tp_price": {"type": ["number", "null"]},
                                    "sl_price": {"type": ["number", "null"]},
                                    "exit_plan": {"type": "string"},
                                    "rationale": {"type": "string"},
                                },
                                "required": ["asset", "action", "allocation_usd", "tp_price", "sl_price", "exit_plan", "rationale"],
                                "additionalProperties": False,
                            },
                            "minItems": 1,
                        }
                    },
                    "required": ["reasoning", "summary", "trade_decisions"],
                    "additionalProperties": False,
                }
                payload = {
                    "model": self.sanitize_model,
                    "messages": [
                        {"role": "system", "content": (
                            "You are a strict JSON normalizer. Return ONLY a JSON array matching the provided JSON Schema. "
                            "If input is wrapped or has prose/markdown, fix it. Do not add fields."
                        )},
                        {"role": "user", "content": raw_content},
                    ],
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "trade_decisions",
                            "strict": True,
                            "schema": schema,
                        },
                    },
                    "temperature": 0,
                }
                resp = _post(payload)
                msg = resp.get("choices", [{}])[0].get("message", {})
                parsed = msg.get("parsed")
                if isinstance(parsed, dict):
                    if "trade_decisions" in parsed:
                        return parsed
                # fallback: try content
                content = msg.get("content") or "[]"
                try:
                    loaded = json.loads(content)
                    if isinstance(loaded, dict) and "trade_decisions" in loaded:
                        return loaded
                except (json.JSONDecodeError, KeyError, ValueError, TypeError):
                    pass
                return {"reasoning": "", "summary": "", "trade_decisions": []}
            except (requests.RequestException, json.JSONDecodeError, KeyError, ValueError, TypeError) as se:
                logging.error("Sanitize failed: %s", se)
                return {"reasoning": "", "summary": "", "trade_decisions": []}

        allow_tools = True
        allow_structured = True

        def _build_schema():
            """Assemble the JSON schema used for structured LLM responses."""
            base_properties = {
                "asset": {"type": "string", "enum": assets},
                "action": {"type": "string", "enum": ["buy", "sell", "hold"]},
                "allocation_usd": {"type": "number", "minimum": 0},
                "tp_price": {"type": ["number", "null"]},
                "sl_price": {"type": ["number", "null"]},
                "exit_plan": {"type": "string"},
                "rationale": {"type": "string"},
            }
            required_keys = ["asset", "action", "allocation_usd", "tp_price", "sl_price", "exit_plan", "rationale"]
            return {
                "type": "object",
                "properties": {
                    "reasoning": {"type": "string"},
                    "summary": {"type": "string"},
                    "trade_decisions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": base_properties,
                            "required": required_keys,
                            "additionalProperties": False,
                        },
                        "minItems": 1,
                    }
                },
                "required": ["reasoning", "summary", "trade_decisions"],
                "additionalProperties": False,
            }

        for _ in range(6):
            data = {"model": self.model, "messages": messages}
            if allow_structured:
                data["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "trade_decisions",
                        "strict": True,
                        "schema": _build_schema(),
                    },
                }
            if allow_tools:
                data["tools"] = tools
                data["tool_choice"] = "auto"
            if CONFIG.get("reasoning_enabled"):
                data["reasoning"] = {
                    "enabled": True,
                    "effort": CONFIG.get("reasoning_effort") or "high",
                    # "max_tokens": CONFIG.get("reasoning_max_tokens") or 100000,
                    "exclude": False,
                }
            if CONFIG.get("provider_config") or CONFIG.get("provider_quantizations"):
                provider_payload = dict(CONFIG.get("provider_config") or {})
                quantizations = CONFIG.get("provider_quantizations")
                if quantizations:
                    provider_payload["quantizations"] = quantizations
                data["provider"] = provider_payload
            try:
                resp_json = _post(data)
            except requests.HTTPError as e:
                try:
                    err = e.response.json()
                except (json.JSONDecodeError, ValueError, AttributeError):
                    err = {}
                raw = (err.get("error", {}).get("metadata", {}) or {}).get("raw", "")
                provider = (err.get("error", {}).get("metadata", {}) or {}).get("provider_name", "")
                if e.response.status_code == 422 and provider.lower().startswith("xai") and "deserialize" in raw.lower():
                    logging.warning("xAI rejected tool schema; retrying without tools.")
                    if allow_tools:
                        allow_tools = False
                        continue
                # Provider may not support structured outputs / response_format
                err_text = json.dumps(err)
                if allow_structured and ("response_format" in err_text or "structured" in err_text or e.response.status_code in (400, 422)):
                    logging.warning("Provider rejected structured outputs; retrying without response_format.")
                    allow_structured = False
                    continue
                raise

            choice = resp_json["choices"][0]
            message = choice["message"]
            messages.append(message)

            tool_calls = message.get("tool_calls") or []
            if allow_tools and tool_calls:
                for tc in tool_calls:
                    if tc.get("type") == "function" and tc.get("function", {}).get("name") == "fetch_indicator":
                        args = json.loads(tc["function"].get("arguments") or "{}")
                        try:
                            indicator = args["indicator"]
                            symbol = args["symbol"]
                            interval = args["interval"]
                            params = {}
                            if args.get("period") is not None:
                                params["period"] = args["period"]
                            if isinstance(args.get("other_params"), dict):
                                params.update(args["other_params"])

                            # Calculate indicator locally using Binance data
                            value = self.indicator_calc.fetch_value(indicator, symbol, interval, params=params)
                            ind_resp = {"value": value, "indicator": indicator, "symbol": symbol, "interval": interval}

                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc.get("id"),
                                "name": "fetch_indicator",
                                "content": json.dumps(ind_resp),
                            })
                        except (KeyError, ValueError, Exception) as ex:
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc.get("id"),
                                "name": "fetch_indicator",
                                "content": f"Error: {str(ex)}",
                            })
                continue

            try:
                # Prefer parsed field from structured outputs if present
                if isinstance(message.get("parsed"), dict):
                    parsed = message.get("parsed")
                else:
                    content = message.get("content") or "{}"
                    parsed = json.loads(content)

                if not isinstance(parsed, dict):
                    logging.error("Expected dict payload, got: %s; attempting sanitize", type(parsed))
                    sanitized = _sanitize_output(content if 'content' in locals() else json.dumps(parsed), assets)
                    if sanitized.get("trade_decisions"):
                        return sanitized
                    return {"reasoning": "", "summary": "", "trade_decisions": []}

                reasoning_text = parsed.get("reasoning", "") or ""
                summary_text = parsed.get("summary", "") or ""
                decisions = parsed.get("trade_decisions")

                if isinstance(decisions, list):
                    normalized = []
                    for item in decisions:
                        if isinstance(item, dict):
                            item.setdefault("allocation_usd", 0.0)
                            item.setdefault("tp_price", None)
                            item.setdefault("sl_price", None)
                            item.setdefault("exit_plan", "")
                            item.setdefault("rationale", "")
                            normalized.append(item)
                        elif isinstance(item, list) and len(item) >= 7:
                            normalized.append({
                                "asset": item[0],
                                "action": item[1],
                                "allocation_usd": float(item[2]) if item[2] else 0.0,
                                "tp_price": float(item[3]) if item[3] and item[3] != "null" else None,
                                "sl_price": float(item[4]) if item[4] and item[4] != "null" else None,
                                "exit_plan": item[5] if len(item) > 5 else "",
                                "rationale": item[6] if len(item) > 6 else ""
                            })
                    return {"reasoning": reasoning_text, "summary": summary_text, "trade_decisions": normalized}

                logging.error("trade_decisions missing or invalid; attempting sanitize")
                sanitized = _sanitize_output(content if 'content' in locals() else json.dumps(parsed), assets)
                if sanitized.get("trade_decisions"):
                    return sanitized
                return {"reasoning": reasoning_text, "summary": summary_text, "trade_decisions": []}
            except (json.JSONDecodeError, KeyError, ValueError, TypeError) as e:
                logging.error("JSON parse error: %s, content: %s", e, content[:200])
                # Try sanitizer as last resort
                sanitized = _sanitize_output(content, assets)
                if sanitized.get("trade_decisions"):
                    return sanitized
                return {
                    "reasoning": "Parse error",
                    "summary": "Having trouble processing the market data. Staying flat until next cycle.",
                    "trade_decisions": [{
                        "asset": a,
                        "action": "hold",
                        "allocation_usd": 0.0,
                        "tp_price": None,
                        "sl_price": None,
                        "exit_plan": "",
                        "rationale": "Parse error"
                    } for a in assets]
                }

        return {
            "reasoning": "tool loop cap",
            "summary": "Analysis taking too long. Staying flat until next cycle.",
            "trade_decisions": [{
                "asset": a,
                "action": "hold",
                "allocation_usd": 0.0,
                "tp_price": None,
                "sl_price": None,
                "exit_plan": "",
                "rationale": "tool loop cap"
            } for a in assets]
        }
