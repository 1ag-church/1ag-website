import test from 'node:test';
import assert from 'node:assert/strict';
import {runIsolatedJobs} from './worker-jobs.ts';
test('a failed prayer job cannot block independent jobs or expose its private error',async()=>{
 const calls:string[]=[];
 const result=await runIsolatedJobs([{name:'Prayer processing',run:async()=>{throw Error('private-secret');}},...['Care reminders','Serving reminders','Communications','Guest follow-up'].map(name=>({name,run:async()=>{calls.push(name);return {processed:1};}}))]);
 assert.equal(calls.length,4);assert.deepEqual(result.issues,['Prayer processing']);assert.ok(!JSON.stringify(result).includes('private-secret'));
});
