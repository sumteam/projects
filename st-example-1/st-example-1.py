import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import asyncio
import websockets
import json
import requests
from typing import List, Dict
from sumtyme import EIPClient
import re

class BinanceSumtymeTracker:
    def __init__(self, ticker: str, timeframes: List[str], api_key: str):
        """
        Initialize the tracker with ticker, timeframes, and API key.
        
        Args:
            ticker: Trading pair (e.g., 'BTCUSDT')
            timeframes: List of timeframe strings (e.g., ['1m', '3m', '5m'])
            api_key: Sumtyme.ai API key
        """
        self.ticker = ticker
        self.timeframes = timeframes
        self.dataframes = {}
        self.ws_connections = {}
        
        # Initialize Sumtyme AI client
        self.client = EIPClient(apikey=api_key)
        
        # Binance US API endpoints
        self.rest_api_base = "https://api.binance.us"
        self.ws_base = "wss://stream.binance.us:9443/ws"
        
    def parse_timeframe(self, timeframe: str) -> tuple:
        """Parse timeframe string into value and unit."""
        match = re.match(r'(\d+)([smhdMY])', timeframe)
        if not match:
            raise ValueError(f"Invalid timeframe format: {timeframe}")
        
        value = int(match.group(1))
        unit = match.group(2)
        
        # Map units to full names for sumtyme API
        unit_mapping = {
            's': 'seconds',
            'm': 'minutes',
            'h': 'hours',
            'd': 'days',
            'M': 'months',
            'Y': 'years'
        }
        
        # Map units to Binance API format
        binance_mapping = {
            's': 's',
            'm': 'm',
            'h': 'h',
            'd': 'd',
            'M': 'M',
            'Y': 'Y'  # Note: Binance doesn't support yearly intervals
        }
        
        return value, unit_mapping[unit], binance_mapping[unit]
    
    def get_binance_interval(self, timeframe: str) -> str:
        """Convert timeframe to Binance interval format."""
        value, _, binance_unit = self.parse_timeframe(timeframe)
        return f"{value}{binance_unit}"
    
    def fetch_historical_data(self, timeframe: str) -> pd.DataFrame:
        """Fetch historical OHLC data from Binance US."""
        interval = self.get_binance_interval(timeframe)
        url = f"{self.rest_api_base}/api/v3/klines"
        
        params = {
            'symbol': self.ticker,
            'interval': interval,
            'limit': 1000  # Binance max limit per request
        }
        
        all_data = []
        
        # Fetch multiple batches to get 5000 data points
        for _ in range(5):
            response = requests.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if not data:
                break
            
            all_data.extend(data)
            
            # Update endTime to get earlier data
            params['endTime'] = data[0][0] - 1
            
            if len(all_data) >= 5000:
                break
        
        # Take the most recent 5000 points
        all_data = all_data[-5000:]
        
        # Convert to DataFrame
        df = pd.DataFrame(all_data, columns=[
            'timestamp', 'open', 'high', 'low', 'close', 'volume',
            'close_time', 'quote_volume', 'trades', 'taker_buy_base',
            'taker_buy_quote', 'ignore'
        ])
        
        # Convert timestamp to datetime
        df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms')
        
        # Select and convert required columns
        df = df[['datetime', 'open', 'high', 'low', 'close']].copy()
        df[['open', 'high', 'low', 'close']] = df[['open', 'high', 'low', 'close']].astype(float)
        df['chain_detected'] = None
        
        return df
    
    def calculate_next_timestamp(self, last_datetime: datetime, timeframe: str) -> datetime:
        """Calculate the next timestamp based on timeframe."""
        value, unit_name, _ = self.parse_timeframe(timeframe)
        
        if unit_name == 'seconds':
            return last_datetime + timedelta(seconds=value)
        elif unit_name == 'minutes':
            return last_datetime + timedelta(minutes=value)
        elif unit_name == 'hours':
            return last_datetime + timedelta(hours=value)
        elif unit_name == 'days':
            return last_datetime + timedelta(days=value)
        elif unit_name == 'months':
            # Add months properly
            month = last_datetime.month - 1 + value
            year = last_datetime.year + month // 12
            month = month % 12 + 1
            day = min(last_datetime.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
            return last_datetime.replace(year=year, month=month, day=day)
        elif unit_name == 'years':
            return last_datetime + timedelta(days=value * 365)
        
        return last_datetime
    
    async def process_forecast(self, timeframe: str, new_row: Dict):
        """Process new data and call sumtyme API for forecast."""
        df = self.dataframes[timeframe]
        
        # Append new row to dataframe
        new_df_row = pd.DataFrame([new_row])
        df = pd.concat([df, new_df_row], ignore_index=True)
        self.dataframes[timeframe] = df
        
        # Create new_dataframe with last 5000 points
        last_5000 = df.tail(5000).copy()
        
        # Calculate next timestamp
        last_datetime = last_5000['datetime'].iloc[-1]
        next_datetime = self.calculate_next_timestamp(last_datetime, timeframe)
        
        # Append prediction row
        prediction_row = pd.DataFrame([{
            'datetime': next_datetime,
            'open': 0,
            'high': 0,
            'low': 0,
            'close': 0,
            'chain_detected': None
        }])
        
        new_dataframe = pd.concat([last_5000, prediction_row], ignore_index=True)
        
        # Call sumtyme API
        try:
            value, unit_name, _ = self.parse_timeframe(timeframe)
            
            forecast = self.client.ohlc_forecast(
                data_input=new_dataframe,
                interval=value,
                interval_unit=unit_name,
                reasoning_mode='reactive'
            )
            
            # Extract chain_detected from forecast
            # forecast is expected to be {datetime_string: chain_detected}
            for datetime_string, chain_detected in forecast.items():
                # Update the original dataframe
                mask = df['datetime'] == pd.to_datetime(datetime_string)
                if mask.any():
                    df.loc[mask, 'chain_detected'] = chain_detected
                    print(f"[{timeframe}] Updated chain_detected at {datetime_string}: {chain_detected}")
                    
        except Exception as e:
            print(f"Error calling sumtyme API for {timeframe}: {e}")
    
    async def handle_websocket(self, timeframe: str):
        """Handle websocket connection for a specific timeframe."""
        interval = self.get_binance_interval(timeframe)
        stream_name = f"{self.ticker.lower()}@kline_{interval}"
        ws_url = f"{self.ws_base}/{stream_name}"
        
        print(f"Connecting to websocket for {timeframe}...")
        
        async with websockets.connect(ws_url) as websocket:
            self.ws_connections[timeframe] = websocket
            print(f"Connected to websocket for {timeframe}")
            
            async for message in websocket:
                try:
                    data = json.loads(message)
                    kline = data['k']
                    
                    # Only process when candle is closed
                    if kline['x']:  # x = is this kline closed?
                        new_row = {
                            'datetime': pd.to_datetime(kline['t'], unit='ms'),
                            'open': float(kline['o']),
                            'high': float(kline['h']),
                            'low': float(kline['l']),
                            'close': float(kline['c']),
                            'chain_detected': None
                        }
                        
                        print(f"[{timeframe}] New candle: {new_row['datetime']}")
                        
                        # Process forecast
                        await self.process_forecast(timeframe, new_row)
                        
                except Exception as e:
                    print(f"Error processing websocket message for {timeframe}: {e}")
    
    async def run(self):
        """Main execution function."""
        print("Initializing Binance Sumtyme Tracker...")
        
        # Fetch historical data for all timeframes
        print("\nFetching historical data...")
        for timeframe in self.timeframes:
            print(f"Fetching data for {timeframe}...")
            self.dataframes[timeframe] = self.fetch_historical_data(timeframe)
            print(f"Loaded {len(self.dataframes[timeframe])} historical data points for {timeframe}")
        
        # Start websocket connections for all timeframes
        print("\nStarting websocket connections...")
        tasks = [self.handle_websocket(tf) for tf in self.timeframes]
        
        try:
            await asyncio.gather(*tasks)
        except KeyboardInterrupt:
            print("\nShutting down...")
        except Exception as e:
            print(f"Error in main loop: {e}")


def main():
    """Main entry point."""
    # Configuration
    TICKER = "BTCUSDT"
    TIMEFRAMES = ['1m', '3m', '5m', '15m']
    API_KEY = "your-api-key-here"
    
    # Create tracker instance
    tracker = BinanceSumtymeTracker(
        ticker=TICKER,
        timeframes=TIMEFRAMES,
        api_key=API_KEY
    )
    
    # Run the tracker
    asyncio.run(tracker.run())


if __name__ == "__main__":
    main()