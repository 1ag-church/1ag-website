import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import PastoralApp from '../app/pastoral-app';
import IntakeForm from '../app/intake-form';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import '../app/globals.css';

const settings = import.meta.env;
const client = settings.VITE_SUPABASE_URL && settings.VITE_SUPABASE_ANON_KEY
  ? createClient(settings.VITE_SUPABASE_URL, settings.VITE_SUPABASE_ANON_KEY) : null;
// On 1ag.tv/pastoralos this uses the same origin and Supabase project session as
// the church's Staff Login. No session token appears in a URL or cross-site message.
async function apiFetch(path: string, init: RequestInit = {}) {
  if (!client) return Response.json({ error: 'Staff login is not configured.' }, { status: 503 });
  const { data: { session } } = await client.auth.getSession();
  const headers = new Headers(init.headers);
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
  return fetch(`/pastoralos${path}`, { ...init, headers, cache: 'no-store' });
}

function StaffPortal() {
  const [email,setEmail] = useState(''), [password,setPassword] = useState('');
  const [user,setUser] = useState(''), [checking,setChecking] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const check = useCallback(async () => {
    try {
      const r = await apiFetch('/api/session'); const data = await r.json();
      setUser(r.ok ? data.email : '');
      if (r.status === 403) setError('Your account does not have PastoralOS access.');
      else if(r.status >= 500)setError('PastoralOS could not reach its database. Please try again.');
      else if(r.ok)setError('');
    } catch { setUser(''); setError('Unable to check your access. Please try again.'); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => {
    let active = true;
    void check();
    // Defer work outside the auth callback to avoid SDK auth-lock deadlocks.
    const { data } = client?.auth.onAuthStateChange(() => { setTimeout(() => { if (active) void check(); },0); }) ?? { data: null };
    const timer = setInterval(check,60000);
    return () => { active=false; data?.subscription.unsubscribe(); clearInterval(timer); };
  },[check]);
  async function signIn(e: React.FormEvent) {
    e.preventDefault(); if (!client) return;
    setBusy(true); setError('');
    try {
      const { error } = await client.auth.signInWithPassword({ email, password }); setPassword('');
      if (error) { setError('Unable to sign in. Check your email and password.'); return; }
      await check();
    } catch { setError('Unable to sign in. Please try again.'); }
    finally { setBusy(false); }
  }
  async function signOut() { await client?.auth.signOut(); setUser(''); setPassword(''); }
  if (checking) return <main className="public-page"><p role="status">Checking your staff access…</p></main>;
  if (user) {
    const path = window.location.pathname.replace(/\/$/,'');
    if (path === '/pastoralos/connect' || path === '/pastoralos/prayer') return <IntakeForm mode={path.endsWith('/connect')?'guest':'prayer'} request={apiFetch} basePath="/pastoralos"/>;
    return <PastoralApp user={user} request={apiFetch} onSignOut={signOut} basePath="/pastoralos"/>;
  }
  return <main className="public-page"><div className="public-card !max-w-[460px] mx-auto"><h1>PastoralOS</h1><p className="muted mt-3 mb-7">Sign in with your 1AG staff account.</p><form onSubmit={signIn} className="space-y-5"><label className="field"><span>Email</span><Input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field"><span>Password</span><Input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{(!client||error)&&<p role="alert">{!client?'Staff login is not connected yet.':error}</p>}<Button type="submit" disabled={busy||!client} className="w-full">{busy?'Signing in…':'Sign in'}</Button><a className="link-button" href="/#admin">Back to church Staff Login</a></form></div></main>;
}
createRoot(document.getElementById('root')!).render(<StaffPortal/>);
