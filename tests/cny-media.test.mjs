import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTask, compileTool } from '../.cache/cny-build/cny/media.js';

test('Seedance per-million tokens produce a task request amount, with USD converted once', () => {
  const quote = {
    plugin: 'doubao',
    model: 'doubao-seedance-2-0-fast-260128',
    tiers: [
      {
        name: 'base',
        charges: [{ usageKey: 'tokens', amount: 3, unit: 'per_million_tokens', currency: 'USD' }],
      },
    ],
  };
  assert.deepEqual(compileTask(quote), {
    status: 'ready',
    expression: 'tier("base", u("tokens") * 21 / 1000000)',
  });
  assert.deepEqual(compileTask(quote), compileTask(quote));
});

test('task prices reject unknown usage keys, missing amounts, and units that conflict with the pinned schema', () => {
  const quote = {
    plugin: 'doubao',
    model: 'doubao-seedance-2-0-fast-260128',
    tiers: [
      {
        name: 'base',
        charges: [{ usageKey: 'seconds', amount: 3, unit: 'per_second', currency: 'CNY' }],
      },
    ],
  };
  assert.equal(compileTask(quote).status, 'unsupported-shape');
  quote.tiers[0].charges = [{ usageKey: 'tokens', unit: 'per_million_tokens', currency: 'CNY' }];
  assert.equal(compileTask(quote).status, 'incomplete');
  quote.tiers[0].charges = [{ usageKey: 'tokens', amount: 3, unit: 'per_second', currency: 'CNY' }];
  assert.equal(compileTask(quote).status, 'unsupported-shape');
});

test('native task enum tiers keep CNY per-second prices and count image terms', () => {
  const quote = {
    plugin: 'google',
    model: 'veo-3.0-generate-001',
    tiers: [
      {
        name: '4k',
        when: { resolution: '4k' },
        charges: [{ usageKey: 'seconds', amount: 4, unit: 'per_second', currency: 'CNY' }],
      },
      {
        name: 'base',
        charges: [{ usageKey: 'seconds', amount: 2, unit: 'per_second', currency: 'CNY' }],
      },
    ],
  };
  assert.deepEqual(compileTask(quote), {
    status: 'ready',
    expression:
      'u("resolution") == "4k" ? tier("4k", u("seconds") * 4) : tier("base", u("seconds") * 2)',
  });
  const image = {
    plugin: 'doubao',
    model: 'doubao-seedream-5-0-pro-260628',
    tiers: [
      {
        name: 'base',
        charges: [
          { usageKey: 'images_up_to_1_5k', amount: 0.1, unit: 'per_count', currency: 'CNY' },
          { usageKey: 'images_above_1_5k', amount: 0.2, unit: 'per_count', currency: 'CNY' },
          { usageKey: 'input_images', amount: 0, unit: 'per_count', currency: 'CNY' },
        ],
      },
    ],
  };
  assert.deepEqual(compileTask(image), {
    status: 'ready',
    expression:
      'tier("base", u("images_up_to_1_5k") * 0.1 + u("images_above_1_5k") * 0.2 + u("input_images") * 0)',
  });
  quote.tiers[0].when = { resolution: 'nonsense' };
  assert.equal(compileTask(quote).status, 'unsupported-shape');
});

test('tool prices remain an independent per-thousand native config, preserving explicit free', () => {
  assert.deepEqual(
    compileTool({
      key: 'web_search:grok*',
      amount: 5,
      unit: 'per_thousand_calls',
      currency: 'USD',
    }),
    { status: 'ready', key: 'web_search:grok*', price: 35 },
  );
  assert.deepEqual(
    compileTool({ key: 'search_std', amount: 0.01, unit: 'per_call', currency: 'CNY' }),
    { status: 'ready', key: 'search_std', price: 10 },
  );
  assert.deepEqual(
    compileTool({ key: 'google_search:gemini-2.5*', amount: 0, unit: 'per_call', currency: 'CNY' }),
    { status: 'ready', key: 'google_search:gemini-2.5*', price: 0 },
  );
  assert.equal(
    compileTool({ key: 'web_search', unit: 'per_call', currency: 'CNY' }).status,
    'incomplete',
  );
  assert.equal(
    compileTool({ key: 'storage_hour', amount: 1, unit: 'per_call', currency: 'CNY' }).status,
    'unsupported-shape',
  );
  assert.equal(
    compileTool({ key: 'web_search:*', amount: 1, unit: 'per_call', currency: 'CNY' }).status,
    'unsupported-shape',
  );
  assert.equal(
    compileTool({ key: 'web_search:grok', amount: 1, unit: 'per_call', currency: 'CNY' }).status,
    'unsupported-shape',
  );
});

test('task quotes cannot omit a numeric fee category or mix currencies across tiers', () => {
  const image = {
    plugin: 'doubao',
    model: 'doubao-seedream-5-0-pro-260628',
    tiers: [
      {
        name: 'base',
        charges: [
          { usageKey: 'images_up_to_1_5k', amount: 0.1, unit: 'per_count', currency: 'CNY' },
        ],
      },
    ],
  };
  assert.equal(compileTask(image).status, 'incomplete');
  const video = {
    plugin: 'google',
    model: 'veo-3.0-generate-001',
    tiers: [
      {
        name: '4k',
        when: { resolution: '4k' },
        charges: [{ usageKey: 'seconds', amount: 4, unit: 'per_second', currency: 'CNY' }],
      },
      {
        name: 'base',
        charges: [{ usageKey: 'seconds', amount: 2, unit: 'per_second', currency: 'USD' }],
      },
    ],
  };
  assert.equal(compileTask(video).status, 'incomplete');
  const unknown = { plugin: 'new-private-plugin', model: 'unknown', tiers: [] };
  assert.equal(compileTask(unknown).status, 'unsupported-shape');
});

test('task compiler refuses rates that overflow native smoke-test usage ceilings', () => {
  assert.equal(
    compileTask({
      plugin: 'google',
      model: 'veo-3.0-generate-001',
      tiers: [
        {
          name: 'base',
          charges: [{ usageKey: 'seconds', amount: 1e308, unit: 'per_second', currency: 'CNY' }],
        },
      ],
    }).status,
    'incomplete',
  );
});
test('non-string not-applicable reasons are incomplete instead of crashing the catalogue',()=>{
 const r=compileTask({plugin:'alibaba',model:'qwen-image-3.0',tiers:[{name:'base',charges:[{usageKey:'image_count',amount:1,unit:'per_count',currency:'CNY'}],notApplicable:{input_image_count:5}}]});
 assert.equal(r.status,'incomplete');
});
