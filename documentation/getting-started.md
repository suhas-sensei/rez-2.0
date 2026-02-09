# Getting Started

This guide walks through setting up and running Rez on Hyperliquid testnet.

## Prerequisites

- Python 3.11+
- Node.js 18+
- Hyperliquid testnet wallet with funds

## Installation

### Backend Setup

```bash
# Clone repository
git clone https://github.com/your-repo/rez.git
cd rez

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
# Hyperliquid Configuration
HYPERLIQUID_NETWORK=testnet
HYPERLIQUID_PRIVATE_KEY=your_private_key
HYPERLIQUID_ACCOUNT_ADDRESS=your_wallet_address

# LLM Configuration
OPENROUTER_API_KEY=your_openrouter_key
LLM_MODEL=gpt-4o
```

## Running the Application

### Start Backend Server

```bash
python src/server.py
```

The backend runs on `http://localhost:8000`.

### Start Frontend Dashboard

```bash
cd frontend
npm run dev
```

The dashboard runs on `http://localhost:3000`.

## First Trade

1. Open the dashboard at `http://localhost:3000`
2. Connect your wallet using the invite code
3. Select trading assets (e.g., BTC, ETH)
4. Choose interval and risk profile
5. Click "Start Agent"

The agent will begin analyzing markets and executing trades based on LLM decisions.

## Testnet Funds

Get testnet funds from the Hyperliquid testnet faucet before trading.
