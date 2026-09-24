import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyAction,assimilationCategories,assimilationStep,assimilationStepLabel,assimilationStepValue,eligible} from './model.ts';

const now=new Date('2026-09-24T17:00:00Z');
function workspace(){const s=initialState(now);s.rules=[];s.messages=[];s.deliveries=[];s.people=s.people.slice(0,1).map(p=>({...p,assimilation:true,stage:'Unassigned'}));return s;}
const add=(title:string)=>({type:'rule.save',title,days:0,channel:'sms',template:'Hello {firstName}',enabled:true});
test('categories and selector identities follow added, renamed and deleted steps',()=>{
 let s=applyAction(workspace(),add('Meet the pastor'),'Staff',now);
 const rule=s.rules[0],value=assimilationStepValue(rule);
 s=applyAction(s,{type:'person.status',id:s.people[0].id,field:'stage',value},'Staff',now);
 const anchor=s.people[0].stageEnteredAt;
 assert.deepEqual(assimilationCategories(s).map(c=>[c.title,c.people.length]),[['Meet the pastor',1]]);
 s=applyAction(s,{type:'rule.save',...rule,title:'Coffee with Pastor Adam'},'Staff',new Date(now.getTime()+86400000));
 assert.equal(assimilationStepLabel(s,s.people[0]),'Coffee with Pastor Adam');
 assert.equal(s.people[0].stage,value);
 assert.equal(s.people[0].stageEnteredAt,anchor);
 s=applyAction(s,{type:'prepare'},'Staff',now);
 assert.equal(s.messages[0].subject,'Coffee with Pastor Adam');
 s=applyAction(s,{type:'rule.delete',id:rule.id,version:2},'Staff',now);
 assert.deepEqual(assimilationCategories(s).map(c=>[c.title,c.people.length]),[['Choose a step',1]]);
 assert.equal(s.messages[0].status,'cancelled');
 assert.equal(eligible(s,s.messages[0],s.messages[0].targets[0]),'Step deleted');
 s=applyAction(s,add('Coffee with Pastor Adam'),'Staff',now);
 assert.equal(assimilationStep(s,s.people[0]),undefined,'same name must not silently reassign someone');
 assert.throws(()=>applyAction(s,{type:'person.status',id:s.people[0].id,field:'stage',value},'Staff',now),/existing assimilation step/);
});
test('moving between steps changes follow-up eligibility and restarts the delay',()=>{
 let s=applyAction(workspace(),add('First step'),'Staff',now);
 s=applyAction(s,add('Second step'),'Staff',now);
 const assign=(value:string)=>({type:'person.status',id:s.people[0].id,field:'stage',value});
 s=applyAction(s,assign(assimilationStepValue(s.rules[0])),'Staff',now);
 s=applyAction(s,{type:'prepare'},'Staff',now);
 const later=new Date(now.getTime()+86400000);
 s=applyAction(s,assign(assimilationStepValue(s.rules[1])),'Staff',later);
 assert.equal(s.people[0].stageEnteredAt,later.toISOString());
 assert.equal(eligible(s,s.messages[0],s.messages[0].targets[0]),'Guest step changed');
 s=applyAction(s,{type:'prepare'},'Staff',later);
 assert.equal(s.messages[0].ruleId,s.rules[1].id);
 assert.deepEqual(assimilationCategories(s).map(c=>c.people.length),[0,1]);
});
test('paused steps remain visible; completed and unmapped people remain visible once; contacts stay out',()=>{
 const s=initialState(now);s.rules[0].enabled=false;
 const columns=assimilationCategories(s);
 assert.equal(columns[0].paused,true);
 assert.equal(columns[0].people[0].id,'p1');
 assert.deepEqual(columns.find(c=>c.id==='unassigned')!.people.map(p=>p.id),['p3','p6']);
 assert.deepEqual(columns.find(c=>c.id==='completed')!.people.map(p=>p.id),['p7']);
 const ids=columns.flatMap(c=>c.people.map(p=>p.id));
 assert.equal(new Set(ids).size,ids.length);
 assert.equal(ids.includes('p8'),false);
 assert.deepEqual(assimilationCategories({...s,people:[],rules:[]}),[]);
});
test('enrollment uses the first configured step and no-step enrollment waits for assignment',()=>{
 for(const withStep of [true,false]){
  let s=workspace();s.people[0].assimilation=false;s.people[0].stage='Contact';
  if(withStep)s=applyAction(s,add('Custom welcome'),'Staff',now);
  s=applyAction(s,{type:'person.enrollment',id:s.people[0].id,enroll:true},'Staff',now);
  assert.equal(assimilationStep(s,s.people[0])?.title,withStep?'Custom welcome':undefined);
  assert.equal(s.messages.length,withStep?1:0);
 }
});
test('event registration retains the configured step; attendance still completes the journey',()=>{
 let s=applyAction(workspace(),add('Starting Point follow-up'),'Staff',now);
 const value=assimilationStepValue(s.rules[0]);
 s=applyAction(s,{type:'person.status',id:s.people[0].id,field:'stage',value},'Staff',now);
 s=applyAction(s,{type:'event.register',eventId:s.events[0].id,personId:s.people[0].id},'Staff',now);
 assert.equal(s.people[0].stage,value);
 s=applyAction(s,{type:'event.attend',eventId:s.events[0].id,personId:s.people[0].id},'Staff',new Date('2026-11-01T17:00:00Z'));
 assert.equal(assimilationCategories(s).find(c=>c.id==='completed')!.people.length,1);
});
