import {inHours, type State, type Person, type Channel, type Action} from './model.ts';

export type Group = {id:string; name:string};
export type ContactPreference = {email:boolean; sms:boolean};
export type DirectoryPerson = Person & {groups?:string[]; tags?:string[]; groupPreferences?:Record<string,ContactPreference>};
export type BroadcastTarget = {personId:string; destination:string; context:number; status:'pending'|'sending'|'sent'|'skipped'|'failed'|'uncertain'; reason?:string; providerId?:string; attemptedAt?:string};
export type Broadcast = {id:string; revision:number; subject:string; body:string; channel:Channel; groupIds:string[]; scheduledAt:string; createdAt:string; status:'draft'|'queued'|'cancelled'; targets:BroadcastTarget[]; approval?:{actor:string;at:string;fingerprint:string}};
export type CommunicationsState = State & {directoryGroups?:Group[]; broadcasts?:Broadcast[]};
export type DeliveryConnection = {sms:boolean; email:boolean; emailFrom?:string; emailReplyTo?:string; emailReason?:string};
export const builtinGroups:Group[]=[{id:'prayer',name:'Prayer chain'},{id:'guests',name:'Guest follow-up'}];
export const directoryGroups=(s:CommunicationsState)=>[...builtinGroups,...(s.directoryGroups??[])];
export function memberships(p:DirectoryPerson):string[]{return [...new Set([...(p.groups??[]).filter(x=>x!=='prayer'&&x!=='guests'),...(p.prayerMember?['prayer']:[]),...((p.groups??[]).includes('guests')||!['Regular attendee','Completed'].includes(p.stage)?['guests']:[])])];}
export function preferences(p:DirectoryPerson,id:string):ContactPreference {if(id==='prayer')return {email:p.groupPreferences?.prayer?.email??false,sms:p.prayerSms};if(id==='guests')return {email:p.guestEmail,sms:p.guestSms};return p.groupPreferences?.[id]??{email:false,sms:false};}
export function recipientIssue(s:CommunicationsState,b:Pick<Broadcast,'channel'|'groupIds'>,p:DirectoryPerson):string|null {
 if(p.archived)return 'Archived';if(p.paused)return 'Contact paused';
 if(!b.groupIds.some(id=>memberships(p).includes(id)&&preferences(p,id)[b.channel]))return 'Group membership or permission unavailable';
 const destination=b.channel==='sms'?p.phone:p.email;
 if(!destination)return 'Contact details missing';
 if(b.channel==='sms'&&!/^\+[1-9]\d{7,14}$/.test(destination))return 'Invalid phone number';
 if(b.channel==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destination))return 'Invalid email address';
 if(b.channel==='sms'&&s.smsSuppressions?.some(x=>x.phone===destination))return 'Opted out of texts';
 return null;
}
export function audience(s:CommunicationsState,b:Pick<Broadcast,'channel'|'groupIds'>):BroadcastTarget[]{
 const seen=new Set<string>();return s.people.flatMap(p=>{if(recipientIssue(s,b,p))return [];const destination=b.channel==='sms'?p.phone:p.email.toLowerCase();if(seen.has(destination))return [];seen.add(destination);return [{personId:p.id,destination,context:p.context,status:'pending' as const}];});
}
export function broadcastFingerprint(b:Broadcast):string{return JSON.stringify([b.id,b.revision,b.subject,b.body,b.channel,[...b.groupIds].sort(),b.scheduledAt,b.targets.map(t=>[t.personId,t.destination,t.context])]);}
export function broadcastIssue(s:CommunicationsState,b:Broadcast,t:BroadcastTarget,now=new Date()):string|null {
 if(b.status!=='queued'||!b.approval||b.approval.fingerprint!==broadcastFingerprint(b))return 'Approval changed';
 if(s.settings.paused)return 'Workflows paused';
 if(s.settings.prayerPaused&&b.groupIds.includes('prayer'))return 'Prayer chain paused';
 if(s.settings.guestPaused&&b.groupIds.includes('guests'))return 'Guest follow-up paused';
 if(b.scheduledAt>now.toISOString())return 'Scheduled for later';
 if(!inHours(now,s.settings.start,s.settings.end,s.settings.timezone))return 'Outside sending hours';
 const p=s.people.find(p=>p.id===t.personId);if(!p)return 'Person removed';if(p.sample)return 'Sample contacts cannot receive broadcasts';
 if(p.context!==t.context||(b.channel==='sms'?p.phone:p.email.toLowerCase())!==t.destination)return 'Contact changed since approval';
 return recipientIssue(s,b,p);
}
export function broadcastStatus(b:Broadcast):string {
 if(b.status==='draft')return 'Draft';if(b.status==='cancelled')return 'Cancelled';
 if(b.targets.some(t=>['uncertain','failed'].includes(t.status)))return 'Needs attention';
 if(b.targets.length&&b.targets.every(t=>t.status==='sent'))return 'Sent';
 if(b.targets.length&&b.targets.every(t=>['sent','skipped'].includes(t.status)))return b.targets.some(t=>t.status==='sent')?'Finished with skips':'Not sent';
 if(b.targets.some(t=>t.status==='sending'||t.status==='sent'))return 'Sending';
 return b.scheduledAt>new Date().toISOString()?'Scheduled':'Queued';
}
function text(v:unknown,max:number){if(typeof v!=='string'||v.trim().length>max)throw Error('Check the text fields.');return v.trim();}
function strings(v:unknown,max=100):string[]{if(!Array.isArray(v)||v.length>max||v.some(x=>typeof x!=='string'||!x.trim()||x.length>100))throw Error('Check the group or tag selection.');return [...new Set(v.map(x=>x.trim()))];}
export function applyCommunicationsAction(previous:State,action:Action,actor:string,connection:DeliveryConnection,now=new Date()):CommunicationsState {
 const s=structuredClone(previous) as CommunicationsState,at=now.toISOString();let label='';
 if(action.type==='directory.group'){
  const name=text(action.name,60);if(!name)throw Error('Enter a group name.');
  if(directoryGroups(s).some(g=>g.name.toLowerCase()===name.toLowerCase()))throw Error('That group already exists.');
  (s.directoryGroups??=[]).push({id:crypto.randomUUID(),name});label=`Created group: ${name}`;
 }else if(action.type==='directory.person'){
  const p=s.people.find(p=>p.id===action.id) as DirectoryPerson|undefined;if(!p)throw Error('Person not found.');
  const groups=strings(action.groups),tags=strings(action.tags,30),prefs=action.preferences as Record<string,ContactPreference>;
  if(groups.some(id=>!directoryGroups(s).some(g=>g.id===id)))throw Error('Group no longer exists.');
  if(!prefs||typeof prefs!=='object'||Array.isArray(prefs))throw Error('Check communication preferences.');
  const clean:Record<string,ContactPreference>={};for(const id of groups){const v=prefs[id];if(!v||typeof v.email!=='boolean'||typeof v.sms!=='boolean')throw Error('Check communication preferences.');clean[id]={email:v.email,sms:v.sms};}
  // Guest membership follows the assimilation journey; removing it must be done there.
  if(memberships(p).includes('guests')&&!groups.includes('guests'))throw Error('Manage guest enrollment from Assimilation.');
  p.groups=groups;p.tags=tags;p.groupPreferences=clean;p.prayerMember=groups.includes('prayer');p.prayerSms=clean.prayer?.sms??false;
  if(groups.includes('guests')){p.guestEmail=clean.guests.email;p.guestSms=clean.guests.sms;}
  p.context++;label=`Updated groups and communication preferences for ${p.name}`;
 }else if(action.type==='broadcast.save'){
  const existing=action.id?s.broadcasts?.find(b=>b.id===action.id):undefined;if(action.id&&!existing)throw Error('Broadcast not found.');if(existing?.status!=='draft'&&existing)throw Error('Cancel this broadcast before creating a replacement.');
  const channel=action.channel;if(channel!=='sms'&&channel!=='email')throw Error('Choose email or text message.');
  const subject=text(action.subject,180),body=text(action.body,channel==='sms'?1400:12000),groupIds=strings(action.groupIds);
  if(!subject||!body||!groupIds.length)throw Error('Add a title, message, and audience.');
  if(groupIds.some(id=>!directoryGroups(s).some(g=>g.id===id)))throw Error('Choose an existing group.');
  const date=action.scheduledAt?new Date(String(action.scheduledAt)):now;if(!Number.isFinite(date.getTime()))throw Error('Choose a valid date and time.');
  if(date.getTime()>now.getTime()+366*86400000)throw Error('Schedule up to one year ahead.');
  const b:Broadcast={id:existing?.id??crypto.randomUUID(),revision:(existing?.revision??0)+1,subject,body,channel,groupIds,scheduledAt:date.toISOString(),createdAt:existing?.createdAt??at,status:'draft',targets:[]};
  if(existing)s.broadcasts![s.broadcasts!.indexOf(existing)]=b;else(s.broadcasts??=[]).unshift(b);label='Broadcast draft saved';
 }else if(action.type==='broadcast.approve'){
  const b=s.broadcasts?.find(b=>b.id===action.id);if(!b||b.status!=='draft'||b.revision!==action.revision)throw Error('This draft changed. Review it again.');
  if(!connection[b.channel])throw Error(b.channel==='email'?'Amazon SES is not connected. You can save email drafts.':'Text delivery is not connected.');
  const targets=audience(s,b).filter(t=>!s.people.find(p=>p.id===t.personId)?.sample);if(!targets.length)throw Error('No recipients with recorded permission.');
  // Bind approval to the reviewed audience, not a newly expanded list.
  if(JSON.stringify(targets.map(t=>[t.personId,t.destination,t.context]))!==JSON.stringify(action.audience))throw Error('Recipients changed. Review this broadcast again.');
  b.targets=targets;b.status='queued';b.approval={actor,at,fingerprint:broadcastFingerprint(b)};label=`Approved ${b.channel==='email'?'email':'text'} broadcast to ${targets.length} recipients`;
 }else if(action.type==='broadcast.cancel'){
  const b=s.broadcasts?.find(b=>b.id===action.id);if(!b)throw Error('Broadcast not found.');b.status='cancelled';for(const t of b.targets)if(t.status==='pending'){t.status='skipped';t.reason='Cancelled by staff';}label='Broadcast cancelled; messages already submitted cannot be recalled';
 }else throw Error('Unknown communications action.');
 s.audit.unshift({id:crypto.randomUUID(),at,actor,action:label});s.audit=s.audit.slice(0,1000);return s;
}
