const axios = require('axios');

async function getBTCData() {
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true');
    const btc = res.data.bitcoin;
    return {
      price: btc.usd,
      marketCap: btc.usd_market_cap,
      volume24h: btc.usd_24h_vol,
      change24h: btc.usd_24h_change
    };
  } catch (err) {
    console.error('CoinGecko error:', err.message);
    return null;
  }
}

module.exports = { getBtcData };