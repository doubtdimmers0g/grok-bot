async function alphaAgent(grok, agentOutputs, lastSignalData) {
  const prompt = `Synthesize from sub-agents for final call:
Buy Agent: ${agentOutputs.buy}
Sell Agent: ${agentOutputs.sell}
Position Agent: ${agentOutputs.position}
Sentiment Agent: ${agentOutputs.sentiment}
Memory Agent: ${agentOutputs.memory}

Final verdict:`;

  const grokRes = await grok.post('/chat/completions', {
    model: 'grok-4-fast-reasoning',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  });
  return grokRes.data.choices[0].message.content.trim();
}

module.exports = alphaAgent;