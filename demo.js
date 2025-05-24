// Welcome to the JavaScript Backtesting Studio!
// This example strategy demonstrates Long and Short entries using SMA crossover.
// IMPORTANT: Decisions are made based on the close of the *previous* candle.

// --- Strategy Configuration ---
const SHORT_SMA_PERIOD = 10;
const LONG_SMA_PERIOD = 30;
const STOP_LOSS_PCT = 0.02;    // 2% stop-loss
const TAKE_PROFIT_PCT = 0.05;  // 5% take-profit
const ORDER_SIZE_PCT = 0.5;    // Use 50% of available capital per trade (if Fixed Trade Amount is not set or 0)

// --- Optional: initialize ---
// Called once at the start of the backtest.
// Use 'context' to store variables that persist across candles.
function initialize(context) {
    context.short_sma_period = SHORT_SMA_PERIOD;
    context.long_sma_period = LONG_SMA_PERIOD;
    context.prices = []; 
    context.short_sma_values = []; // Stores SMA calculated using close of candle at index i
    context.long_sma_values = [];  // Stores SMA calculated using close of candle at index i
    
    context.stop_loss_percent = STOP_LOSS_PCT; 
    context.take_profit_percent = TAKE_PROFIT_PCT;
    context.order_size_percent = ORDER_SIZE_PCT;

    log("Strategy Initialized: JS SMA Crossover (Long/Short)");
    log(`Short SMA: ${context.short_sma_period}, Long SMA: ${context.long_sma_period}`);
    if (context.stop_loss_percent) log("Stop-Loss: " + (context.stop_loss_percent * 100) + "%");
    if (context.take_profit_percent) log("Take-Profit: " + (context.take_profit_percent * 100) + "%");
    log("Default Order Size (percentage): " + (context.order_size_percent * 100) + "% of equity (if Fixed Trade Amount is 0)");
}

// --- Required: handle_data ---
// Called for each historical candle. Populates indicator values.
// context.short_sma_values[i] will be the SMA including all_candles[i].close
function handle_data(context, current_candle_index, all_candles) {
    const current_candle = all_candles[current_candle_index];
    context.prices.push(current_candle.close);

    if (context.prices.length >= context.short_sma_period) {
        context.short_sma_values.push(calculate_sma(context.prices, context.short_sma_period));
    } else {
        context.short_sma_values.push(null); // Not enough data yet
    }

    if (context.prices.length >= context.long_sma_period) {
        context.long_sma_values.push(calculate_sma(context.prices, context.long_sma_period));
    } else {
        context.long_sma_values.push(null); // Not enough data yet
    }
}

// --- Required: check_entry ---
// Called after handle_data if no position is held.
// Decision for candle 'current_candle_index' (to trade at its open) is based on
// data from 'current_candle_index - 1' (most recent close) and 'current_candle_index - 2'.
function check_entry(context, current_candle_index, all_candles) {
    if (context.position_held) { 
        return false; 
    }

    // We need at least two previous candles' SMAs for a crossover.
    // Index for most_recently_closed_candle's SMA: current_candle_index - 1
    // Index for candle_before_that's SMA: current_candle_index - 2
    if (current_candle_index < 2) { 
        // Not enough historical candles for sma[i-1] and sma[i-2]
        return false;
    }

    const sma_idx_current = current_candle_index - 1;
    const sma_idx_prev = current_candle_index - 2;

    const short_sma_current = context.short_sma_values[sma_idx_current];
    const long_sma_current = context.long_sma_values[sma_idx_current];
    const short_sma_prev = context.short_sma_values[sma_idx_prev];
    const long_sma_prev = context.long_sma_values[sma_idx_prev];

    if (short_sma_current === null || long_sma_current === null || short_sma_prev === null || long_sma_prev === null) {
        return false; // SMA data not available yet for the required candles
    }

    const current_candle_open_price = all_candles[current_candle_index].open;

    // LONG entry: Short SMA (of prev closed candle) crossed above Long SMA (of prev closed candle)
    if (short_sma_current > long_sma_current && short_sma_prev <= long_sma_prev) {
        log(`Decision based on candle ${sma_idx_current} close. Signal LONG entry for current candle ${current_candle_index} at open price ${current_candle_open_price.toFixed(2)}`);
        return { signal: 'BUY', sizePercent: context.order_size_percent }; 
    }

    // SHORT entry: Short SMA (of prev closed candle) crossed below Long SMA (of prev closed candle)
    if (short_sma_current < long_sma_current && short_sma_prev >= long_sma_prev) {
        log(`Decision based on candle ${sma_idx_current} close. Signal SHORT entry for current candle ${current_candle_index} at open price ${current_candle_open_price.toFixed(2)}`);
        return { signal: 'SELL_SHORT', sizePercent: context.order_size_percent };
    }
    
    return false;
}

// --- Required: check_exit ---
// Called after handle_data if a position is held AND stop-loss/take-profit were NOT triggered. 
// Decision for candle 'current_candle_index' (to trade at its open) is based on
// data from 'current_candle_index - 1' (most recent close) and 'current_candle_index - 2'.
function check_exit(context, current_candle_index, all_candles) {
    if (!context.position_held) {
        return false; 
    }

    if (current_candle_index < 2) {
        return false;
    }

    const sma_idx_current = current_candle_index - 1;
    const sma_idx_prev = current_candle_index - 2;

    const short_sma_current = context.short_sma_values[sma_idx_current];
    const long_sma_current = context.long_sma_values[sma_idx_current];
    const short_sma_prev = context.short_sma_values[sma_idx_prev];
    const long_sma_prev = context.long_sma_values[sma_idx_prev];

    if (short_sma_current === null || long_sma_current === null || short_sma_prev === null || long_sma_prev === null) {
        return false; // SMA data not available yet
    }
    
    const current_candle_open_price = all_candles[current_candle_index].open;

    // Exit LONG: Short SMA (of prev closed candle) crosses below Long SMA (of prev closed candle)
    if (context.position_type === 'LONG' && short_sma_current < long_sma_current && short_sma_prev >= long_sma_prev) {
        log(`Decision based on candle ${sma_idx_current} close. Signal EXIT LONG for current candle ${current_candle_index} at open price ${current_candle_open_price.toFixed(2)}`);
        return true;
    }

    // Exit SHORT: Short SMA (of prev closed candle) crosses above Long SMA (of prev closed candle)
    if (context.position_type === 'SHORT' && short_sma_current > long_sma_current && short_sma_prev <= long_sma_prev) {
        log(`Decision based on candle ${sma_idx_current} close. Signal EXIT SHORT for current candle ${current_candle_index} at open price ${current_candle_open_price.toFixed(2)}`);
        return true;
    }
    
    return false;
}

// --- Helper Functions ---
function calculate_sma(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((acc, val) => acc + val, 0);
    return sum / period;
}

// log("This is a log message from the strategy.");
// context.position_type will be 'LONG' or 'SHORT', set by the backtester.
// context.position_held will be true/false, set by the backtester.
