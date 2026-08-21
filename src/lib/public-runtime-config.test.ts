import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_API_BASE_URL,
  DEFAULT_UPDATE_MANIFEST_URL,
  resolveRuntimeUrl,
} from './public-runtime-config';

test('resolveRuntimeUrl uses a trimmed configured URL', () => {
  assert.equal(
    resolveRuntimeUrl('  https://api.example.com/api/  ', DEFAULT_API_BASE_URL),
    'https://api.example.com/api/',
  );
});

test('resolveRuntimeUrl falls back to public-safe defaults', () => {
  assert.equal(resolveRuntimeUrl(undefined, DEFAULT_API_BASE_URL), 'http://localhost:4000/api');
  assert.equal(
    resolveRuntimeUrl('   ', DEFAULT_UPDATE_MANIFEST_URL),
    'https://example.com/memories/version.json',
  );
});
