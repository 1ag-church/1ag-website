import type {State,Person} from './model.ts';
import {channelPermissions,setChannelPermissions} from './contact-permissions.ts';
import {parsePeopleCsv,normalizeContactPhone,type CsvOptions,type CsvField,type CsvRow} from './people-csv.ts';

type Subscription='Subscribed'|'Unsubscribed'|'';
type ImportedPerson=Person & {groups?:string[];glooImportKeys?:string[]};
type DirectoryState=State & {directoryGroups?:{id:string;name:string}[]};
type GlooRow=CsvRow & {address:string;smsStatus:Subscription;emailStatus:Subscription;status:string;createdAt:string;key:string;personId:string;groups:string[]};
const clean=(value:string)=>value.trim()==='-'?'':value.trim();
const identity=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const subscription=(value:string):Subscription=>{if(!value)return '';if(value==='Subscribed'||value==='Unsubscribed')return value;throw Error('Subscription status must be Subscribed, Unsubscribed, or blank.');};

function planGloo(text:string,options:CsvOptions,state:State):GlooRow[]{
 const {headers,rows}=parsePeopleCsv(text),mapping=options.mapping;
 if(!mapping||(!mapping.name&&!mapping.firstName))throw Error('Match a Full name or First name column.');
 const fields:CsvField[]=['name','firstName','lastName','phone','email','address','groups','smsStatus','emailStatus','status','createdAt'];
 for(const field of fields){const h=mapping[field];if(h!==undefined&&(typeof h!=='string'||h&&!headers.includes(h)))throw Error('Choose valid column headings.');}
 for(const field of ['groups','smsStatus','emailStatus','status'] as const)if(!mapping[field])throw Error('Match the Gloo groups, subscription statuses, and contact status columns.');
 if(!mapping.phone&&!mapping.email)throw Error('Match the Gloo phone or email column.');
 const used=fields.map(f=>mapping[f]).filter(Boolean);if(new Set(used).size!==used.length)throw Error('Match each CSV column to only one field.');
 // Preview and commit share a deterministic plan. Email alone never identifies a person.
 const known:ImportedPerson[]=structuredClone(state.people),output:GlooRow[]=[];
 for(const [index,values] of rows.entries()){
  const get=(field:CsvField)=>mapping[field]?clean(values[headers.indexOf(mapping[field]!)]) : '';
  const originalName=get('name')||[get('firstName'),get('lastName')].filter(Boolean).join(' ');
  const r:GlooRow={row:index+2,name:originalName,phone:'',email:get('email').toLowerCase(),firstVisit:'',issue:'',duplicate:false,address:get('address'),groups:[],smsStatus:'',emailStatus:'',status:get('status'),createdAt:get('createdAt'),key:'',personId:'',result:''};
  try{
   r.phone=normalizeContactPhone(get('phone'));
   if(originalName.length>120)throw Error('Name must be at most 120 characters.');
   if(r.email&&(r.email.length>254||!/^\S+@\S+\.\S+$/.test(r.email)))throw Error('Email address is invalid.');
   if(r.address.length>500)throw Error('Address must be at most 500 characters.');
   if(!originalName&&!r.phone&&!r.email)throw Error('A name, phone number, or email is required.');
   r.name=originalName||`Unnamed Gloo contact (${r.phone||r.email})`;
   if(!originalName)r.warning='Gloo has no name; a descriptive placeholder will be used.';
   else if(!r.phone&&!r.email)r.warning='Saved in the directory without contact permission.';
   r.groups=[...new Set(get('groups').split(',').map(x=>x.trim()).filter(Boolean))];
   if(r.groups.length>100||r.groups.some(x=>x.length>60))throw Error('Use at most 100 groups, with group names up to 60 characters.');
   r.smsStatus=subscription(get('smsStatus'));r.emailStatus=subscription(get('emailStatus'));
   if(!['Active','Inactive','Archived','Blocked','Unsubscribed'].includes(r.status))throw Error('Choose a valid Gloo contact status.');
   if(r.createdAt.length>100)throw Error('Gloo creation date is too long.');
   r.key=JSON.stringify([identity(originalName),r.phone,r.email,r.address,r.createdAt]);
   const byKey=known.filter(p=>p.glooImportKeys?.includes(r.key));
   const byPhone=r.phone?known.filter(p=>{try{return normalizeContactPhone(p.phone)===r.phone;}catch{return false;}}):[];
   const byEmailName=r.email&&originalName?known.filter(p=>p.email.trim().toLowerCase()===r.email&&identity(p.name)===identity(originalName)):[];
   const candidates=byKey.length?byKey:byPhone.length?byPhone:byEmailName;
   if(candidates.length>1)throw Error('Multiple contacts match. Resolve these contacts before importing.');
   const match=candidates[0];
   if(match){
    if(!byKey.length&&originalName&&identity(match.name)!==identity(originalName))throw Error('This phone belongs to a differently named contact. Review before importing.');
    if(r.phone&&match.phone&&normalizeContactPhone(match.phone)!==r.phone)throw Error('This matching name and email has a different phone. Review before importing.');
    if(r.email&&match.email&&match.email.toLowerCase()!==r.email)throw Error('This matching phone has a different email. Review before importing.');
    r.personId=match.id;r.result='Update matching person';
    if(!match.phone)match.phone=r.phone;if(!match.email)match.email=r.email;
    (match.glooImportKeys??=[]).push(r.key);
   }else{
    r.personId=`gloo-row-${index}`;r.result='New directory contact';
    known.push({id:r.personId,name:r.name,phone:r.phone,email:r.email,glooImportKeys:[r.key]} as ImportedPerson);
   }
  }catch(e){r.issue=e instanceof Error?e.message:'Invalid row.';r.result='Needs review';}
  output.push(r);
 }
 return output;
}
export function previewGlooCsv(text:string,options:CsvOptions,state:State):CsvRow[]{return planGloo(text,options,state);}

