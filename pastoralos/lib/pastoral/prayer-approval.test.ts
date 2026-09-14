import assert from 'node:assert/strict';
import {test} from 'node:test';
import {dispatchCheck,applyAction} from './model.ts';
import {approvePrayerRequest,prayerRecipients,prayerNeedsApproval,type PrayerApprovalState} from './prayer-approval.ts';

import {fixture} from '../../tests/prayer-fixture.ts';

const approve=(state=fixture())=>approvePrayerRequest(state,{id:'prayer',body:'The exact message the pastor reviewed.'},'Test pastor');

test('one approval saves exact wording and queues only designated members',()=>{
  const original=fixture(),state=approve(original),message=state.messages[0];
  assert.equal(message.body,'The exact message the pastor reviewed.');
  assert.equal(message.status,'approved');assert.equal(message.approval?.sendRequested,true);
  assert.deepEqual(message.targets.map(target=>target.personId),['member']);
  assert.equal(state.deliveries.length,1);assert.equal(state.deliveries[0].status,'queued');
  assert.equal(state.automation!.requests[0].status,'approved');
  assert.equal(prayerNeedsApproval(state,'prayer'),false);
  assert.equal(original.messages.length,0);
});

test('duplicates, opted-out, paused, archived, unpermitted and sample members are excluded',()=>{
  const state=fixture(),member=state.people[0];
  state.people.push({...member,id:'duplicate'},...[
    {id:'paused',paused:true},{id:'archived',archived:true},{id:'sample',sample:true},{id:'unpermitted',prayerSms:false},{id:'opted-out'}
  ].map((overrides,index)=>({...member,phone:`+120255501${10+index}`,...overrides})));
  state.smsSuppressions=[{phone:'+12025550114',at:new Date().toISOString(),messageSid:'test-opt-out'}];
  assert.deepEqual(prayerRecipients(state).map(target=>target.personId),['member']);
});

test('private requests and empty recipient lists cannot be broadcast',()=>{
  const state=fixture();state.prayers[0].sharing='private';assert.throws(()=>approve(state),/private/);
  state.prayers[0].sharing='unknown';state.automation!.requests[0].privateRequested=true;assert.throws(()=>approve(state),/private/);
  state.automation!.requests[0].privateRequested=false;state.people=[];assert.throws(()=>approve(state),/at least one/);
});

test('an approval cannot be submitted twice or resend an uncertain delivery',()=>{
  const state=approve();assert.throws(()=>approve(state),/already approved/);
  delete state.messages[0].approval!.sendRequested;state.deliveries[0].status='uncertain';
  assert.throws(()=>approve(state),/already started/);
});

test('old unsent test approvals require a new decision and their old queue is cancelled',()=>{
  const legacy=approve();delete legacy.messages[0].approval!.sendRequested;
  assert.equal(prayerNeedsApproval(legacy,'prayer'),true);
  const oldId=legacy.messages[0].id,state=approve(legacy);
  assert.equal(state.messages.find(message=>message.id===oldId)!.status,'cancelled');
  assert.equal(state.deliveries.find(delivery=>delivery.messageId===oldId)!.status,'cancelled');
  assert.equal(state.deliveries.filter(delivery=>delivery.status==='queued').length,1);
});

test('recipient changes after approval cannot expand its audience and opt-outs still suppress delivery',()=>{
  const state=approve(),message=state.messages[0];
  state.people[1].prayerMember=true;
  assert.equal(message.targets.length,1);
  state.people[0].prayerSms=false;
  assert.match(dispatchCheck(state,message,message.targets[0],new Date(),true)!,/withdrawn/);
});

test('pause and sending hours continue to hold an approved message',()=>{
  const state=approvePrayerRequest(fixture(),{id:'prayer',body:'Approved message.'},'Test pastor',new Date('2026-09-14T05:00:00Z')),message=state.messages[0];
  state.settings.paused=true;assert.equal(dispatchCheck(state,message,message.targets[0],new Date(),true),'Sending paused');
  state.settings.paused=false;state.settings.start='08:30';state.settings.end='20:30';
  assert.equal(dispatchCheck(state,message,message.targets[0],new Date('2026-09-14T06:00:00Z'),true),'Outside sending hours');
});

test('declining queues no broadcast',()=>{
  const state=applyAction(fixture(),{type:'prayer.close',id:'prayer'},'Test pastor');
  assert.equal(state.prayers[0].state,'closed');assert.equal(state.deliveries.length,0);
});

test('delivery must be enabled before a new approve-and-send decision',()=>{
  const state=fixture();state.automation!.broadcastsEnabled=false;assert.throws(()=>approve(state),/not enabled/);
});
