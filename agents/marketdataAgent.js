const axios = require('axios');

const COINGECKO_KEY = process.env.COINGECKO_API_KEY;

async function getMarketReasoning(grok, asset = { cgId: 'bitcoin', name: 'Bitcoin' }) {
  try {
    const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${asset.cgId}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`, {
      headers: {
        'x-cg-demo-api-key': COINGECKO_KEY
      }
    });
    const data = res.data[asset.cgId.toLowerCase()];  // dynamic key

    const prompt = `Analyze current crypto market data for trading context.

Data:
- Price: $${data.usd.toFixed(2)}
- 24h change: ${data.usd_24h_change.toFixed(2)}%
- 24h volume: $${data.usd_24h_vol.toFixed(0)}

Think step by step:
1. Price action: Uptrend, downtrend, or neutral?
2. Volume: Spike (strong interest) or flat/fading?
3. Overall momentum: Bullish, bearish, neutral?

Output concise market view (2-3 sentences) for ${asset.name}—no verdict, just contextual information. Focus on short-term momentum (bullish/bearish/neutral), volume implications (elevated = interest, low = fading), and any volatility/consolidation notes. Be objective—no hype.`;

    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Market reasoning error:', err.message);
    return 'Market data unavailable';
  }
}

module.exports = { getMarketReasoning };