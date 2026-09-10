import { normalizeContactPhone } from './people-csv.ts';
export type Program = 'guest' | 'prayer';
export type Channel = 'sms' | 'email';
export type Recurrence = { frequency:'daily'|'weekly'|'monthly'; interval:number; duration:number; durationUnit:'days'|'weeks'|'months' };
export type Occurrence = { anchor:string; dueAt:string };
export type Person = { id:string; name:string; email:string; phone:string; address:string; household:string; stage:string; paused:boolean; archived:boolean; prayerMember:boolean; guestSms:boolean; guestEmail:boolean; prayerSms:boolean; firstVisit:string; stageEnteredAt?:string; source:string; note:string; context:number; sample:boolean; completedAt?:string };
export type Prayer = { id:string; name:string; original:string; sharing:'private'|'unknown'|'shareable'; state:'review'|'drafted'|'closed'; createdAt:string; sample:boolean };
export type Target = { personId:string; destination:string; context:number };
export type Message = { id:string; program:Program; personId?:string; prayerId?:string; eventId?:string; eventVersion?:number; ruleId?:string; occurrence?:Occurrence; subject:string; body:string; channel:Channel; status:'pending'|'approved'|'held'|'cancelled'; revision:number; createdAt:string; scheduledAt:string; targets:Target[]; approval?:{ revision:number; fingerprint:string; actor:string; at:string; expiresAt:string }; reason:string };
export type Delivery = { id:string; messageId:string; revision:number; target:Target; status:'queued'|'suppressed'|'cancelled'|'simulated'|'sent'|'delivered'|'failed'|'uncertain'; reason:string; at:string };
export type Rule = { id:string; title:string; stage:string; days:number; recurrence?:Recurrence; channel:Channel; template:string; enabled:boolean; version:number };
export type Event = { id:string; title:string; kind:'starting'|'pizza'; date:string; location:string; description:string; cancelled:boolean; version:number; registered:string[]; attended:string[]; sample:boolean };
export type Task = { id:string; personId?:string; title:string; detail:string; done:boolean; private:boolean };
export type Audit = { id:string; at:string; actor:string; action:string };
export type State = { smsSuppressions?:{phone:string;at:string;messageSid:string}[]; visits?:{personId:string;at:string;source:string}[]; people:Person[]; prayers:Prayer[]; messages:Message[]; deliveries:Delivery[]; rules:Rule[]; ruleHistory:Rule[]; events:Event[]; tasks:Task[]; audit:Audit[]; settings:{ adminPhone?:string; paused:boolean; guestPaused:boolean; prayerPaused:boolean; start:string; end:string; timezone:string; weeklyLimit:number; churchName:string; tone:string; facts:string }; inbox:{id:string; personId:string; body:string; at:string; program:Program|'unassigned';from?:string;source?:'twilio'}[] };
export type Action = {type:string; [key:string]:unknown};
export const stages=['New guest','Welcome','Check-in','Returning guest','Starting Point invited','Registered','Completed','Regular attendee'];
export const uid=()=>crypto.randomUUID();
export function initialState(now=new Date()):State {
 const date=(days:number)=>new Date(now.getTime()+days*86400000).toISOString();
 const data=[['Sarah Mitchell','New guest',false],['Daniel Brooks','Returning guest',true],['Alex Morgan','Registered',true],['Emily Carter','Check-in',false],['Jordan Reed','Welcome',true],['Casey Reed','Starting Point invited',true],['Riley Parker','Completed',true],['Jamie Collins','Regular attendee',true]] as const;
 const people:Person[]=data.map(([name,stage,member],i)=>({id:`p${i+1}`,name,email:`${name.toLowerCase().replace(' ','.')}@example.com`,phone:`+1202555010${i}`,address:'',household:name.includes('Reed')?'Reed household':'',stage,paused:false,archived:false,prayerMember:member,guestSms:true,guestEmail:true,prayerSms:member,firstVisit:date(-i-1),source:'Sample record',note:'Fictional person for trying PastoralOS.',context:1,sample:true,...(stage==='Completed'?{completedAt:date(-2)}:{})}));
 const rules:Rule[]=[{id:'welcome',title:'First-visit welcome',stage:'New guest',days:0,channel:'sms',template:'Hi {firstName}! Thanks for joining us at 1AG. We’re glad you came. Is there anything we can help you with this week?',enabled:true,version:1},{id:'checkin',title:'A personal check-in',stage:'Welcome',days:3,channel:'sms',template:'Hi {firstName}, we hope your week is going well! Do you have any questions about 1AG, or anything we can pray with you about?',enabled:true,version:1},{id:'return',title:'An invitation to return',stage:'Check-in',days:7,channel:'email',template:'Hi {firstName}, we would love to see you at 1AG again. You’re always welcome here.',enabled:true,version:1},{id:'starting',title:'Starting Point invitation',stage:'Returning guest',days:7,channel:'email',template:'Hi {firstName}, interested in getting to know 1AG? Starting Point is a great next step. Reply if you’d like the details.',enabled:true,version:1}];
 const target=(id:string,channel:Channel):Target=>{const p=people.find(p=>p.id===id)!;return {personId:id,destination:channel==='sms'?p.phone:p.email,context:p.context};};
 const prayer:Prayer={id:'pr1',name:'Jamie Collins',original:'Please pray for my mother as she recovers from surgery. You may share this with the prayer chain.',sharing:'shareable',state:'drafted',createdAt:date(0),sample:true};
 return {people,prayers:[prayer,{id:'pr2',name:'Emily Carter',original:'I would like to speak with Pastor Adam about a family situation. Please keep this private.',sharing:'private',state:'review',createdAt:date(0),sample:true}],messages:[{id:'m1',program:'guest',personId:'p1',ruleId:'welcome',subject:'First-visit welcome',body:rules[0].template.replace('{firstName}','Sarah'),channel:'sms',status:'pending',revision:1,createdAt:date(0),scheduledAt:date(0),targets:[target('p1','sms')],reason:'First visit recorded'},{id:'m2',program:'guest',personId:'p2',ruleId:'starting',subject:'Your next step at 1AG',body:rules[3].template.replace('{firstName}','Daniel'),channel:'email',status:'pending',revision:1,createdAt:date(0),scheduledAt:date(0),targets:[target('p2','email')],reason:'Returning guest • Starting Point invitation'},{id:'m3',program:'prayer',prayerId:'pr1',subject:'Prayer for recovery',body:'1AG Prayer Chain: Please pray for Jamie’s mother as she recovers from surgery. Pray for strength, healing, and peace for the family.',channel:'sms',status:'pending',revision:1,createdAt:date(0),scheduledAt:date(0),targets:people.filter(p=>p.prayerMember).map(p=>target(p.id,'sms')),reason:'Sharing permission recorded'}],deliveries:[],rules,ruleHistory:[],events:[{id:'ev1',title:'Starting Point',kind:'starting',date:date(20),location:'1AG Church',description:'90-minute class after the service. Lunch and childcare provided. Sample date—confirm before inviting guests.',cancelled:false,version:1,registered:['p3'],attended:[],sample:true},{id:'ev2',title:'Pizza with the Pastors',kind:'pizza',date:date(13),location:'1AG Church',description:'Meet the pastors and get to know 1AG. Sample date—confirm before inviting guests.',cancelled:false,version:1,registered:['p2'],attended:[],sample:true}],tasks:[{id:'t1',personId:'p4',title:'A personal conversation',detail:'Emily requested a private conversation. Open Prayer Chain to review.',done:false,private:true},{id:'t2',title:'Confirm the guest gift',detail:'Your current connection card mentions a free gift. Add the gift and delivery process before opening the new form.',done:false,private:false}],audit:[{id:uid(),at:date(0),actor:'PastoralOS',action:'Sample workspace created. Live messaging is disabled.'}],settings:{paused:false,guestPaused:false,prayerPaused:false,start:'08:30',end:'20:30',timezone:'America/Chicago',weeklyLimit:2,churchName:'1AG Church',tone:'Warm, personal, concise. Use natural language; never imply Adam has personally prayed or read something unless recorded.',facts:'Starting Point is a 90-minute class held after a Sunday service. Lunch and childcare are provided. Event dates must be confirmed before invitations.'},inbox:[{id:'i1',personId:'p4',body:'Thank you for checking in. Could I speak with Pastor Adam sometime?',at:date(0),program:'guest'}]};
}

