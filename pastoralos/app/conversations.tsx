'use client';
import {MessageSquare,ArrowUpRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {CommunicationsState,DeliveryConnection} from '@/lib/pastoral/communications';
const date=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at))+' CT';
export function Conversations({state,connection,reply}:{state:CommunicationsState;connection:DeliveryConnection|null;reply:(personId?:string)=>void}){
 return <section className="panel"><div className="panel-head"><h2>Conversations</h2><Button size="sm" variant="outline" onClick={()=>reply()}>New text message</Button></div>
  <div className="m-5 soft-banner"><MessageSquare size={18} className="shrink-0"/><span>{connection?.smsGeneral?`General texting: ${connection.smsFrom}. Replies to this number stay here for your review. Texts to the prayer line go to prayer review.`:'Incoming text messages and staff notes appear here. The separate general texting line is being set up.'}</span></div>
  <div className="divide-y">{state.inbox.length?state.inbox.map(i=>{const p=state.people.find(p=>p.id===i.personId);return <article key={i.id} className="p-6"><div className="flex justify-between gap-2"><h3>{p?.name||i.from||'Unknown sender'}</h3><span className="text-xs muted">{date(i.at)}</span></div><p className="text-xs muted mt-1">{i.line==='general'?'General texting':i.line==='prayer'?'Prayer line':i.source==='twilio'?'Text message':'Conversation note'}{i.to?` · To ${i.to}`:''}</p><p className="my-3 text-sm whitespace-pre-wrap">{i.body}</p>{p&&!p.archived?<Button size="sm" variant="outline" onClick={()=>reply(p.id)}>Reply by text<ArrowUpRight size={14}/></Button>:<p className="text-xs muted">Confirm this sender’s identity and add them to People with texting permission before replying.</p>}</article>;}):<p className="directory-empty">Incoming texts will appear here.</p>}</div>
 </section>;
}
