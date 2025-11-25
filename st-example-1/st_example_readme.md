# Binance Sumtyme Tracker - Real-Time Causal Chain Detection

A live market tracker that connects real-time data from Binance to **sumtyme.ai's Causal Intelligence Layer (CIL)** to detect and track causal chains - the earliest internal signals that precede large-scale directional changes in market dynamics.

## 🎯 Purpose

This tracker demonstrates how to:

1. **Stream real-time OHLC** (Open-High-Low-Close) data from Binance
2. **Feed live data** into sumtyme.ai's causal intelligence API
3. **Detect first internal shifts** that signal upcoming directional changes
4. **Track propagation** of these shifts through multiple timeframes (e.g., 1m → 3m → 5m → 15m)

The result is a **live causal map** of the market, showing not only *what* is changing, but *why* and *how* those changes evolve across time.

## 🧠 What is Causal Intelligence?

Traditional forecasting models predict what might happen next using correlations in historical data. **sumtyme.ai instead identifies why change is forming**, mapping the real-time flow of cause and effect within the system itself.

This enables:
- ⚡ **Early warnings** before observable change appears
- 🔍 **Separation of noise from signal** - distinguishing short-term fluctuations from structural shifts
- 📊 **Continuous insight** into whether a movement is forming, propagating, or decaying

> We don't predict the future; we understand how the future is forming.

## 📋 Prerequisites

