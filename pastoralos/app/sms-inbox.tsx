'use client';
import './sms-inbox.css';
import {openCare} from './pastoral-care';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Check,Clock,MessageSquare,Plus,Search,Send} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {RecipientPicker} from './recipient-picker';
import {audienceReport,type CommunicationsState,type DeliveryConnection} from '@/lib/pastoral/communications';
import {smsThreads} from '@/lib/pastoral/sms-conversations';
import {centralDate,centralInput} from '@/lib/pastoral/email-design';
import type {Action} from '@/lib/pastoral/model';

const stamp=(value:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
const initials=(name:string)=>name.startsWith('+')?'?':name.split(' ').slice(0,2).map(w=>w[0]).join('');
type Props={state:CommunicationsState;busy:boolean;connection:DeliveryConnection|null;run:(a:Action)=>Promise<boolean>};
export function SmsInbox({state,busy,connection,run}:Props){
 const threads=useMemo(()=>smsThreads(state),[state]);
 const [selected,setSelected]=useState<string|null>(null),[creating,setCreating]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState('All'),[hideAutomated,setHideAutomated]=useState(false);
 const [groups,setGroups]=useState<string[]>([]),[people,setPeople]=useState<string[]>([]),[drafts,setDrafts]=useState<Record<string,string>>({}),[schedule,setSchedule]=useState(false),[when,setWhen]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[sending,setSending]=useState(false);
 const scroll=useRef<HTMLDivElement>(null),sendingRef=useRef(false),readAttempt=useRef('');
 const thread=threads.find(t=>t.phone===selected),draftKey=creating?'new':selected??'none',body=drafts[draftKey]??'';
 const personIds=creating?people:thread?.personId?[thread.personId]:[],groupIds=creating?groups:[];
 const report=audienceReport(state,{channel:'sms',personIds,groupIds});
 const matches=threads.filter(t=>(!query.trim()||`${t.name} ${t.phone}`.toLowerCase().includes(query.trim().toLowerCase())||query.replace(/\D/g,'').length>2&&t.phone.includes(query.replace(/\D/g,'')))&&(filter==='All'||filter==='Unread'&&t.unread||filter==='Open'&&!t.done||filter==='Done'&&t.done));
 const messages=thread?.messages.filter(m=>!hideAutomated||!m.automated)??[];
 useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'smooth'});},[selected,thread?.messages.length,hideAutomated]);
 useEffect(()=>{
  if(creating||!thread?.unread||busy)return;
  const key=thread.phone+':'+thread.lastIncomingId;if(readAttempt.current===key)return;readAttempt.current=key;
  void run({type:'conversation.read',phone:thread.phone,lastIncomingId:thread.lastIncomingId});
 },[thread?.phone,thread?.lastIncomingId,thread?.unread,creating,busy,run]);
 function choose(phone:string){setSelected(phone);setCreating(false);setSchedule(false);setError('');setNotice('');readAttempt.current='';}
 function newText(){setCreating(true);setSelected(null);setSchedule(false);setError('');setNotice('');}
 async function send(later=false){
  if(sendingRef.current||busy)return;sendingRef.current=true;setSending(true);setError('');setNotice('');
  try{
   const scheduledAt=later?centralDate(when):undefined;
   if(later&&new Date(scheduledAt!)<=new Date())throw Error('Choose a future date and time.');
   const ok=await run({type:'broadcast.send',channel:'sms',subject:body.trim().slice(0,70),body,personIds,groupIds,scheduledAt,audience:report.targets.map(t=>[t.personId,t.destination,t.context])});
   if(ok){setDrafts(d=>({...d,[draftKey]:''}));setSchedule(false);setNotice(`${report.targets.length} ${later?'scheduled':'queued'}${report.skipped.length?` · Not sent to: ${report.skipped.map(p=>`${p.name} (${p.reason})`).join('; ')}`:''}.`);
    if(creating&&personIds.length===1&&!groupIds.length&&report.targets.length){setSelected(report.targets[0].destination);setCreating(false);}
   }
  }catch(e){setError(e instanceof Error?e.message:'Unable to send this message.');}finally{sendingRef.current=false;setSending(false);}
 }
 const canSend=!!body.trim()&&!!connection?.sms&&(report.targets.length>0||report.skipped.length>0)&&!busy&&!sending;
 return <section className={`sms-inbox ${selected||creating?'has-conversation':''}`} aria-label="Text message conversations">
  <aside className="sms-thread-sidebar">
   <div className="sms-list-tools"><label className="sms-search"><Search size={17}/><input aria-label="Search conversations" placeholder="Search by name or phone number" value={query} onChange={e=>setQuery(e.target.value)}/></label><Button size="icon" aria-label="New text" title="New text" onClick={newText}><Plus size={20}/></Button></div>
   <div className="sms-list-filter"><select aria-label="Conversation status" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option>Unread</option><option>Open</option><option>Done</option></select><span>{matches.length} conversations</span></div>
   <div className="sms-thread-list">{matches.map(t=><button key={t.phone} className={`sms-thread-card ${selected===t.phone&&!creating?'selected':''}`} onClick={()=>choose(t.phone)} aria-pressed={selected===t.phone&&!creating}>
    <span className="avatar">{initials(t.name)}</span><span className="sms-thread-heading"><strong>{t.name}</strong><small>{stamp(t.messages.at(-1)!.at)}</small></span>{t.unread&&<span className="sms-unread" aria-label="Unread"/>}
    <span className="sms-thread-snippet">{t.messages.at(-1)!.direction==='out'?'You: ':''}{t.messages.at(-1)!.body}</span><span className={`sms-thread-status ${t.done?'done':''}`}>{t.done?'Done':'Open'}</span>
   </button>)}{!matches.length&&<div className="sms-empty-list"><MessageSquare size={24}/><strong>{threads.length?'No matching conversations':'Your text conversations'}</strong><p>{threads.length?'Try a different search or status.':'Received texts and sent messages will appear here.'}</p><Button variant="outline" onClick={newText}>New text</Button></div>}</div>
  </aside>
  <div className="sms-conversation">
   {creating||thread?<>
    <header className="sms-conversation-header"><Button className="sms-back" variant="ghost" size="icon" aria-label="Back to conversations" onClick={()=>{setSelected(null);setCreating(false);}}><ArrowLeft size={19}/></Button><span className="avatar">{creating?<Plus size={23}/>:initials(thread!.name)}</span><div><h2>{creating?'New text':thread!.name}</h2><p>{creating?'Choose a person or a group':thread!.phone}</p></div>{!creating&&<select aria-label="Set conversation status" disabled={busy} value={thread!.done?'Done':'Open'} onChange={e=>void run({type:'conversation.status',phone:thread!.phone,lastIncomingId:thread!.lastIncomingId,done:e.target.value==='Done'})}><option>Open</option><option>Done</option></select>}</header>
    {creating?<div className="sms-new-recipient"><RecipientPicker state={state} channel="sms" groups={groups} people={people} onChange={(g,p)=>{setGroups(g);setPeople(p);setNotice('');}}/>{people.length===1&&!groups.length&&threads.some(t=>t.personId===people[0])&&<button className="link-button" onClick={()=>choose(threads.find(t=>t.personId===people[0])!.phone)}>Open existing conversation</button>}</div>:<div className="sms-conversation-options"><label><input type="checkbox" checked={hideAutomated} onChange={e=>setHideAutomated(e.target.checked)}/>Hide automated messages</label><Button variant="ghost" size="sm" onClick={()=>openCare({mode:'case',personId:thread?.personId,source:thread?.lastIncomingId?{kind:'conversation',id:thread.lastIncomingId}:undefined})}>Create care follow-up</Button><span>Central time</span></div>}
    <div ref={scroll} className="sms-message-history" role="log" aria-label="Message history" aria-live="polite" aria-relevant="additions text">
     {creating?<div className="sms-start-note"><MessageSquare size={32}/><h3>Start a conversation</h3><p>Send a personal text or message a whole group. Group messages go to each person separately; replies stay private.</p></div>:messages.map(m=><article key={m.id} className={`sms-message ${m.direction==='out'?'outgoing':'incoming'}`}><div className="sms-message-body">{m.body}</div><div className="sms-message-meta"><span>{stamp(m.at)} · {m.status}</span>{m.line==='prayer'&&<span>Prayer line{m.automated?' · Automated':''}</span>}{m.line==='legacy'&&<span>Previous sending line</span>}{m.automated&&m.line!=='prayer'&&<span>Automated follow-up</span>}{m.status==='Scheduled'&&m.scheduledAt&&<span>For {stamp(m.scheduledAt)} CT</span>}{m.detail&&['Failed','Not sent','Delivery unknown'].includes(m.status)&&<span className="sms-delivery-error">{m.detail}</span>}</div></article>)}
     {!creating&&!messages.length&&<p className="sms-start-note">No messages to show with this filter.</p>}
    </div>
    <div className="sms-reply-area">
     {connection&&!connection.sms&&<p className="sms-connection-note" role="status">{connection.smsReason??'The separate communications texting number is not connected yet. You can view conversations and write your message here.'}</p>}
     {!creating&&!thread?.personId&&<p className="sms-connection-note">{thread?.shared?'This number belongs to more than one person. Open People to resolve the shared number before replying.':'Add this number in People and record text permission before replying.'}</p>}
     {report.skipped.length>0&&<div className="sms-skip-report" role="status">{report.skipped.map(p=><p key={p.personId}>{p.name}: {p.reason}</p>)}</div>}
     {error&&<p role="alert" className="sms-delivery-error">{error}</p>}{notice&&<p role="status" className="sms-send-result"><Check size={15}/>{notice}</p>}
     <Textarea aria-label="Text message" placeholder="Type your message…" maxLength={1400} rows={3} value={body} disabled={sending} onChange={e=>setDrafts(d=>({...d,[draftKey]:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&canSend){e.preventDefault();void send();}}}/>
     {schedule&&<div className="sms-schedule"><label>Send date and time · Central<Input aria-label="Schedule text Central time" type="datetime-local" value={when} min={centralInput(new Date().toISOString())} onInput={e=>setWhen(e.currentTarget.value)} onChange={e=>setWhen(e.target.value)}/></label><Button disabled={!canSend||!when} onClick={()=>void send(true)}>Schedule text</Button><Button variant="ghost" onClick={()=>setSchedule(false)}>Cancel</Button></div>}
     <div className="sms-reply-footer"><div><span>{body.length}/1,400 · Long texts may use multiple segments</span><small>{state.settings.paused?'Workflows paused — queued texts wait until resumed.':connection?.smsFrom?`From ${connection.smsFrom} · Sending hours apply.`:'Sending hours apply.'}</small>{creating&&<small>{report.targets.length} ready · {report.skipped.length} skipped</small>}</div><Button variant="outline" disabled={busy||sending||!connection?.sms} onClick={()=>setSchedule(!schedule)}><Clock size={16}/>Schedule</Button><Button disabled={!canSend} onClick={()=>void send()}><Send size={16}/>{sending?'Sending…':'Send'}</Button></div>
    </div>
   </>:<div className="sms-welcome"><span><MessageSquare size={40}/></span><h2>A place for every conversation</h2><p>Select a conversation to see its history and reply, or start a new text.</p><Button onClick={newText}><Plus size={17}/>New text</Button>{connection&&!connection.sms&&<p className="sms-connection-note">{connection.smsReason??'Your separate communications texting number is not connected yet.'}</p>}</div>}
  </div>
 </section>;
}
