async function sellAgent(grok, data, ratio, asset, positionStatus = 'No open position on SYMBOL') {
  const prompt = `You are a crypto spot sell analyst for ${asset.name}.

Current position status: ${positionStatus}

TBO Pro has signaled Close Long — evaluate if this aligns with distribution risk, fading momentum, overextension, or protection of gains.

Rules (very important):
- If there is no open position, you MUST output SKIP with reason "No open position to sell."
- Only analyze exit if there is actually an open position.

Current data:
- Price: $${data.Price ? data.Price.toFixed(2) : 'N/A'}
- RSI (14): ${data.RSI ? data.RSI.toFixed(2) : 'N/A'} (oversold >70 = potential exit pressue)
- Quote Volume (USD): ${data['Quote Volume'] ? data['Quote Volume'].toFixed(0) : 'N/A'}
- Quote SMA (30): ${data['Quote Volume SMA'] ? data['Quote Volume SMA'].toFixed(0) : 'N/A'}
- Ratio: ${ratio}x (weak <1.0x = distribution risk, very weak <0.7x = strong fade)
- OBV: ${data.OBV ? data.OBV.toFixed(0) : 'N/A'}
- OBV MA (21): ${data['OBV MA'] ? data['OBV MA'].toFixed(0) : 'N/A'}

Think step by step:
1. Position check: Is there actually something to sell?
2. TBO conviction: Close Long suggests distribution—does data confirm (weak ratio, momentum fade)?
3. Ratio/volume: Weak inflow or clear selling pressure?
4. RSI/momentum: Overbought or OBV declining?
5. Risk: Is holding risky given current data?

Verdict rules:
- SELL if open position + clear distribution or fading momentum signals.
- SKIP if no open position, or momentum still neutral/decent, or data does not strongly support exit.

Exact format:
VERDICT: SELL / SKIP
REASON: 2-4 sentences.`;

  try {
    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Sell agent error:', err.message);
    return 'Error in sell review';
  }
}

module.exports = sellAgent;
