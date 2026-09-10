import type { State, Person } from './model.ts';

export type CsvField = 'name'|'firstName'|'lastName'|'phone'|'email'|'firstVisit';
export type CsvMapping = Record<CsvField,string>;
export type CsvOptions = { list:'prayer'|'guest'; mapping:CsvMapping; smsPermission:boolean; emailPermission:boolean; consentSource:string };
export type CsvRow = { row:number; name:string; phone:string; email:string; firstVisit:string; issue:string; duplicate:boolean };
export const csvFields:CsvField[]=['name','firstName','lastName','phone','email','firstVisit'];
export const csvLabels:Record<CsvField,string>={name:'Full name',firstName:'First name',lastName:'Last name',phone:'Phone',email:'Email',firstVisit:'First visit (YYYY-MM-DD)'};
const aliases:Record<CsvField,string[]>={name:['name','fullname'],firstName:['firstname','first','givenname'],lastName:['lastname','last','surname','familyname'],phone:['phone','phonenumber','mobile','mobilenumber','mobilephone','cell','cellphone'],email:['email','emailaddress'],firstVisit:['firstvisit','firstvisitdate','visitdate']};
export function parsePeopleCsv(text:string):{headers:string[];rows:string[][]} {
  if(typeof text!=='string'||new TextEncoder().encode(text).length>500000)throw Error('Choose a CSV file under 500 KB.');
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
  const finishCell=()=>{row.push(cell.trim());cell='';closed=false;if(row.length>60)throw Error('CSV files can have at most 60 columns.');};
  const finishRow=()=>{finishCell();if(row.some(Boolean))rows.push(row);row=[];if(rows.length>1001)throw Error('Import up to 1,000 people at a time.');};
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c===','){finishCell();continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;finishRow();continue;}
    if(c==='"'){if(cell.trim()||closed)throw Error('Unexpected quote in CSV. Export the file as CSV again.');cell='';quoted=true;continue;}
    if(closed&&c.trim())throw Error('Unexpected text after a quoted CSV field.');
    cell+=c;
  }
  if(quoted)throw Error('A quoted CSV field is unfinished.');
  finishRow();const headers=rows.shift();
  if(!headers?.length||!rows.length)throw Error('Include column headings and at least one person.');
  if(headers.some(h=>!h)||new Set(headers.map(h=>h.toLowerCase())).size!==headers.length)throw Error('Give every column a unique, nonempty heading.');
  if(rows.some(r=>r.length!==headers.length))throw Error('Each CSV row must have the same number of columns as the headings.');
  return {headers,rows};
}
export function guessCsvMapping(headers:string[]):CsvMapping {
  return Object.fromEntries(csvFields.map(f=>[f,headers.find(h=>aliases[f].includes(h.toLowerCase().replace(/[^a-z]/g,'')))??''])) as CsvMapping;
}
export function normalizeContactPhone(value:string):string {
  if(!value.trim())return '';
  // Our export prefixes spreadsheet-formula characters with an apostrophe.
  const v=value.trim().replace(/^'(?=\+)/,'');
  if(!/^\+?[\d\s().-]+$/.test(v))throw Error('Use a phone number without extensions.');
  const digits=v.replace(/\D/g,'');const phone=v.startsWith('+')?'+'+digits:digits.length===10?'+1'+digits:digits.length===11&&digits.startsWith('1')?'+'+digits:'';
  if(!/^\+[1-9]\d{7,14}$/.test(phone))throw Error('Use a 10-digit US number or include the country code.');
  return phone;
}
export function previewPeopleCsv(text:string,options:CsvOptions,state:State):CsvRow[] {
  const {headers,rows}=parsePeopleCsv(text);
  if(!options||!['prayer','guest'].includes(options.list)||!options.mapping)throw Error('Choose Prayer Chain or Assimilation and match the columns.');
  const mapping=options.mapping;
  if(!mapping.name&&!mapping.firstName)throw Error('Match a Full name or First name column.');
  if(!mapping.phone&&!mapping.email)throw Error('Match a Phone or Email column.');
  for(const f of csvFields)if(typeof mapping[f]!=='string'||mapping[f]&&!headers.includes(mapping[f]))throw Error('Choose valid column headings.');
  const used=csvFields.map(f=>mapping[f]).filter(Boolean);if(new Set(used).size!==used.length)throw Error('Match each CSV column to only one field.');
  const phones=new Set(state.people.map(p=>{try{return normalizeContactPhone(p.phone);}catch{return p.phone;}}).filter(Boolean));
  const emails=new Set(state.people.map(p=>p.email.toLowerCase()).filter(Boolean));
  return rows.map((values,index)=>{
    const get=(f:CsvField)=>mapping[f]?values[headers.indexOf(mapping[f])].trim():'';
    const r:CsvRow={row:index+2,name:get('name')||[get('firstName'),get('lastName')].filter(Boolean).join(' '),phone:'',email:get('email').toLowerCase(),firstVisit:get('firstVisit'),issue:'',duplicate:false};
    try{
      if(!r.name||r.name.length>120)throw Error('Name is required (up to 120 characters).');
      r.phone=normalizeContactPhone(get('phone'));
      if(r.email&&(r.email.length>254||!/^\S+@\S+\.\S+$/.test(r.email)))throw Error('Email address is invalid.');
      if(!r.phone&&!r.email)throw Error('A phone number or email is required.');
      if(options.list==='prayer'&&!r.phone)throw Error('Prayer-chain members need a phone number.');
      if(r.firstVisit&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.firstVisit)||!Number.isFinite(Date.parse(r.firstVisit))||new Date(r.firstVisit).toISOString().slice(0,10)!==r.firstVisit||r.firstVisit>new Date().toISOString().slice(0,10)))throw Error('First visit must be a valid date today or earlier (YYYY-MM-DD).');
      if(r.phone&&phones.has(r.phone)||r.email&&emails.has(r.email)){r.duplicate=true;r.issue='Skipped: contact matches an existing person or an earlier CSV row. Review shared contacts manually.';}
      else {if(r.phone)phones.add(r.phone);if(r.email)emails.add(r.email);}
    }catch(e){r.issue=e instanceof Error?e.message:'Invalid row.';}
    return r;
  });
}
export function importPeopleCsv(previous:State,text:string,options:CsvOptions,actor:string,now=new Date()):State {
  const rows=previewPeopleCsv(text,options,previous);
  if(typeof options.smsPermission!=='boolean'||typeof options.emailPermission!=='boolean'||typeof options.consentSource!=='string'||options.consentSource.length>500)throw Error('Choose contact permissions and enter a consent source under 500 characters.');
  if((options.smsPermission||options.list==='guest'&&options.emailPermission)&&!options.consentSource.trim())throw Error('Record how these people gave permission to be contacted.');
  const invalid=rows.filter(r=>r.issue&&!r.duplicate);if(invalid.length)throw Error(`Fix ${invalid.length} invalid row(s) before importing.`);
  const ready=rows.filter(r=>!r.issue);if(!ready.length)throw Error('There are no new people to import.');
  const s=structuredClone(previous),at=now.toISOString();
  for(const r of ready){
    const sms=options.smsPermission&&!!r.phone&&!s.smsSuppressions?.some(x=>x.phone===r.phone);
    const firstVisit=r.firstVisit?`${r.firstVisit}T12:00:00.000Z`:at;
    const p:Person={id:crypto.randomUUID(),name:r.name,email:r.email,phone:r.phone,address:'',household:'',stage:options.list==='prayer'?'Regular attendee':'New guest',paused:false,archived:false,prayerMember:options.list==='prayer',prayerSms:options.list==='prayer'&&sms,guestSms:options.list==='guest'&&sms,guestEmail:options.list==='guest'&&options.emailPermission&&!!r.email,firstVisit,stageEnteredAt:firstVisit,source:`CSV import · ${options.list==='prayer'?'Prayer Chain':'Assimilation'}`,note:`Imported ${at} by ${actor}. SMS permission confirmed: ${options.smsPermission}. Email permission confirmed: ${options.list==='guest'&&options.emailPermission}. Consent source: ${options.consentSource.trim()||'Not recorded'}.`,context:1,sample:false};
    s.people.push(p);
  }
  s.audit.unshift({id:crypto.randomUUID(),at,actor,action:`Imported ${ready.length} people into ${options.list==='prayer'?'Prayer Chain':'Assimilation'}; skipped ${rows.filter(r=>r.duplicate).length} duplicate contacts. No messages sent.`});s.audit=s.audit.slice(0,1000);
  return s;
}
