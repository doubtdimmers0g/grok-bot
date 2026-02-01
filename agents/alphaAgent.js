async function alphaAgent(grok, buyVerdict, sellVerdict, getPositionContext, getMarketReasoning) {
  const prompt = `Synthesize for final trading decision as the prime analyst.

Sub-agent inputs:
- Buy Agent: ${buyVerdict || 'No buy signal'}
- Sell Agent: ${sellVerdict || 'No sell signal'}
- Position & Live P&L: ${getPositionContext}
- Market Data Agent: ${getMarketReasoning}

Final verdict—conservative, small safe trades only.

Exact format:
FINAL VERDICT: BUY / SELL / HOLD / SKIP
REASON: 3-5 sentences synthesizing agents, position, risk.
ACTION: Size $50-100 or partial sell, with stops/targets if relevant`;

  try {
    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Alpha agent error:', err.message);
    return 'Error in final review';
  }
}

module.exports = alphaAgent;
