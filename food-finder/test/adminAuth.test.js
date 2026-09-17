const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAdminApiKey } = require('../middleware/adminAuth');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('production admin middleware rejects missing and accepts valid keys', () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousKey = process.env.ADMIN_API_KEY;
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_API_KEY = 'a-long-test-secret';

  try {
    const deniedResponse = responseRecorder();
    requireAdminApiKey({ get: () => '' }, deniedResponse, () => assert.fail('must not continue'));
    assert.equal(deniedResponse.statusCode, 401);

    let continued = false;
    const allowedRequest = {
      get(name) {
        return name === 'x-admin-api-key' ? 'a-long-test-secret' : '';
      },
    };
    requireAdminApiKey(allowedRequest, responseRecorder(), () => { continued = true; });
    assert.equal(continued, true);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousKey === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = previousKey;
  }
});
