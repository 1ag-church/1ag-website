import assert from 'node:assert/strict';
import {test} from 'node:test';
import {approvalMatches,fingerprint,initialState,type Message} from './model.ts';

function approved():Message {
 const m=initialState().messages.find(m=>m.program==='prayer')!;
 m.occurrence={anchor:'2026-09-14T12:00:00Z',dueAt:'2026-09-14T13:00:00Z'};
 m.status='approved';m.approval={revision:m.revision,fingerprint:fingerprint(m),actor:'Test',at:'2026-09-14T12:00:00Z',expiresAt:'2026-09-15T12:00:00Z',sendRequested:true};
 return m;
}
test('saved approvals accept reordered object keys, including older fingerprints',()=>{
 const m=approved();
 m.targets=m.targets.map(t=>({context:t.context,destination:t.destination,personId:t.personId}));
 m.occurrence={dueAt:m.occurrence!.dueAt,anchor:m.occurrence!.anchor};
 assert.notEqual(fingerprint(m),m.approval!.fingerprint);
 assert.equal(approvalMatches(m),true);
});
test('saved approvals reject every changed approved field and malformed approvals',()=>{
 const changes:((m:Message)=>void)[]=[
  m=>{m.body+=' changed';},m=>{m.subject+=' changed';},m=>{m.id+='changed';},
  m=>{m.revision++;},m=>{m.program='guest';},m=>{m.channel='email';},
  m=>{m.scheduledAt='2026-10-01T00:00:00Z';},m=>{m.eventId='changed';},m=>{m.eventVersion=2;},
  m=>{m.targets[0].destination='+12025550999';},m=>{m.targets[0].personId='different';},
  m=>{m.targets[0].context++;},m=>{m.targets.pop();},m=>{m.targets.reverse();},
  m=>{m.occurrence!.anchor='changed';},m=>{m.occurrence!.dueAt='changed';},
  m=>{m.approval!.fingerprint='invalid JSON';},m=>{m.approval!.fingerprint='null';},m=>{delete m.approval;},
 ];
 for(const change of changes){const m=approved();change(m);assert.equal(approvalMatches(m),false,change.toString());}
});
