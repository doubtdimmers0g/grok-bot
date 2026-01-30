  const prompt = `You are a conservative crypto trading analyst reviewing an exit on an open BTC spot position (small $50-100 buy on dip).

Current data (sell conditions met):
- Price: $${data.Price.toFixed(2)}
- RSI (14): ${data.RSI.toFixed(2)} (overbought >65 = stretched, neutral 50-65)
- Quote Volume USDT: ${data['Quote Volume'].toFixed(0)}
- Quote SMA (30): ${data['Quote Volume SMA'].toFixed(0)}
- Volume Ratio: ${ratio}x (weak <1.0x = distribution, decent <1.1x)
- OBV: ${data.OBV.toFixed(0)}
- OBV MA (7): ${data['OBV MA'].toFixed(0)}

Think step by step:
1. Ratio strength: Fading inflow (<1.0x) = distribution risk.
2. RSI: Overbought or weakening?
3. Momentum: OBV falling or below MA? Slope confirming sellers?
4. Context: Current X/macro sentiment? News/red flags for reversal?
5. Overall: Time to take profits/protect or hold for more?

Verdict rules:
- SELL if fading momentum + overbought + downside risk.
- HOLD if momentum strong or ratio decent.
- NO if traps (fake fade).

Exact format:
VERDICT: SELL / HOLD
REASON: 2-4 sentences on ratio (priority), RSI, momentum fade, sentiment/risk.
ACTION: Take full profit / partial / trail stop`;

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