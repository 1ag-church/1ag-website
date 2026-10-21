import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type State} from './model.ts';
import {guessCsvMapping,parsePeopleCsv,previewPeopleCsv,importPeopleCsv,type CsvOptions} from './people-csv.ts';
import {channelPermissions} from './contact-permissions.ts';
const now=new Date('2026-10-21T21:00:00Z');
const headers=['Phone Number','First Name','Last Name','Email','Address','Groups','SMS Subscription Status','Email Subscription Status','Status','Created At'];
const cell=(v:string)=>'"'+v.replaceAll('"','""')+'"';
const csv=(rows:string[][])=>[headers,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
const record=(name='Jane',phone='(618) 555-0100',email='jane@example.com',groups='Prayer Chain, Members',sms='Subscribed',mail='Subscribed',status='Active')=>[phone,name,'Smith',email,'123 Main St',groups,sms,mail,status,'10/01/2026 4:00 PM'];
function state(){const s=initialState(now);s.people=[];s.messages=[];s.deliveries=[];return s;}
function options(text:string):CsvOptions{return {list:'gloo',mapping:guessCsvMapping(parsePeopleCsv(text).headers),smsPermission:false,emailPermission:false,consentSource:''};}
function run(text:string,s:State=state()){return importPeopleCsv(s,text,options(text),'Test',now) as State & {directoryGroups:{id:string;name:string}[]};}
test('Gloo mapping preserves quoted comma groups, addresses and per-person permissions without guest enrollment',()=>{
 const text=csv([record()]),s=run(text),p=s.people[0];
 assert.equal(p.prayerMember,true);assert.equal(p.address,'123 Main St');assert.equal(p.phone,'+16185550100');
 assert.deepEqual(s.directoryGroups.map(g=>g.name),['Members']);assert.deepEqual(channelPermissions(p),{sms:true,email:true});
 assert.equal(p.assimilation,false);assert.equal(p.stage,'Contact');assert.equal(p.firstVisit,now.toISOString());assert.match(p.note,/Created in Gloo: 10\/01\/2026/);
 assert.equal(s.messages.length,0);assert.equal(s.deliveries.length,0);
});
test('household email does not merge different names; matching name/email source fragments merge and retain all tags and permissions',()=>{
 const text=csv([record('Jane'),record('John','(618) 555-0101','jane@example.com','Men'),record('jane','-','jane@example.com','Volunteers','-','Subscribed')]);
 const s=run(text);assert.equal(s.people.length,2);assert.deepEqual(channelPermissions(s.people[0]),{sms:true,email:true});
 assert.equal((s.people[0] as {groups?:string[]}).groups?.length,2);assert.equal(s.people[0].prayerMember,true);
 const next=run(text,s);assert.equal(next.people.length,2);assert.equal(next.directoryGroups.length,3);
});
test('source opt-out wins across shared destinations, regardless of row order',()=>{
 const a=record('Jane'),b=record('John','(618) 555-0101','jane@example.com','Men','Subscribed','Unsubscribed');
 for(const rows of [[a,b],[b,a]]){const s=run(csv(rows));assert(s.people.every(p=>channelPermissions(p).email===false));assert(s.people.every(p=>channelPermissions(p).sms));}
});
test('existing local refusals and STOP remain off; matching person gains tags without starting assimilation',()=>{
 const text=csv([record()]),s=run(text);s.people[0].channelPermissions={sms:false,email:false};s.people[0].prayerMember=false;
 s.smsSuppressions=[{phone:'+16185550100',at:now.toISOString(),messageSid:'STOP-test'}];
 const next=run(text,s);assert.equal(next.people.length,1);assert.deepEqual(channelPermissions(next.people[0]),{sms:false,email:false});assert(next.people[0].prayerMember);assert.equal(next.people[0].assimilation,false);
});
test('inactive contacts stay paused on later active imports; unnamed and name-only rows remain available',()=>{
 const unnamed=record('','(618) 555-0100','-','','Subscribed','-');unnamed[2]='';
 const nameOnly=record('Contact','-','-','','-','-','Inactive');
 const text=csv([unnamed,nameOnly]),s=run(text);assert.equal(s.people.length,2);assert.match(s.people[0].name,/Unnamed Gloo/);assert(s.people[1].paused);
 assert.deepEqual(channelPermissions(s.people[1]),{sms:false,email:false});nameOnly[8]='Active';assert(run(csv([nameOnly]),s).people[1].paused);
});
test('ambiguous phone ownership and conflicting email are shown in preview and abort atomically',()=>{
 const s=run(csv([record()])),before=structuredClone(s);
 for(const row of [record('Different'),record('Jane','(618) 555-0100','other@example.com')]){
  const text=csv([row]);assert(previewPeopleCsv(text,options(text),s)[0].issue);assert.throws(()=>run(text,s),/conflicting/);assert.deepEqual(s,before);
 }
});
test('invalid status, missing required columns, malformed CSV and over-limit files fail before mutation',()=>{
 const text=csv([record()]),o=options(text);o.mapping.smsStatus='';assert.throws(()=>importPeopleCsv(state(),text,o,'Test'),/subscription/);
 const bad=record();bad[6]='yes';assert.throws(()=>run(csv([bad])),/invalid/);
 assert.throws(()=>parsePeopleCsv('Name,Email\n"broken'),/unfinished/);
 assert.equal(parsePeopleCsv(csv(Array.from({length:1023},(_,i)=>record('Person'+i)))).rows.length,1023);
 assert.throws(()=>parsePeopleCsv(csv(Array.from({length:5001},()=>record()))),/5,000|500 KB/);
});
test('generic Prayer Chain and Assimilation imports keep their original duplicate and consent behavior',()=>{
 const text='Name,Phone,Email\nJane Smith,6185550100,jane@example.com';
 const o:CsvOptions={list:'prayer',mapping:guessCsvMapping(parsePeopleCsv(text).headers),smsPermission:true,emailPermission:false,consentSource:'Signup card'};
 const s=importPeopleCsv(state(),text,o,'Test',now);assert.equal(s.people.length,1);assert(s.people[0].prayerMember);assert(channelPermissions(s.people[0]).sms);
 assert(previewPeopleCsv(text,o,s)[0].duplicate);assert.throws(()=>importPeopleCsv(state(),text,{...o,consentSource:''},'Test'),/permission/);
});
test('contact changes revoke approvals and queued deliveries but preserve submitted delivery history',()=>{
 let s=run(csv([record()])),id=s.people[0].id;
 const target={personId:id,destination:s.people[0].phone,context:1};
 s.messages=[{id:'m1',program:'guest',personId:id,subject:'Test',body:'Test',channel:'sms',status:'approved',revision:1,createdAt:now.toISOString(),scheduledAt:now.toISOString(),targets:[target],approval:{revision:1,fingerprint:'old',actor:'Test',at:now.toISOString(),expiresAt:now.toISOString()},reason:''}];
 s.deliveries=[{id:'d1',messageId:'m1',revision:1,target,status:'queued',reason:'',at:now.toISOString()},{id:'d2',messageId:'m1',revision:1,target,status:'sent',reason:'',at:now.toISOString()}];
 s=run(csv([record()]),s);assert.equal(s.messages[0].status,'held');assert.equal(s.messages[0].approval,undefined);assert.equal(s.deliveries[0].status,'suppressed');assert.equal(s.deliveries[1].status,'sent');
});
