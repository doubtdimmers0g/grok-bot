async function alphaAgent(grok, buyVerdict, sellVerdict, positionContext, marketReason) {

  const prompt = `Prime analyst final synthesis for spot crypto market trades. Prioritize capital protection in multi-position mode (one open per asset, concurrent across assets).

Inputs:
- Buy Agent: ${buyVerdict || 'No buy signal'}
- Sell Agent: ${sellVerdict || 'No sell signal'}
- Position & Live P&L: ${positionContext || 'No position context'}
- Market Reasoning: ${marketReason || 'No market reasoning'}

Think step by step:
1. Sub-agent consensus: Strong agreement or conflict on this asset?
2. Position risk per asset: Gains to protect or losses to cut on the signaled coin?
3. Market momentum: Volume/change confirming trend for this asset?
4. Overall: Legit opportunity or trap for the signaled asset?

Verdict rules (strict):
- BUY only on strong buy-agent consensus + no open position + clean market context.
- SELL only on strong sell-agent consensus + open position on this asset.
- PASS if the signal is marginal, trap risk is high, or data does not justify action (even if position allows it).
- SKIP only if position rules prevent action (e.g. already open on buy, flat on sell).
- HOLD only if open position and shows continued momentum.

Exact format:
FINAL VERDICT: BUY / SELL / PASS / SKIP / HOLD
REASON: 3-5 sentences synthesizing sub-agent verdicts, position status, market context, and risk.`;

  try {
    const grokRes = await grok.post('/chat/completions', {
      model: 'grok-4-fast-reasoning',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });
    return grokRes.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('Alpha agent error:', err.message);
    return 'Error in final synthesis';
  }
}

module.exports = alphaAgent;
