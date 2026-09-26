import {addCalendar, type State, type Action} from './model.ts';

export type CareSource={kind:'prayer'|'conversation';id:string};
export type CareCase={id:string;personId:string;title:string;detail:string;status:'open'|'waiting'|'closed';source?:CareSource;createdAt:string;closedAt?:string};
export type CareTask={id:string;caseId?:string;personId:string;title:string;dueAt:string;status:'open'|'done'|'cancelled';notify:boolean;repeatDays:number;revision:number;createdAt:string;doneAt?:string};
export type CareNote={id:string;personId:string;caseId?:string;taskId?:string;body:string;at:string;kind:'note'|'visit'|'call'|'action'};
export type CarePlan={id:string;name:string;steps:{title:string;days:number}[]};
export type CarePreferences={channel:'off'|'email'|'sms';email:string;digestTime:string;dueReminders:boolean;pauseOnReply:boolean;enabledAt?:string};
export type CareNotice={id:string;kind:'digest'|'due';taskIds:string[];taskRevisions:number[];day:string;channel:'email'|'sms';destination:string;status:'pending'|'sending'|'sent'|'failed'|'uncertain'|'cancelled';createdAt:string;attemptedAt?:string;providerId?:string;reason?:string;attempts:number};
export type CareData={cases:CareCase[];tasks:CareTask[];notes:CareNote[];plans:CarePlan[];preferences:CarePreferences;notices:CareNotice[];availability:{personId:string;from:string;through:string}[];replyHolds:Record<string,{at:string;messageId:string}>;worker?:{at:string;issues:string[]}};
export type CareState=State&{care?:CareData};
export const defaultPlans:CarePlan[]=[
 {id:'hospital',name:'Hospital or surgery',steps:[{title:'Call before the procedure',days:-1},{title:'Check in after the procedure',days:1},{title:'Follow up on recovery',days:7}]},
 {id:'bereavement',name:'Bereavement',steps:[{title:'Make a personal call',days:0},{title:'Check on practical needs',days:3},{title:'Follow up with the family',days:14},{title:'Check in again',days:30}]},
 {id:'new-baby',name:'New baby',steps:[{title:'Congratulate the family',days:0},{title:'Check on the family',days:7},{title:'Follow up',days:30}]},
 {id:'shut-in',name:'Shut-in visit',steps:[{title:'Arrange a visit',days:0},{title:'Check in again',days:14}]},
 {id:'check-in',name:'General check-in',steps:[{title:'Make a personal call',days:0},{title:'Follow up',days:7}]},
];
export const emptyCare=():CareData=>({cases:[],tasks:[],notes:[],plans:structuredClone(defaultPlans),preferences:{channel:'off',email:'',digestTime:'08:00',dueReminders:true,pauseOnReply:true},notices:[],availability:[],replyHolds:{}});
export const careData=(s:State):CareData=>(s as CareState).care??emptyCare();
export function ensureCare(s:State):CareData{return (s as CareState).care??=emptyCare();}
export const centralDay=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
export const centralClock=(d:Date)=>new Intl.DateTimeFormat('en-GB',{timeZone:'America/Chicago',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
export function careLocalTime(value:string):string{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Choose a date and time.');
 const [date,time]=value.split('T'),wall=Date.parse(value+'Z');
 for(const offset of [5,6]){const d=new Date(wall+offset*3600000);if(Number.isFinite(d.getTime())&&centralDay(d)===date&&centralClock(d)===time)return d.toISOString();}
 throw Error('That Central time does not exist. Choose another time.');
}
export const careInputTime=(value:string)=>{const d=new Date(value);return centralDay(d)+'T'+centralClock(d);};
export function availabilityIssue(s:State,personId:string,date:string){return careData(s).availability.some(x=>x.personId===personId&&x.from<=date&&x.through>=date)?'Unavailable on this date':null;}
const str=(v:unknown,max:number,required=true)=>{if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))throw Error('Complete the required fields.');return v.trim();};
const instant=(v:unknown)=>{const s=str(v,35);if(!Number.isFinite(Date.parse(s)))throw Error('Choose a valid date and time.');return new Date(s).toISOString();};
function history(c:CareData,personId:string,body:string,at:string,extra:Partial<CareNote>={}){c.notes.unshift({id:crypto.randomUUID(),personId,body,at,kind:'action',...extra});}
function addTask(c:CareData,personId:string,title:string,dueAt:string,at:string,caseId?:string,notify=true,repeatDays=0){
 c.tasks.push({id:crypto.randomUUID(),personId,title,dueAt,status:'open',notify,repeatDays,revision:1,createdAt:at,...(caseId?{caseId}:{})});
}
export function applyCareAction(previous:State,a:Action,actor:string,now=new Date()):CareState{
 const s=structuredClone(previous) as CareState,c=ensureCare(s),at=now.toISOString();let label='Care updated';
 const personId=typeof a.personId==='string'?a.personId:'';
 const person=()=>{const p=s.people.find(p=>p.id===personId&&!p.archived);if(!p)throw Error('Choose an existing person from People.');return p;};
 if(a.type==='care.case.save'){
  person();const old=c.cases.find(x=>x.id===a.id);if(a.id&&!old)throw Error('Care record no longer exists.');
  const title=str(a.title,120),detail=str(a.detail??'',6000,false);
  if(old){if(old.personId!==personId)throw Error('A care record cannot be moved to another person.');Object.assign(old,{title,detail});}
  else {
   let source:CareSource|undefined;
   if(a.source){const x=a.source as CareSource;if(!['prayer','conversation'].includes(x.kind)||typeof x.id!=='string'||!(x.kind==='prayer'?s.prayers:s.inbox).some(r=>r.id===x.id))throw Error('Source is unavailable.');source={kind:x.kind,id:x.id};
    if(c.cases.some(r=>r.status!=='closed'&&r.source?.kind===x.kind&&r.source.id===x.id))throw Error('This item already has an open care record.');}
   const id=crypto.randomUUID();c.cases.push({id,personId,title,detail,status:'open',createdAt:at,...(source?{source}:{})});
   if(!Array.isArray(a.steps)||!a.steps.length||a.steps.length>20)throw Error('Add at least one next action.');
   for(const step of a.steps as {title:unknown;dueAt:unknown}[])addTask(c,personId,str(step.title,120),instant(step.dueAt),at,id);
   history(c,personId,'Care plan started: '+title,at,{caseId:id});
  }label=old?'Care details saved':'Care plan created';
 }else if(a.type==='care.case.status'){
  const item=c.cases.find(x=>x.id===a.id);if(!item||!['open','waiting','closed'].includes(String(a.status)))throw Error('Choose an available care record.');
  item.status=a.status as CareCase['status'];if(item.status==='closed'){item.closedAt=at;for(const t of c.tasks)if(t.caseId===item.id&&t.status==='open'){t.status='cancelled';t.revision++;}}else delete item.closedAt;
  history(c,item.personId,'Care record '+item.status,at,{caseId:item.id});label='Care status updated';
 }else if(a.type==='care.task.save'){
  person();const old=c.tasks.find(x=>x.id===a.id);if(a.id&&!old)throw Error('Follow-up no longer exists.');
  const title=str(a.title,120),dueAt=instant(a.dueAt),repeatDays=Number(a.repeatDays??0);
  if(!Number.isInteger(repeatDays)||repeatDays<0||repeatDays>365)throw Error('Repeat interval must be 0 to 365 days.');
  const caseId=typeof a.caseId==='string'&&a.caseId?a.caseId:undefined;
  if(caseId&&!c.cases.some(x=>x.id===caseId&&x.personId===personId&&x.status!=='closed'))throw Error('Choose an open care record.');
  if(typeof a.notify!=='boolean')throw Error('Choose a reminder setting.');
  if(old){if(old.status!=='open'||old.personId!==personId)throw Error('Only open follow-ups can be edited.');Object.assign(old,{title,dueAt,repeatDays,notify:a.notify,revision:old.revision+1});}
  else addTask(c,personId,title,dueAt,at,caseId,a.notify,repeatDays);
  history(c,personId,'Follow-up scheduled: '+title,at,{caseId});label='Follow-up saved';
 }else if(['care.task.done','care.task.snooze','care.task.cancel'].includes(a.type)){
  const t=c.tasks.find(x=>x.id===a.id);if(!t||t.status!=='open')throw Error('This follow-up is no longer open.');
  if(a.type.endsWith('snooze')){t.dueAt=instant(a.dueAt);if(t.dueAt<=at)throw Error('Choose a future reminder time.');t.revision++;history(c,t.personId,'Rescheduled: '+t.title,at,{caseId:t.caseId,taskId:t.id});label='Reminder rescheduled';}
  else{t.status=a.type.endsWith('done')?'done':'cancelled';t.doneAt=at;t.revision++;
   history(c,t.personId,(t.status==='done'?'Completed: ':'Cancelled: ')+t.title,at,{caseId:t.caseId,taskId:t.id});
   if(typeof a.note==='string'&&a.note.trim())history(c,t.personId,str(a.note,6000),at,{caseId:t.caseId,taskId:t.id,kind:'note'});
   if(t.status==='done'&&(a.nextDueAt||t.repeatDays)){const due=a.nextDueAt?instant(a.nextDueAt):addCalendar(now,t.repeatDays,'days').toISOString();if(due<=at)throw Error('The next follow-up must be in the future.');addTask(c,t.personId,t.title,due,at,t.caseId,t.notify,t.repeatDays);}
   label=t.status==='done'?'Follow-up completed':'Follow-up cancelled';
  }
 }else if(a.type==='care.note.add'){
  person();const body=str(a.body,6000),kind=['visit','call','note'].includes(String(a.kind))?a.kind as CareNote['kind']:'note';
  const caseId=typeof a.caseId==='string'&&a.caseId?a.caseId:undefined;
  if(caseId&&!c.cases.some(x=>x.id===caseId&&x.personId===personId))throw Error('Care record unavailable.');
  history(c,personId,body,at,{caseId,kind});
  if(a.followUpAt)addTask(c,personId,str(a.followUpTitle??'Personal follow-up',120),instant(a.followUpAt),at,caseId);
  label='Note saved'+(a.followUpAt?' with follow-up':'');
 }else if(a.type==='care.preferences'){
  const p=a.preferences as CarePreferences;if(!p||!['off','email','sms'].includes(p.channel)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.digestTime)||typeof p.dueReminders!=='boolean'||typeof p.pauseOnReply!=='boolean')throw Error('Choose valid reminder preferences.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actor))throw Error('Sign in to configure personal reminders.');
  c.preferences={channel:p.channel,email:actor,digestTime:p.digestTime,dueReminders:p.dueReminders,pauseOnReply:p.pauseOnReply,enabledAt:at};
  for(const n of c.notices)if(n.status==='pending')n.status='cancelled';label='Personal reminder preferences saved';
 }else if(a.type==='care.plan.save'){
  const name=str(a.name,80);if(!Array.isArray(a.steps)||!a.steps.length||a.steps.length>20)throw Error('Add 1 to 20 plan steps.');
  const steps=a.steps.map(x=>{const days=Number(x.days);if(!Number.isInteger(days)||days< -365||days>730)throw Error('Choose an offset from -365 to 730 days.');return {title:str(x.title,120),days};});
  const old=c.plans.find(x=>x.id===a.id);if(a.id&&!old)throw Error('Plan unavailable.');if(old)Object.assign(old,{name,steps});else c.plans.push({id:crypto.randomUUID(),name,steps});label='Care plan template saved';
 }else if(a.type==='care.availability'){
  person();if(a.clear)c.availability=c.availability.filter(x=>x.personId!==personId);
  else{const from=str(a.from,10),through=str(a.through,10);careLocalTime(from+'T12:00');careLocalTime(through+'T12:00');if(through<from)throw Error('End date must follow start date.');c.availability=c.availability.filter(x=>x.personId!==personId);c.availability.push({personId,from,through});}
  label='Serving availability saved';
 }else if(a.type==='care.reply.resume'){
  person();delete c.replyHolds[personId];label='Guest follow-up resumed';
 }else if(a.type==='care.notice.retry'){
  const n=c.notices.find(x=>x.id===a.id);if(!n||n.status!=='failed')throw Error('Only definitively failed reminders can be retried.');
  if(n.day!==centralDay(now))throw Error('This reminder is outdated. Open tasks remain on Today.');n.status='pending';delete n.reason;label='Reminder queued for retry';
 }else throw Error('Unknown care action.');
 s.audit.unshift({id:crypto.randomUUID(),at,actor,action:label});s.audit=s.audit.slice(0,1000);return s;
}

/** Reviewed suggestions only; never guess a person or silently interpret an ambiguous date. */
export function quickNoteSuggestion(text:string,now=new Date()){
 const hasAction=/\b(remind|call|follow up|check in|visit)\b/i.test(text),weekday=text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i)?.[1];
 let date:Date|undefined;
 if(/\btomorrow\b/i.test(text))date=addCalendar(now,1,'days');
 else if(/\bnext week\b/i.test(text))date=addCalendar(now,7,'days');
 else if(weekday){const names=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],today=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'long'}).format(now),delta=(names.findIndex(x=>x.toLowerCase()===weekday.toLowerCase())-names.indexOf(today)+7)%7||7;date=addCalendar(now,delta,'days');}
 const explicit=text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
 let dueAt='';if(hasAction&&(explicit||date))try{dueAt=careLocalTime((explicit??centralDay(date!))+'T09:00');}catch{}
 return {title:/\bcall\b/i.test(text)?'Personal call':/\bvisit\b/i.test(text)?'Personal visit':'Personal follow-up',dueAt,explanation:dueAt?'Suggested date at 9:00 a.m. Central. Confirm or change it before saving.':'Choose the follow-up date and time; nothing is scheduled until you save.'};
}
