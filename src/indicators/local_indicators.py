"""Local technical indicator calculation using Binance data and pandas-ta."""

import requests
import pandas as pd
import pandas_ta as ta
import logging
from typing import List, Optional


class LocalIndicatorCalculator:
    """Calculate technical indicators locally using real Binance OHLCV data."""

    def __init__(self):
        """Initialize Binance API client."""
        self.base_url = "https://api.binance.com/api/v3"

    def _fetch_klines(self, symbol: str, interval: str, limit: int = 100) -> pd.DataFrame:
        """Fetch OHLCV data from Binance and convert to DataFrame.

        Args:
            symbol: Trading pair (e.g., 'BTCUSDT')
            interval: Candle interval (e.g., '5m', '1h', '4h')
            limit: Number of candles to fetch (max 1000)

        Returns:
            DataFrame with columns: timestamp, open, high, low, close, volume
        """
        try:
            url = f"{self.base_url}/klines"
            params = {
                "symbol": symbol,
                "interval": interval,
                "limit": limit
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            # Parse Binance kline format
            df = pd.DataFrame(data, columns=[
                'timestamp', 'open', 'high', 'low', 'close', 'volume',
                'close_time', 'quote_volume', 'trades',
                'taker_buy_base', 'taker_buy_quote', 'ignore'
            ])

            # Convert to proper types
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = df[col].astype(float)

            # Keep only needed columns
            df = df[['timestamp', 'open', 'high', 'low', 'close', 'volume']]
            df.set_index('timestamp', inplace=True)

            return df

        except Exception as e:
            logging.error(f"Failed to fetch klines for {symbol} {interval}: {e}")
            return pd.DataFrame()

    def fetch_series(
        self,
        indicator: str,
        symbol: str,
        interval: str,
        results: int = 10,
        params: Optional[dict] = None,
        value_key: str = "value"
    ) -> List[float]:
        """Calculate indicator series using local data.

        Args:
            indicator: Indicator name ('ema', 'rsi', 'macd', etc.)
            symbol: Trading pair in TAAPI format ('BTC/USDT')
            interval: Candle interval
            results: Number of values to return
            params: Indicator parameters (e.g., {'period': 20})
            value_key: Which column to extract (for compatibility)

        Returns:
            List of indicator values (most recent last)
        """
        try:
            # Convert symbol format from 'BTC/USDT' to 'BTCUSDT'
            binance_symbol = symbol.replace('/', '')

            # Fetch enough candles to calculate indicator properly
            # For indicators like EMA we need warmup period
            fetch_limit = max(100, results * 3)
            df = self._fetch_klines(binance_symbol, interval, fetch_limit)

            if df.empty:
                return []

            # Calculate indicator using pandas-ta
            if indicator == "ema":
                period = params.get('period', 20) if params else 20
                df.ta.ema(length=period, append=True)
                col_name = f"EMA_{period}"

            elif indicator == "rsi":
                period = params.get('period', 14) if params else 14
                df.ta.rsi(length=period, append=True)
                col_name = f"RSI_{period}"

            elif indicator == "macd":
                df.ta.macd(append=True)
                # Return MACD line (not signal or histogram)
                col_name = "MACD_12_26_9"

            elif indicator == "atr":
                period = params.get('period', 14) if params else 14
                df.ta.atr(length=period, append=True)
                col_name = f"ATRr_{period}"

            else:
                logging.warning(f"Unsupported indicator: {indicator}")
                return []

            # Extract the calculated values
            if col_name not in df.columns:
                logging.error(f"Column {col_name} not found after calculation")
                return []

            values = df[col_name].dropna().tail(results).tolist()

            # Round to 4 decimals for consistency with TAAPI
            return [round(v, 4) for v in values]

        except Exception as e:
            logging.error(f"Error calculating {indicator} for {symbol}: {e}")
            return []

    def fetch_value(
        self,
        indicator: str,
        symbol: str,
        interval: str,
        params: Optional[dict] = None,
        key: str = "value"
    ) -> Optional[float]:
        """Calculate single indicator value (most recent).

        Args:
            indicator: Indicator name
            symbol: Trading pair in TAAPI format
            interval: Candle interval
            params: Indicator parameters
            key: Not used, for compatibility

        Returns:
            Most recent indicator value or None
        """
        try:
            series = self.fetch_series(indicator, symbol, interval, results=1, params=params)
            return series[-1] if series else None
        except Exception as e:
            logging.error(f"Error fetching value for {indicator}: {e}")
            return None
