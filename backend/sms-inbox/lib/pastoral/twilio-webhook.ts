import { validateRequest } from 'twilio/lib/webhooks/webhooks.js';
import { applyIncomingSms, type IncomingSms } from './inbound.ts';
import type { State } from './model.ts';
import type { ServerConfig } from './supabase.ts';
import { ingestPrayerSms, applyPrayerCommand, isPrayerCommand, adminPhone } from './prayer-flow.ts';

export interface WebhookStore {
  load(owner: string): Promise<{ state: State; version: number }>;
  receive(owner: string, version: number, state: State, event: IncomingSms): Promise<'accepted' | 'duplicate' | 'conflict'>;
  recordStatus(owner: string, event: { accountSid: string; messageSid: string; status: string; errorCode: string }): Promise<void>;
}
const response = (status: number, body: string) => new Response(status === 204 ? null : body, { status, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
const emptyTwiml = () => new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
  status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' },
});
const string = (config: ServerConfig, key: string) => typeof config[key] === 'string' ? config[key] as string : '';
const sid = (value: string, prefix: string) => new RegExp(`^${prefix}[0-9a-fA-F]{32}$`).test(value);
const phone = (value: string) => /^\+[1-9]\d{7,14}$/.test(value);

export async function handleTwilioWebhook(request: Request, config: ServerConfig, store: WebhookStore, kind: 'inbound' | 'status'): Promise<Response> {
  // Deliberate deployment flag: configuring credentials alone must not open intake.
  if (config.PASTORALOS_TWILIO_WEBHOOKS_ENABLED !== 'true' || config.PASTORALOS_STORAGE !== 'supabase') return response(503, 'SMS intake is not connected.');
  const owner = string(config, 'PASTORALOS_WORKSPACE_OWNER');
  const token = string(config, 'TWILIO_AUTH_TOKEN');
  const accountSid = string(config, 'TWILIO_ACCOUNT_SID');
  const number = string(config, 'TWILIO_PHONE_NUMBER');
  const general=string(config,'PASTORALOS_GENERAL_SMS_NUMBER');
  const acceptedNumber=(value:string)=>value===number||(phone(general)&&general!==number&&value===general);
  const canonical = string(config, kind === 'inbound' ? 'TWILIO_INBOUND_WEBHOOK_URL' : 'TWILIO_STATUS_WEBHOOK_URL');
  let url: URL;
  try { url = new URL(canonical); } catch { return response(503, 'Webhook configuration is incomplete.'); }
  if (!owner || !token || !sid(accountSid, 'AC') || !phone(number) || url.protocol !== 'https:' || url.hash || url.username || url.password) return response(503, 'Webhook configuration is incomplete.');
  if (request.method !== 'POST') return response(405, 'POST required.');
  // Bind the public URL to configuration; do not trust forwarded host/protocol headers.
  const actual = new URL(request.url);
  if (actual.pathname !== url.pathname || actual.search !== url.search) return response(403, 'Invalid webhook URL.');
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/x-www-form-urlencoded') return response(415, 'Form encoding required.');
  const signature = request.headers.get('x-twilio-signature');
  if (!signature) return response(403, 'Invalid signature.');
  // Bound the stream before parsing, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return response(400, 'Missing body.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); return response(413, 'Body too large.'); }
      chunks.push(value);
    }
  } catch { return response(400, 'Unable to read body.'); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const form = new URLSearchParams(new TextDecoder().decode(bytes));
  const params: Record<string, string> = Object.create(null);
  for (const [key, value] of form) {
    if (Object.hasOwn(params, key)) return response(400, 'Duplicate field.');
    params[key] = value;
  }
  if (!validateRequest(token, signature, canonical, params)) return response(403, 'Invalid signature.');
  if (params.AccountSid !== accountSid || !sid(params.MessageSid ?? '', 'SM')) return response(403, 'Unexpected account or message.');
  try {
    if (kind === 'status') {
      const status = params.MessageStatus ?? '';
      if (!acceptedNumber(params.From) || !phone(params.To ?? '') || !['accepted', 'scheduled', 'canceled', 'queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'read'].includes(status)) return response(400, 'Invalid status event.');
      if (params.ErrorCode && !/^\d{1,10}$/.test(params.ErrorCode)) return response(400, 'Invalid error code.');
      // Append evidence; never regress a delivery state on an out-of-order callback.
      await store.recordStatus(owner, { accountSid, messageSid: params.MessageSid, status, errorCode: params.ErrorCode ?? '' });
      return response(204, '');
    }
    if (!acceptedNumber(params.To) || !phone(params.From ?? '') || (params.Body?.length ?? 0) > 6000 || !/^\d{1,2}$/.test(params.NumMedia ?? '0')) return response(400, 'Invalid incoming message.');
    const event: IncomingSms = { accountSid, messageSid: params.MessageSid, from: params.From, to: params.To,
      body: params.Body ?? '', optOut: params.OptOutType ?? '', mediaCount: Number(params.NumMedia ?? '0') };
    if (!event.body.trim() && !event.mediaCount) return response(400, 'Empty incoming message.');
    // Replay transformation after a concurrent staff edit; never overwrite a newer workspace.
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await store.load(owner);
      const isPrayerLine=event.to===number;
      const prayerCommand=isPrayerLine&&event.from===adminPhone(current.state)&&isPrayerCommand(event.body)&&!event.optOut;
      let state=prayerCommand?applyPrayerCommand(current.state,event):applyIncomingSms(current.state,event,new Date(),isPrayerLine?'prayer':'general');
      if(isPrayerLine&&!prayerCommand)state=ingestPrayerSms(state,event);
      const result = await store.receive(owner, current.version, state, event);
      if (result !== 'conflict') return emptyTwiml();
    }
    return response(503, 'Workspace busy; retry delivery.');
  } catch {
    // Do not acknowledge an event until its transaction commits; Twilio may retry a failure.
    return response(503, 'Unable to persist webhook.');
  }
}

