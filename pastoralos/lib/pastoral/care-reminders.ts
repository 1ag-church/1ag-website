import {inHours,type State} from './model.ts';
import {careData,ensureCare,centralDay,centralClock,type CareNotice,type CareState} from './pastoral-care.ts';
import {deliveryConnection,sendSes,sendBroadcastSms,ProviderRejected,type BroadcastStore,type BroadcastConfig} from './broadcast-worker.ts';
import {smsThreads} from './sms-conversations.ts';
import type {CommunicationsState} from './communications.ts';

export async function updateCareStore(store:BroadcastStore,change:(s:CareState)=>void){
 for(let n=0;n<5;n++){const current=await store.load(),s=structuredClone(current.state) as CareState;change(s);if(JSON.stringify(s)===JSON.stringify(current.state))return;
  try{await store.save(current.version,s as CommunicationsState);return;}catch(e){if(!(e instanceof Error)||e.message!=='CONFLICT')throw e;}}
 throw Error('Workspace busy.');
}
export function noticeIssue(s:State,n:CareNotice,now:Date):string|null{
 const c=careData(s),p=c.preferences;
 if(p.channel==='off'||p.channel!==n.channel)return 'Reminder preference changed';
 if(n.destination!==(n.channel==='email'?p.email:s.settings.adminPhone))return 'Reminder destination changed';
 if(n.channel==='sms'&&s.smsSuppressions?.some(x=>x.phone===n.destination))return 'Reminder number opted out';
 if(n.day!==centralDay(now))return 'Reminder date passed';
 if(n.kind==='due'&&!n.taskIds.some((id,i)=>c.tasks.some(t=>t.id===id&&t.status==='open'&&t.notify&&t.revision===n.taskRevisions[i]&&t.dueAt<=now.toISOString()&&s.people.some(p=>p.id===t.personId&&!p.archived&&!p.sample))))return 'Follow-ups completed or rescheduled';
 return null;
}
export function prepareCareNotices(s:CareState,now:Date){
 const c=ensureCare(s),p=c.preferences,day=centralDay(now),at=now.toISOString();
 for(const n of c.notices){
  if(n.status==='sending'&&Date.parse(n.attemptedAt??at)<now.getTime()-180000){n.status='uncertain';n.reason='Delivery result unknown. Check the provider before sending a replacement.';}
  if(n.status==='pending'){const issue=noticeIssue(s,n,now);if(issue){n.status='cancelled';n.reason=issue;}}
 }
 if(p.channel==='off'||s.settings.paused)return;
 const destination=p.channel==='email'?p.email:s.settings.adminPhone??'';
 if(!destination)return;
 const add=(id:string,kind:CareNotice['kind'],tasks:typeof c.tasks)=>{if(!c.notices.some(n=>n.id===id))c.notices.push({id,kind,taskIds:tasks.map(t=>t.id),taskRevisions:tasks.map(t=>t.revision),day,channel:p.channel as 'email'|'sms',destination,status:'pending',createdAt:at,attempts:0});};
 if(centralClock(now)>=p.digestTime&&(!p.enabledAt||centralDay(new Date(p.enabledAt))<day||centralClock(new Date(p.enabledAt))<=p.digestTime))add('digest:'+day,'digest',[]);
 if(p.dueReminders){const due=c.tasks.filter(t=>t.status==='open'&&t.notify&&t.dueAt<=at&&s.people.some(p=>p.id===t.personId&&!p.archived&&!p.sample)&&!c.notices.some(n=>n.kind==='due'&&n.taskIds.some((id,i)=>id===t.id&&n.taskRevisions[i]===t.revision)));
  if(due.length)add('due:'+day+':'+due.map(t=>t.id+'v'+t.revision).sort().join('|'),'due',due);
 }
}
export function reminderBody(s:State,n:CareNotice,now:Date){
 const c=careData(s),today=centralDay(now),count=c.tasks.filter(t=>t.status==='open'&&centralDay(new Date(t.dueAt))<=today&&s.people.some(p=>p.id===t.personId&&!p.archived&&!p.sample)).length;
 const prayers=s.prayers.filter(p=>p.state!=='closed'&&s.messages.some(m=>m.prayerId===p.id&&m.status==='pending')).length,replies=smsThreads(s).filter(t=>!t.done&&t.messages.at(-1)?.direction==='in').length;
 const failures=c.notices.filter(x=>['failed','uncertain'].includes(x.status)).length;
 return `PastoralOS: ${n.kind==='digest'?'Your daily agenda is ready.':'You have a follow-up to review.'} ${count} care follow-up${count===1?'':'s'} due or overdue. ${prayers} prayer review${prayers===1?'':'s'} and ${replies} conversation${replies===1?'':'s'} to review.${failures?` ${failures} reminder delivery issue${failures===1?'':'s'} need attention.`:''} Open your private agenda to review, complete, or snooze: https://1ag.tv/pastoralos/`;
}
/** Persist a sending claim before each provider call. Unknown outcomes never automatically retry. */
export async function runCareReminderWorker(store:BroadcastStore,config:BroadcastConfig,fetcher:typeof fetch=fetch,clock=()=>new Date()){
 await updateCareStore(store,s=>prepareCareNotices(s,clock()));let processed=0;
 for(let i=0;i<2;i++){
  const current=(await store.load()).state,c=careData(current),connection=deliveryConnection(config);
  if(current.settings.paused)break;
  const n=c.notices.find(n=>n.status==='pending'&&!noticeIssue(current,n,clock())&&(n.kind==='digest'||inHours(clock(),current.settings.start,current.settings.end)));if(!n)break;
  if(!connection[n.channel]){await updateCareStore(store,s=>{const item=ensureCare(s).notices.find(x=>x.id===n.id);if(item?.status==='pending')item.reason=n.channel==='sms'?'Texting is not activated. Choose email or keep using Today.':'Email connection needs attention. Follow-ups remain on Today.';});break;}
  let claimed=false;
  await updateCareStore(store,s=>{claimed=false;const item=ensureCare(s).notices.find(x=>x.id===n.id);if(item?.status==='pending'&&!s.settings.paused&&!noticeIssue(s,item,clock())){item.status='sending';item.attemptedAt=clock().toISOString();item.attempts++;delete item.reason;claimed=true;}});
  if(!claimed)continue;
  const latest=(await store.load()).state,item=careData(latest).notices.find(x=>x.id===n.id);if(!item)continue;
  const issue=noticeIssue(latest,item,clock());if(issue||latest.settings.paused){await updateCareStore(store,s=>{const n=ensureCare(s).notices.find(x=>x.id===item.id);if(n?.status==='sending'){n.status=issue?'cancelled':'pending';n.reason=issue??'Workflows paused';}});continue;}
  let status:CareNotice['status']='sent',providerId:string|undefined,reason='Accepted by provider; this does not confirm it was read.';
  try{const body=reminderBody(latest,item,clock()),target={personId:'workspace-owner',destination:item.destination,context:0,status:'pending' as const};
   providerId=item.channel==='email'?await sendSes({subject:item.kind==='digest'?'Your PastoralOS day':'PastoralOS follow-up reminder',body},target,config.ses!,fetcher,clock()):await sendBroadcastSms({body},target,config.twilio!,fetcher);
  }catch(e){status=e instanceof ProviderRejected?'failed':'uncertain';reason=e instanceof ProviderRejected?e.message:'Delivery outcome unknown. Automatic retry blocked.';}
  await updateCareStore(store,s=>{const n=ensureCare(s).notices.find(x=>x.id===item.id);if(n?.status==='sending')Object.assign(n,{status,providerId,reason});});processed++;
 }
 return {processed};
}
