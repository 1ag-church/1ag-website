import type { State } from './model';

type Workspace = { state: State; version: number };
type Request = (path: string, init?: RequestInit) => Promise<Response>;

async function readWorkspace(response: Response): Promise<Workspace> {
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'Unable to save workflow status. Please try again.');
  if (!Number.isInteger(data.version) || typeof data.state?.settings?.paused !== 'boolean') {
    throw Error('Unable to confirm workflow status. Please refresh and try again.');
  }
  return data;
}

// Retry only this explicit, idempotent setting. Other actions still require
// review after a conflict; never turn a pause into a resume by toggling twice.
export async function saveWorkflowPause(request: Request, version: number, paused: boolean): Promise<Workspace> {
  const save = (currentVersion: number) => request('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: currentVersion, action: { type: 'pause', paused } }),
  });
  try {
    let response: Response | null;
    try { response = await save(version); }
    catch (error) {
      if (!(error instanceof TypeError)) throw error;
      // A lost response may still have saved. Read back before attempting
      // the same setting again, so a connection failure cannot reverse it.
      response = null;
    }
    if (!response || response.status === 409) {
      const current = await readWorkspace(await request('/api/state'));
      if (current.state.settings.paused === paused) return current;
      response = await save(current.version);
    }
    const saved = await readWorkspace(response);
    if (saved.state.settings.paused !== paused) throw Error('The workflow status did not save. Please try again.');
    return saved;
  } catch (error) {
    if (error instanceof TypeError) {
      throw Error('Could not reach PastoralOS to confirm workflow status. Refresh the page and try again.');
    }
    throw error;
  }
}
