# API Reference

Backend REST API for managing trading agents.

**Base URL:** `http://localhost:8000`

---

## Agent Lifecycle

### Start Agent

Deploys a new trading agent for your session.

```
POST /start-agent
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string | Your wallet address |
| `assets` | string[] | Assets to trade: `["BTC", "ETH"]` |
| `interval` | string | `"1m"`, `"5m"`, `"15m"`, `"1h"` |
| `risk_profile` | string | `"conservative"`, `"moderate"`, `"aggressive"` |
| `private_key` | string | Wallet private key |
| `public_key` | string | Wallet public address |

**Response:**
```json
{
  "success": true,
  "message": "Agent started",
  "session_id": "0x...",
  "assets": ["BTC", "ETH"],
  "interval": "5m"
}
```

---

### Stop Agent

Terminates a running agent.

```
POST /stop-agent
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `session_id` | string | Your wallet address |

---

### Get Status

Returns agent state and configuration.

```
GET /agent-status/{session_id}
```

**Response:**
```json
{
  "running": true,
  "paused": false,
  "started_at": "2025-01-31T22:00:00Z",
  "assets": ["BTC", "ETH"],
  "interval": "5m",
  "risk_profile": "moderate"
}
```

---

### Get Logs

Fetches agent activity logs.

```
GET /logs/{session_id}?limit=100
```

---

## Position Management

### Close Position

Closes a specific position.

```
POST /close-position
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `asset` | string | Asset symbol: `"BTC"` |
| `private_key` | string | Wallet private key |
| `public_key` | string | Wallet address |
| `size` | float | Position size (optional, improves speed) |
| `side` | string | `"LONG"` or `"SHORT"` (optional) |

---

### Close All

Closes all open positions.

```
POST /close-all
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `private_key` | string | Wallet private key |
| `public_key` | string | Wallet address |

---

## Health

```
GET /health
```

Returns `{"status": "healthy"}` when server is operational.
