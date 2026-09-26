import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type Action} from './model.ts';
import {applyCareAction,careData,ensureCare,careLocalTime,quickNoteSuggestion,type CareState} from './pastoral-care.ts';
import {prepareCareNotices,runCareReminderWorker,reminderBody} from './care-reminders.ts';
import {applyIncomingSms} from './inbound.ts';
import {applyServingAction,servingData,servingKey,applyServingReply,servingReminderIssue,servingSnapshot} from './serving.ts';
import {applyServingInvite} from './serving-confirmations.ts';
import type {CommunicationsState} from './communications.ts';
import type {BroadcastStore} from './broadcast-worker.ts';

const now=new Date('2026-09-26T15:00:00Z'),actor='pastor@example.com';
function fresh():CareState&CommunicationsState {
 const s=initialState(now);s.people=s.people.slice(0,1).map(p=>({...p,sample:false,archived:false,paused:false,assimilation:true,channelPermissions:{sms:true,email:true}}));
 s.settings.paused=false;s.messages=[];s.deliveries=[];s.inbox=[];s.prayers=[];s.tasks=[];s.audit=[];return s;
}
function action(s:CareState,a:Action,date=now){return applyCareAction(s,a,actor,date);}
function task(s=fresh()){return action(s,{type:'care.task.save',personId:s.people[0].id,title:'Private medical follow-up',dueAt:now.toISOString(),notify:true,repeatDays:7});}
function enabled(){let s=task();s=action(s,{type:'care.preferences',preferences:{channel:'sms',digestTime:'08:00',dueReminders:true,pauseOnReply:true}},new Date('2026-09-25T15:00:00Z'));s.settings.adminPhone='+12025550199';return s;}
function memory(state:CareState){let version=0;const box={state};const store:BroadcastStore={load:async()=>({state:structuredClone(box.state),version}),save:async(expected,next)=>{if(expected!==version)throw Error('CONFLICT');version++;box.state=structuredClone(next);}};return {box,store};}
const config={twilio:{accountSid:'AC'+'1'.repeat(32),token:'test-only',phone:'+18555052220'}};
function provider(calls:string[],status=201):typeof fetch{return (async(_input,init)=>{const body=new URLSearchParams(String(init?.body));calls.push(body.toString());return status===201?Response.json({sid:'SM'+'a'.repeat(32),account_sid:config.twilio.accountSid,from:config.twilio.phone,to:body.get('To')}):new Response('{}',{status});}) as typeof fetch;}

