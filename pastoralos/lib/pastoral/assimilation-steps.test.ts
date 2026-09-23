import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyAction,eligible,type Delivery} from './model.ts';

const now=new Date('2026-09-23T16:00:00Z');
const remove={type:'rule.delete',id:'welcome',version:1};
test('deleting a step cancels waiting work and prevents regeneration or reopening',()=>{
 let s=initialState(now);
 s=applyAction(s,{type:'message.approve',id:'m1',revision:1},'Staff',now);
 const other=s.messages.filter(m=>m.ruleId!=='welcome');
 const before=structuredClone(s);
 s=applyAction(s,remove,'Staff',now);
 assert.equal(s.rules.some(r=>r.id==='welcome'),false);
 assert.equal(s.messages.find(m=>m.id==='m1')!.status,'cancelled');
 assert.equal(s.messages.find(m=>m.id==='m1')!.approval,undefined);
 assert.equal(s.deliveries[0].status,'cancelled');
 assert.equal(s.deliveries[0].reason,'Step deleted');
 assert.deepEqual(s.ruleHistory[0],before.rules[0]);
 assert.deepEqual(s.messages.filter(m=>m.ruleId!=='welcome'),other);
 assert.deepEqual(s.people,before.people);
 assert.deepEqual(s.prayers,before.prayers);
 assert.equal(before.rules.length,4);
 const prepared=applyAction(s,{type:'prepare'},'Staff',new Date('2026-10-23T16:00:00Z'));
 assert.equal(prepared.messages.filter(m=>m.ruleId==='welcome').length,1);
 assert.throws(()=>applyAction(s,{type:'message.reopen',id:'m1'},'Staff',now),/no longer exists/);
 assert.throws(()=>applyAction(s,{type:'rule.restore',id:'welcome',version:1},'Staff',now),/no longer exists/);
 assert.throws(()=>applyAction(s,{type:'rule.save',id:'welcome'},'Staff',now),/no longer exists/);
});
test('deleting keeps every attempted delivery and its message intact, while cancelling other queued recipients',()=>{
 for(const status of ['sending','sent','delivered','failed','uncertain','simulated'] as const){
  let s=initialState(now);
  s=applyAction(s,{type:'message.approve',id:'m1',revision:1},'Staff',now);
  s.deliveries[0]={...s.deliveries[0],status,attemptedAt:now.toISOString(),providerId:'provider-reference'};
  s.deliveries.push({...s.deliveries[0],id:'waiting',status:'queued',attemptedAt:undefined,providerId:undefined} as Delivery);
  const sent=structuredClone(s.deliveries[0]),message=structuredClone(s.messages[0]);
  const result=applyAction(s,remove,'Staff',now);
  assert.deepEqual(result.deliveries[0],sent,status);
  assert.deepEqual(result.messages[0],message,status);
  assert.equal(result.deliveries[1].status,'cancelled');
  assert.equal(eligible(result,result.messages[0],result.messages[0].targets[0]),'Step deleted');
 }
});
test('held drafts are cancelled and stale editors cannot delete or overwrite newer step settings',()=>{
 let s=initialState(now);
 s.messages[0].status='held';
 const changed=applyAction(s,{type:'rule.save',...s.rules[0],version:1,title:'Updated welcome'},'Staff',now);
 assert.throws(()=>applyAction(changed,remove,'Staff',now),/step changed/);
 assert.throws(()=>applyAction(changed,{type:'rule.save',...s.rules[0]},'Staff',now),/step changed/);
 const result=applyAction(changed,{...remove,version:2},'Staff',now);
 assert.equal(result.messages[0].status,'cancelled');
 assert.throws(()=>applyAction(result,{...remove,version:2},'Staff',now),/no longer exists/);
});
test('a new named recurring email step prepares the configured personalized message',()=>{
 let s=initialState(now);s.messages=[];s.rules=[];
 s=applyAction(s,{type:'rule.save',title:'Monthly welcome email',stage:'New guest',days:0,channel:'email',template:'Welcome, {firstName}!',enabled:true,recurrence:{frequency:'monthly',interval:1,duration:6,durationUnit:'months'}},'Staff',now);
 s=applyAction(s,{type:'prepare'},'Staff',now);
 assert.equal(s.rules.length,1);
 assert.equal(s.messages.length,1);
 assert.equal(s.messages[0].subject,'Monthly welcome email');
 assert.equal(s.messages[0].body,'Welcome, Sarah!');
 assert.equal(s.messages[0].channel,'email');
 assert.equal(s.messages[0].status,'pending');
 assert.ok(s.messages[0].occurrence);
 s=applyAction(s,{type:'rule.delete',id:s.rules[0].id,version:1},'Staff',now);
 assert.equal(applyAction(s,{type:'prepare'},'Staff',new Date('2026-10-23T16:00:00Z')).messages.length,1);
});
