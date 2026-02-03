# Rez Documentation

Autonomous AI Trading Agent for Hyperliquid

---

## Introduction

- [Overview](overview.md) - What is Rez and how it works
- [Getting Started](getting-started.md) - Installation and first trade

## Using Rez

- [Dashboard Guide](dashboard.md) - Monitoring interface walkthrough
- [Core Concepts](concepts.md) - Decision engine, indicators, risk profiles

## Developers

- [API Reference](api-reference.md) - Backend REST endpoints

## Support

- [Troubleshooting](troubleshooting.md) - Common issues and solutions

---

## Quick Links

| Resource | Description |
|----------|-------------|
| Backend | `http://localhost:8000` |
| Dashboard | `http://localhost:3000` |
| Server Logs | `/tmp/rez_server.log` |
| Agent Logs | `/tmp/rez_logs/{wallet}.log` |

---

## Tech Stack

- **Backend:** Python, FastAPI, Hyperliquid SDK
- **Frontend:** Next.js, React, TailwindCSS
- **AI:** OpenRouter (GPT-4o)
- **Exchange:** Hyperliquid Testnet
