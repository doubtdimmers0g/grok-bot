const fs = require('fs').promises;

const POSITION_FILE = 'position.json';
const PNL_FILE = 'pnl.json';

// Load with error handling
async function loadFiles() {
  let currentPosition = { open: false };
  let pnlData = { cumulative: 0, trades: [] };

  try {
    currentPosition = JSON.parse(await fs.readFile(POSITION_FILE));
  } catch (err) {
    console.error('Position load error:', err.message);
  }

  try {
    pnlData = JSON.parse(await fs.readFile(PNL_FILE));
  } catch (err) {
    console.error('PnL load error:', err.message);
  }

  return { currentPosition, pnlData };
}

// Save with error handling
async function saveFiles(currentPosition, pnlData) {
  try {
    await fs.writeFile(POSITION_FILE, JSON.stringify(currentPosition, null, 2));
  } catch (err) {
    console.error('Position save error:', err.message);
  }

  try {
    await fs.writeFile(PNL_FILE, JSON.stringify(pnlData, null, 2));
  } catch (err) {
    console.error('PnL save error:', err.message);
  }
}

async function getPositionContext(price) {
  const { currentPosition } = await loadFiles();
  if (!currentPosition.open) return 'No open position';
  const unrealized = (price - currentPosition.entry) * (currentPosition.sizeUsd / currentPosition.entry);
  return `Open: $${currentPosition.sizeUsd} at $${currentPosition.entry.toFixed(2)}, now $${price.toFixed(2)} (unrealized ~$${unrealized.toFixed(2)})`;
}

async function handleBuy(sizeUsd = 75, entryPrice) {
  sizeUsd = sizeUsd || 75;
  let { currentPosition, pnlData } = await loadFiles();
  currentPosition = {
    open: true,
    entry: entryPrice,
    sizeUsd: sizeUsd,
    time: new Date().toISOString()
  };
  await saveFiles(currentPosition, pnlData);
  return `<b>Paper BUY</b>: $${sizeUsd} at $${entryPrice.toFixed(2)}`;
}

async function handleSell(exitPrice) {
  let { currentPosition, pnlData } = await loadFiles();
  if (!currentPosition.open) return 'No position to sell';

  const profit = (exitPrice - currentPosition.entry) * (currentPosition.sizeUsd / currentPosition.entry);
  pnlData.trades.push({
    entry: currentPosition.entry,
    exit: exitPrice,
    sizeUsd: currentPosition.sizeUsd,
    profit: profit.toFixed(2),
    time: new Date().toISOString()
  });
  pnlData.cumulative = (parseFloat(pnlData.cumulative) + profit).toFixed(2);

  currentPosition.open = false;
  await saveFiles(currentPosition, pnlData);

  return `<b>Paper SELL</b>: $${currentPosition.sizeUsd} at $${exitPrice.toFixed(2)}\nProfit: $${profit.toFixed(2)}\nCumulative: $${pnlData.cumulative}`;
}

module.exports = { getPositionContext, handleBuy, handleSell };
