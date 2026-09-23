import {channelPermissions} from './contact-permissions.ts';
import { trustedGreeting } from './greeting.ts';
import { applyAction, eligible, fingerprint, type State, type Target, type Message } from './model.ts';

export const PASTOR_APPROVAL_PHONE = '+13099893498'; // Legacy workspaces only.
export function adminPhone(s:State):string { return s.settings.adminPhone??PASTOR_APPROVAL_PHONE; }
export type PrayerSmsEvent = { messageSid:string; from:string; body:string; optOut?:string };
export type PrayerProposalResult = { draft:string; privateRequested:boolean; summary?:string; category?:string };
export type PrayerRequest = {
 id:string; source:'sms'|'voice'; from:string; original:string; transcript:string;
 recordingSid?:string; callSid?:string; status:'received'|'drafting'|'review'|'approved'|'rejected'|'error';
 privateRequested:boolean; draft:string; code:string; prayerId:string; messageId?:string; revision:number;
 createdAt:string; expiresAt?:string; fingerprint?:string; error?:string; audioDeleted:boolean;
 attempts?:number; nextAttemptAt?:string; transcriptionSavedAt?:string; awaitingEdit?:boolean;
 sharingEvidence?:string; greetingUrl?:string; category?:string; summary?:string;
};
export type SmsOutbox = {
 id:string; kind:'approval'|'command'|'broadcast'; requestId:string; revision:number; to:string; body:string;
 status:'pending'|'sending'|'sent'|'cancelled'|'error'|'uncertain'; createdAt:string;
 providerSid?:string; error?:string; sentAt?:string; attempts?:number; nextAttemptAt?:string;
 messageId?:string; messageRevision?:number; target?:Target;
};
export type Automation = { requests:PrayerRequest[]; outbox:SmsOutbox[]; enabled:boolean; broadcastsEnabled:boolean; nextCode?:number; commandSids?:string[] };
export type AutomationState = State & { automation?:Automation };
export function getAutomation(state:AutomationState):Automation {
 return state.automation??{ requests:[], outbox:[], enabled:false, broadcastsEnabled:false, nextCode:1, commandSids:[] };
}
function copy(state:AutomationState):AutomationState { const s=structuredClone(state); s.automation=getAutomation(s); return s; }
function audit(s:AutomationState,action:string,now:Date) { s.audit.unshift({id:crypto.randomUUID(),at:now.toISOString(),actor:'Prayer automation',action}); s.audit=s.audit.slice(0,1000); }
function requestById(s:AutomationState,id:string) { const r=s.automation!.requests.find(r=>r.id===id); if(!r)throw Error('Prayer request unavailable.'); return r; }
const smsId=/^SM[0-9a-f]{32}$/i, recordingId=/^RE[0-9a-f]{32}$/i, callId=/^CA[0-9a-f]{32}$/i;
const control=/^(?:(?:STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT|REVOKE|OPTOUT|START|UNSTOP|HELP|INFO|YES|NO|EDIT)|(?:YES|NO|EDIT)\s+\d+(?:\s*:[\s\S]*)?)$/i;
export function isPrayerCommand(body:string) { return /^(YES|NO|EDIT)(?:\s|$)/i.test(body.trim()); }
export function ingestPrayerSms(previous:AutomationState,event:PrayerSmsEvent,now=new Date()):AutomationState {
 const s=copy(previous);
 if(!smsId.test(event.messageSid)||!/^\+[1-9]\d{6,14}$/.test(event.from))throw Error('Invalid inbound prayer identifiers.');
 if(event.optOut||control.test(event.body.trim())||!event.body.trim())return s;
 if(s.automation!.requests.some(r=>r.id===event.messageSid))return s;
 const original=event.body; if(original.length>12000)throw Error('Prayer request is too long.');
 const prayerId=`prayer-${event.messageSid}`;
 const person=s.people.find(p=>p.phone===event.from&&!p.archived&&!p.sample);
 s.prayers.unshift({id:prayerId,name:person?.name??event.from,original,sharing:'unknown',state:'review',createdAt:now.toISOString(),sample:false});
 s.automation!.requests.push({id:event.messageSid,source:'sms',from:event.from,original,transcript:original,status:'received',privateRequested:false,draft:'',code:'',prayerId,revision:0,createdAt:now.toISOString(),audioDeleted:true,transcriptionSavedAt:now.toISOString()});
 audit(s,'Prayer text received privately; sharing permission remains unconfirmed',now); return s;
}
export function ingestPrayerRecording(previous:AutomationState,event:{ recordingSid:string; callSid:string; from:string; greetingUrl?:string; sharingEvidence?:string },now=new Date()):AutomationState {
 const s=copy(previous);
 if(!recordingId.test(event.recordingSid)||!callId.test(event.callSid)||(event.from!==''&&!/^\+[1-9]\d{6,14}$/.test(event.from)))throw Error('Invalid prayer recording identifiers.');
 if(s.automation!.requests.some(r=>r.id===event.recordingSid))return s;
 const prayerId=`prayer-${event.recordingSid}`;
 s.automation!.requests.push({id:event.recordingSid,source:'voice',from:event.from,original:'',transcript:'',recordingSid:event.recordingSid,callSid:event.callSid,status:'received',privateRequested:false,draft:'',code:'',prayerId,revision:0,createdAt:now.toISOString(),audioDeleted:false,...(trustedGreeting(event.greetingUrl)&&event.sharingEvidence==='Caller left voicemail after prayer-chain broadcast disclosure.'?{greetingUrl:event.greetingUrl,sharingEvidence:event.sharingEvidence}:{})});
 audit(s,'Prayer voicemail received privately; transcription pending',now); return s;
}
export function fixedPrayerAudience(s:AutomationState):Target[] {
 const seen=new Set<string>(), targets:Target[]=[];
 for(const p of s.people){if(p.sample||p.archived||p.paused||!p.prayerMember||!channelPermissions(p).sms||!/^\+[1-9]\d{6,14}$/.test(p.phone)||seen.has(p.phone)||s.smsSuppressions?.some(x=>x.phone===p.phone))continue; seen.add(p.phone); targets.push({personId:p.id,destination:p.phone,context:p.context});}
 return targets;
}
function reviewFingerprint(s:AutomationState,r:PrayerRequest) {
 const prayer=s.prayers.find(p=>p.id===r.prayerId), m=s.messages.find(m=>m.id===r.messageId);
 return JSON.stringify([adminPhone(s),r.id,r.revision,r.original,r.transcript,r.draft,r.category,r.summary,prayer?.sharing,prayer?.state,r.awaitingEdit??false,r.expiresAt,m?fingerprint(m):null,m?.status,s.settings.start,s.settings.end,s.settings.timezone,m?.targets.map(t=>[t,s.people.find(p=>p.id===t.personId)?.name,s.people.find(p=>p.id===t.personId)?.sample]),m?.targets.map(t=>eligible(s,m,t))]);
}
function cancelNotifications(s:AutomationState,r:PrayerRequest) {
 for(const item of s.automation!.outbox)if(item.requestId===r.id&&item.kind==='approval'&&item.status==='pending')item.status='cancelled';
}
function nextCode(s:AutomationState) {
 const a=s.automation!;
 const highest=Math.max(0,...a.requests.map(r=>Number(r.code)||0));
 const code=Math.max(a.nextCode??1,highest+1); a.nextCode=code+1; return String(code);
}
export function rerouteAdminReviews(previous:AutomationState,now=new Date()):AutomationState {
 let s=copy(previous);
 for(const item of s.automation!.outbox)if(item.kind!=='broadcast'&&item.status==='pending')item.status='cancelled';
 for(const id of s.automation!.requests.filter(r=>r.status==='review').map(r=>r.id)){
  const r=requestById(s,id);
  r.fingerprint='';
  if(r.awaitingEdit){
   r.code=nextCode(s);r.revision++;
   s.automation!.outbox.push({id:`admin-edit-${r.id}-${r.revision}`,kind:'command',requestId:r.id,revision:r.revision,to:adminPhone(s),body:`Prayer review ${r.code} remains held for editing. Review the original request in PastoralOS, then send EDIT ${r.code}: followed by your complete replacement wording.`,status:'pending',createdAt:now.toISOString()});
  }else s=refreshPrayerReview(s,r.id,now);
 }
 return s;
}
/** The link selects a private review; opening it never grants access or approval. */
export function approvalNotification(s:AutomationState,request:PrayerRequest|string):string[] {
 const r=typeof request==='string'?requestById(s,request):request;
 return [`You have a new prayer request: https://1ag.tv/pastoralos/#prayer?request=${encodeURIComponent(r.id)}`];
}
/** Collapse legacy queued review parts without repeating a notification already submitted. */
export function compactPendingPrayerNotifications(s:AutomationState):void {
 const outbox=getAutomation(s).outbox;
 for(const r of getAutomation(s).requests){
  const group=outbox.filter(o=>o.kind==='approval'&&o.requestId===r.id&&o.revision===r.revision);
  const pending=group.filter(o=>o.status==='pending');
  if(!pending.length)continue;
  const submitted=group.some(o=>['sent','sending','uncertain'].includes(o.status));
  pending.forEach((o,i)=>{if(submitted||i>0)o.status='cancelled';else o.body=approvalNotification(s,r)[0];});
 }
}
function createReview(s:AutomationState,r:PrayerRequest,now:Date) {
 cancelNotifications(s,r);r.revision++;r.code=nextCode(s);r.status='review';r.awaitingEdit=false;r.expiresAt=new Date(now.getTime()+24*3600000).toISOString();
 r.fingerprint=reviewFingerprint(s,r);
 const parts=approvalNotification(s,r);
 parts.forEach((body,index)=>s.automation!.outbox.push({id:`review-${r.id}-${r.revision}-${index+1}`,kind:'approval',requestId:r.id,revision:r.revision,to:adminPhone(s),body,status:'pending',createdAt:now.toISOString()}));
}
function createMessage(s:AutomationState,r:PrayerRequest,now:Date) {
 const targets=fixedPrayerAudience(s);if(!targets.length)return;
 const id=`broadcast-${r.id}-${r.revision+1}`;
 const m:Message={id,program:'prayer',prayerId:r.prayerId,subject:'1AG prayer request',body:r.draft,channel:'sms',status:'pending',revision:1,createdAt:now.toISOString(),scheduledAt:now.toISOString(),targets,reason:'Prayer request prepared for exact review; fixed audience'};
 s.messages.unshift(m);r.messageId=id;s.prayers.find(p=>p.id===r.prayerId)!.state='drafted';
}
export function applyPrayerProposal(previous:AutomationState,id:string,result:PrayerProposalResult,now=new Date()):AutomationState {
 const s=copy(previous),r=requestById(s,id);
 if(r.status==='review'||r.status==='approved'||r.status==='rejected')return s;
 if(typeof result.draft!=='string'||(!result.draft.trim()&&(!result.category||result.category==='prayer'))||result.draft.length>6000||typeof result.privateRequested!=='boolean')throw Error('Invalid prayer proposal.');
 if(!(r.transcript||r.original).trim())throw Error('Save a usable transcript before preparing prayer wording.');
 let prayer=s.prayers.find(p=>p.id===r.prayerId);
 if(!prayer){prayer={id:r.prayerId,name:s.people.find(p=>p.phone===r.from&&!p.archived&&!p.sample)?.name??r.from,original:r.transcript||r.original,sharing:'unknown',state:'review',createdAt:r.createdAt,sample:false};s.prayers.unshift(prayer);}
 r.draft=result.draft.trim();r.privateRequested=result.privateRequested;r.category=result.category??'prayer';r.summary=result.summary?.slice(0,1000);delete r.error;
 if(result.privateRequested)prayer.sharing='private';
 else if(r.source==='voice'&&r.category==='prayer'&&r.sharingEvidence==='Caller left voicemail after prayer-chain broadcast disclosure.'&&trustedGreeting(r.greetingUrl))prayer.sharing='shareable';
 if(prayer.sharing==='shareable'&&r.category==='prayer'&&r.draft)createMessage(s,r,now);
 createReview(s,r,now);audit(s,'Prayer wording prepared for pastor review; no sharing permission inferred',now);return s;
}
/** Reissue a code when the dashboard changes wording, sharing permission, or the reviewed context. */
export function refreshPrayerReview(previous:AutomationState,id:string,now=new Date()):AutomationState {
 const s=copy(previous),r=requestById(s,id);if(r.status!=='review'||r.awaitingEdit)return s;
 const prayer=s.prayers.find(p=>p.id===r.prayerId);let m=s.messages.find(m=>m.id===r.messageId);
 if(!prayer||prayer.state==='closed'||m?.status==='cancelled'){r.status='rejected';cancelNotifications(s,r);return s;}
 if(m?.status==='approved'){r.status='approved';cancelNotifications(s,r);return s;}
 if(m?.status==='held'){cancelNotifications(s,r);return s;} // Staff holds require an explicit reopen or replacement edit.
 if(r.fingerprint===reviewFingerprint(s,r))return s; // Expiry alone never triggers daily repeat notifications.
 if(m){r.draft=m.body;}
 else if(prayer.sharing==='shareable'&&r.category==='prayer'&&r.draft)createMessage(s,r,now);
 createReview(s,r,now);audit(s,'Prayer review refreshed; previous text approval code invalidated',now);return s;
}
export function notificationCurrent(s:AutomationState,item:SmsOutbox,now=new Date()):boolean {
 if(item.kind==='broadcast'||item.to!==adminPhone(s)||s.smsSuppressions?.some(x=>x.phone===item.to))return false;
 const r=getAutomation(s).requests.find(r=>r.id===item.requestId);
 if(item.kind==='command')return !r||item.revision===r.revision;
 return !!r&&r.status==='review'&&!r.awaitingEdit&&r.revision===item.revision&&!!r.expiresAt&&r.expiresAt>now.toISOString()&&r.fingerprint===reviewFingerprint(s,r);
}
function commandReply(s:AutomationState,event:PrayerSmsEvent,body:string,now:Date,r?:PrayerRequest) {
 s.automation!.outbox.push({id:`command-${event.messageSid}`,kind:'command',requestId:r?.id??'',revision:r?.revision??0,to:adminPhone(s),body,status:'pending',createdAt:now.toISOString()});
}
export function applyPrayerCommand(previous:AutomationState,event:PrayerSmsEvent,now=new Date()):AutomationState {
 let s=copy(previous);
 if(event.from!==adminPhone(s)||!smsId.test(event.messageSid)||event.optOut||!isPrayerCommand(event.body))return s;
 if(s.automation!.commandSids?.includes(event.messageSid))return s;
 (s.automation!.commandSids??=[]).push(event.messageSid);
 if(s.smsSuppressions?.some(x=>x.phone===event.from))return s;
 const match=/^(YES|NO|EDIT)\s+(\d+)(?:\s*:\s*([\s\S]*))?\s*$/i.exec(event.body.trim());
 if(!match){commandReply(s,event,'Please include the review code: YES 42, NO 42, or EDIT 42: replacement wording. A bare reply cannot approve a prayer request.',now);return s;}
 const [,verb,code,replacement]=match,command=verb.toUpperCase();
 let r=s.automation!.requests.find(r=>r.code===code&&r.status==='review');
 if(!r){commandReply(s,event,'That review code is no longer awaiting approval. Please use the code on the latest complete review.',now);return s;}
 const m=s.messages.find(m=>m.id===r!.messageId),prayer=s.prayers.find(p=>p.id===r!.prayerId);
 if(!prayer||prayer.state==='closed'||m?.status==='cancelled'||m?.status==='approved'){commandReply(s,event,'This prayer review has been closed or changed. Open PastoralOS to review it.',now,r);return s;}
 if(!r.awaitingEdit&&(r.fingerprint!==reviewFingerprint(s,r)||!r.expiresAt||r.expiresAt<=now.toISOString())){commandReply(s,event,'This request changed or expired. Open PastoralOS or wait for the updated review before approving.',now,r);return s;}
 if(command!=='EDIT'&&replacement!==undefined){commandReply(s,event,'Use YES plus the code to approve, NO plus the code to dismiss, or EDIT plus the code and replacement wording.',now,r);return s;}
 const notifications=s.automation!.outbox.filter(x=>x.kind==='approval'&&x.requestId===r!.id&&x.revision===r!.revision);
 if(!r.awaitingEdit&&(!notifications.length||notifications.some(x=>x.status!=='sent'))){commandReply(s,event,'The complete review has not finished sending. Please wait for all review parts before replying.',now,r);return s;}
 if(command==='NO'){
  if(m)s=applyAction(s,{type:'message.cancel',id:m.id},'Pastor by verified SMS',now) as AutomationState;
  r=requestById(s,r.id);r.status='rejected';cancelNotifications(s,r);commandReply(s,event,`Prayer review ${code} dismissed. Nothing will be broadcast.`,now,r);audit(s,'Prayer request dismissed by verified pastor SMS',now);return s;
 }
 if(command==='EDIT'){
  if(replacement!==undefined&&(!replacement.trim()||replacement.length>6000)){commandReply(s,event,'Please provide replacement wording between 1 and 6,000 characters.',now,r);return s;}
  if(m){
   s=applyAction(s,replacement!==undefined?{type:'message.edit',id:m.id,revision:m.revision,body:replacement,subject:m.subject,scheduledAt:now.toISOString()}:{type:'message.hold',id:m.id},'Pastor by verified SMS',now) as AutomationState;
   r=requestById(s,r.id);
  }
  if(replacement===undefined){r.awaitingEdit=true;cancelNotifications(s,r);commandReply(s,event,`Prayer review ${code} is held. Send EDIT ${code}: followed by your complete replacement wording.`,now,r);return s;}
  r.draft=replacement.trim();createReview(s,r,now);audit(s,'Pastor edited prayer wording by SMS; fresh exact approval required',now);return s;
 }
 if(r.awaitingEdit){commandReply(s,event,`This request is held for editing. Send EDIT ${code}: followed by your complete replacement wording.`,now,r);return s;}
 if(!prayer||prayer.sharing!=='shareable'||!m){commandReply(s,event,'Sharing permission must be recorded in PastoralOS before this request can be approved for broadcast.',now,r);return s;}
 if(!m.targets.length||m.targets.every(t=>s.people.find(p=>p.id===t.personId)?.sample||eligible(s,m,t))){commandReply(s,event,'No approved recipients remain eligible. Review prayer-chain membership and permissions in PastoralOS.',now,r);return s;}
 try{s=applyAction(s,{type:'message.approve',id:m.id,revision:m.revision},'Pastor by verified SMS',now) as AutomationState;}
 catch{commandReply(s,event,'This draft cannot be approved now. Please review its status in PastoralOS.',now,r);return s;}
 r=requestById(s,r.id);r.status='approved';const approved=s.messages.find(x=>x.id===m.id)!;if(approved.approval&&r.expiresAt&&approved.approval.expiresAt>r.expiresAt)approved.approval.expiresAt=r.expiresAt;
 cancelNotifications(s,r);commandReply(s,event,`Prayer review ${code} approved for its exact audience and sending window. Delivery still follows sending controls and current opt-outs.`,now,r);return s;
}

