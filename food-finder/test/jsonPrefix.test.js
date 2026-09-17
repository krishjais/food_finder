const test = require('node:test');
const assert = require('node:assert/strict');

const { extractFirstJsonValue } = require('../utils/jsonPrefix');

test('parses JSON followed by MCP advisory text', () => {
  const input = '{"restaurants":[{"name":"A"}],"dishes":[]}\n\nWarning: rich UI may be shown';
  assert.deepEqual(extractFirstJsonValue(input), {
    restaurants: [{ name: 'A' }],
    dishes: [],
  });
});

test('handles nested delimiters and escaped quotes inside strings', () => {
  const input = '  [{"message":"brace } and \\\"quote\\\"","nested":{"ok":true}}] trailing';
  assert.deepEqual(extractFirstJsonValue(input), [
    { message: 'brace } and "quote"', nested: { ok: true } },
  ]);
});

test('returns null for plain text or incomplete JSON', () => {
  assert.equal(extractFirstJsonValue('1. First address\n2. Second address'), null);
  assert.equal(extractFirstJsonValue('{"unfinished":true'), null);
});
