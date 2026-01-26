# Rez 

Rez is an AI-powered autonomous trading system designed for the Hyperliquid decentralized exchange. It integrates advanced Large Language Models (LLMs) with real-time market data and technical indicators to execute sophisticated trading strategies with automated risk management.

## Core Components

### Trading Agent
The heart of Rez Computation is its autonomous trading agent. It utilizes a Reasoning and Acting (ReAct) loop to:
- Analyze Market Data: Ingests real-time price action and technical indicators.
- LLM Reasoning: Leverages GPT-4o to evaluate market conditions and form a trading thesis.
- Autonomous Execution: Executes trades including buys, sells, and position management directly on-chain.
- Dynamic Tool-Calling: Fetches additional technical data on-demand during the decision process.

### Monitoring Dashboard
A real-time, web-based dashboard provides full visibility into the system's operations:
- Live Performance: Track PnL, open positions, and account balance in real-time.
- Reasoning Logs: View the "Internal Monologue" of the AI agent for every trade decision.
- Transaction History: Audit all fills and order placements on the Hyperliquid exchange.
- Track Record : Additional stats like win rate, average trade, volume etc. for records.

## Architectural Orchestration

Rez operates as a synchronized ecosystem where deterministic data meets stochastic reasoning. The orchestration follows a continuous, multi-stage lifecycle:

1.  Data Ingestion & Normalization: The backend continuously polls market data (OHLCV klines) from external sources. It calculates technical indicators (RSI, EMA, MACD, ATR) locally using a high-precision calculation engine, ensuring the data is "warmed up" and mathematically accurate.
2.  Context Synthesis: This raw market data is combined with the current account state (equity, position size, PnL) and injected into a structured "Context Payload."
3.  The ReAct Reasoning Loop: 
    - The Trading Agent dispatches this context to a high-reasoning LLM (e.g., GPT-4o).
    - The LLM performs an internal "Chain of Thought" analysis. If it needs more specific data to confirm a signal, it uses Tool-Calling to query the backend for targeted technical indicators.
    - This recursive loop repeats until the model reaches a high-confluence trade decision.
4.  On-Chain Execution: Once a decision is reached (Buy/Sell/Close), the backend translates the thesis into signed transactions on the Hyperliquid exchange, immediately followed by sub-second placement of Take-Profit and Stop-Loss trigger orders.
5.  State Persistence & Visualization: Every detail of the cycle—from the raw prompt to the agent's verbose reasoning and the final execution results—is streamed to a local diary.jsonl store. The Monitoring Dashboard consumes this stream via an API, providing the end-user with a real-time window into the agent's mind and performance.

## Tech Stack

- Backend: Python-based asynchronous trading engine.
- Frontend: Next.js & React-powered monitoring interface with advanced 3D visualizations, with realtime market data from [Trading View](https://www.tradingview.com/).
- AI Engine: Integrated with multiple LLMs via OpenRouter for high-fidelity reasoning.
- Infrastructure: Optimized for deployment in Trusted Execution Environments (TEE) like EigenCloud.
- Exchange Interface: Native integration with the Hyperliquid SDK (testnet).