- **Python 3.9+**
- **Sumtyme.ai API Key** - Get yours at [sumtyme.ai](https://sumtyme.ai)
- **Internet connection** for Binance WebSocket and REST API access

## 🚀 Installation

### 1. Install Required Packages

```bash
pip install sumtyme pandas numpy websockets requests
```

Or use the requirements file:

```bash
pip install -r requirements.txt
```

**requirements.txt:**
```txt
sumtyme>=1.0.0
pandas==2.2.3
numpy==2.2.1
websockets==13.1
requests==2.32.3
```

### 2. Get Your Sumtyme API Key

1. Visit [sumtyme.ai](https://sumtyme.ai)
2. Sign up for an account
3. Generate your API key
4. Copy the key for use in configuration

## ⚙️ Configuration

Edit the `main()` function in `st-example-1.py`:

```python
def main():
    # Configuration
    TICKER = "BTCUSDT"  # Any valid Binance trading pair
    TIMEFRAMES = ['1m', '3m', '5m', '15m']  # List of timeframes to monitor
    API_KEY = "your-sumtyme-api-key-here"  # Your actual API key
    
    # Create tracker instance
    tracker = BinanceSumtymeTracker(
        ticker=TICKER,
        timeframes=TIMEFRAMES,
        api_key=API_KEY
    )
    
    # Run the tracker
    asyncio.run(tracker.run())
```

### Supported Timeframes

Any valid Binance interval format:
- **Seconds**: `1s`, `5s`, etc. (not commonly used)
- **Minutes**: `1m`, `3m`, `5m`, `15m`, `30m`
- **Hours**: `1h`, `2h`, `4h`, `6h`, `8h`, `12h`
- **Days**: `1d`, `3d`
- **Weeks**: `1w`
- **Months**: `1M`

### Popular Tickers

- `BTCUSDT` - Bitcoin
- `ETHUSDT` - Ethereum
- `ADAUSDT` - Cardano
- `SOLUSDT` - Solana
- `BNBUSDT` - Binance Coin
- `XRPUSDT` - Ripple

## 🎮 Usage

### Basic Usage

```bash
python st-example-1.py
```

### What Happens When You Run It

1. **Initialization**
   ```
   Initializing Binance Sumtyme Tracker...
   ```

2. **Historical Data Loading**
   ```
   Fetching historical data...
   Fetching data for 1m...
   Loaded 5000 historical data points for 1m
   Fetching data for 3m...
   Loaded 5000 historical data points for 3m
   ...
   ```
   - Fetches 5,000 historical candles for each timeframe
   - This provides baseline system behavior for causal analysis

3. **WebSocket Connection**
   ```
   Starting websocket connections...
   Connecting to websocket for 1m...
   Connected to websocket for 1m
   ...
   ```
   - Opens live connections to Binance for each timeframe

4. **Real-Time Processing**
   ```
   [1m] New candle: 2025-11-25 12:34:00
   [1m] Updated chain_detected at 2025-11-25 12:34:00: 1
   [3m] New candle: 2025-11-25 12:36:00
   [3m] Updated chain_detected at 2025-11-25 12:36:00: 1
   ...
   ```
   - Processes each closed candle in real-time
   - Sends data to sumtyme.ai for causal analysis
   - Displays detected causal chains

## 📊 Understanding the Output

### Causal Chain Values

The tracker outputs a **causal chain signal** for each timeframe:

| Value | Meaning | Interpretation |
|-------|---------|----------------|
| `+1` | **Positive causal chain** | Emerging upward movement detected |
| `-1` | **Negative causal chain** | Emerging downward movement detected |
| `0` | **No active chain** | No emerging movement detected |

> **Important**: These are NOT price predictions. They represent **causal state changes** - detections of how the system's internal dynamics are changing in real-time.

### Propagation Patterns

#### ✅ Positive Causal Chain (Complete Propagation)
```
[1m] chain_detected: 1
[3m] chain_detected: 1
[5m] chain_detected: 1
[15m] chain_detected: 1
```
- Initial shift at 1m spreads to all longer timeframes
- Indicates **directional evolution** - a larger movement is forming
- Shows early formation of a structural shift

#### ⚠️ Fading Chain (Incomplete Propagation)
```
[1m] chain_detected: -1
[3m] chain_detected: -1
[5m] chain_detected: 0   ← Stopped propagating
[15m] chain_detected: 0
```
- Movement lost momentum before reaching lower frequencies
- **Doesn't mean reversal** - just that the movement's internal structure lost coherence
- Signals approaching end of the move

#### 🔄 Overlapping Chains
```
[1m] chain_detected: -1   ← New negative chain
[3m] chain_detected: 1    ← Old positive chain still active
[5m] chain_detected: 1
[15m] chain_detected: 1
```
- Fresh chain emerges at higher frequency
- Older chain still exists at lower frequencies
- **Multiple independent causal processes** unfolding at different temporal layers
- Does NOT represent a direction flip

## 🔧 How It Works

### 1. Data Gathering

```python
self.fetch_historical_data(timeframe)
```

- Fetches 5,000 most recent candles from Binance REST API
- Collects: `datetime`, `open`, `high`, `low`, `close`
- Final row is a placeholder (zeros) for the next interval to be forecasted

### 2. Real-Time Streaming

```python
await self.handle_websocket(timeframe)
```

- Opens WebSocket connection for each timeframe
- When a candle closes, captures new OHLC data
- Triggers `process_forecast()` for causal analysis

### 3. Causal Chain Detection

```python
forecast = self.client.ohlc_forecast(
    data_input=new_dataframe,
    interval=value,
    interval_unit=unit_name,
    reasoning_mode='reactive'
)
```

- Takes latest 5,000 data points
- Adds one future timestamp (blank row) for forecasting
- Sends to sumtyme.ai Causal Intelligence Layer
- Receives causal chain signal: `-1`, `0`, or `+1`

### 4. Propagation Tracking

As each timeframe updates, the tracker builds a **real-time map** of how causal influence flows through the market's internal structure across different time scales.

## 🎨 Design Concepts

| Concept | Meaning |
|---------|---------|
| **Parameter-free** | No hyperparameter tuning needed. Causality derived directly from structure. |
| **Memoryless** | Each inference based purely on current system state, not past learning. |
| **Multi-timeframe network** | Tracks how change propagates from short to long time horizons. |
| **Reactive reasoning mode** | Adapts dynamically to streaming data in real time. |
| **Autonomous detection** | Identifies emerging structural shifts without human labeling or retraining. |

## 📝 Code Structure

```python
class BinanceSumtymeTracker:
    def __init__(self, ticker, timeframes, api_key)
        # Initialize connections and client
        
    def parse_timeframe(self, timeframe)
        # Convert timeframe string to values
        
    def fetch_historical_data(self, timeframe)
        # Get 5,000 historical candles
        
    def calculate_next_timestamp(self, last_datetime, timeframe)
        # Calculate next candle timestamp
        
    async def process_forecast(self, timeframe, new_row)
        # Send data to sumtyme.ai and update chain_detected
        
    async def handle_websocket(self, timeframe)
        # Manage WebSocket connection and process new candles
        
    async def run(self)
        # Main execution loop
```

## 🛠️ Customization

### Monitor Different Timeframes

```python
TIMEFRAMES = ['5m', '15m', '30m', '1h']  # Focus on longer timeframes
```

### Track Different Assets

```python
TICKER = "ETHUSDT"  # Switch to Ethereum
```

### Adjust Data History

Modify the limit in `fetch_historical_data()`:

```python
params = {
    'symbol': self.ticker,
    'interval': interval,
    'limit': 1000  # Binance max per request
}

# Adjust loop to get more/fewer points
for _ in range(5):  # Currently fetches ~5000 points
```

### Change Reasoning Mode

In `process_forecast()`:

```python
forecast = self.client.ohlc_forecast(
    data_input=new_dataframe,
    interval=value,
    interval_unit=unit_name,
    reasoning_mode='reactive'  # or 'proactive'
)
```

**Reasoning Modes:**
- `reactive`: Adapts dynamically to streaming data in real time (recommended for live tracking)
- `proactive`: Alternative mode for different causal detection strategies

## ⚠️ Important Notes

### Data Requirements

- Requires **exactly 5,001 data points** per API call:
  - 5,000 historical candles
  - 1 forecast placeholder (zeros)
- The system analyzes this to form a baseline of system behavior

### API Rate Limits

- Binance has rate limits on API calls
- WebSocket connections are more efficient than REST
- Consider implementing exponential backoff for reconnections

### Network Stability

- Requires stable internet connection
- WebSocket drops are handled but may cause brief interruptions
- Consider implementing automatic reconnection logic for production use

## 🐛 Troubleshooting

### Issue: "Invalid API Key"
```python
# Solution: Check your API key in main()
API_KEY = "your-actual-sumtyme-api-key"  # Not placeholder text
```

### Issue: "Websocket Connection Failed"
```python
# Solution: Check internet connection and Binance availability
# Binance.US may have different endpoints than Binance.com
```

### Issue: "Insufficient Historical Data"
```python
# Solution: Increase fetch attempts or reduce timeframe requirements
for _ in range(10):  # Try more fetches
    # ... fetch logic
```

### Issue: "Timeframe Not Supported"
```python
# Solution: Use valid Binance intervals
# Check: https://binance-docs.github.io/apidocs/spot/en/#public-api-definitions
```

## 📚 Example Output

```bash
Initializing Binance Sumtyme Tracker...

Fetching historical data...
Fetching data for 1m...
Loaded 5000 historical data points for 1m
Fetching data for 3m...
Loaded 5000 historical data points for 3m
Fetching data for 5m...
Loaded 5000 historical data points for 5m
Fetching data for 15m...
Loaded 5000 historical data points for 15m

Starting websocket connections...
Connecting to websocket for 1m...
Connected to websocket for 1m
Connecting to websocket for 3m...
Connected to websocket for 3m
Connecting to websocket for 5m...
Connected to websocket for 5m
Connecting to websocket for 15m...
Connected to websocket for 15m

[1m] New candle: 2025-11-25 14:23:00
[1m] Updated chain_detected at 2025-11-25 14:23:00: 1

[1m] New candle: 2025-11-25 14:24:00
[1m] Updated chain_detected at 2025-11-25 14:24:00: 1

[3m] New candle: 2025-11-25 14:24:00
[3m] Updated chain_detected at 2025-11-25 14:24:00: 1

[1m] New candle: 2025-11-25 14:25:00
[1m] Updated chain_detected at 2025-11-25 14:25:00: 1

[5m] New candle: 2025-11-25 14:25:00
[5m] Updated chain_detected at 2025-11-25 14:25:00: 1

↑ Positive causal chain propagating across timeframes!
```

## 🎓 Learning More

- **Sumtyme.ai Documentation**: Visit [sumtyme.ai](https://sumtyme.ai) for API docs
- **Binance API**: [Binance API Documentation](https://binance-docs.github.io/apidocs/spot/en/)
- **WebSockets in Python**: [websockets library docs](https://websockets.readthedocs.io/)

## 🤝 Contributing

Contributions are welcome! Areas for enhancement:

- [ ] Add automatic reconnection logic
- [ ] Implement data persistence (save to database)
- [ ] Add visualization of causal chains
- [ ] Create alerting system for propagation events
- [ ] Add support for multiple tickers simultaneously
- [ ] Implement backtesting functionality

## 📄 License

This code is provided as an example implementation. Check with sumtyme.ai for API usage terms.

## ⚠️ Disclaimer

This tracker is for **educational and research purposes only**. It demonstrates causal chain detection but should NOT be used as the sole basis for trading decisions. Cryptocurrency trading carries significant risk. Always do your own research and consult with financial professionals before making investment decisions.

---

**Built with sumtyme.ai's Causal Intelligence Layer** - Understanding how the future is forming, not predicting what will happen next.