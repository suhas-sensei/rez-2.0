# Core Concepts

Understanding how Rez makes trading decisions.

---

## Decision Engine

The agent uses a ReAct (Reasoning + Acting) loop:

1. **Observe** - Gather market data, positions, indicators
2. **Think** - LLM analyzes context and forms thesis
3. **Act** - Execute trade or hold
4. **Reflect** - Log outcome for learning

---

## Technical Indicators

Rez calculates these indicators in real-time:

| Indicator | Timeframes | Usage |
|-----------|------------|-------|
| RSI | 5m, 4h | Overbought/oversold detection |
| EMA | 5m, 4h | Trend direction |
| MACD | 5m, 4h | Momentum and crossovers |
| ATR | 5m | Volatility measurement |

---

## Risk Profiles

### Conservative
- Smaller position sizes
- Tighter stop-losses
- Focus on high-confluence setups

### Moderate
- Balanced risk/reward
- Standard position sizing
- Accepts moderate drawdowns

### Aggressive
- Larger positions
- Wider stops
- Pursues higher returns

---

## Position Management

### Entry
Market orders with slippage tolerance (default 5%).

### Take Profit
Trigger orders placed automatically based on risk/reward ratio.

### Stop Loss
Protective orders to limit downside.

### Exit
Positions can be closed:
- Automatically by TP/SL triggers
- Manually via dashboard
- By agent decision based on market change

---

## Data Flow

```
Market Data → Indicators → Context Builder → LLM → Decision → Execution
                              ↑                         ↓
                         Account State ←──────── Reconciliation
```

---

## Session Management

Each wallet address is a unique session. The backend:

- Persists agent configuration across restarts
- Maintains one agent per session
- Syncs state across multiple browser tabs
- Stores trade history in per-user diary files
