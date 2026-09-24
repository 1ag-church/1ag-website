import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type Action} from './model.ts';
import {applyServingAction,servingData,servingInstant,servingReminderIssue,type ServingState} from './serving.ts';
import {prepareServingReminders,queueServingReminders} from './serving-reminders.ts';
import {broadcastIssue,type CommunicationsState} from './communications.ts';
import {runBroadcastWorker,type BroadcastStore} from './broadcast-worker.ts';
import {smsThreads} from './sms-conversations.ts';

const start=new Date('2026-09-24T15:00:00Z'),due=new Date('2026-09-26T14:15:00Z');
function setup(){
 let s=initialState(start) as ServingState&CommunicationsState;s.people=s.people.slice(0,2).map(p=>({...p,sample:false,paused:false,archived:false,channelPermissions:{sms:true,email:false}}));s.broadcasts=[];
 s=applyServingAction(s,{type:'serving.service.save',title:'Sunday Worship',date:'2026-09-27',time:'10:00'},'Staff',start);
 const plan=servingData(s).services[0];
 s=applyServingAction(s,{type:'serving.area.save',serviceId:plan.id,serviceVersion:plan.version,name:'Welcome team',description:'Greet guests.',arrivalTime:'09:15',needed:3,personIds:s.people.map(p=>p.id),remindersEnabled:true,reminderMinutes:[1440,120]},'Staff',start);
 return s as ServingState&CommunicationsState;
}
function action(s:ServingState,a:Action,now=start){const plan=servingData(s).services[0];return applyServingAction(s,{serviceId:plan.id,serviceVersion:plan.version,...a},'Staff',now) as ServingState&CommunicationsState;}
function editArea(s:ServingState,changes:Record<string,unknown>,now=start){const a=servingData(s).services[0].areas[0];return action(s,{...a,type:'serving.area.save',areaId:a.id,...changes},now);}
function memory(state:CommunicationsState){let version=0;const box={state};const store:BroadcastStore={load:async()=>({state:structuredClone(box.state),version}),save:async(expected,next)=>{if(expected!==version)throw Error('CONFLICT');version++;box.state=structuredClone(next);}};return {box,store};}
const config={twilio:{accountSid:'AC'+'a'.repeat(32),token:'fake-test-only',phone:'+18555052220'}};
function provider(calls:string[],status=201):typeof fetch{return (async(_input,init)=>{const body=new URLSearchParams(String(init?.body));calls.push(body.toString());return status===201?Response.json({sid:'SM'+String(calls.length).padStart(32,'0'),account_sid:config.twilio.accountSid,from:config.twilio.phone,to:body.get('To')}):new Response('',{status});}) as typeof fetch;}

