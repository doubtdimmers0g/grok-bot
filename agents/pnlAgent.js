const fs = require('fs');

const POSITION_FILE = 'position.json';
const PNL_FILE = 'pnl.json';

// Init/load files
if (!fs.existsSync(POSITION_FILE)) {
  fs.writeFileSync(POSITION_FILE, JSON.stringify({ open: false }, null, 2));
}
if (!fs.existsSync(PNL_FILE)) {
  fs.writeFileSync(PNL_FILE, JSON.stringify({ cumulative: 0, trades: [] }, null, 2));
}

let currentPosition = JSON.parse(fs.readFileSync(POSITION_FILE));
let pnlData = JSON.parse(fs.readFileSync(PNL_FILE));

function getPositionContext(price) {
  if (!currentPosition.open) return 'No open position';
  const unrealized = (price - currentPosition.entry) * (currentPosition.sizeUsd / currentPosition.entry);
  return `Open: $${currentPosition.sizeUsd} at $${currentPosition.entry.toFixed(2)}, now $${price.toFixed(2)} (unrealized ~$${unrealized.toFixed(2)})`;
}

async function handleBuy(sizeUsd, entryPrice) {
  currentPosition = {
    open: true,
    entry: entryPrice,
    sizeUsd: sizeUsd,
    time: new Date().toISOString()
  };
  fs.writeFileSync(POSITION_FILE, JSON.stringify(currentPosition, null, 2));
  return `<b>Paper BUY</b>: $${sizeUsd} at $${entryPrice.toFixed(2)}`;
}

async function handleSell(exitPrice) {
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
  fs.writeFileSync(PNL_FILE, JSON.stringify(pnlData, null, 2));

  currentPosition.open = false;
  fs.writeFileSync(POSITION_FILE, JSON.stringify(currentPosition, null, 2));

  return `<b>Paper SELL</b>: $${currentPosition.sizeUsd} at $${exitPrice.toFixed(2)}\nProfit: $${profit.toFixed(2)}\nCumulative: $${pnlData.cumulative}`;
}

module.exports = { getPositionContext, handleBuy, handleSell, pnlData };
