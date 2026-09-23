import {channelPermissions} from './contact-permissions.ts';
import { applyAction, type State, type Target } from './model.ts';

export type PrayerApprovalState = State & { automation?: {
  enabled: boolean; broadcastsEnabled: boolean;
  requests: {id:string; prayerId:string; messageId?:string; draft:string; privateRequested:boolean; status:string; awaitingEdit?:boolean; fingerprint?:string}[];
  outbox: {requestId:string; messageId?:string; status:string; kind:string}[];
} };

export function prayerRecipients(state: State): Target[] {
  const seen = new Set<string>();
  return state.people.flatMap(person => {
    if (!person.prayerMember || !channelPermissions(person).sms || person.paused || person.archived || person.sample ||
        !/^\+[1-9]\d{7,14}$/.test(person.phone) || seen.has(person.phone) ||
        state.smsSuppressions?.some(item => item.phone === person.phone)) return [];
    seen.add(person.phone);
    return [{personId: person.id, destination: person.phone, context: person.context}];
  });
}

export function prayerMessage(state: State, prayerId: string) {
  return state.messages.find(message => message.program === 'prayer' && message.prayerId === prayerId && message.status !== 'cancelled');
}

export function prayerNeedsApproval(state: State, prayerId: string) {
  const prayer = state.prayers.find(prayer => prayer.id === prayerId);
  const message = prayerMessage(state, prayerId);
  return !!prayer && prayer.state !== 'closed' && !(message?.status === 'approved' && message.approval?.sendRequested);
}

export function prayerDraft(state: PrayerApprovalState, prayerId: string): string {
  const message=prayerMessage(state,prayerId);
  if(message?.body)return message.body;
  const request=state.automation?.requests.find(request=>request.prayerId===prayerId);
  if(request)return request.draft;
  return state.prayers.find(prayer=>prayer.id===prayerId)?.original||'';
}

/** One staff decision saves the displayed wording and queues its fixed audience.
 * The API checks the workspace version before calling this function. */
export function approvePrayerRequest(previous: PrayerApprovalState, input: {id:unknown; body:unknown}, actor: string, now = new Date()): PrayerApprovalState {
  let state = structuredClone(previous);
  const prayer = state.prayers.find(prayer => prayer.id === input.id);
  if (!prayer || prayer.state === 'closed' || prayer.sample) throw Error('This prayer request is not available for sending.');
  const request = state.automation?.requests.find(request => request.prayerId === prayer.id);
  if(request&&['received','drafting','error'].includes(request.status))throw Error('Wait for the prayer summary to finish before approving.');
  if (prayer.sharing === 'private' || request?.privateRequested) throw Error('This request was marked private and stays with the pastor.');
  if (!state.automation?.enabled || !state.automation.broadcastsEnabled) throw Error('Prayer-chain delivery is not enabled yet.');
  if (typeof input.body !== 'string' || !input.body.trim() || input.body.trim().length > 6000) throw Error('Enter a prayer message between 1 and 6,000 characters.');
  if (!prayerNeedsApproval(state, prayer.id)) throw Error('This prayer request is already approved for sending.');
  const priorIds = new Set(state.messages.filter(message => message.prayerId === prayer.id).map(message => message.id));
  if (state.deliveries.some(delivery => priorIds.has(delivery.messageId) && ['sent','delivered','uncertain'].includes(delivery.status)) ||
      state.automation.outbox.some(item => item.kind === 'broadcast' && (priorIds.has(item.messageId ?? '') || item.requestId === request?.id) && ['sending','sent','uncertain'].includes(item.status))) {
    throw Error('Sending has already started for this request. Check its delivery status before sending anything else.');
  }
  const targets = prayerRecipients(state);
  if (!targets.length) throw Error('Choose at least one prayer-chain member with permission to receive texts.');

  // Replace unsent preparation in this same save; it never needs a second approval.
  for (const message of state.messages.filter(message => priorIds.has(message.id))) {
    message.status = 'cancelled'; delete message.approval;
  }
  for (const delivery of state.deliveries) if (priorIds.has(delivery.messageId) && delivery.status === 'queued') delivery.status = 'cancelled';
  for (const item of state.automation.outbox) if ((priorIds.has(item.messageId ?? '') || item.requestId === request?.id) && item.status === 'pending') item.status = 'cancelled';
  // This records the pastor's explicit sharing decision, not inferred caller consent.
  prayer.sharing = 'shareable'; prayer.state = 'drafted';
  const messageId = crypto.randomUUID(), at = now.toISOString();
  state.messages.unshift({id:messageId,program:'prayer',prayerId:prayer.id,subject:`Prayer for ${prayer.name}`,body:input.body.trim(),channel:'sms',status:'pending',revision:1,createdAt:at,scheduledAt:at,targets,reason:'Pastor approved sharing this wording with designated prayer-chain members'});
  state = applyAction(state,{type:'message.approve',id:messageId,revision:1},actor,now) as PrayerApprovalState;
  const savedRequest = state.automation?.requests.find(item => item.prayerId === prayer.id);
  if (savedRequest) { savedRequest.messageId=messageId; savedRequest.draft=input.body.trim(); savedRequest.status='approved'; savedRequest.awaitingEdit=false; savedRequest.fingerprint=''; }
  state.audit[0].action = `Prayer approved and queued for ${targets.length} prayer-chain ${targets.length === 1 ? 'member' : 'members'}`;
  return state;
}
