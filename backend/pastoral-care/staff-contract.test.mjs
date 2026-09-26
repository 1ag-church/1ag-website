import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.env.CARE_EXPORT_ROOT;
if(!root)throw Error('Set CARE_EXPORT_ROOT to the prepared function exports.');
const {handleStaffApi}=await import(pathToFileURL(root+'/pastoralos-staff/lib/pastoral/staff-api.ts'));
const {handleEdgeStaff}=await import(pathToFileURL(root+'/pastoralos-staff/lib/pastoral/edge-staff.ts'));
const {initialState}=await import(pathToFileURL(root+'/pastoralos-staff/lib/pastoral/model.ts'));

test('deployed staff bundle authenticates and scopes health to the signed-in workspace',async()=>{
 let owner;const deps={authenticate:async token=>token==='test'?{email:'test@example.com',workspaceOwner:'test-only'}:null,health:async key=>{owner=key;return {lastCompletedAt:'2026-09-26T15:00:00Z',lastError:null};}};
 const url='https://example.supabase.co/functions/v1/pastoralos-staff/health';
 assert.equal((await handleEdgeStaff(new Request(url),deps)).status,401);
 assert.equal((await handleEdgeStaff(new Request(url,{headers:{Authorization:'Bearer invalid'}}),deps)).status,403);
 assert.equal((await handleEdgeStaff(new Request(url,{headers:{Authorization:'Bearer test',Origin:'https://evil.example'}}),deps)).status,403);
 const response=await handleEdgeStaff(new Request(url,{headers:{Authorization:'Bearer test',Origin:'https://1ag.tv'}}),deps);
 assert.equal(response.status,200);assert.equal(owner,'test-only');assert.deepEqual(Object.keys(await response.json()).sort(),['lastCompletedAt','lastError']);
});
test('staff care actions preserve contacts, reject stale writes and bind reminder email to authentication',async()=>{
 let state=initialState(),version=5,owner;const people=structuredClone(state.people);
 const deps={authenticate:async()=>({email:'test@example.com',workspaceOwner:'test-only'}),load:async()=>({state,version}),save:async(key,v,next)=>{assert.equal(v,version);owner=key;state=next;version++;return {state,version};}};
 const send=(action,v=version)=>handleStaffApi(new Request('https://1ag.tv/pastoralos/api/action',{method:'POST',headers:{Authorization:'Bearer test','Content-Type':'application/json'},body:JSON.stringify({action,version:v,owner:'untrusted-other-workspace'})}),deps);
 const action={type:'care.task.save',personId:state.people[0].id,title:'A private follow-up',dueAt:new Date(Date.now()+86400000).toISOString(),notify:false,repeatDays:0};
 assert.equal((await send(action)).status,200);assert.equal(owner,'test-only');assert.equal(state.care.tasks.length,1);assert.deepEqual(state.people,people);
 assert.equal((await send(action,5)).status,409);assert.equal(state.care.tasks.length,1);
 assert.equal((await send({type:'care.preferences',preferences:{channel:'email',email:'wrong@example.com',digestTime:'07:45',dueReminders:false,pauseOnReply:true}})).status,200);
 assert.equal(state.care.preferences.email,'test@example.com');assert.equal(state.care.preferences.digestTime,'07:45');
});
