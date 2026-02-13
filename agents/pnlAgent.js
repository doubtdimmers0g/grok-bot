const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const COINGECKO_KEY = process.env.COINGECKO_API_KEY;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
};

// Load current position (single row table)
async function loadPosition(symbol) {
  try {
    const res = await axios.get(`${SUPABASE_URL}/rest/v1/current_position?symbol=eq.${symbol}&open=eq.true&select=*`, { headers });
    if (res.data.length === 0) {
      return { open: false };
    }
    return res.data[0];
  } catch (err) {
    console.error('Position load error:', err.message);
    return { open: false };
  }
}

// Load trades
async function loadTrades() {
  try {
    const res = await axios.get(`${SUPABASE_URL}/rest/v1/trades?select=*&order=time.desc`, { headers });
    const cumulative = res.data.reduce((sum, trade) => sum + parseFloat(trade.profit || 0), 0);
    return { trades: res.data, cumulative };
  } catch (err) {
    console.error('Trades load error:', err.message);
    return { trades: [], cumulative: 0 };
  }
}

// Save position (upsert)
async function savePosition(position) {
  try {
    if (position.id) {
      await axios.patch(`${SUPABASE_URL}/rest/v1/current_position?id=eq.${position.id}`, position, { headers });
    } else {
      const res = await axios.post(`${SUPABASE_URL}/rest/v1/current_position`, position, { headers });
      position.id = res.data[0].id;
    }
  } catch (err) {
    console.error('Position save error:', err.message);
  }
}

// Add trade
async function addTrade(trade) {
  try {
    await axios.post(`${SUPABASE_URL}/rest/v1/trades`, trade, { headers });
  } catch (err) {
    console.error('Trade save error:', err.message);
  }
}

// Fetch live asset price from CoinGecko
async function getLivePrice(asset) {
  const cgId = asset?.cgId || 'bitcoin';  // define here
  try {
    const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`, {
      headers: { 'x-cg-demo-api-key': COINGECKO_KEY }
    });
    return res.data[cgId.toLowerCase()]?.usd || null;
  } catch (err) {
    console.error('CoinGecko error:', err.message);
    return null;
  }
}

// Position context with live price
async function getPositionContext(signalPrice, symbol) {
  const position = await loadPosition(symbol);
  if (!position.open) return 'No open position';

  const cgId = asset?.cgId || 'bitcoin'
  const livePrice = await getLivePrice(asset) || signalPrice;
  const unrealizedPct = ((livePrice - position.entry) / position.entry * 100).toFixed(1);
  const unrealizedUsd = (livePrice - position.entry) * (position.sizeUsd / position.entry);

    return `Open ${position.symbol}: $${position.sizeUsd.toFixed(0)} at $${position.entry.toFixed(4)}, current ~$${livePrice.toFixed(4)} (unrealized ${unrealizedPct}% / $${unrealizedUsd})`;
}

// Buy
async function handleBuy(sizeUsd = 100, entryPrice, symbol) {
  sizeUsd = sizeUsd || 100;
  const position = {
    open: true,
    entry: entryPrice,
    sizeUsd: sizeUsd,
    time: new Date().toISOString(),
    symbol: symbol
  };
  await savePosition(position);
  return `<b>BOUGHT</b>: $${sizeUsd} at $${entryPrice.toFixed(4)} (${symbol})`;
}

// Sell
async function handleSell(exitPrice, symbol) {
  const position = await loadPosition(symbol);
  if (!position.open) return 'No position open for this asset';

  const livePrice = await getLivePrice(asset) || exitPrice;
  const profit = (livePrice - position.entry) * (position.sizeUsd / position.entry);

  const trade = {
    entry: position.entry,
    exit: livePrice,
    sizeUsd: position.sizeUsd,
    profit: profit.toFixed(2),
    time: new Date().toISOString()
  };
  await addTrade(trade);
  
    // Explicit patch of existing row
  const closedPosition = {
    id: position.id,  // key for patch
    open: false,
    entry: null,
    sizeUsd: 0,
    time: null,
    symbol: position.symbol
  };
  await savePosition(closedPosition);

  const { cumulative } = await loadTrades();

  return `<b>SOLD</b>: $${position.sizeUsd} at $${livePrice.toFixed(2)}\nProfit: $${profit.toFixed(2)}\nCumulative: $${cumulative.toFixed(2)}`;
}

module.exports = { getPositionContext, handleBuy, handleSell };
