import {channelPermissions,setChannelPermissions} from './contact-permissions.ts';
import {validateDesign,renderEmail,type EmailDesign} from './email-design.ts';
import {isAssimilating,applyAction,inHours, type State, type Person, type Channel, type Action} from './model.ts';

export type Group = {id:string; name:string};
export type ContactPreference = {email:boolean; sms:boolean};
export type DirectoryPerson = Person & {groups?:string[]; tags?:string[]; groupPreferences?:Record<string,ContactPreference>; contactPermissions?:ContactPreference};
export type BroadcastTarget = {personId:string; destination:string; context:number; status:'pending'|'sending'|'sent'|'skipped'|'failed'|'uncertain'; reason?:string; providerId?:string; attemptedAt?:string};
export type SkippedRecipient = {personId:string;name:string;reason:string};
export type Broadcast = { smsLine?:'general'; skippedRecipients?:SkippedRecipient[];id:string; revision:number; subject:string; body:string; channel:Channel; groupIds:string[]; personIds?:string[]; design?:EmailDesign; scheduledAt:string; createdAt:string; status:'draft'|'queued'|'cancelled'; targets:BroadcastTarget[]; approval?:{actor:string;at:string;fingerprint:string}};
export type CommunicationsState = State & {directoryGroups?:Group[]; broadcasts?:Broadcast[]; smsThreads?:Record<string,{readThrough?:string;doneThrough?:string;done?:boolean}>; emailTemplates?:{id:string;name:string;design:EmailDesign}[]};
export type DeliveryConnection = {sms:boolean; email:boolean; emailFrom?:string; emailReplyTo?:string; emailReason?:string; smsReason?:string; smsFrom?:string};
export const builtinGroups:Group[]=[{id:'prayer',name:'Prayer chain'},{id:'guests',name:'Assimilation'}];
export const directoryGroups=(s:CommunicationsState)=>[...builtinGroups,...(s.directoryGroups??[])];
export function memberships(p:DirectoryPerson):string[]{return [...new Set([...(p.groups??[]).filter(x=>x!=='prayer'&&x!=='guests'),...(p.prayerMember?['prayer']:[]),...(isAssimilating(p)?['guests']:[])])];}
export function preferences(p:DirectoryPerson,id:string):ContactPreference {return {...channelPermissions(p),...(id==='prayer'?{email:false}:{})};}
export function selectedFor(b:Pick<Broadcast,'groupIds'|'personIds'>,p:DirectoryPerson){return !!b.personIds?.includes(p.id)||b.groupIds.some(id=>memberships(p).includes(id));}
export function recipientIssue(s:CommunicationsState,b:Pick<Broadcast,'channel'|'groupIds'|'personIds'>,p:DirectoryPerson):string|null {
 if(p.archived)return 'Archived';if(p.paused)return 'Contact paused';
 if(!selectedFor(b,p))return 'No longer in the selected audience';
 if(b.channel==='email'&&b.groupIds.includes('prayer'))return 'Prayer chain uses text messages only';
 if(!channelPermissions(p)[b.channel])return b.channel==='sms'?'No text permission':'No email permission';
 const destination=b.channel==='sms'?p.phone:p.email;
 if(!destination)return 'Contact details missing';
 if(b.channel==='sms'&&!/^\+[1-9]\d{7,14}$/.test(destination))return 'Invalid phone number';
 if(b.channel==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destination))return 'Invalid email address';
 if(b.channel==='sms'&&s.smsSuppressions?.some(x=>x.phone===destination))return 'Opted out of texts';
 return null;
}
export function audienceReport(s:CommunicationsState,b:Pick<Broadcast,'channel'|'groupIds'|'personIds'>){
 const targets:BroadcastTarget[]=[],skipped:SkippedRecipient[]=[],seen=new Set<string>();
 for(const p of s.people){if(!selectedFor(b,p))continue;const destination=b.channel==='sms'?p.phone:p.email.toLowerCase();
  const reason=recipientIssue(s,b,p)??(p.sample?'Sample contact':seen.has(destination)?'Shared address or number; included once':null);
  if(reason){skipped.push({personId:p.id,name:p.name,reason});continue;}
  seen.add(destination);targets.push({personId:p.id,destination,context:p.context,status:'pending'});
 }
 return {targets,skipped};
}
export function audience(s:CommunicationsState,b:Pick<Broadcast,'channel'|'groupIds'|'personIds'>):BroadcastTarget[]{return audienceReport(s,b).targets;}
function canonical(value:unknown):unknown {if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value;}
export function broadcastFingerprint(b:Broadcast):string{return JSON.stringify([b.id,b.revision,b.subject,b.body,b.channel,[...b.groupIds].sort(),b.scheduledAt,b.targets.map(t=>[t.personId,t.destination,t.context]),...(b.personIds?.length||b.design?[b.personIds??[],canonical(b.design??null)]:[])]);}
export function broadcastIssue(s:CommunicationsState,b:Broadcast,t:BroadcastTarget,now=new Date()):string|null {
 if(b.status!=='queued'||!b.approval||b.approval.fingerprint!==broadcastFingerprint(b))return 'Message changed after sending was requested';
 if(s.settings.paused)return 'Workflows paused';
 if(s.settings.prayerPaused&&b.groupIds.includes('prayer'))return 'Prayer chain paused';
 if(s.settings.guestPaused&&b.groupIds.includes('guests'))return 'Guest follow-up paused';
 if(b.scheduledAt>now.toISOString())return 'Scheduled for later';
 if(!inHours(now,s.settings.start,s.settings.end,s.settings.timezone))return 'Outside sending hours';
 const p=s.people.find(p=>p.id===t.personId);if(!p)return 'Person removed';if(p.sample)return 'Sample contacts cannot receive broadcasts';
 if(p.context!==t.context||(b.channel==='sms'?p.phone:p.email.toLowerCase())!==t.destination)return 'Contact changed since sending was requested';
 return recipientIssue(s,b,p);
}
export function broadcastStatus(b:Broadcast):string {
 if(b.status==='draft')return 'Draft';if(b.status==='cancelled')return 'Cancelled';
 if(b.targets.some(t=>['uncertain','failed'].includes(t.status)))return 'Needs attention';
 if(!b.targets.length&&b.skippedRecipients?.length)return 'Not sent';
 if(b.targets.length&&b.targets.every(t=>t.status==='sent'))return b.skippedRecipients?.length?'Finished with skips':'Sent';
 if(b.targets.length&&b.targets.every(t=>['sent','skipped'].includes(t.status)))return b.targets.some(t=>t.status==='sent')?'Finished with skips':'Not sent';
 if(b.targets.some(t=>t.status==='sending'||t.status==='sent'))return 'Sending';
 return b.scheduledAt>new Date().toISOString()?'Scheduled':'Queued';
}
function text(v:unknown,max:number){if(typeof v!=='string'||v.trim().length>max)throw Error('Check the text fields.');return v.trim();}
function strings(v:unknown,max=100):string[]{if(!Array.isArray(v)||v.length>max||v.some(x=>typeof x!=='string'||!x.trim()||x.length>100))throw Error('Check the group or tag selection.');return [...new Set(v.map(x=>x.trim()))];}
export function applyCommunicationsAction(previous:State,action:Action,actor:string,connection:DeliveryConnection,now=new Date()):CommunicationsState {
 let s=structuredClone(previous) as CommunicationsState,at=now.toISOString();let label='';
 if(action.type==='conversation.read'||action.type==='conversation.status'){
  const phone=text(action.phone,32);if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Conversation phone number is missing.');
  const incoming=s.inbox.filter(i=>i.source==='twilio'&&(i.from??s.people.find(p=>p.id===i.personId)?.phone)===phone).sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id))[0];
  // Bind read/done to the last inbound message actually shown. New replies reopen the thread.
  if((incoming?.id??'')!==action.lastIncomingId)throw Error('A new reply arrived. Refresh the conversation.');
  const meta=(s.smsThreads??={})[phone]??{};
  if(action.type==='conversation.read'){meta.readThrough=incoming?.id;label='Conversation marked read';}
  else {if(typeof action.done!=='boolean')throw Error('Choose a conversation status.');meta.done=action.done;meta.doneThrough=incoming?.id;label=action.done?'Conversation marked done':'Conversation reopened';}
  s.smsThreads[phone]=meta;
 }else if(action.type==='broadcast.template'){
  const name=text(action.name,80);if(!name)throw Error('Name the template.');const design=validateDesign(action.design);(s.emailTemplates??=[]).unshift({id:crypto.randomUUID(),name,design});if(s.emailTemplates.length>50)throw Error('Up to 50 templates can be saved.');label='Email template saved';
 }else if(action.type==='directory.group'){
  const name=text(action.name,60);if(!name)throw Error('Enter a group name.');
  if(directoryGroups(s).some(g=>g.name.toLowerCase()===name.toLowerCase()))throw Error('That group already exists.');
  (s.directoryGroups??=[]).push({id:crypto.randomUUID(),name});label=`Created tag: ${name}`;
 }else if(action.type==='directory.person'){
  const p=s.people.find(p=>p.id===action.id) as DirectoryPerson|undefined;if(!p)throw Error('Person not found.');
  if(action.preferences!==undefined||action.contactPermissions!==undefined)throw Error('Contact permissions have been simplified. Reload the page before saving.');
  const groups=strings(action.groups),tags=strings(action.tags??[],30);
  if(groups.some(id=>!directoryGroups(s).some(g=>g.id===id)))throw Error('Group no longer exists.');
  if(groups.includes('guests')!==isAssimilating(p))throw Error('Use assimilation enrollment to change guest follow-up.');
  setChannelPermissions(p,action.channelPermissions??channelPermissions(p));
  p.groups=groups;p.tags=tags;p.prayerMember=groups.includes('prayer');
  p.context++;if(typeof action.enroll==='boolean')s=applyAction(s,{type:'person.enrollment',id:p.id,enroll:action.enroll},actor,now) as CommunicationsState;label=`Updated tags and communication preferences for ${p.name}`;
 }else if(action.type==='broadcast.save'||action.type==='broadcast.send'){
  const existing=action.id?s.broadcasts?.find(b=>b.id===action.id):undefined;if(action.id&&!existing)throw Error('Broadcast not found.');if(existing?.status!=='draft'&&existing)throw Error('Cancel this broadcast before creating a replacement.');
  const channel=action.channel;if(channel!=='sms'&&channel!=='email')throw Error('Choose email or text message.');
  const subject=text(action.subject,180),design=channel==='email'&&action.design?validateDesign(action.design):undefined,body=design?renderEmail(design).text:text(action.body,channel==='sms'?1400:24000),groupIds=strings(action.groupIds),personIds=strings(action.personIds??[],1000);
  if(personIds.some(id=>!s.people.some(p=>p.id===id)))throw Error('A selected person no longer exists.');
  if(!subject||!body)throw Error('Add a subject and message.');if(action.type==='broadcast.send'&&!groupIds.length&&!personIds.length)throw Error('Choose an audience.');
  if(groupIds.some(id=>!directoryGroups(s).some(g=>g.id===id)))throw Error('Choose an existing group.');
  if(channel==='email'&&groupIds.includes('prayer'))throw Error('Prayer chain uses text messages only. Choose Text messages for that group.');
  const date=action.scheduledAt?new Date(String(action.scheduledAt)):now;if(!Number.isFinite(date.getTime()))throw Error('Choose a valid date and time.');
  if(date.getTime()>now.getTime()+366*86400000)throw Error('Schedule up to one year ahead.');
  const b:Broadcast={id:existing?.id??crypto.randomUUID(),revision:(existing?.revision??0)+1,subject,body,channel,groupIds,...(personIds.length?{personIds}:{}),...(design?{design}:{}),scheduledAt:date.toISOString(),createdAt:existing?.createdAt??at,status:'draft',targets:[]};
  if(existing)s.broadcasts![s.broadcasts!.indexOf(existing)]=b;else(s.broadcasts??=[]).unshift(b);label='Broadcast draft saved';
  if(action.type==='broadcast.send'){if(action.scheduledAt&&date<=now)throw Error('Choose a future time to schedule.');return applyCommunicationsAction(s,{type:'broadcast.queue',id:b.id,revision:b.revision,audience:action.audience},actor,connection,now);}
 }else if(action.type==='broadcast.queue'||action.type==='broadcast.approve'){
  const b=s.broadcasts?.find(b=>b.id===action.id);if(!b||b.status!=='draft'||b.revision!==action.revision)throw Error('This draft changed. Review it again.');
  if(!connection[b.channel])throw Error(b.channel==='email'?'Amazon SES is not connected. You can save email drafts.':'Text delivery is not connected.');
  const {targets,skipped}=audienceReport(s,b);if(!targets.length&&!skipped.length)throw Error('Choose at least one person or a group with people.');
  b.skippedRecipients=skipped;
  // Sending is one staff action. Retain the exact content and audience snapshot for safe dispatch.
  if(JSON.stringify(targets.map(t=>[t.personId,t.destination,t.context]))!==JSON.stringify(action.audience))throw Error('Recipients changed. Review this broadcast again.');
  b.targets=targets;b.status='queued';if(b.channel==='sms')b.smsLine='general';b.approval={actor,at,fingerprint:broadcastFingerprint(b)};label=`${targets.length} queued · ${skipped.length} skipped${skipped.length?' — see delivery report':''}`;
 }else if(action.type==='broadcast.cancel'){
  const b=s.broadcasts?.find(b=>b.id===action.id);if(!b)throw Error('Broadcast not found.');b.status='cancelled';for(const t of b.targets)if(t.status==='pending'){t.status='skipped';t.reason='Cancelled by staff';}label='Broadcast cancelled; messages already submitted cannot be recalled';
 }else throw Error('Unknown communications action.');
 s.audit.unshift({id:crypto.randomUUID(),at,actor,action:label});s.audit=s.audit.slice(0,1000);return s;
}
