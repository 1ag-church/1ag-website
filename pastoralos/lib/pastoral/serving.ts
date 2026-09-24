import {addCalendar,type State,type Action,type Person} from './model.ts';
import {channelPermissions} from './contact-permissions.ts';

export type MinistryArea={id:string;name:string;description:string;arrivalTime:string;needed:number;personIds:string[];assignedAt:Record<string,string>;remindersEnabled:boolean;reminderMinutes:number[];createdAt:string;version:number};
export type ServicePlan={id:string;title:string;date:string;time:string;areas:MinistryArea[];cancelled:boolean;version:number};
export type ServingData={services:ServicePlan[]};
export type ServingState=State&{serving?:ServingData};
export type ServingReminder={serviceId:string;areaId:string;personId:string;minutes:number;snapshot:string};
export const servingData=(s:State)=>(s as ServingState).serving??{services:[]};
export const reminderChoices=[{minutes:10080,label:'1 week before'},{minutes:4320,label:'3 days before'},{minutes:1440,label:'1 day before'},{minutes:120,label:'2 hours before'},{minutes:60,label:'1 hour before'},{minutes:30,label:'30 minutes before'}];
export const reminderLabel=(n:number)=>reminderChoices.find(x=>x.minutes===n)?.label??`${n} minutes before`;
const zone='America/Chicago';
export const servingDate=(d:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
/** Strict Central wall-clock conversion. Reject nonexistent spring-forward times. */
export function servingInstant(date:string,time:string):Date{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Choose a valid date and time.');
 const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number),wall=Date.UTC(y,m-1,d,h,min);
 if(new Date(wall).toISOString().slice(0,10)!==date)throw Error('Choose a valid date.');
 const format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(const offset of [5,6]){const candidate=new Date(wall+offset*3600000),parts=Object.fromEntries(format.formatToParts(candidate).map(p=>[p.type,p.value]));if(`${parts.year}-${parts.month}-${parts.day}`===date&&`${parts.hour}:${parts.minute}`===time)return candidate;}
 throw Error('That time does not exist when clocks change. Choose another time.');
}
export function servingTime(time:string){const [h,m]=time.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;}
export const serviceLabel=(s:ServicePlan)=>`${s.title} · ${new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'short',day:'numeric',year:'numeric'}).format(servingInstant(s.date,s.time))} · ${servingTime(s.time)}`;
export function servingRecipientIssue(s:State,p:Person|undefined):string|null{
 if(!p||p.archived)return 'Person unavailable';if(p.sample)return 'Sample person';if(p.paused)return 'Contact paused';
 if(!p.phone)return 'Missing phone number';if(!/^\+[1-9]\d{7,14}$/.test(p.phone))return 'Invalid phone number';
 if(!channelPermissions(p).sms)return 'No text permission';if(s.smsSuppressions?.some(x=>x.phone===p.phone))return 'Opted out of texts';return null;
}
export function servingBody(s:State,service:ServicePlan,area:MinistryArea,p:Pick<Person,'name'>){
 const day=new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'long',month:'short',day:'numeric'}).format(servingInstant(service.date,area.arrivalTime));
 return `Hi ${p.name.split(' ')[0]}! You're scheduled for ${area.name} at ${service.title} on ${day}. Please arrive at ${servingTime(area.arrivalTime)} Central.${area.description?` ${area.description}`:''} Thanks for serving! - ${s.settings.churchName||'1AG Church'}. Reply STOP to opt out.`;
}
export const servingSnapshot=(service:ServicePlan,area:MinistryArea,personId:string)=>JSON.stringify([service.title,service.date,service.time,area.name,area.description,area.arrivalTime,area.assignedAt[personId]]);
export function servingReminderIssue(s:State,ref:ServingReminder,now=new Date()):string|null{
 const service=servingData(s).services.find(x=>x.id===ref.serviceId),area=service?.areas.find(x=>x.id===ref.areaId);
 if(!service||service.cancelled)return 'Service cancelled';if(!area)return 'Ministry area removed';
 if(!area.personIds.includes(ref.personId))return 'Assignment removed';if(!area.remindersEnabled)return 'Area reminders turned off';
 if(!area.reminderMinutes.includes(ref.minutes))return 'Reminder timing removed';
 const arrival=servingInstant(service.date,area.arrivalTime);if(arrival<=now)return 'Arrival time passed';
 if(now.getTime()-(arrival.getTime()-ref.minutes*60000)>6*3600000)return 'Reminder time passed';
 if(servingSnapshot(service,area,ref.personId)!==ref.snapshot)return 'Schedule changed; old reminder cancelled';return null;
}
function text(v:unknown,max:number,required=true){if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))throw Error('Fill in the required fields.');return v.trim();}
function integer(v:unknown,min:number,max:number){if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw Error(`Choose a number from ${min} to ${max}.`);return v;}
function bool(v:unknown){if(typeof v!=='boolean')throw Error('Choose a valid setting.');return v;}
function future(date:string,time:string,now:Date){const at=servingInstant(date,time);if(at<=now||at.getTime()>now.getTime()+400*86400000)throw Error('Choose a future service within the next 400 days.');}
export function applyServingAction(previous:State,a:Action,actor:string,now=new Date()):ServingState{
 const s=structuredClone(previous) as ServingState,data=s.serving??={services:[]},at=now.toISOString();let label='';
 const service=a.serviceId?data.services.find(x=>x.id===a.serviceId):undefined;
 if(a.serviceId&&!service)throw Error('Service no longer exists. Refresh and try again.');
 if(service&&a.serviceVersion!==service.version)throw Error('This service changed. Reopen it before saving.');
 if(a.type==='serving.service.save'){
  const title=text(a.title,100),date=text(a.date,10),time=text(a.time,5);future(date,time,now);
  if(data.services.some(x=>x.id!==service?.id&&!x.cancelled&&x.date===date&&x.time===time&&x.title.toLowerCase()===title.toLowerCase()))throw Error('That service is already scheduled.');
  if(service){for(const area of service.areas)if(servingInstant(date,area.arrivalTime)>servingInstant(date,time))throw Error('Service time must be after every ministry arrival time.');Object.assign(service,{title,date,time,version:service.version+1});}
  else {if(data.services.filter(x=>!x.cancelled&&x.date>=servingDate(now)).length>=104)throw Error('Up to 104 upcoming services can be scheduled.');data.services.push({id:crypto.randomUUID(),title,date,time,areas:[],cancelled:false,version:1});}label='Service saved';
 }else if(a.type==='serving.service.cancel'||a.type==='serving.service.restore'){
  if(!service)throw Error('Choose a service.');if(a.type.endsWith('restore'))future(service.date,service.time,now);service.cancelled=a.type.endsWith('cancel');service.version++;label=service.cancelled?'Service cancelled; unsent reminders stopped':'Service restored';
 }else if(a.type==='serving.service.copy'){
  if(!service||service.cancelled)throw Error('Choose an active service to copy.');const date=text(a.date,10),count=integer(a.count,1,26),carry=bool(a.carryPeople);future(date,service.time,now);
  if(data.services.filter(x=>!x.cancelled&&x.date>=servingDate(now)).length+count>104)throw Error('Up to 104 upcoming services can be scheduled.');
  for(let i=0;i<count;i++){const targetDate=servingDate(addCalendar(servingInstant(date,service.time),i,'weeks'));future(targetDate,service.time,now);
   if(data.services.some(x=>!x.cancelled&&x.title.toLowerCase()===service.title.toLowerCase()&&x.date===targetDate&&x.time===service.time))throw Error(`A service already exists on ${targetDate}. Choose another first date.`);
   const copy=structuredClone(service);Object.assign(copy,{id:crypto.randomUUID(),date:targetDate,version:1});
   copy.areas=copy.areas.map(area=>({...area,id:crypto.randomUUID(),version:1,createdAt:at,personIds:carry?area.personIds.filter(id=>s.people.some(p=>p.id===id&&!p.archived)):[],assignedAt:carry?Object.fromEntries(area.personIds.map(id=>[id,at])):{}}));
   data.services.push(copy);
  }label=`Created ${count} ${count===1?'service':'weekly services'}${carry?' with the same volunteers':''}`;
 }else if(a.type==='serving.area.save'){
  if(!service||service.cancelled)throw Error('Choose an active service.');future(service.date,service.time,now);
  const old=a.areaId?service.areas.find(x=>x.id===a.areaId):undefined;if(a.areaId&&!old)throw Error('Ministry area no longer exists.');
  const name=text(a.name,80),description=text(a.description,400,false),arrivalTime=text(a.arrivalTime,5),needed=integer(a.needed,1,50);
  const arrival=servingInstant(service.date,arrivalTime);if(arrival>servingInstant(service.date,service.time)||arrival<=now)throw Error('Arrival must be before the service and still in the future.');
  if(service.areas.some(x=>x.id!==old?.id&&x.name.toLowerCase()===name.toLowerCase()))throw Error('That ministry area is already on this service.');
  if(!Array.isArray(a.personIds)||a.personIds.length>50||a.personIds.some(id=>typeof id!=='string'||!s.people.some(p=>p.id===id&&!p.archived)))throw Error('Choose existing people from the People database.');
  const personIds=[...new Set(a.personIds as string[])];if(personIds.length>needed)throw Error('Increase the spots needed before assigning more people.');
  if(!Array.isArray(a.reminderMinutes)||a.reminderMinutes.length>4||a.reminderMinutes.some(n=>!reminderChoices.some(x=>x.minutes===n)))throw Error('Choose up to four reminder times.');
  const remindersEnabled=bool(a.remindersEnabled),reminderMinutes=[...new Set(a.reminderMinutes as number[])].sort((a,b)=>b-a);if(remindersEnabled&&!reminderMinutes.length)throw Error('Add a reminder time or turn off automatic reminders.');
  const area:MinistryArea={id:old?.id??crypto.randomUUID(),name,description,arrivalTime,needed,personIds,remindersEnabled,reminderMinutes,createdAt:old?.createdAt??at,version:(old?.version??0)+1,assignedAt:Object.fromEntries(personIds.map(id=>[id,old?.assignedAt[id]??at]))};
  if(old)service.areas[service.areas.indexOf(old)]=area;else {if(service.areas.length>=40)throw Error('Up to 40 ministry areas can be added per service.');service.areas.push(area);}service.version++;label=`Saved ${name}; reminders follow this service's assignments`;
 }else if(a.type==='serving.area.remove'){
  if(!service||!service.areas.some(x=>x.id===a.areaId))throw Error('Ministry area no longer exists.');service.areas=service.areas.filter(x=>x.id!==a.areaId);service.version++;label='Ministry area removed; unsent reminders stopped';
 }else throw Error('Unknown serving action.');
 // Keep provider attempts as history, cancelling only work that has not been claimed.
 const broadcasts=(s as ServingState&{broadcasts?:{serving?:ServingReminder;targets:{status:string;reason?:string}[];status:string}[]}).broadcasts??[];
 for(const b of broadcasts)if(b.serving){const issue=servingReminderIssue(s,b.serving,now);if(issue){for(const t of b.targets)if(t.status==='pending'){t.status='skipped';t.reason=issue;}}}
 s.audit.unshift({id:crypto.randomUUID(),at,actor,action:label});s.audit=s.audit.slice(0,1000);return s;
}