test('ministry assignments reference existing People and never modify their permission or enrollment',()=>{
 const s=setup(),before=structuredClone(s.people);const next=editArea(s,{personIds:[s.people[0].id]});assert.deepEqual(next.people,before);
 assert.throws(()=>editArea(s,{personIds:['does-not-exist']}),/existing people/);
 assert.throws(()=>action(s,{type:'serving.area.save',name:'Wrong',description:'',arrivalTime:'10:15',needed:1,personIds:[],remindersEnabled:false,reminderMinutes:[]}),/Arrival/);
 assert.throws(()=>action(s,{type:'serving.service.save',serviceVersion:0,title:'Changed',date:'2026-09-27',time:'11:00'}),/changed/);
});
test('Central calendar handles DST and rejects invalid dates and nonexistent times',()=>{
 assert.equal(servingInstant('2026-11-01','09:15').toISOString(),'2026-11-01T15:15:00.000Z');
 assert.equal(servingInstant('2026-10-25','09:15').toISOString(),'2026-10-25T14:15:00.000Z');
 assert.throws(()=>servingInstant('2027-03-14','02:30'),/does not exist/);assert.throws(()=>servingInstant('2026-02-30','09:00'),/valid date/);
});
test('weekly copies keep arrival wall clock and can be edited independently without cloning people',()=>{
 let s=setup();s=action(s,{type:'serving.service.copy',date:'2026-10-25',count:2,carryPeople:true});const plans=servingData(s).services;
 assert.deepEqual(plans.slice(1).map(p=>p.date),['2026-10-25','2026-11-01']);assert.equal(s.people.length,2);assert.notEqual(plans[1].areas[0].id,plans[0].areas[0].id);
 const updated=applyServingAction(s,{type:'serving.area.save',...plans[1].areas[0],areaId:plans[1].areas[0].id,serviceId:plans[1].id,serviceVersion:plans[1].version,name:'Different team'},'Staff',start);
 assert.equal(servingData(updated).services[0].areas[0].name,'Welcome team');assert.equal(servingData(updated).services[2].areas[0].name,'Welcome team');
 const empty=action(s,{type:'serving.service.copy',date:'2026-11-08',count:1,carryPeople:false});assert.deepEqual(servingData(empty).services.at(-1)!.areas[0].personIds,[]);
 assert.throws(()=>action(s,{type:'serving.service.copy',date:'2026-10-25',count:2,carryPeople:true}),/already exists/);
});
test('due reminders are unique, personalized, use general SMS, and run without prayer approvals',async()=>{
 const s=setup();assert.equal(prepareServingReminders(s,start).broadcasts?.length,0);
 const queued=prepareServingReminders(s,due);assert.equal(queued.broadcasts?.length,2);assert.equal(prepareServingReminders(queued,due).broadcasts?.length,2);
 const {store,box}=memory(queued),calls:string[]=[];await runBroadcastWorker(store,config,provider(calls),()=>due);
 assert.equal(calls.length,2);assert.ok(calls.every(body=>new URLSearchParams(body).get('From')==='+18555052220'));
 assert.ok(calls.every(body=>new URLSearchParams(body).get('Body')?.includes('9:15 AM Central')));assert.ok(box.state.broadcasts?.every(b=>b.targets[0].status==='sent'));
 assert.equal(smsThreads(box.state)[0].messages[0].automated,true);
 await runBroadcastWorker(store,config,provider(calls),()=>due);assert.equal(calls.length,2);
});
test('missing permission, missing number, STOP and paused contacts are skipped with named reports',()=>{
 for(const change of [(s:CommunicationsState)=>{s.people[0].channelPermissions!.sms=false;},(s:CommunicationsState)=>{s.people[0].phone='';},(s:CommunicationsState)=>{s.smsSuppressions=[{phone:s.people[0].phone,at:start.toISOString(),messageSid:'test'}];},(s:CommunicationsState)=>{s.people[0].paused=true;}]){
  const s=setup();change(s);const q=prepareServingReminders(s,due),b=q.broadcasts!.find(b=>b.serving?.personId===s.people[0].id)!;assert.equal(b.targets.length,0);assert.equal(b.skippedRecipients?.[0].name,s.people[0].name);assert.ok(b.skippedRecipients?.[0].reason);
 }
});
test('permission revocation, assignment removal, service cancellation and area removal block pending sends',async()=>{
 for(const change of [(s:ServingState&CommunicationsState)=>{s.people.forEach(p=>p.channelPermissions!.sms=false);return s;},(s:ServingState&CommunicationsState)=>editArea(s,{personIds:[]}), (s:ServingState&CommunicationsState)=>action(s,{type:'serving.service.cancel'}),(s:ServingState&CommunicationsState)=>action(s,{type:'serving.area.remove',areaId:servingData(s).services[0].areas[0].id})]){
  const s=change(prepareServingReminders(setup(),due));const {store,box}=memory(s),calls:string[]=[];await runBroadcastWorker(store,config,provider(calls),()=>due);assert.equal(calls.length,0);assert.ok(box.state.broadcasts!.every(b=>b.targets.every(t=>t.status==='skipped')));
 }
});
test('worker uses durable claims under concurrency and does not retry ambiguous outcomes',async()=>{
 const {store,box}=memory(setup());await Promise.all([queueServingReminders(store,due),queueServingReminders(store,due)]);assert.equal(box.state.broadcasts?.length,2);
 const calls:string[]=[];await Promise.all([runBroadcastWorker(store,config,provider(calls),()=>due),runBroadcastWorker(store,config,provider(calls),()=>due)]);assert.equal(calls.length,2);
 const another=memory(prepareServingReminders(setup(),due));let attempts=0;const fail=(async()=>{attempts++;throw Error('timeout');}) as typeof fetch;
 await runBroadcastWorker(another.store,config,fail,()=>due);await runBroadcastWorker(another.store,config,fail,()=>due);assert.equal(attempts,2);assert.ok(another.box.state.broadcasts!.every(b=>b.targets[0].status==='uncertain'));
});
test('past due times are not backfilled for late assignments or after long downtime',()=>{
 let s=setup();s=editArea(s,{personIds:[]});s=editArea(s,{personIds:s.people.map(p=>p.id)},new Date('2026-09-26T15:00:00Z'));
 const q=prepareServingReminders(s,new Date('2026-09-26T15:00:00Z'));assert.ok(q.broadcasts!.every(b=>b.skippedRecipients?.[0].reason==='Assigned after this reminder time'));
 assert.ok(prepareServingReminders(setup(),new Date('2026-09-26T21:00:00Z')).broadcasts!.every(b=>b.skippedRecipients?.[0].reason==='Reminder time passed'));
 assert.equal(prepareServingReminders(setup(),new Date('2026-09-27T15:00:00Z')).broadcasts?.length,0);
});
test('pause and sending hours defer delivery; arrival expiry still stops paused reminders',()=>{
 const s=prepareServingReminders(setup(),due);s.settings.paused=true;let b=s.broadcasts![0];assert.equal(broadcastIssue(s,b,b.targets[0],due),'Workflows paused');
 assert.equal(broadcastIssue(s,b,b.targets[0],new Date('2026-09-27T14:15:00Z')),'Arrival time passed');
 const morning=prepareServingReminders(setup(),new Date('2026-09-27T12:15:00Z'));b=morning.broadcasts!.find(b=>b.serving?.minutes===120)!;
 assert.equal(broadcastIssue(morning,b,b.targets[0],new Date('2026-09-27T12:15:00Z')),'Outside sending hours');assert.equal(broadcastIssue(morning,b,b.targets[0],new Date('2026-09-27T13:30:00Z')),null);
});
test('editing a service replaces unattempted reminder at the new time, but never repeats a sent one',()=>{
 let s=prepareServingReminders(setup(),due);const b=s.broadcasts![0];b.targets[0].status='sent';b.targets[0].providerId='SM'+'1'.repeat(32);
 s=action(s,{type:'serving.service.save',title:'Sunday Worship',date:'2026-10-04',time:'10:00'});
 assert.match(servingReminderIssue(s,s.broadcasts![1].serving!,due)!,/Schedule changed/);
 const q=prepareServingReminders(s,new Date('2026-10-03T14:15:00Z'));assert.equal(q.broadcasts?.length,2);assert.equal(q.broadcasts![0].targets[0].status,'sent');assert.equal(q.broadcasts![1].targets[0].status,'pending');assert.match(q.broadcasts![1].body,/Oct 4/);
});
test('disabled general connection cannot send any reminders',async()=>{
 const {store}=memory(prepareServingReminders(setup(),due)),calls:string[]=[];await runBroadcastWorker(store,{},provider(calls),()=>due);assert.equal(calls.length,0);
});
test('restoring a service or re-enabling reminders can resume unattempted work only',()=>{
 let s=prepareServingReminders(setup(),due);s=action(s,{type:'serving.service.cancel'});s=action(s,{type:'serving.service.restore'});s=prepareServingReminders(s,due);assert.ok(s.broadcasts!.every(b=>b.targets[0].status==='pending'));
 s=editArea(s,{remindersEnabled:false});s=editArea(s,{remindersEnabled:true});s=prepareServingReminders(s,due);assert.ok(s.broadcasts!.every(b=>b.targets[0].status==='pending'));
 s.broadcasts![0].targets[0].status='sent';s.broadcasts![0].targets[0].providerId='SM'+'2'.repeat(32);s=action(s,{type:'serving.service.cancel'});s=action(s,{type:'serving.service.restore'});s=prepareServingReminders(s,due);assert.equal(s.broadcasts![0].targets[0].status,'sent');
});
