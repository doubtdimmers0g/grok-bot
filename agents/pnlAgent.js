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

// Load by symbol (multiple concurrent across symbols)
async function loadPosition(symbol) {
  try {
    const res = await axios.get(`${SUPABASE_URL}/rest/v1/current_position?symbol=eq.${symbol}&select=*`, { headers });
    if (res.data.length === 0) return { open: false };
    return res.data[0];  // one per symbol (index enforces)
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

// Save/upsert (by ID or new)
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

// getPositionContext (per symbol)
async function getPositionContext(signalPrice, symbol, asset) {
  const position = await loadPosition(symbol);
  if (!position.open) return `Flat on ${symbol} - no open position`;

  const livePrice = await getLivePrice(asset) || signalPrice;

  const unrealizedPct = ((livePrice - position.entry) / position.entry * 100).toFixed(1);
  const unrealizedUsd = ((livePrice - position.entry) * (position.sizeUsd / position.entry)).toFixed(2);

  return `Open ${symbol}: $${position.sizeUsd.toFixed(0)} at $${position.entry.toFixed(4)}, current ~$${livePrice.toFixed(4)} (unrealized ${unrealizedPct}% / $${unrealizedUsd})`;
}
// handleBuy (skip if already open on symbol)
async function handleBuy(sizeUsd = 100, entryPrice, symbol) {
  const position = await loadPosition(symbol);
  if (position.open) return `Already open on ${symbol} - skipping add`;

  const newPosition = {
    open: true,
    entry: entryPrice,
    sizeUsd: sizeUsd,
    time: new Date().toISOString(),
    symbol: symbol
  };
  await savePosition(newPosition);
  return `<b>BOUGHT</b>: $${sizeUsd} at $${entryPrice.toFixed(4)} (${symbol})`;
}

// handleSell (only if open on symbol)
async function handleSell(exitPrice, symbol, asset) {
  const position = await loadPosition(symbol);
  if (!position.open) return `No open position on ${symbol} to sell`;

  const livePrice = await getLivePrice(asset) || exitPrice;

  const profit = (livePrice - position.entry) * (position.sizeUsd / position.entry);

  const trade = {
    entry: position.entry,
    exit: livePrice,
    sizeUsd: position.sizeUsd,
    profit: profit.toFixed(2),
    time: new Date().toISOString(),
    symbol: symbol
  };
  await addTrade(trade);

  const closedPosition = {
    id: position.id,
    open: false,
    entry: null,
    sizeUsd: 0,
    time: null,
    symbol: symbol
  };
  await savePosition(closedPosition);

  const { cumulative } = await loadTrades();

  return `<b>SOLD</b>: $${position.sizeUsd.toFixed(0)} at $${livePrice.toFixed(4)} (${symbol})\nProfit: $${profit.toFixed(2)}\nCumulative: $${cumulative.toFixed(2)}`;
}

module.exports = { getPositionContext, handleBuy, handleSell };
