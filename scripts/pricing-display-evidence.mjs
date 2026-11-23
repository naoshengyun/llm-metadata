// Reviewed cache terms that are documented alongside these exact source records.
const openAiResponsesCache = [
  { usageKey: 'cache_write', retentionMinutes: 30 },
  { usageKey: 'cache_write_12h', condition: 'Responses API' },
];

export const cacheTermsByRecord = new Map([
  ['ac78ac97fcf28c9e45ce2d4b7cd1d76445f74aa3e01b0324c7e04336cc63738d', openAiResponsesCache], // Batch
  ['3d7d8d0512145734625d8cfae11db5b95d208f83892f7ea611bd35d7e499b9fc', openAiResponsesCache], // Flex
  ['3272c723a3e7628e52bc38698f6065b933f307854aff0a1690dc245e1ffc11a1', openAiResponsesCache], // Fast
  ['a344f33c2b7111c2b5f28a275fc7e6c4ca5b70f98b78db5cbafe2f66653be440', openAiResponsesCache], // Ultrafast
  [
    'f5386f9c833521c4ec9f2f471992f3d3e85065100f5d2a568972467937c7107c', // Anthropic Batch
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ],
]);