export function fingerprint(m:Message){const parts:unknown[]=[m.id,m.revision,m.program,m.channel,m.subject,m.body,m.scheduledAt,m.targets,m.eventId,m.eventVersion];if(m.occurrence)parts.push(m.occurrence);return JSON.stringify(parts);}
// Calendar arithmetic uses the church's Central wall clock, not fixed 24-hour months/days.
const centralFormatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function wallTime(date:Date){const p=Object.fromEntries(centralFormatter.formatToParts(date).map(x=>[x.type,x.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second,date.getUTCMilliseconds());}
function fromWall(wall:number){
 const offsets=new Set([-36,0,36].map(h=>{const instant=wall+h*3600000;return wallTime(new Date(instant))-instant;}));
 const candidates=[...offsets].map(offset=>new Date(wall-offset)).sort((a,b)=>a.getTime()-b.getTime());
 // Earlier instant for a repeated clock time; advance by the DST gap for a missing clock time.
 return candidates.find(d=>wallTime(d)===wall)??candidates.filter(d=>wallTime(d)>wall).sort((a,b)=>wallTime(a)-wallTime(b))[0];
}
export function addCalendar(date:Date,amount:number,unit:'days'|'weeks'|'months'){
 if(amount===0)return new Date(date);
 const wall=new Date(wallTime(date));if(unit==='months'){const day=wall.getUTCDate();wall.setUTCDate(1);wall.setUTCMonth(wall.getUTCMonth()+amount);const last=new Date(Date.UTC(wall.getUTCFullYear(),wall.getUTCMonth()+1,0)).getUTCDate();wall.setUTCDate(Math.min(day,last));}else wall.setUTCDate(wall.getUTCDate()+amount*(unit==='weeks'?7:1));
 return fromWall(wall.getTime());
}
function intervalUnit(recurrence:Recurrence){return recurrence.frequency==='monthly'?'months':recurrence.frequency==='weekly'?'weeks':'days';}
function occurrenceIndex(first:Date,date:Date,r:Recurrence){
 const a=new Date(wallTime(first)),b=new Date(wallTime(date));
 const elapsed=r.frequency==='monthly'?(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth():(wallTime(date)-wallTime(first))/86400000/(r.frequency==='weekly'?7:1);
 let index=Math.max(0,Math.floor(elapsed/r.interval));while(index>0&&addCalendar(first,index*r.interval,intervalUnit(r))>date)index--;return index;
}
export function recurrenceSummary(r?:Recurrence){if(!r)return 'One time';const unit=intervalUnit(r);return `${r.interval===1?'Every '+unit.slice(0,-1):'Every '+r.interval+' '+unit} for ${r.duration} ${r.duration===1?r.durationUnit.slice(0,-1):r.durationUnit}`;}
export function validateRecurrence(value:unknown):Recurrence|undefined{
 if(value===null||value===undefined)return undefined;if(typeof value!=='object')throw Error('Choose a valid repeat schedule.');const r=value as Recurrence;
 if(!['daily','weekly','monthly'].includes(r.frequency)||!Number.isInteger(r.interval)||r.interval<1||r.interval>12)throw Error('Repeat every 1–12 days, weeks, or months.');
 const limits={days:730,weeks:104,months:24};if(!Object.hasOwn(limits,r.durationUnit)||!Number.isInteger(r.duration)||r.duration<1||r.duration>limits[r.durationUnit])throw Error('Choose a duration of 1–730 days, 1–104 weeks, or 1–24 months.');
 return {frequency:r.frequency,interval:r.interval,duration:r.duration,durationUnit:r.durationUnit};
}
export function schedulePreview(anchor:string,days:number,recurrence?:Recurrence,limit=6){
 const first=addCalendar(new Date(anchor),days,'days');if(!recurrence)return {dates:[first.toISOString()],total:1,end:undefined};
 const end=addCalendar(first,recurrence.duration,recurrence.durationUnit),last=occurrenceIndex(first,new Date(end.getTime()-1),recurrence),total=last+1;
 return {dates:Array.from({length:Math.min(limit,total)},(_,i)=>addCalendar(first,i*recurrence.interval,intervalUnit(recurrence)).toISOString()),total,end:end.toISOString()};
}
export function dueOccurrence(anchor:string,r:Rule,now:Date):Occurrence|null{
 const first=addCalendar(new Date(anchor),r.days,'days');if(now<first)return null;
 if(!r.recurrence)return {anchor,dueAt:first.toISOString()};const end=addCalendar(first,r.recurrence.duration,r.recurrence.durationUnit);if(now>=end)return null;
 return {anchor,dueAt:addCalendar(first,occurrenceIndex(first,now,r.recurrence)*r.recurrence.interval,intervalUnit(r.recurrence)).toISOString()};
}
function occurrenceWindow(p:Person,r:Rule,m:Message):{end:Date}|null{
 if(!r.recurrence||!m.occurrence||m.occurrence.anchor!==(p.stageEnteredAt??p.firstVisit))return null;
 const first=addCalendar(new Date(m.occurrence.anchor),r.days,'days'),due=new Date(m.occurrence.dueAt),end=addCalendar(first,r.recurrence.duration,r.recurrence.durationUnit);
 if(due<first||due>=end)return null;const index=occurrenceIndex(first,due,r.recurrence);if(addCalendar(first,index*r.recurrence.interval,intervalUnit(r.recurrence)).toISOString()!==m.occurrence.dueAt)return null;
 return {end:new Date(Math.min(end.getTime(),addCalendar(first,(index+1)*r.recurrence.interval,intervalUnit(r.recurrence)).getTime()))};
}
function recurringIssue(s:State,m:Message,now?:Date):string|null{
 if(!m.ruleId)return null;const r=s.rules.find(r=>r.id===m.ruleId);if(!r)return null;
 if(!r.recurrence)return m.occurrence?'Repeat schedule changed. Dismiss this draft and prepare follow-ups again.':null;
 const p=s.people.find(p=>p.id===m.personId);const window=p&&occurrenceWindow(p,r,m);
 if(!window)return 'Repeat schedule changed. Dismiss this draft and prepare follow-ups again.';
 if(m.scheduledAt<m.occurrence!.dueAt||m.scheduledAt>=window.end.toISOString())return 'Send time must stay within this repeat period.';
 if(now&&now>=window.end)return 'Repeat period ended. Dismiss this draft and prepare the current follow-up.';
 return null;
}
function validText(v:unknown,max=4000){if(typeof v!=='string'||v.length>max)throw Error('Please check the text fields.');return v.trim();}
function reqText(v:unknown,max=4000){const s=validText(v,max);if(!s)throw Error('Please fill in the required fields.');return s;}
function isBool(v:unknown){if(typeof v!=='boolean')throw Error('Invalid choice.');return v;}
function find<T extends {id:string}>(items:T[],id:unknown):T {const x=items.find(x=>x.id===id);if(!x)throw Error('That record no longer exists. Refresh and try again.');return x;}
function change(m:Message,s:State,status:Message['status']='pending'){m.revision++;m.status=status;delete m.approval;s.deliveries.filter(d=>d.messageId===m.id&&d.status==='queued').forEach(d=>{d.status='cancelled';d.reason='Previous approval invalidated';});}
export function eligible(s:State,m:Message,t:Target):string|null{
 if(m.channel==='sms'&&s.smsSuppressions?.some(x=>x.phone===t.destination))return 'Number opted out of SMS';
 const p=s.people.find(x=>x.id===t.personId);if(!p||p.archived)return 'Person archived';
 if(p.context!==t.context)return 'Contact or conversation changed';
 if((m.channel==='sms'?p.phone:p.email)!==t.destination)return 'Destination changed';
 if(p.paused)return 'Person paused';
 if(m.program==='prayer'){const prayer=s.prayers.find(p=>p.id===m.prayerId);if(!prayer||prayer.sharing!=='shareable'||prayer.state==='closed')return 'Sharing permission unavailable';if(!p.prayerMember||!p.prayerSms)return 'Prayer membership or permission withdrawn';}
 else {if(p.completedAt||p.stage==='Completed'||p.stage==='Regular attendee')return 'Guest sequence ended';if(!(m.channel==='sms'?p.guestSms:p.guestEmail))return 'Contact permission unavailable';}
 if(m.ruleId){const rule=s.rules.find(r=>r.id===m.ruleId);if(!rule||!rule.enabled)return 'Rule paused';if(p.stage!==rule.stage)return 'Guest step changed';const issue=recurringIssue(s,m);if(issue)return issue;}
 if(m.eventId){const e=s.events.find(e=>e.id===m.eventId);if(!e||e.cancelled||e.version!==m.eventVersion)return 'Event changed';}
 return null;
}
export function inHours(date:Date,start:string,end:string,timezone='America/Chicago'){
 const t=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);return t>=start&&t<end;
}
export function dispatchCheck(s:State,m:Message,t:Target,now=new Date(),live=false):string|null{
 if(live&&(s.people.find(p=>p.id===t.personId)?.sample||s.prayers.find(p=>p.id===m.prayerId)?.sample))return 'Sample records cannot receive live messages';
 if(!live)return 'Live messaging is disabled';if(s.settings.paused||(m.program==='guest'?s.settings.guestPaused:s.settings.prayerPaused))return 'Sending paused';
 if(m.status!=='approved'||!m.approval||m.approval.revision!==m.revision||m.approval.fingerprint!==fingerprint(m))return 'Exact approval required';
 if(!m.targets.some(x=>x.personId===t.personId&&x.destination===t.destination&&x.context===t.context))return 'Recipient outside approved audience';
 if(now.toISOString()>=m.approval.expiresAt)return 'Approval expired';if(now.toISOString()<m.scheduledAt)return 'Not due';
 if(m.eventId){const e=s.events.find(e=>e.id===m.eventId);if(e&&new Date(e.date)<=now)return 'Event has already started';}
 const repeatIssue=recurringIssue(s,m,now);if(repeatIssue)return repeatIssue;
 if(!inHours(now,s.settings.start,s.settings.end,s.settings.timezone))return 'Outside sending hours';
 if(m.program==='guest'){const weekStart=now.getTime()-7*86400000;const other=s.messages.filter(x=>x.program==='guest'&&x.id!==m.id&&x.status==='approved'&&x.approval&&x.scheduledAt<=m.scheduledAt&&x.targets.some(y=>y.personId===t.personId)&&new Date(x.approval.at).getTime()>=weekStart).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id));const earlier=other.filter(x=>x.scheduledAt<m.scheduledAt||x.id<m.id);if(earlier.length>=s.settings.weeklyLimit)return 'Weekly contact limit reached';}
 return eligible(s,m,t);
}
function makeDraft(s:State,p:Person,r:Rule,now:string){
 const instant=new Date(now),anchor=p.stageEnteredAt??p.firstVisit,occurrence=dueOccurrence(anchor,r,instant);
 if(!occurrence||p.paused||p.archived||p.completedAt||p.stage!==r.stage||!r.enabled)return false;
 const previous=s.messages.filter(m=>m.personId===p.id&&m.ruleId===r.id);
 if(r.recurrence){
  if(previous.some(m=>m.occurrence?.anchor===anchor&&m.occurrence.dueAt===occurrence.dueAt))return false;
  if(previous.some(m=>m.occurrence?.anchor===anchor&&((m.status==='pending'||m.status==='held')&&occurrenceWindow(p,r,m)||m.status==='approved'&&m.approval&&m.approval.expiresAt>now)))return false;
 }else if(previous.some(m=>m.status!=='cancelled'))return false;
 const dest=r.channel==='sms'?p.phone:p.email;if(!dest||!(r.channel==='sms'?p.guestSms:p.guestEmail))return false;
 s.messages.unshift({id:uid(),program:'guest',personId:p.id,ruleId:r.id,...(r.recurrence?{occurrence}:{}),subject:r.title,body:r.template.replaceAll('{firstName}',p.name.split(' ')[0]),channel:r.channel,status:'pending',revision:1,createdAt:now,scheduledAt:now,targets:[{personId:p.id,destination:dest,context:p.context}],reason:r.recurrence?`${r.title} · ${recurrenceSummary(r.recurrence)}`:r.title});return true;
}
export function ruleImpact(s:State,ruleId:string){return {people:s.people.filter(p=>!p.archived&&!p.paused&&p.stage===s.rules.find(r=>r.id===ruleId)?.stage).length,messages:s.messages.filter(m=>m.ruleId===ruleId&&(m.status==='pending'||m.status==='approved')).length};}
export function applyAction(previous:State,a:Action,actor:string,now=new Date()):State{
 const s:State=structuredClone(previous),at=now.toISOString();let label='';
 if(a.type==='person.save'){
  const v=a.person as Partial<Person>;if(!v||typeof v!=='object')throw Error('Missing person.');
  const existing=v.id?s.people.find(p=>p.id===v.id):undefined;
  const name=reqText(v.name,120),email=validText(v.email??'',200).toLowerCase(),phone=validText(v.phone??'',40).replace(/[\s()-]/g,'');
  if(email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw Error('Enter a valid email address.');if(phone&&!/^\+?[0-9]{7,15}$/.test(phone))throw Error('Enter a phone number with country code.');
  const normalized=phone?(phone.startsWith('+')?phone:phone.length===10?'+1'+phone:'+'+phone):'';
  const duplicate=s.people.find(p=>p.id!==existing?.id&&!p.archived&&((email&&p.email===email)||(normalized&&p.phone===normalized)));
  if(duplicate&&!a.allowShared)throw Error(`This contact matches ${duplicate.name}. Open that record or confirm this is a separate person with a shared contact.`);
  const stage=existing?.stage??'New guest';
  const p:Person={id:existing?.id??uid(),name,email,phone:normalized,address:validText(v.address??'',500),household:validText(v.household??'',100),stage,paused:existing?.paused??false,archived:existing?.archived??false,prayerMember:isBool(v.prayerMember??false),guestSms:isBool(v.guestSms??false),guestEmail:isBool(v.guestEmail??false),prayerSms:isBool(v.prayerSms??false),firstVisit:existing?.firstVisit??at,stageEnteredAt:existing?.stageEnteredAt??existing?.firstVisit??at,source:existing?.source??'Staff entry',note:validText(v.note??'',2000),context:(existing?.context??0)+1,sample:existing?.sample??false,completedAt:existing?.completedAt};
  if(existing){s.people[s.people.indexOf(existing)]=p;s.messages.filter(m=>m.targets.some(t=>t.personId===p.id)&&m.program==='guest'&&m.status!=='cancelled').forEach(m=>change(m,s,'held'));s.deliveries.filter(d=>d.target.personId===p.id&&d.status==='queued').forEach(d=>{d.status='suppressed';d.reason='Person or permissions updated';});}
  else {s.people.unshift(p);if(a.enroll!==false){const r=s.rules.find(r=>r.id==='welcome'&&r.enabled);if(r)makeDraft(s,p,r,at);}}
  label=`${existing?'Updated':'Added'} ${name}; contact permissions recorded`;
 } else if(a.type==='person.status'){
  const p=find(s.people,a.id);if(a.field==='paused')p.paused=isBool(a.value);else if(a.field==='archived')p.archived=isBool(a.value);else if(a.field==='prayerMember')p.prayerMember=isBool(a.value);else if(a.field==='stage'){const stage=reqText(a.value,60);if(!stages.includes(stage)||stage==='Completed')throw Error('Record attendance through Events to complete Starting Point.');if(p.completedAt)throw Error('Completed guests require a separately reviewed restart.');if(p.stage!==stage){p.stage=stage;p.stageEnteredAt=at;}}else throw Error('Unknown person action.');
  s.messages.filter(m=>m.personId===p.id&&(m.status==='approved'||m.status==='pending')).forEach(m=>change(m,s,'held'));
  s.deliveries.filter(d=>d.target.personId===p.id&&d.status==='queued').forEach(d=>{const m=find(s.messages,d.messageId);const reason=eligible(s,m,d.target);if(reason){d.status='suppressed';d.reason=reason;}});label=`Updated ${p.name}: ${String(a.field)}`;
 } else if(a.type==='guest.intake'){
  const category=a.category;if(!['First visit','Returning guest','Regular attendee'].includes(String(category)))throw Error('Choose your visit type.');
  const name=reqText(a.name,120),email=reqText(a.email,200).toLowerCase(),phone=reqText(a.phone,40);const digits=phone.replace(/[\s()-]/g,'');const normal=digits.startsWith('+')?digits:digits.length===10?'+1'+digits:'+'+digits;
  const matches=s.people.filter(p=>!p.archived&&(p.email===email||p.phone===normal));
  if(matches.length){const exact=matches.length===1&&matches[0].email===email&&matches[0].phone===normal?matches[0]:undefined;
   if(exact){(s.visits??=[]).push({personId:exact.id,at,source:'Repeat connection card'});if(a.starting===true)s.tasks.unshift({id:uid(),personId:exact.id,title:'Starting Point interest',detail:'Requested on a repeat connection card; not a registration.',done:false,private:false});if(a.jesus===true)s.tasks.unshift({id:uid(),personId:exact.id,title:'Interest in following Jesus',detail:'Requested on a repeat connection card.',done:false,private:true});const prayer=validText(a.prayer??'',6000);if(prayer)s.prayers.unshift({id:uid(),name,original:prayer,sharing:'private',state:'review',createdAt:at,sample:false});s.audit.unshift({id:uid(),at,actor,action:'Repeat connection card linked; no duplicate enrollment or permission changes'});}
   else {const submission={name,email,phone:normal,category,address:validText(a.address??'',500),sms:isBool(a.sms),emailPermission:isBool(a.emailPermission),starting:a.starting===true,jesus:a.jesus===true,prayer:validText(a.prayer??'',6000)};s.tasks.unshift({id:uid(),title:'Review a possible duplicate connection card',detail:`Match identity before changing a profile. Original submission (private):\n${JSON.stringify(submission,null,2)}`,done:false,private:true});s.audit.unshift({id:uid(),at,actor,action:'Connection card held for identity review; no profile overwritten'});}return s;
  }
  const intermediate=applyAction(s,{type:'person.save',person:{name,email,phone,address:validText(a.address??'',500),note:'Connection card submission',guestSms:isBool(a.sms),guestEmail:isBool(a.emailPermission),prayerMember:false,prayerSms:false},enroll:category==='First visit'},actor,now);
  const person=intermediate.people[0];(intermediate.visits??=[]).push({personId:person.id,at,source:'Connection card'});person.source='Connection card preview';person.stage=category==='Regular attendee'?'Regular attendee':category==='Returning guest'?'Returning guest':'New guest';
  if(a.jesus===true)intermediate.tasks.unshift({id:uid(),personId:person.id,title:'Interest in following Jesus',detail:'Connection card requested a personal conversation about following Jesus.',done:false,private:true});
  if(a.starting===true)intermediate.tasks.unshift({id:uid(),personId:person.id,title:'Starting Point interest',detail:'Prepare an invitation to a confirmed event. Interest is not registration.',done:false,private:false});
  const prayer=validText(a.prayer??'',6000);if(prayer)intermediate.prayers.unshift({id:uid(),name,original:prayer,sharing:'private',state:'review',createdAt:at,sample:false});
  intermediate.audit.unshift({id:uid(),at,actor,action:'Connection card recorded; contact permissions captured; no message sent'});return intermediate;
 } else if(a.type==='prayer.create'){
  const sharing=a.sharing;if(!['private','unknown','shareable'].includes(String(sharing)))throw Error('Choose sharing permission.');
  s.prayers.unshift({id:uid(),name:reqText(a.name,120),original:reqText(a.original,6000),sharing:sharing as Prayer['sharing'],state:'review',createdAt:at,sample:false});label='Prayer request received; no subscription created';
 } else if(a.type==='prayer.sharing'){
  const p=find(s.prayers,a.id);if(!['private','unknown','shareable'].includes(String(a.sharing)))throw Error('Invalid sharing choice.');p.sharing=a.sharing as Prayer['sharing'];s.messages.filter(m=>m.prayerId===p.id&&m.status!=='cancelled').forEach(m=>change(m,s,'held'));label='Prayer sharing permission updated; previous approvals revoked';
 } else if(a.type==='prayer.draft'){
  const p=find(s.prayers,a.id);if(p.sharing!=='shareable'||p.state==='closed')throw Error('Sharing permission must be recorded before preparing a broadcast.');
  const targets:Target[]=[];for(const member of s.people.filter(x=>x.prayerMember&&x.prayerSms&&!x.paused&&!x.archived&&x.phone)){if(!targets.some(t=>t.destination===member.phone))targets.push({personId:member.id,destination:member.phone,context:member.context});}
  if(!targets.length)throw Error('Add a prayer-chain member with permission to receive texts first.');
  s.messages.filter(m=>m.prayerId===p.id&&m.status!=='cancelled').forEach(m=>change(m,s,'cancelled'));
  s.messages.unshift({id:uid(),program:'prayer',prayerId:p.id,subject:`Prayer request · ${p.name}`,body:reqText(a.body,2500),channel:'sms',status:'pending',revision:1,createdAt:at,scheduledAt:at,targets,reason:'Sharing permission recorded • audience fixed'});p.state='drafted';label='Prayer broadcast drafted for a fixed audience';
 } else if(a.type==='prayer.close'){
  const p=find(s.prayers,a.id);p.state='closed';s.messages.filter(m=>m.prayerId===p.id&&m.status!=='cancelled').forEach(m=>change(m,s,'cancelled'));label='Prayer request closed; unsent broadcasts cancelled';
 } else if(a.type==='message.edit'){
  const m=find(s.messages,a.id);if(m.revision!==a.revision)throw Error('This draft changed. Refresh before editing.');m.body=reqText(a.body,6000);m.subject=reqText(a.subject,180);const scheduled=new Date(String(a.scheduledAt));if(!Number.isFinite(scheduled.getTime()))throw Error('Enter a valid send time.');m.scheduledAt=scheduled.toISOString();const repeatIssue=recurringIssue(s,m,now);if(repeatIssue)throw Error(repeatIssue);change(m,s);label='Message edited; fresh approval required';
 } else if(a.type==='message.approve'){
  const m=find(s.messages,a.id);if(m.status==='approved')throw Error('This message is already approved.');if(m.status!=='pending'||m.revision!==a.revision)throw Error('This version is not awaiting approval.');
  if(m.program==='prayer'&&find(s.prayers,m.prayerId).sharing!=='shareable')throw Error('Sharing permission required.');if(!m.targets.some(t=>!eligible(s,m,t)))throw Error('No eligible recipients. Review permissions and destinations.');
  const repeatIssue=recurringIssue(s,m,now);if(repeatIssue)throw Error(repeatIssue);const repeatEnd=m.ruleId&&m.occurrence?occurrenceWindow(find(s.people,m.personId),find(s.rules,m.ruleId),m)?.end.getTime():undefined;
  const expiry=new Date(Math.min(repeatEnd??Infinity,now.getTime()+(m.program==='prayer'?24:48)*3600000,m.eventId?new Date(find(s.events,m.eventId).date).getTime():Infinity)).toISOString();if(m.scheduledAt>=expiry||expiry<=at)throw Error('This schedule is outside the approval window. Edit it before approving.');
  m.status='approved';m.approval={revision:m.revision,fingerprint:fingerprint(m),actor,at,expiresAt:expiry};
  for(const target of m.targets){const reason=eligible(s,m,target);s.deliveries.push({id:uid(),messageId:m.id,revision:m.revision,target:structuredClone(target),status:reason?'suppressed':'queued',reason:reason??'Live delivery disabled; approval saved',at});}label=`Approved exact ${m.program==='prayer'?'broadcast':'message'} revision ${m.revision}; live delivery remains disabled`;
 } else if(a.type==='message.cancel'){
  const m=find(s.messages,a.id);change(m,s,'cancelled');label='Draft dismissed; this occurrence will not be prepared again';
 } else if(a.type==='message.hold'||a.type==='message.reopen'){
  const m=find(s.messages,a.id);change(m,s,a.type==='message.hold'?'held':'pending');if(a.type==='message.reopen'){if(m.ruleId){const rule=find(s.rules,m.ruleId),person=find(s.people,m.personId);if(!rule.enabled)throw Error('Enable this rule before refreshing its draft.');if(person.stage!==rule.stage)throw Error('This draft does not match the current guest step. Prepare a new follow-up.');m.body=rule.template.replaceAll('{firstName}',person.name.split(' ')[0]);m.subject=rule.title;m.channel=rule.channel;const repeatIssue=recurringIssue(s,{...m,scheduledAt:at},now);if(repeatIssue)throw Error(repeatIssue);}if(m.eventId){const event=find(s.events,m.eventId);if(event.cancelled||new Date(event.date)<=now)throw Error('Choose an upcoming event before refreshing this invitation.');m.eventVersion=event.version;const person=find(s.people,m.personId);m.body=`Hi ${person.name.split(' ')[0]}! You're invited to ${event.title} at ${event.location} on ${new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'full',timeStyle:'short'}).format(new Date(event.date))} (Central time). ${event.description}`;}m.scheduledAt=at;m.targets=m.targets.map(t=>{const p=s.people.find(p=>p.id===t.personId);return p?{personId:p.id,destination:m.channel==='sms'?p.phone:p.email,context:p.context}:t;});}label=a.type==='message.hold'?'Message held; approval revoked':'Draft refreshed with current contact details; fresh approval required';
 } else if(a.type==='rule.save'){
  const r=find(s.rules,a.id);s.ruleHistory.unshift(structuredClone(r));r.title=reqText(a.title,100);r.template=reqText(a.template,5000);const days=Number(a.days);if(!Number.isInteger(days)||days<0||days>90)throw Error('Delay must be 0–90 days.');r.days=days;if(Object.hasOwn(a,'recurrence'))r.recurrence=validateRecurrence(a.recurrence);
  if(a.channel!=='sms'&&a.channel!=='email')throw Error('Invalid channel.');r.channel=a.channel;r.enabled=isBool(a.enabled);r.version++;
  s.messages.filter(m=>m.ruleId===r.id&&(m.status==='pending'||m.status==='approved')).forEach(m=>change(m,s,'held'));label=`Saved ${r.title} version ${r.version}; affected drafts held for review`;
 } else if(a.type==='rule.restore'){
  const r=find(s.rules,a.id);const old=s.ruleHistory.find(h=>h.id===r.id&&h.version===a.version);if(!old)throw Error('Previous version unavailable.');s.ruleHistory.unshift(structuredClone(r));Object.assign(r,structuredClone(old),{recurrence:old.recurrence?structuredClone(old.recurrence):undefined,version:r.version+1});s.messages.filter(m=>m.ruleId===r.id&&m.status!=='cancelled').forEach(m=>change(m,s,'held'));label='Restored rule as a new version; affected drafts held';
 } else if(a.type==='settings.admin-phone'){
  if(typeof a.phone!=='string')throw Error('Enter the admin phone number.');
  const phone=normalizeContactPhone(a.phone);if(!phone)throw Error('Enter the admin phone number.');
  s.settings.adminPhone=phone;s.messages.filter(m=>m.status==='approved').forEach(m=>change(m,s,'held'));label='Admin phone updated; previous text review codes revoked';
 } else if(a.type==='settings.save'){
  const v=a.settings as State['settings'];if(!v||!/^\d{2}:\d{2}$/.test(v.start)||!/^\d{2}:\d{2}$/.test(v.end)||v.start>=v.end||v.start<'00:00'||v.end>'23:59'||Number(v.start.slice(3))>59||Number(v.end.slice(3))>59)throw Error('Choose a valid daytime sending window.');
  if(!Number.isInteger(v.weeklyLimit)||v.weeklyLimit<1||v.weeklyLimit>7)throw Error('Contact limit must be 1–7.');
  const adminPhone=v.adminPhone===undefined?s.settings.adminPhone:normalizeContactPhone(v.adminPhone);if(v.adminPhone!==undefined&&!adminPhone)throw Error('Enter the admin phone number.');
  s.settings={...s.settings,adminPhone,start:v.start,end:v.end,weeklyLimit:v.weeklyLimit,tone:validText(v.tone,3000),facts:validText(v.facts,6000),guestPaused:isBool(v.guestPaused),prayerPaused:isBool(v.prayerPaused)};s.messages.filter(m=>m.status==='approved').forEach(m=>change(m,s,'held'));label='Settings updated; scheduled approvals returned to review';
 } else if(a.type==='pause'){
  s.settings.paused=isBool(a.paused);label=s.settings.paused?'All sending paused':'Global pause removed; live delivery still disabled';
 } else if(a.type==='event.save'){
  const v=a.event as Partial<Event>;const e=v.id?find(s.events,v.id):undefined;const date=new Date(reqText(v.date,50));if(!Number.isFinite(date.getTime()))throw Error('Choose a valid event date.');if(v.kind!=='starting'&&v.kind!=='pizza')throw Error('Choose event type.');
  const n:Event={id:e?.id??uid(),title:reqText(v.title,100),kind:v.kind,date:date.toISOString(),location:reqText(v.location,200),description:validText(v.description??'',2000),cancelled:isBool(v.cancelled??false),version:(e?.version??0)+1,registered:e?.registered??[],attended:e?.attended??[],sample:e?.sample??false};if(e)s.events[s.events.indexOf(e)]=n;else s.events.push(n);s.messages.filter(m=>m.eventId===n.id&&m.status!=='cancelled').forEach(m=>change(m,s,'held'));label='Event saved; linked invitations require review';
 } else if(a.type==='event.register'||a.type==='event.attend'){
  const e=find(s.events,a.eventId),p=find(s.people,a.personId);if(e.cancelled)throw Error('This event is cancelled.');if(!e.registered.includes(p.id))e.registered.push(p.id);
  if(a.type==='event.attend'){if(new Date(e.date)>now)throw Error('Attendance can be recorded after the event starts.');if(!e.attended.includes(p.id))e.attended.push(p.id);if(e.kind==='starting'){p.stage='Completed';p.completedAt=at;s.messages.filter(m=>m.personId===p.id&&m.program==='guest'&&m.status!=='cancelled').forEach(m=>change(m,s,'cancelled'));}label=`Recorded ${p.name}'s attendance at ${e.title}`;}else {if(e.kind==='starting'&&!p.completedAt){if(p.stage!=='Registered'){p.stage='Registered';p.stageEnteredAt=at;}s.messages.filter(m=>m.personId===p.id&&m.status!=='cancelled').forEach(m=>change(m,s,'held'));}label=`Registered ${p.name} for ${e.title}`;}
 } else if(a.type==='event.invite'){
  const e=find(s.events,a.eventId),p=find(s.people,a.personId);if(e.cancelled||new Date(e.date)<now)throw Error('Choose an upcoming event.');if(p.completedAt||p.stage==='Completed'||p.stage==='Regular attendee')throw Error('Guest follow-up is complete.');const channel:Channel=p.guestEmail&&p.email?'email':'sms';if(!(channel==='sms'?p.guestSms&&p.phone:p.guestEmail&&p.email))throw Error('Contact permission required.');
  const textDate=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'full',timeStyle:'short'}).format(new Date(e.date));s.messages.unshift({id:uid(),program:'guest',personId:p.id,eventId:e.id,eventVersion:e.version,subject:`You're invited: ${e.title}`,body:`Hi ${p.name.split(' ')[0]}! You're invited to ${e.title} at ${e.location} on ${textDate} (Central time). ${e.description}`,channel,status:'pending',revision:1,createdAt:at,scheduledAt:at,targets:[{personId:p.id,destination:channel==='sms'?p.phone:p.email,context:p.context}],reason:`Invitation • ${e.title}`});label='Event invitation prepared for approval';
 } else if(a.type==='inbox.add'){
  const p=find(s.people,a.personId);s.inbox.unshift({id:uid(),personId:p.id,body:reqText(a.body,6000),at,program:a.program==='prayer'?'prayer':'guest'});p.context++;s.messages.filter(m=>m.personId===p.id&&m.status!=='cancelled').forEach(m=>change(m,s,'held'));s.deliveries.filter(d=>d.target.personId===p.id&&d.status==='queued').forEach(d=>{d.status='suppressed';d.reason='Conversation changed; review required';});label='Conversation note recorded; stale follow-up held';
 } else if(a.type==='message.compose'){
  const p=find(s.people,a.personId);const channel=a.channel==='email'?'email':'sms';if(!(channel==='sms'?p.guestSms&&p.phone:p.guestEmail&&p.email))throw Error('Guest contact permission required.');s.messages.unshift({id:uid(),program:'guest',personId:p.id,subject:reqText(a.subject,180),body:reqText(a.body,6000),channel,status:'pending',revision:1,createdAt:at,scheduledAt:at,targets:[{personId:p.id,destination:channel==='sms'?p.phone:p.email,context:p.context}],reason:'Personal follow-up'});label='Personal message drafted for approval';
 } else if(a.type==='task.done'){
  const task=find(s.tasks,a.id);task.done=!task.done;label=task.done?'Task marked complete':'Task reopened';
 } else if(a.type==='prepare'){
  let count=0;if(!s.settings.paused&&!s.settings.guestPaused)for(const p of s.people){if(p.paused||p.archived||p.completedAt||['Completed','Regular attendee','Registered'].includes(p.stage))continue;for(const r of s.rules){if(makeDraft(s,p,r,at))count++;}}label=`Prepared ${count} eligible follow-up drafts; none sent`;
 } else if(a.type==='delivery.check'){
  for(const d of s.deliveries.filter(d=>d.status==='queued')){const m=find(s.messages,d.messageId);const blocked=eligible(s,m,d.target);if(blocked){d.status='suppressed';d.reason=blocked;}else d.reason=dispatchCheck(s,m,d.target,now,false)??'Ready';}label='Delivery eligibility checked; no messages sent';
 } else throw Error('Unknown action.');
 s.audit.unshift({id:uid(),at,actor,action:label});s.audit=s.audit.slice(0,1000);return s;
}
