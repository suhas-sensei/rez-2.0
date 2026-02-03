# Troubleshooting

Common issues and solutions.

---

## Rate Limited

**Error:** `Rate limited` toast appears

**Cause:** Hyperliquid API rate limits exceeded

**Solution:**
- Wait 1-2 minutes before retrying
- Avoid clicking buttons multiple times
- Rate limit resets based on trading volume

---

## Price Too Far From Oracle

**Error:** `Price too far from oracle`

**Cause:** Market volatility exceeds slippage tolerance

**Solution:**
- Wait for market to stabilize
- Try closing position again
- Backend uses 15% slippage to handle most cases

---

## Position Won't Close

**Symptoms:** Close button clicked but position remains

**Causes:**
1. Rate limited - wait and retry
2. Network latency - check server logs
3. Insufficient margin for closing order

**Debug:**
```bash
tail -50 /tmp/rez_server.log | grep -i close
```

---

## Agent Not Starting

**Error:** 500 Internal Server Error

**Check:**
1. Backend server is running: `ps aux | grep server.py`
2. Environment variables set in `.env`
3. Valid API keys configured

**Restart server:**
```bash
pkill -f "python src/server.py"
python src/server.py
```

---

## Balance Shows Incorrect Value

**Symptoms:** Dashboard shows $999 or stale balance

**Cause:** Fallback to cached data when live fetch fails

**Solution:**
- Ensure agent is running for live updates
- Check Hyperliquid testnet status
- Verify wallet address is correct

---

## Cross-Browser Sync Issues

**Symptoms:** Different state in Chrome vs Firefox

**How it works:**
- Backend is source of truth
- Frontend polls every 5 seconds
- Wallet address identifies session

**Solution:**
- Wait for next poll cycle
- Refresh the page
- Verify same wallet connected in both browsers

---

## Server Logs

View real-time server activity:
```bash
tail -f /tmp/rez_server.log
```

Agent logs per session:
```bash
tail -f /tmp/rez_logs/{wallet_address}.log
```
