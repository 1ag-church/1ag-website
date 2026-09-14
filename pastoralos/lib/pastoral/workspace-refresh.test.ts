import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initialState} from './model.ts';
import {createWorkspaceRefresh,type WorkspaceSnapshot} from './workspace-refresh.ts';
const snapshot=(version:number)=>({state:initialState(),version});
function deferred(){let resolve!:(response:Response)=>void;const promise=new Promise<Response>(done=>resolve=done);return {promise,resolve};}

test('every refresh reads uncached workspace data',async()=>{
 const applied:WorkspaceSnapshot[]=[],reader=createWorkspaceRefresh(s=>applied.push(s));let calls=0;
 const request=async(path:string,init?:RequestInit)=>{assert.equal(path,'/api/state');assert.equal(init?.cache,'no-store');return Response.json(snapshot(++calls));};
 await reader.refresh(request);await reader.refresh(request);
 assert.deepEqual(applied.map(s=>s.version),[1,2]);
});
test('older overlapping reads cannot replace the newest tab result',async()=>{
 const applied:number[]=[],reader=createWorkspaceRefresh(s=>applied.push(s.version));
 const first=deferred(),second=deferred();
 const one=reader.refresh(()=>first.promise),two=reader.refresh(()=>second.promise);
 second.resolve(Response.json(snapshot(12)));await two;
 first.resolve(Response.json(snapshot(11)));await one;
 assert.deepEqual(applied,[12]);
});
test('a delayed refresh cannot undo a saved approval or pause',async()=>{
 const applied:number[]=[],reader=createWorkspaceRefresh(s=>applied.push(s.version)),pending=deferred();
 reader.accept(snapshot(20));const read=reader.refresh(()=>pending.promise);
 reader.accept(snapshot(22));pending.resolve(Response.json(snapshot(21)));await read;
 reader.accept(snapshot(21));assert.deepEqual(applied,[20,22]);
});
test('unchanged refresh preserves the current snapshot and unsaved component state',async()=>{
 const applied:WorkspaceSnapshot[]=[],reader=createWorkspaceRefresh(s=>applied.push(s)),current=snapshot(1);
 reader.accept(current);await reader.refresh(async()=>Response.json(snapshot(1)));
 assert.equal(applied.length,1);assert.equal(applied[0],current);
});
test('refresh failure retains loaded data and a later retry recovers',async()=>{
 const applied:number[]=[],reader=createWorkspaceRefresh(s=>applied.push(s.version));reader.accept(snapshot(3));
 await assert.rejects(reader.refresh(async()=>{throw new TypeError('Load failed');}),/Load failed/);
 assert.deepEqual(applied,[3]);await reader.refresh(async()=>Response.json(snapshot(4)));assert.deepEqual(applied,[3,4]);
});
test('obsolete read failures do not report a false refresh error',async()=>{
 const reader=createWorkspaceRefresh(()=>{}),pending=deferred();const old=reader.refresh(()=>pending.promise);
 await reader.refresh(async()=>Response.json(snapshot(2)));pending.resolve(Response.json({error:'Old failure'},{status:503}));await old;
});
