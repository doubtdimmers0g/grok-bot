async function sellAgent(grok, data, ratio, asset, positionStatus = 'No open position on SYMBOL') {
  const prompt = `You are a crypto spot sell analyst for ${asset.name}. 

Current position status: ${positionStatus}

TBO Pro has signaled Close Long.

Rules (strict):
- If position is FLAT or no open position: VERDICT MUST BE HOLD. Do not analyze exit. Reason: "No open position to sell."
- Only if open: evaluate if distribution risk, overextension, or fading momentum justifies exit.

Rules (very important):
- If the position status says "No open position on", you MUST output VERDICT: SKIP with reason "No open position to sell."
- Only analyze distribution risk and give SELL verdict if there is actually an open position.

Current data:
- Price: $${data.Price.toFixed(2)}
- RSI (14): ${data.RSI.toFixed(2)} (oversold <40 = dip support)
- Quote Volume (USD): ${data['Quote Volume'].toFixed(0)}
- Quote SMA (30): ${data['Quote Volume SMA'].toFixed(0)}
- Ratio: ${ratio}x (positive >1.0x = edge, strong >1.3x = conviction)
- OBV: ${data.OBV ? data.OBV.toFixed(0) : 'N/A'}
- OBV MA (21): ${data['OBV MA'] ? data['OBV MA'].toFixed(0) : 'N/A'}

Think step by step and follow rules strictly to determine if TBO Close Long + weak ratio + momentum fade confirm exit.

Verdict rules:
- SELL only if open + strong alignment on risks.
- HOLD if momentum still decent.
- SKIP if No open position.

Exact format:
VERDICT: SELL / HOLD / SKIP
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
