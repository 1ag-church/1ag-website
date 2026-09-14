import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveWorkflowPause } from './workflow-pause.ts';

const workspace = (paused: boolean, version: number) => ({ state: { settings: { paused } }, version });
const conflict = () => Response.json({ error: 'This workspace changed. Refresh before saving.' }, { status: 409 });

test('pause and resume return the confirmed saved state', async () => {
  for (const paused of [true, false]) {
    const saved = await saveWorkflowPause(async (path, init) => {
      assert.equal(path, '/api/action');
      assert.deepEqual(JSON.parse(init!.body as string), { version: 7, action: { type: 'pause', paused } });
      return Response.json(workspace(paused, 8));
    }, 7, paused);
    assert.equal(saved.state.settings.paused, paused);
    assert.equal(saved.version, 8);
  }
});

test('background activity does not discard the requested pause or resume', async () => {
  for (const paused of [true, false]) {
    let calls = 0;
    const saved = await saveWorkflowPause(async (path, init) => {
      calls++;
      if (calls === 1) return conflict();
      if (calls === 2) {
        assert.equal(path, '/api/state');
        return Response.json(workspace(!paused, 9));
      }
      assert.deepEqual(JSON.parse(init!.body as string), { version: 9, action: { type: 'pause', paused } });
      return Response.json(workspace(paused, 10));
    }, 7, paused);
    assert.equal(saved.state.settings.paused, paused);
    assert.equal(calls, 3);
  }
});

test('a concurrent change to the requested state is accepted without toggling it back', async () => {
  let calls = 0;
  const saved = await saveWorkflowPause(async () => ++calls === 1 ? conflict() : Response.json(workspace(true, 9)), 7, true);
  assert.equal(saved.state.settings.paused, true);
  assert.equal(calls, 2);
});

test('repeated conflicts stop after one retry', async () => {
  let calls = 0;
  await assert.rejects(saveWorkflowPause(async () => ++calls === 2 ? Response.json(workspace(false, 9)) : conflict(), 7, true), /workspace changed/);
  assert.equal(calls, 3);
});

test('connection and server errors do not claim that the status was saved', async () => {
  await assert.rejects(saveWorkflowPause(async () => { throw new TypeError('Load failed'); }, 7, true), /Could not reach PastoralOS/);
  await assert.rejects(saveWorkflowPause(async () => Response.json({ error: 'Sign in required.' }, { status: 401 }), 7, true), /Sign in required/);
  await assert.rejects(saveWorkflowPause(async () => Response.json(workspace(false, 8)), 7, true), /did not save/);
  await assert.rejects(saveWorkflowPause(async () => Response.json({ version: 8 }), 7, true), /confirm workflow status/);
});

test('Load failed recovers with a status read and a single retry', async () => {
  for (const paused of [true, false]) {
    let calls = 0;
    const saved = await saveWorkflowPause(async (path, init) => {
      calls++;
      if (calls === 1) throw new TypeError('Load failed');
      if (calls === 2) {
        assert.equal(path, '/api/state');
        return Response.json(workspace(!paused, 7));
      }
      assert.deepEqual(JSON.parse(init!.body as string), { version: 7, action: { type: 'pause', paused } });
      return Response.json(workspace(paused, 8));
    }, 7, paused);
    assert.equal(saved.state.settings.paused, paused);
    assert.equal(calls, 3);
  }
});

test('a lost response after saving is confirmed without a second write', async () => {
  let calls = 0;
  const saved = await saveWorkflowPause(async () => {
    if (++calls === 1) throw new TypeError('Load failed');
    return Response.json(workspace(true, 8));
  }, 7, true);
  assert.equal(saved.state.settings.paused, true);
  assert.equal(calls, 2);
});
