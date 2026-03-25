async function alphaAgent(grok, buyVerdict, sellVerdict, positionContext, marketReason) {

  const prompt = `Prime analyst final synthesis for spot crypto market trades. Prioritize capital protection in multi-position mode (one open per asset, concurrent across assets).

Inputs:
- Buy Agent: ${buyVerdict || 'No buy signal'}
- Sell Agent: ${sellVerdict || 'No sell signal'}
- Position & Live P&L: ${positionContext || 'No position context'}
- Market Reasoning: ${marketReason || 'No market reasoning'}

Mechanical Rules (very important):
- If buy signal and there is already an open position, you MUST output SKIP with reason “Already open position bought.”
- If sell signal and there is no open position, you MUST output SKIP with reason “No open position to sell.”

Think step by step:
1. What does the agent say?
2. Position risk per asset: Gains to protect or losses to cut on the signaled coin?
3. Market momentum: Volume/change confirming trend for this asset?
4. Overall: Legit opportunity or trap for the signaled asset?

Verdict rules (strict):
- SKIP only if mechanical rules prevent action.
- BUY only if you agree with buy-agent verdict + no open position + clean market context.
- PASS only if you do not agree with buy-agent verdict.
- SELL only if you agree with sell-agent verdict + open position on this asset + clean market context.
- HOLD only if you do not agree with sell-agent verdict.

Exact format:
FINAL VERDICT: SKIP / BUY / PASS / SELL / HOLD
REASON: 2-4 sentences.`;

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