test('care uses existing People and preserves prayer decisions and permissions',()=>{
 const s=fresh(),people=structuredClone(s.people);s.prayers.push({id:'declined',name:'Private',original:'Confidential',sharing:'private',state:'closed',createdAt:now.toISOString(),sample:false});
 const a={type:'care.case.save',personId:s.people[0].id,title:'Recovery',detail:'Private note',source:{kind:'prayer',id:'declined'},steps:[{title:'Call',dueAt:now.toISOString()}]};
 let next=action(s,a);assert.deepEqual(next.people,people);assert.deepEqual(next.prayers,s.prayers);assert.equal(careData(next).tasks.length,1);
 assert.throws(()=>action(s,{...a,personId:'unknown'}),/existing person/);assert.throws(()=>action(next,a),/already has/);
 next=action(next,{type:'care.case.status',id:careData(next).cases[0].id,status:'closed'});assert.equal(careData(next).tasks[0].status,'cancelled');assert.deepEqual(next.prayers,s.prayers);
});
test('completion creates one recurring action; repeated completion cannot duplicate it',()=>{
 let s=task(),id=careData(s).tasks[0].id;s=action(s,{type:'care.task.done',id,note:'Called today.'});
 assert.equal(careData(s).tasks.length,2);assert.equal(careData(s).tasks[1].dueAt,'2026-10-03T15:00:00.000Z');assert.equal(careData(s).tasks[0].status,'done');
 assert.throws(()=>action(s,{type:'care.task.done',id}),/no longer open/);assert.ok(careData(s).notes.some(n=>n.body==='Called today.'));
});
test('snoozing cancels the old pending reminder and dates handle Central daylight changes',()=>{
 let s=enabled();prepareCareNotices(s,now);const id=careData(s).tasks[0].id;
 s=action(s,{type:'care.task.snooze',id,dueAt:'2026-09-27T15:00:00Z'});prepareCareNotices(s,now);
 assert.equal(careData(s).notices.find(n=>n.kind==='due')?.status,'cancelled');assert.equal(careData(s).tasks[0].revision,2);
 assert.throws(()=>action(s,{type:'care.task.snooze',id,dueAt:'2026-09-25T15:00:00Z'}),/future/);
 assert.equal(careLocalTime('2026-11-01T09:00'),'2026-11-01T15:00:00.000Z');assert.throws(()=>careLocalTime('2027-03-14T02:30'),/does not exist/);
});
test('personal settings default off and bind email to the signed-in actor, not caller data',()=>{
 const s=task();prepareCareNotices(s,now);assert.equal(careData(s).notices.length,0);
 const next=action(s,{type:'care.preferences',preferences:{channel:'email',email:'attacker@example.com',digestTime:'09:30',dueReminders:false,pauseOnReply:true}});
 assert.equal(careData(next).preferences.email,actor);prepareCareNotices(next,now);assert.equal(careData(next).notices.length,0,'do not backfill summary on initial setup after its time');
 prepareCareNotices(next,new Date('2026-09-27T15:00:00Z'));assert.equal(careData(next).notices.length,1);
});
test('concurrent reminder workers claim once and messages omit names and confidential notes',async()=>{
 const {box,store}=memory(enabled()),calls:string[]=[];
 await Promise.all([runCareReminderWorker(store,config,provider(calls),()=>now),runCareReminderWorker(store,config,provider(calls),()=>now)]);
 assert.equal(calls.length,2);assert.ok(careData(box.state).notices.every(n=>n.status==='sent'));
 const body=reminderBody(box.state,careData(box.state).notices[0],now);assert.ok(!body.includes('medical'));assert.ok(!body.includes(box.state.people[0].name));assert.match(body,/private agenda/);
 await runCareReminderWorker(store,config,provider(calls),()=>now);assert.equal(calls.length,2);
});
test('unknown send results are never retried; definitive rejection allows explicit retry',async()=>{
 const first=memory(enabled());let calls=0;const fail=(async()=>{calls++;throw Error('timeout');}) as typeof fetch;
 await runCareReminderWorker(first.store,config,fail,()=>now);await runCareReminderWorker(first.store,config,fail,()=>now);
 assert.equal(calls,2);assert.ok(careData(first.box.state).notices.every(n=>n.status==='uncertain'));
 assert.throws(()=>action(first.box.state,{type:'care.notice.retry',id:careData(first.box.state).notices[0].id}),/definitively failed/);
 const second=memory(enabled()),rejected:string[]=[];await runCareReminderWorker(second.store,config,provider(rejected,400),()=>now);
 assert.ok(careData(second.box.state).notices.every(n=>n.status==='failed'));const next=action(second.box.state,{type:'care.notice.retry',id:careData(second.box.state).notices[0].id});assert.equal(careData(next).notices[0].status,'pending');
});
test('disabled transport, global pause, STOP and changed destination do not send',async()=>{
 const noConfig=memory(enabled()),calls:string[]=[];await runCareReminderWorker(noConfig.store,{},provider(calls),()=>now);assert.equal(calls.length,0);assert.match(careData(noConfig.box.state).notices[0].reason!,/not activated/);
 for(const mutate of [(s:CareState)=>{s.settings.paused=true;},(s:CareState)=>{s.smsSuppressions=[{phone:s.settings.adminPhone!,at:now.toISOString(),messageSid:'test'}];},(s:CareState)=>{s.settings.adminPhone='+12025550222';}]){
  const s=enabled();prepareCareNotices(s,now);mutate(s);const {store}=memory(s);await runCareReminderWorker(store,config,provider(calls),()=>now);assert.equal(calls.length,0);
 }
});
test('quick note interpretation is a suggestion and never changes the workspace',()=>{
 const s=fresh(),before=structuredClone(s),suggestion=quickNoteSuggestion('Call tomorrow after the visit',now);assert.equal(suggestion.dueAt,'2026-09-27T14:00:00.000Z');assert.deepEqual(s,before);assert.equal(quickNoteSuggestion('Call sometime').dueAt,'');
});
function serving(){let s=fresh();s=applyServingAction(s,{type:'serving.service.save',title:'Sunday',date:'2026-09-27',time:'10:00'},actor,now);const service=servingData(s).services[0];return applyServingAction(s,{type:'serving.area.save',serviceId:service.id,serviceVersion:service.version,name:'Welcome',description:'Greet people',arrivalTime:'09:30',needed:1,personIds:[s.people[0].id],remindersEnabled:false,reminderMinutes:[]},actor,now);}
function response(s:CareState){const service=servingData(s).services[0],area=service.areas[0];return {service,area,response:servingData(s).responses![servingKey(service.id,area.id,s.people[0].id)]};}
function incoming(s:CareState,body:string,sid='2',from=s.people[0].phone){return applyIncomingSms(s,{accountSid:'AC'+'1'.repeat(32),messageSid:'SM'+sid.repeat(32),from,to:config.twilio.phone,body,optOut:'',mediaCount:0},now,'general');}
test('confirmation replies require exact live assignment code and matching phone, never create prayers',()=>{
 const s=serving(),r=response(s),prayers=structuredClone(s.prayers);
 assert.equal(applyServingReply(s,'+12025550999','YES '+r.response.code,now),false);assert.equal(applyServingReply(s,s.people[0].phone,'YES WRONG',now),false);
 let next=incoming(s,'YES '+r.response.code);assert.equal(response(next).response.status,'confirmed');assert.deepEqual(next.prayers,prayers);assert.equal(Object.keys(careData(next).replyHolds).length,0);
 const same=incoming(next,'YES '+r.response.code);assert.deepEqual(same,next);
 next=incoming(next,'NO '+r.response.code,'3');assert.equal(response(next).response.status,'declined');
 const ref={serviceId:r.service.id,areaId:r.area.id,personId:s.people[0].id,snapshot:servingSnapshot(r.service,r.area,s.people[0].id),minutes:0,invitation:true};assert.equal(servingReminderIssue(next,ref,now),'Volunteer declined');
 const stop=incoming(next,'STOP','4');assert.equal(stop.people[0].channelPermissions?.sms,false);
});
test('schedule changes invalidate old confirmation codes and invitations cannot duplicate',()=>{
 const s=serving(),r=response(s),a={type:'serving.invite',serviceId:r.service.id,serviceVersion:r.service.version,areaId:r.area.id};
 const invited=applyServingInvite(s,a,actor,{sms:true,email:false},now);assert.equal(invited.broadcasts?.length,1);assert.match(invited.broadcasts![0].body,/Reply YES/);
 assert.throws(()=>applyServingInvite(invited,a,actor,{sms:true,email:false},now),/No new invitations/);
 assert.throws(()=>applyServingInvite(s,a,actor,{sms:false,email:false},now),/activated/);
 const changed=applyServingAction(s,{type:'serving.service.save',serviceId:r.service.id,serviceVersion:r.service.version,title:'Sunday',date:'2026-10-04',time:'10:00'},actor,now);
 assert.notEqual(response(changed).response.code,r.response.code);assert.equal(applyServingReply(changed,s.people[0].phone,'YES '+r.response.code,now),false);
});
test('only uniquely matched enrolled guest replies create a hold; resume preserves permissions',()=>{
 const s=fresh(),next=incoming(s,'Can we talk?');assert.ok(careData(next).replyHolds[s.people[0].id]);
 const resumed=action(next,{type:'care.reply.resume',personId:s.people[0].id});assert.equal(Object.keys(careData(resumed).replyHolds).length,0);assert.deepEqual(resumed.people,s.people);
 const notGuest=fresh();notGuest.people[0].assimilation=false;assert.equal(Object.keys(careData(incoming(notGuest,'Thanks')).replyHolds).length,0);
 const shared=fresh();shared.people.push({...shared.people[0],id:'second'});assert.equal(Object.keys(careData(incoming(shared,'Thanks')).replyHolds).length,0);
 const disabled=fresh();ensureCare(disabled).preferences.pauseOnReply=false;assert.equal(Object.keys(careData(incoming(disabled,'Thanks')).replyHolds).length,0);
});
