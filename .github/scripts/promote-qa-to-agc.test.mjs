import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePromotion } from './promote-qa-to-agc.mjs';

function github({ existing = [], ahead = 1, race = false } = {}) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push([url, options.method, options.body]);
    const path = new URL(url).pathname;
    if (path.endsWith('/compare/agc...qa')) return Response.json({ ahead_by: ahead });
    if (options.method === 'POST') {
      if (race) return Response.json({}, { status: 422 });
      return Response.json({ html_url: 'https://github.com/I-CORE-TEC/plexo/pull/7' }, { status: 201 });
    }
    return Response.json(race && calls.length > 2 ? [{ html_url: 'existing' }] : existing);
  };
  return { calls, fetch };
}

test('opens a canonical QA-to-AGC PR without merging', async () => {
  const { calls, fetch } = github();
  assert.equal(await reconcilePromotion(fetch, 'test-token'), 'https://github.com/I-CORE-TEC/plexo/pull/7');
  const writes = calls.filter(([, method]) => method === 'POST');
  assert.equal(writes.length, 1);
  assert.match(writes[0][0], /\/repos\/I-CORE-TEC\/plexo\/pulls$/);
  const { head, base } = JSON.parse(writes[0][2]);
  assert.deepEqual({ head, base }, { head: 'qa', base: 'agc' });
});

test('reuses the open promotion PR', async () => {
  const { calls, fetch } = github({ existing: [{ html_url: 'existing' }] });
  assert.equal(await reconcilePromotion(fetch, 'test-token'), 'existing');
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.fromEntries(new URL(calls[0][0]).searchParams), {
    state: 'open', head: 'I-CORE-TEC:qa', base: 'agc',
  });
});

test('does not open a PR when QA has no new commits', async () => {
  const { calls, fetch } = github({ ahead: 0 });
  assert.equal(await reconcilePromotion(fetch, 'test-token'), null);
  assert.equal(calls.length, 2);
});

test('reuses a PR created concurrently', async () => {
  const { calls, fetch } = github({ race: true });
  assert.equal(await reconcilePromotion(fetch, 'test-token'), 'existing');
  assert.equal(calls.length, 4);
});