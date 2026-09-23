import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from './model.ts';
import {applyIncomingSms} from './inbound.ts';
import {smsThreads} from './sms-conversations.ts';
import {applyCommunicationsAction,audience,broadcastIssue,type CommunicationsState} from './communications.ts';
import {readBroadcastConfig,deliveryConnection} from './broadcast-worker.ts';
const now=new Date('2026-09-23T17:00:00Z'),phone='+12025550111',connection={sms:true,email:true};
function fresh():CommunicationsState{const s=initialState(now);s.people=[{...s.people[0],id:'person',name:'Jamie Rivers',phone,sample:false,channelPermissions:{sms:true,email:true}}];s.inbox=[];s.messages=[];s.deliveries=[];s.prayers=[];s.audit=[];s.tasks=[];s.settings.paused=false;return s;}
function receive(s:CommunicationsState,id='1',from=phone){return applyIncomingSms(s,{accountSid:'AC'+'1'.repeat(32),messageSid:'SM'+id.repeat(32),from,to:'+12025550199',body:'Thanks for checking in.',optOut:'',mediaCount:0},new Date(now.getTime()+Number(id)*60000),'general') as CommunicationsState;}
function send(s:CommunicationsState,channel='sms',scheduledAt?:string){return applyCommunicationsAction(s,{type:'broadcast.send',channel,subject:'Hello',body:'See you Sunday!',groupIds:[],personIds:['person'],scheduledAt,audience:audience(s,{channel:channel==='sms'?'sms':'email',groupIds:[],personIds:['person']}).map(t=>[t.personId,t.destination,t.context])},'Pastor',connection,now);}
test('communications email, text and scheduled messages queue in one action without a prayer approval',()=>{
 for(const channel of ['sms','email'])for(const scheduledAt of [undefined,'2026-09-25T17:00:00Z']){
  const s=send(fresh(),channel,scheduledAt);assert.equal(s.broadcasts?.[0].status,'queued');assert.equal(s.broadcasts?.[0].targets.length,1);assert.equal(s.messages.length,0);assert.equal(s.prayers.length,0);
 }
});
test('a new general reply does not invalidate a staff communications send or become a prayer request',()=>{const s=receive(send(fresh()));const b=s.broadcasts![0];assert.equal(broadcastIssue(s,b,b.targets[0],now),null);assert.equal(s.prayers.length,0);assert.equal(smsThreads(s)[0].messages.length,2);});
test('read and done follow the exact received message, with new replies reopening the conversation',()=>{
 let s=receive(fresh()),thread=smsThreads(s)[0];assert.equal(thread.unread,true);
 s=applyCommunicationsAction(s,{type:'conversation.read',phone,lastIncomingId:thread.lastIncomingId},'Pastor',connection,now);
 s=applyCommunicationsAction(s,{type:'conversation.status',phone,lastIncomingId:thread.lastIncomingId,done:true},'Pastor',connection,now);
 assert.equal(smsThreads(s)[0].unread,false);assert.equal(smsThreads(s)[0].done,true);
 s=receive(s,'2');assert.equal(smsThreads(s)[0].unread,true);assert.equal(smsThreads(s)[0].done,false);
 assert.throws(()=>applyCommunicationsAction(s,{type:'conversation.status',phone,lastIncomingId:thread.lastIncomingId,done:true},'Pastor',connection,now),/new reply/);
});
test('unknown and shared phones remain visible without selecting an assumed recipient',()=>{
 const unknown=receive(fresh(),'1','+12025550999');assert.equal(smsThreads(unknown)[0].personId,undefined);
 const shared=fresh();shared.people.push({...shared.people[0],id:'second'});const result=receive(shared);assert.equal(smsThreads(result)[0].shared,true);assert.equal(smsThreads(result)[0].personId,undefined);
});
test('historical texts remain with their actual destination after a contact changes numbers',()=>{
 const s=receive(send(fresh()));s.people[0].phone='+12025550222';const threads=smsThreads(s);assert.equal(threads.length,1);assert.equal(threads[0].phone,phone);assert.equal(threads[0].personId,undefined);
});
test('history excludes draft broadcasts, staff notes, email and demo conversations',()=>{
 let s=fresh();s.inbox.push({id:'note',personId:'person',at:now.toISOString(),body:'Private note',program:'guest'});
 s=send(s,'email');s=applyCommunicationsAction(s,{type:'broadcast.save',channel:'sms',subject:'Draft',body:'Do not send',groupIds:[],personIds:['person']},'Pastor',connection,now);assert.equal(smsThreads(s).length,0);
});
test('history distinguishes failed, uncertain and scheduled messages and deduplicates provider records',()=>{
 const s=receive(send(fresh(),'sms','2026-09-25T17:00:00Z')),b=s.broadcasts![0];assert.equal(smsThreads(s,now)[0].messages.find(m=>m.direction==='out')?.status,'Scheduled');
 b.targets[0].status='failed';assert.equal(smsThreads(s,now)[0].messages.find(m=>m.direction==='out')?.status,'Failed');
 b.targets[0].status='uncertain';assert.equal(smsThreads(s,now)[0].messages.find(m=>m.direction==='out')?.status,'Delivery unknown');
 b.targets[0].status='sent';b.targets[0].providerId='SM123';
 Object.assign(s,{automation:{outbox:[{id:'duplicate',to:phone,body:b.body,createdAt:now.toISOString(),status:'sent',kind:'broadcast',providerSid:'SM123'}]}});
 assert.equal(smsThreads(s)[0].messages.filter(m=>m.direction==='out').length,1);
});
test('STOP blocks subsequent direct sends; a missing permission produces a named skip',()=>{
 let s=fresh();s.people[0].channelPermissions={sms:false,email:true};s=send(s);assert.equal(s.broadcasts![0].targets.length,0);assert.equal(s.broadcasts![0].skippedRecipients![0].name,'Jamie Rivers');
 const stop=applyIncomingSms(fresh(),{accountSid:'AC'+'1'.repeat(32),messageSid:'SM'+'3'.repeat(32),from:phone,to:'+12025550199',body:'STOP',optOut:'STOP',mediaCount:0},now,'general');
 assert.equal(send(stop).broadcasts![0].targets.length,0);assert.equal(stop.people[0].channelPermissions?.email,true);
});
test('general SMS cannot fall back to the prayer number or enable before verification',()=>{
 const prayer={accountSid:'AC'+'1'.repeat(32),token:'test-only',phone:'+12025550198'};
 for(const env of [{},{PASTORALOS_GENERAL_SMS_NUMBER:'+12025550199'},{PASTORALOS_GENERAL_SMS_NUMBER:prayer.phone,PASTORALOS_GENERAL_SMS_ENABLED:'true'}])assert.equal(deliveryConnection(readBroadcastConfig(k=>(env as Record<string,string>)[k],prayer)).sms,false);
 const env:Record<string,string>={PASTORALOS_GENERAL_SMS_NUMBER:'+12025550199',PASTORALOS_GENERAL_SMS_ENABLED:'true'};const config=readBroadcastConfig(k=>env[k],prayer);assert.equal(config.twilio?.phone,'+12025550199');assert.equal(deliveryConnection(config).sms,true);
});
