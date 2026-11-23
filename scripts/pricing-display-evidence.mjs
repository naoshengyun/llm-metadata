// Reviewed cache terms that are documented alongside these exact source records.
const openAiResponsesCache = [
  { usageKey: 'cache_write', retentionMinutes: 30 },
  { usageKey: 'cache_write_12h', condition: 'Responses API' },
];

export const cacheTermsByRecord = new Map([
  // Exact Anthropic references: 5m writes; Batch/Fast multipliers and US uplift retain TTL.
  // tests/fixtures/official-check/anth-2026-11-18.gz decompressed SHA256 048ccb65c7aa39a16f8475d92bec1730bc9e42c63b79085e2f0f1e6e5f867cd1
  [
    '131cbf7bfeebfbb222bfbdb43e1ec506336c6f07857ae0e744d361ed1570c05b',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-fable-5 / Batch / global
  [
    '5b9efd6ac87657989b9bf3ce894642bf04d59afc7a381ef5e8c14508ff2badf6',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-fable-5 / Standard / inference_geo=us
  [
    '5e9f5a0e5d4503513a110c82e1a6ae73247d8752ff3042a06089fe2683bb8109',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-fable-5-1 / Batch / global
  [
    '7daf5b5bd86ed17410810ecf3da15e58ac05a3ceed616f7602dbc6bb19334f58',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-fable-5-1 / Standard / inference_geo=us
  [
    '5504b4b4b6f892790d75cc74c92efde550c806a2788c834410ebe023ba48d189',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-fable-5-2 / Batch / global
  [
    '74a12b1c307133ed5aec00507df96c9ae3204f8c4898a48e4a1e0b626a569e93',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-fable-5-2 / Fast / global
  [
    '67b6a4f232693d59d18253e3166a7cbaea5f45b8756c7170e03c478e42ea12f8',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-fable-5-2 / Standard / inference_geo=us
  [
    'a1c6ac02237b306dec977052ccb8faebf226fc6178c5e1e244f9b0a92d985e6f',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-haiku-4-5 / Batch / global
  [
    '4aa0cfa8356cfc0ecf437d144b6a9823be2bb95b9257f744dd928e4e92abc62d',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-haiku-4-5-20251001 / Batch / global
  [
    '34569eda4e2c4cab2650624c003cff2b2fa0a77517fe35280220f44a87a3bfa7',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-haiku-5-5 / Standard / inference_geo=us
  [
    '0248d9e6a78919cc10dd6eeb7b8e3ae679233380f1a0462cf311081ee00a2499',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-4-5-20251101 / Batch / global
  [
    '96bad424d1bb8c80a672755808f7a5faeb6c8498fca3e87aa64a7faf46606aeb',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-4-6 / Batch / global
  [
    'e9172bc206b0615ffc5f73c41da9e169dc91b9e1d7b0a5af09649554672e7c27',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-4-6 / Standard / inference_geo=us
  [
    '19430a46cb14e088e4f665bac8eb386acc7a4c0028570eb1b15f6d79836ec649',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-4-7 / Batch / global
  [
    'c8955905518849f45cd862e51a33e743ed252687e10748cc09245b6d41029549',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-4-7 / Standard / inference_geo=us
  [
    'ee31c40e46657a4c848d8e5bb12521994960b6c1b8bed677e2f0d945c919f588',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-4-8 / Batch / global
  [
    '3be42cb11a4230801a56ba51d47de2f288a0be3a637b308274358a79e3fa900d',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-4-8 / Fast / global
  [
    '1bd74b36a8dfe7f5cbf0b8be9a815e603688ba47323442c3ecdfe519ee6bcd56',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-4-8 / Standard / inference_geo=us
  [
    'fdb0ea78891e030bc69df8782bd3f7047bd7e35914abb7856e32782e2664df4a',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-5 / Batch / global
  [
    'dc96c3794691192789c25e0e61168dbf19a332f445048bea22b77c6fb565bae5',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-5 / Fast / global
  [
    '61586fb00fb12922d0b3e357910be68ebef086ccbe4414aa011b71226799a6a0',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-5 / Standard / inference_geo=us
  [
    'ddb51719aa0cd1c773eb6f5f0519909dedc3dc1660481060631559215d8e1e05',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-5-5 / Batch / global
  [
    'd60e5584ac550ffcd2c4d3c9487ffab3b98772857f3144066063937018e1d31c',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-5-5 / Fast / global
  [
    'a412c8eb736e136793e1075a7d22057ba9db3b2bbdb8837b462f655a438e9c33',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-opus-5-5 / Standard / inference_geo=us
  [
    'a53a08abbcaeb8b3dae7051e767e4dd583ed292a5f150d78b444f4366d88e1b7',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-sonnet-4-5 / Batch / global
  [
    'e7130a93d34947994d6bb7c2e106add872f8f900155514d4443188d106ffff7a',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-sonnet-4-5-20250929 / Batch / global
  [
    '80d3286c3c8b447e5fdff916515b3ed88bf2878d0427376bc3c94ef3ed5c0b3b',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-sonnet-4-6 / Batch / global
  [
    '1763d3d88e32d8eddfcb2a3ea8ea95b6171174db6f4ec6b1e6d2628550c84de2',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-sonnet-4-6 / Standard / inference_geo=us
  [
    'de9544d9d33a9e2e1d2cf587fe54f9ba367f9ec016bc001ea86761c85f8812f7',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-sonnet-5 / Batch / global
  [
    '4be6b080c87befd7fe2319fe49b027500abe1d34b6b9435d2de0c39bb71c341b',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-sonnet-5 / Standard / inference_geo=us
  [
    '92c8a565cddc3a2b01d446392430a7b956af335bf8f941cab289bdf79f95cafa',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-sonnet-5-5 / Batch / global
  [
    '86d712baae9587db4acc132fba366037463b5bcc1179b8012ca0ad488d610bb1',
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ], // claude-sonnet-5-5 / Standard / inference_geo=us
  // Exact Standard records verified against openai-upstream-2026-11-19.gz:
  // pricing.md SHA256 427698a0c4f1cf4abb2569cb0f9a4ca7fcacfa2f45d61a75f221f0b590ac5114,
  // both short/long-context columns explicitly say “30m write”.
  [
    '0bb9242db844b2351de64c366ea1b6d08a7eaa04f9adb62fab74b8832f654b94',
    [{ usageKey: 'cache_write', retentionMinutes: 30 }],
  ],
  [
    'cfd04f58c4c0b8aa3e494bedbb1f79bd216f0fcc5a32c2d3c54d3c622a20faba',
    [{ usageKey: 'cache_write', retentionMinutes: 30 }],
  ],
  [
    '77cd2f3936683dde3a4af3f067d2510ef44b7e8ccb30ec1a82fe60293f6500eb',
    [{ usageKey: 'cache_write', retentionMinutes: 30 }],
  ],
  ['ac78ac97fcf28c9e45ce2d4b7cd1d76445f74aa3e01b0324c7e04336cc63738d', openAiResponsesCache], // Batch
  ['3d7d8d0512145734625d8cfae11db5b95d208f83892f7ea611bd35d7e499b9fc', openAiResponsesCache], // Flex
  ['3272c723a3e7628e52bc38698f6065b933f307854aff0a1690dc245e1ffc11a1', openAiResponsesCache], // Fast
  ['a344f33c2b7111c2b5f28a275fc7e6c4ca5b70f98b78db5cbafe2f66653be440', openAiResponsesCache], // Ultrafast
  [
    'f5386f9c833521c4ec9f2f471992f3d3e85065100f5d2a568972467937c7107c', // Anthropic Batch
    [{ usageKey: 'cache_write', retentionMinutes: 5 }],
  ],
]);
