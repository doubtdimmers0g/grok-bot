async function buyAgent(grok, data, ratio, asset, positionStatus = 'No open position on SYMBOL') {
  const prompt = `You are a crypto spot buy analyst for ${asset.name}.

Current position status: ${positionStatus}

TBO Pro has signaled Open Long — evaluate if this aligns with positive inflow conviction, low trap risk, and supportive momentum for a safe accumulation.

Rules (very important):
- If there is already an open position, you MUST output SKIP.

Current data:
- Price: $${data.Price ? data.Price.toFixed(2) : 'N/A'}
- RSI (14): ${data.RSI ? data.RSI.toFixed(2) : 'N/A'} (oversold <40 = dip support)
- Quote Volume (USD): ${data['Quote Volume'] ? data['Quote Volume'].toFixed(0) : 'N/A'}
- Quote SMA (30): ${data['Quote Volume SMA'] ? data['Quote Volume SMA'].toFixed(0) : 'N/A'}
- Ratio: ${ratio}x (positive >1.0x = edge, strong >1.3x = conviction)
- OBV: ${data.OBV ? data.OBV.toFixed(0) : 'N/A'}
- OBV MA (21): ${data['OBV MA'] ? data['OBV MA'].toFixed(0) : 'N/A'}

Think step by step:
1. TBO conviction: Open Long suggests breakout—does data confirm (decent ratio, momentum support)?
2. Ratio/inflow: Positive edge or strong surge?
3. RSI/momentum: Oversold support or OBV rising?
4. Risk: Trap flags (high range, weak volume, red macro)?
5. Overall: Safe low-risk entry?

Verdict rules:
- BUY if no open position + TBO alignment + supportive data (ratio >1.0x, low risks).
- PASS if signal is marginal, traps present, or data contradicts TBO (strategic decision).
- SKIP only if already open (mechanical rule).

Exact format:
VERDICT: BUY / PASS / SKIP
REASON: 2-4 sentences.`;

  try {
    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Buy agent error:', err.message);
    return 'Error in buy review';
  }
}

module.exports = buyAgent;
