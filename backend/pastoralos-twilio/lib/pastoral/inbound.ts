import { type State } from './model.ts';

export type IncomingSms = {
  accountSid: string; messageSid: string; from: string; to: string;
  body: string; optOut: string; mediaCount: number;
};

export function smsOptOut(body: string, providerType: string): 'STOP' | 'START' | 'HELP' | '' {
  // Provider classification takes precedence; also support the default keyword set.
  if (['STOP', 'START', 'HELP'].includes(providerType)) return providerType as 'STOP' | 'START' | 'HELP';
  const word = body.trim().toUpperCase();
  if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT'].includes(word)) return 'STOP';
  if (['START', 'UNSTOP', 'YES'].includes(word)) return 'START';
  if (['HELP', 'INFO'].includes(word)) return 'HELP';
  return '';
}

export function applyIncomingSms(previous: State, event: IncomingSms, now = new Date(), line:'prayer'|'general'='prayer'): State {
  const s = structuredClone(previous), at = now.toISOString();
  const id = `twilio:${event.accountSid}:${event.messageSid}`;
  // The database receipt is the authoritative dedupe key. These IDs also make retries safe in memory.
  if (s.audit.some(a => a.id === id)) return s;
  const people = s.people.filter(p => p.phone === event.from);
  const peopleIds = new Set(people.map(p => p.id));
  const optOut = smsOptOut(event.body, event.optOut);
  if (optOut === 'STOP') {
    s.smsSuppressions ??= [];
    if (!s.smsSuppressions.some(x => x.phone === event.from)) {
      s.smsSuppressions.push({ phone: event.from, at, messageSid: event.messageSid });
    }
    // STOP belongs to the number, including all profiles sharing it and both programs.
    people.forEach(p => { p.guestSms = false; p.prayerSms = false; });
  }
  people.forEach(p => { p.context++; });
  for (const m of s.messages) {
    const affected = peopleIds.has(m.personId ?? '') || (m.channel === 'sms' && m.targets.some(t => t.destination === event.from));
    if (affected && m.status !== 'cancelled') {
      m.status = 'held'; m.revision++; delete m.approval;
      m.reason = optOut === 'STOP' ? 'SMS opt-out received; review required' : 'Incoming reply; review required';
      s.deliveries.filter(d => d.messageId === m.id && d.status === 'queued').forEach(d => {
        d.status = 'suppressed'; d.reason = m.reason;
      });
    }
  }
  const body = event.body + (event.mediaCount ? `\n[${event.mediaCount} attachment(s) received. Media retrieval is not connected.]` : '');
  if (people.length === 1 && !people[0].archived) {
    s.inbox.unshift({ id, personId: people[0].id, body, at, program: 'unassigned', from: event.from, to:event.to, line, source: 'twilio' });
  } else {
    if(line==='general')s.inbox.unshift({id,personId:'',body,at,program:'unassigned',from:event.from,to:event.to,line,source:'twilio'});
    s.tasks.unshift({ id, title: people.length > 1 ? 'Review reply from a shared phone' : 'Review incoming text',
      detail: `From ${event.from}\n${body}\nDo not assume identity or permission to share this request.`, done: false, private: true });
  }
  if (optOut === 'START') {
    // A carrier unblock does not select or consent to either church program.
    s.tasks.unshift({ id: `${id}:consent`, personId: people.length === 1 ? people[0].id : undefined,
      title: 'Review SMS re-enrollment request', detail: 'START/YES received. Confirm program-specific consent before restoring texting. Number suppression remains active.', done: false, private: true });
  }
  s.audit.unshift({ id, at, actor: 'Twilio', action: optOut === 'STOP'
    ? 'SMS opt-out recorded for this number across all programs; unsent approvals held.'
    : 'Incoming SMS saved for private review; no automatic reply or enrollment.' });
  return s;
}