export function importGlooCsv(previous:State,text:string,options:CsvOptions,actor:string,now=new Date()):State{
 const rows=planGloo(text,options,previous),invalid=rows.filter(r=>r.issue);
 if(invalid.length)throw Error(`Review ${invalid.length} invalid or conflicting row(s) before importing.`);
 const s=structuredClone(previous) as DirectoryState,at=now.toISOString(),resolved=new Map<string,ImportedPerson>();
 const revokedPhones=new Set(rows.filter(r=>r.smsStatus==='Unsubscribed'||r.status==='Unsubscribed').map(r=>r.phone).filter(Boolean));
 const revokedEmails=new Set(rows.filter(r=>r.emailStatus==='Unsubscribed').map(r=>r.email).filter(Boolean));
 let created=0,updated=0;const touched=new Set<string>(),createdIds=new Set<string>(),sourceSmsIds=new Set<string>(),sourceEmailIds=new Set<string>();
 for(const r of rows){
  let p=resolved.get(r.personId)??s.people.find(p=>p.id===r.personId) as ImportedPerson|undefined;
  const isNew=!p;
  if(!p){p={id:crypto.randomUUID(),name:r.name,phone:r.phone,email:r.email,address:r.address,household:'',stage:'Contact',assimilation:false,paused:false,archived:false,prayerMember:false,prayerSms:false,guestSms:false,guestEmail:false,firstVisit:at,source:'Gloo CSV import',note:'',context:1,sample:false};s.people.push(p);createdIds.add(p.id);created++;}
  else if(!touched.has(p.id))updated++;
  resolved.set(r.personId,p);touched.add(p.id);
  if(!p.phone)p.phone=r.phone;if(!p.email)p.email=r.email;if(!p.address)p.address=r.address;
  p.paused=p.paused||['Inactive','Blocked'].includes(r.status);p.archived=p.archived||r.status==='Archived';
  const ids=p.groups??=[];
  for(const name of r.groups){
   if(identity(name)==='prayer chain'){p.prayerMember=true;continue;}
   const groups=s.directoryGroups??=[];
   let group=groups.find(g=>identity(g.name)===identity(name));
   if(!group){group={id:crypto.randomUUID(),name};groups.push(group);}
   if(!ids.includes(group.id))ids.push(group.id);
  }
  if(r.smsStatus==='Subscribed')sourceSmsIds.add(p.id);
  if(r.emailStatus==='Subscribed')sourceEmailIds.add(p.id);
  if(!p.glooImportKeys?.includes(r.key))(p.glooImportKeys??=[]).push(r.key);
  const detail=`Gloo record: ${r.status}. SMS: ${r.smsStatus||'Unknown'}. Email: ${r.emailStatus||'Unknown'}. Created in Gloo: ${r.createdAt||'Unknown'}.`;
  if(!p.note.includes(detail))p.note=[p.note,detail].filter(Boolean).join('\n');
  if(!isNew)p.context++;
 }
 // Aggregate source fragments before applying permissions. Blank source fields are unknown,
 // and any explicit destination opt-out wins across family records and repeated source rows.
 for(const p of s.people){const permission=channelPermissions(p);let phone='';try{phone=normalizeContactPhone(p.phone);}catch{/* Invalid stored numbers cannot be sent to. */}
  if(!touched.has(p.id)&&!revokedPhones.has(phone)&&!revokedEmails.has(p.email.toLowerCase()))continue;
  const sms=(createdIds.has(p.id)?sourceSmsIds.has(p.id):permission.sms)&&!!phone&&!revokedPhones.has(phone)&&!s.smsSuppressions?.some(x=>x.phone===phone);
  const email=(createdIds.has(p.id)?sourceEmailIds.has(p.id):permission.email)&&!!p.email&&!revokedEmails.has(p.email.toLowerCase());
  if(createdIds.has(p.id)||sms!==permission.sms||email!==permission.email){setChannelPermissions(p,{sms,email});p.context++;touched.add(p.id);}
 }
 // Only invalidate affected pending work. Importing never sends, approves, or enrolls guests.
 for(const m of s.messages)if(m.targets.some(t=>touched.has(t.personId))&&m.status==='approved'){m.status='held';delete m.approval;m.revision++;m.reason='Contact updated by Gloo import; review again.';}
 for(const d of s.deliveries)if(touched.has(d.target.personId)&&d.status==='queued'){d.status='suppressed';d.reason='Contact updated by Gloo import; review again.';}
 s.audit.unshift({id:crypto.randomUUID(),at,actor,action:`Gloo import: ${rows.length} source records, ${created} new people, ${updated} matching people updated. Groups and subscription statuses preserved. No messages sent or guest follow-up started.`});s.audit=s.audit.slice(0,1000);
 return s;
}
