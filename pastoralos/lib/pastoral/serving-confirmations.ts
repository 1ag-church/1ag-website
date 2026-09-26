import type {State,Action} from './model.ts';
import {applyCommunicationsAction,audience,type CommunicationsState,type DeliveryConnection} from './communications.ts';
import {ensureServingResponses,servingData,servingKey,servingSnapshot,servingBody,servingInstant} from './serving.ts';
import {availabilityIssue} from './pastoral-care.ts';

/** Explicit staff send action, with the same eligibility and frozen audience as Communications. */
export function applyServingInvite(previous:State,a:Action,actor:string,connection:DeliveryConnection,now=new Date()):CommunicationsState{
 let s=structuredClone(previous) as CommunicationsState;ensureServingResponses(s);
 const service=servingData(s).services.find(x=>x.id===a.serviceId),area=service?.areas.find(x=>x.id===a.areaId);
 if(!service||service.cancelled||!area||service.version!==a.serviceVersion)throw Error('This schedule changed. Refresh before requesting confirmations.');
 if(servingInstant(service.date,area.arrivalTime)<=now)throw Error('This arrival time has passed.');
 if(!connection.sms)throw Error('The Communications texting number must be activated before sending invitations.');
 let created=0;
 for(const personId of area.personIds){
  const p=s.people.find(x=>x.id===personId),response=servingData(s).responses?.[servingKey(service.id,area.id,personId)];
  if(!p||response?.status!=='pending'||availabilityIssue(s,personId,service.date))continue;
  const snapshot=servingSnapshot(service,area,personId);
  if(s.broadcasts?.some(b=>b.serving?.invitation&&b.serving.serviceId===service.id&&b.serving.areaId===area.id&&b.serving.personId===personId&&b.serving.snapshot===snapshot&&b.status!=='cancelled'))continue;
  const targets=audience(s,{channel:'sms',personIds:[personId],groupIds:[]});
  const before=new Set(s.broadcasts?.map(b=>b.id));
  s=applyCommunicationsAction(s,{type:'broadcast.send',channel:'sms',subject:'Serving confirmation · '+area.name,body:servingBody(s,service,area,p),personIds:[personId],groupIds:[],audience:targets.map(t=>[t.personId,t.destination,t.context])},actor,connection,now);
  const b=s.broadcasts?.find(b=>!before.has(b.id));if(b){b.serving={serviceId:service.id,areaId:area.id,personId,minutes:0,snapshot,invitation:true};created++;}
 }
 if(!created)throw Error('No new invitations needed. Check responses, permissions, or existing invitations in delivery history.');
 s.audit.unshift({id:crypto.randomUUID(),at:now.toISOString(),actor,action:'Serving confirmations requested; skipped recipients remain in delivery history'});return s;
}
