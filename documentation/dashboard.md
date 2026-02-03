# Dashboard Guide

Real-time monitoring interface for your trading agent.

---

## Main View

### Portfolio Header
- **Account Value** - Total equity in USDC
- **Margin Used** - Collateral locked in positions
- **Unrealized P&L** - Current profit/loss on open positions

### Live Chart
TradingView-powered chart showing price action for selected asset.

### Agent Controls
- **Start Agent** - Deploy with selected configuration
- **Stop Agent** - Terminate trading
- **Close All** - Emergency exit all positions

---

## Configuration Panel

### Assets
Select which perpetuals to trade:
- BTC, ETH, SOL, DOGE, etc.
- Multi-select supported

### Interval
How often the agent analyzes markets:
- `1m` - Every minute (most active)
- `5m` - Every 5 minutes (balanced)
- `15m` - Every 15 minutes
- `1h` - Hourly (conservative)

### Risk Profile
- Conservative / Moderate / Aggressive

---

## Agent Logs

Real-time stream of agent activity:
- Market analysis reasoning
- Trade decisions with thesis
- Order execution results
- Error messages

---

## Positions Table

| Column | Description |
|--------|-------------|
| Asset | Trading pair |
| Side | LONG or SHORT |
| Size | Position quantity |
| Entry | Average entry price |
| Mark | Current market price |
| P&L | Unrealized profit/loss |
| Actions | Close button |

---

## Completed Trades

Historical record of closed positions showing:
- Entry/exit prices
- Realized P&L
- Duration
- Win/loss status

---

## Growth Stats

Aggregate performance metrics:
- Total trades
- Win rate percentage
- Total P&L
- Average trade result
