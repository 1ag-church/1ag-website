import {servingData,servingInstant,servingBody,servingSnapshot,servingRecipientIssue,type ServingReminder} from './serving.ts';
import {broadcastFingerprint,type CommunicationsState,type Broadcast} from './communications.ts';
import type {BroadcastStore} from './broadcast-worker.ts';

/** Stable per-assignment keys prevent duplicate SMS on overlapping cron invocations. */
export function prepareServingReminders(previous:CommunicationsState,now=new Date()):CommunicationsState{
 const s=structuredClone(previous),at=now.toISOString();let created=0;
 for(const service of servingData(s).services){if(service.cancelled)continue;
  for(const area of service.areas){if(!area.remindersEnabled)continue;const arrival=servingInstant(service.date,area.arrivalTime);
   // Never prepare anything for completed services, including after a pause/outage.
   if(arrival<=now)continue;
   for(const minutes of area.reminderMinutes)for(const personId of area.personIds){
    const due=new Date(arrival.getTime()-minutes*60000);if(due>now)continue;
    const id=`serving:${service.id}:${area.id}:${personId}:${minutes}`;
    const existing=s.broadcasts?.find(b=>b.id===id),snapshot=servingSnapshot(service,area,personId);
    // Reschedule an unattempted reminder after editing its service; never resend an attempt.
    const resumable=existing?.targets.length&&existing.targets.every(t=>t.status==='skipped'&&['Service cancelled','Area reminders turned off','Reminder timing removed'].includes(t.reason??''));
    if(existing&&(existing.status==='cancelled'||existing.serving?.snapshot===snapshot&&!resumable||existing.targets.some(t=>t.attemptedAt||t.providerId||['sending','sent','failed','uncertain'].includes(t.status))))continue;
    if(created>=100)return s;
    const p=s.people.find(p=>p.id===personId),assignedAt=area.assignedAt[personId]??area.createdAt;
    // Do not send a flurry of past reminders when someone is assigned late or a worker recovers.
    const reason=due.toISOString()<assignedAt?'Assigned after this reminder time':now.getTime()-due.getTime()>6*3600000?'Reminder time passed':servingRecipientIssue(s,p);
    const ref:ServingReminder={serviceId:service.id,areaId:area.id,personId,minutes,snapshot:servingSnapshot(service,area,personId)};
    const b:Broadcast={id,revision:(existing?.revision??0)+1,subject:`Serving · ${area.name}`,body:servingBody(s,service,area,p??{name:'Volunteer'}),channel:'sms',smsLine:'general',personIds:[personId],groupIds:[],scheduledAt:due.toISOString(),createdAt:at,status:'queued',serving:ref,
     targets:!reason&&p?[{personId,destination:p.phone,context:p.context,status:'pending'}]:[],...(reason?{skippedRecipients:[{personId,name:p?.name??'Removed person',reason}]}:{})};
    b.approval={actor:'Serving Teams scheduler',at,fingerprint:broadcastFingerprint(b)};
    if(existing)s.broadcasts![s.broadcasts!.indexOf(existing)]=b;else(s.broadcasts??=[]).unshift(b);created++;
   }
  }
 }return s;
}
export async function queueServingReminders(store:BroadcastStore,now=new Date()){
 for(let i=0;i<5;i++){const current=await store.load(),next=prepareServingReminders(current.state,now);if(JSON.stringify(next)===JSON.stringify(current.state))return;
  try{await store.save(current.version,next);return;}catch(e){if(!(e instanceof Error)||e.message!=='CONFLICT')throw e;}}
 throw Error('Workspace busy.');
}
