import type {CommunicationsState} from './communications.ts';

export type SmsBubble={id:string;body:string;at:string;direction:'in'|'out';status:string;detail?:string;automated:boolean;line:'general'|'prayer'|'legacy';scheduledAt?:string};
export type SmsThread={phone:string;name:string;personId?:string;shared:boolean;messages:SmsBubble[];lastIncomingId:string;unread:boolean;done:boolean};
type PrayerOutbox={id:string;to:string;body:string;createdAt:string;sentAt?:string;status:string;kind:string;providerSid?:string;error?:string};
const statusLabel=(status:string)=>({pending:'Queued',sending:'Sending',sent:'Sent',delivered:'Delivered',failed:'Failed',error:'Failed',uncertain:'Delivery unknown',skipped:'Not sent',suppressed:'Not sent',cancelled:'Cancelled',queued:'Queued',simulated:'Preview only'}[status]??status);

/** Join by the actual phone used, never by a contact's possibly changed current phone. */
export function smsThreads(state:CommunicationsState,now=new Date()):SmsThread[]{
 const map=new Map<string,SmsBubble[]>(),providerIds=new Set<string>();
 function add(phone:string|undefined,bubble:SmsBubble,providerId?:string){
  if(!phone||!/^\+[1-9]\d{7,14}$/.test(phone)||providerId&&providerIds.has(providerId))return;
  if(providerId)providerIds.add(providerId);
  const messages=map.get(phone)??[];messages.push(bubble);map.set(phone,messages);
 }
 for(const i of state.inbox){
  // Staff notes and demo conversations are not received text messages.
  if(i.source!=='twilio')continue;
  add(i.from??state.people.find(p=>p.id===i.personId)?.phone,{id:i.id,body:i.body,at:i.at,direction:'in',status:'Received',automated:false,line:i.line??'prayer'});
 }
 for(const b of state.broadcasts??[]){
  if(b.channel!=='sms'||b.status==='draft')continue;
  for(const t of b.targets)add(t.destination,{id:b.id+':'+t.personId,body:b.body,at:t.attemptedAt??b.createdAt,direction:'out',status:b.status==='cancelled'&&t.status==='pending'?'Cancelled':t.status==='pending'&&b.scheduledAt>now.toISOString()?'Scheduled':statusLabel(t.status),detail:t.reason,automated:false,line:b.smsLine??'legacy',scheduledAt:b.scheduledAt},t.providerId);
 }
 for(const d of state.deliveries){
  const m=state.messages.find(m=>m.id===d.messageId);if(!m||m.channel!=='sms'||d.status==='simulated')continue;
  add(d.target.destination,{id:d.id,body:d.revision===m.revision?m.body:'Earlier message version — wording is no longer available.',at:d.attemptedAt??d.at,direction:'out',status:statusLabel(d.status),detail:d.reason,automated:true,line:m.program==='prayer'?'prayer':'legacy'},d.providerId);
 }
 const automation=(state as CommunicationsState&{automation?:{outbox:PrayerOutbox[]}}).automation;
 for(const o of automation?.outbox??[]){
  add(o.to,{id:o.id,body:o.body,at:o.sentAt??o.createdAt,direction:'out',status:statusLabel(o.status),detail:o.error,automated:true,line:'prayer'},o.providerSid);
 }
 return [...map.entries()].map(([phone,messages])=>{
  messages.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
  const people=state.people.filter(p=>p.phone===phone&&!p.archived&&!p.sample),person=people.length===1?people[0]:undefined;
  const incoming=messages.filter(m=>m.direction==='in').at(-1),meta=state.smsThreads?.[phone];
  return {phone,name:person?.name??(people.length>1?'Shared phone':phone),personId:person?.id,shared:people.length>1,messages,lastIncomingId:incoming?.id??'',unread:!!incoming&&meta?.readThrough!==incoming.id,done:!!meta?.done&&(meta.doneThrough??'')===(incoming?.id??'')};
 }).sort((a,b)=>b.messages.at(-1)!.at.localeCompare(a.messages.at(-1)!.at)||a.phone.localeCompare(b.phone));
}
