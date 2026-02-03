# Overview

Rez is an autonomous AI trading agent for the Hyperliquid decentralized perpetual exchange. Users can deploy intelligent trading strategies without manual intervention.

## What is Rez?

Rez combines Large Language Models (LLMs) with real-time market analysis to execute trades autonomously. The system:

- Analyzes market conditions using technical indicators (RSI, EMA, MACD)
- Makes trading decisions using GPT-4o reasoning
- Executes trades directly on Hyperliquid
- Manages risk with configurable parameters

## Core Components

| Component | Description |
|-----------|-------------|
| Trading Agent | Autonomous decision engine using LLM reasoning |
| Dashboard | Real-time monitoring interface |
| Backend Server | FastAPI service managing agent lifecycle |
| Hyperliquid Integration | Direct on-chain execution via SDK |

## How It Works

1. **Data Ingestion** - Fetches OHLCV data and calculates technical indicators
2. **Context Building** - Combines market data with account state
3. **LLM Analysis** - GPT-4o evaluates conditions and forms trading thesis
4. **Execution** - Places orders on Hyperliquid with TP/SL management
5. **Monitoring** - Streams decisions to dashboard for visibility

## Supported Features

- Multi-asset trading (BTC, ETH, SOL, etc.)
- Configurable intervals (1m, 5m, 15m, 1h)
- Risk profiles (conservative, moderate, aggressive)
- Automatic take-profit and stop-loss
- Real-time P&L tracking
