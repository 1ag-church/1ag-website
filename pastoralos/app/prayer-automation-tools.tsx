'use client';
import {useState} from 'react';
import {Clock, LockKeyhole, MessageSquare, Mic, RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {Action, State} from '@/lib/pastoral/model';

// Client view only. Keep provider credentials and server routing modules out of this bundle.
type ActivityRequest = {
  id:string; prayerId:string; messageId?:string; source:'sms'|'voice'; from:string; original:string; transcript:string;
  status:'received'|'drafting'|'review'|'approved'|'rejected'|'error'|'expired';
  privateRequested:boolean; draft:string; code:string; createdAt:string; expiresAt?:string;
  error?:string; audioDeleted:boolean; awaitingEdit?:boolean; summary?:string;
};
type ActivityMessage = {
  id:string; requestId:string; kind:'approval'|'command'|'broadcast'; to:string; body:string;
  status:'pending'|'sending'|'sent'|'cancelled'|'error'|'uncertain'; createdAt:string;
  sentAt?:string; error?:string; nextAttemptAt?:string;
};
type AutomationView = {requests:ActivityRequest[]; outbox:ActivityMessage[]; enabled:boolean; broadcastsEnabled:boolean};
const time = (value?:string) => value && Number.isFinite(Date.parse(value))
  ? new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)) + ' CT' : 'Not recorded';
const labels:Record<string,string> = {received:'Received',drafting:'Preparing draft',review:'Awaiting your review',approved:'Approved',rejected:'Rejected',error:'Needs attention',expired:'Review expired',pending:'Queued',sending:'Sending',sent:'Sent to provider',cancelled:'Cancelled',uncertain:'Delivery needs checking'};

export function PrayerAutomationTools({state,busy,run,onRefresh,linkedRequest,onReview}:{state:State;busy:boolean;run:(action:Action)=>Promise<boolean>;onRefresh:()=>Promise<void>;linkedRequest?:string|null;onReview:(messageId:string|undefined,prayerId:string)=>void}) {
  const automation = (state as State & {automation?:AutomationView}).automation;
  const [limit,setLimit] = useState(20), [refreshing,setRefreshing] = useState(false);
  const requests = [...(automation?.requests ?? [])].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const visibleRequests=linkedRequest?requests.filter(r=>r.id===linkedRequest):requests.slice(0,limit);
  const outbox = [...(automation?.outbox ?? [])].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return <section className="panel mb-6">
    <div className="panel-head flex-wrap">
      <div><h2>Prayer line activity</h2><p className="text-sm muted mt-2">Call recordings, incoming texts, proposed wording, and approval messages.</p></div>
      <Button size="sm" variant="outline" disabled={busy||refreshing} onClick={async()=>{setRefreshing(true);try{await onRefresh();}finally{setRefreshing(false);}}}><RefreshCw size={14} className={refreshing?'animate-spin':''}/>Refresh activity</Button>
    </div>
    <div className="px-6 pb-5 flex gap-2 flex-wrap">
      <span className={`badge ${automation?.enabled?'teal':'gray'}`}>{automation?.enabled?'Processing enabled':'Processing not enabled'}</span>
      <span className="badge gray">{automation?.broadcastsEnabled?'Broadcasts require approval':'Broadcast delivery off'}</span>
      <span className="badge gray">{requests.length} {requests.length===1?'request':'requests'}</span>
    </div>
    {linkedRequest&&<div className="px-6 pb-5"><a className="link-button" href="#prayer">View all prayer requests</a>{!visibleRequests.length&&<p role="status" className="mt-3">This request could not be found. Refresh activity or view all requests.</p>}</div>}
    {!requests.length?<div className="px-6 pb-6 text-sm muted">No prayer-line requests recorded yet. New requests will appear here as they are received.</div>:<div className="divide-y">
      {visibleRequests.map(item=>{
        const expired = item.status==='expired'||(item.status==='review'&&!!item.expiresAt&&Date.parse(item.expiresAt)<=Date.now());
        const displayStatus = expired?'expired':item.status;
        const canRetry = item.status==='error'&&(item.source==='sms'||!item.audioDeleted);
        return <article key={item.id} className="p-6">
          <div className="flex justify-between items-start gap-3 flex-wrap">
            <div><h3 className="flex items-center gap-2">{item.source==='voice'?<Mic size={17}/>:<MessageSquare size={17}/>} {item.source==='voice'?'Voicemail':'Text request'} <span className="font-normal text-sm muted">{item.from}</span></h3><p className="text-xs muted mt-2">{time(item.createdAt)}</p></div>
            <div className="flex gap-2 flex-wrap"><span className={`badge ${displayStatus==='error'||expired?'amber':displayStatus==='approved'?'teal':'gray'}`}>{labels[displayStatus]??displayStatus}</span>{item.privateRequested&&<span className="badge rose"><LockKeyhole size={12}/>Pastor only</span>}</div>
          </div>
          <details className="mt-4 text-sm" open={!!linkedRequest||displayStatus==='review'||displayStatus==='error'}>
            <summary className="cursor-pointer text-teal-700">Read request and proposed wording</summary>
            <div className="grid lg:grid-cols-2 gap-4 mt-4">
              <div><h4 className="font-semibold mb-2">{item.source==='voice'?'Transcript':'Original text'}</h4><p className="callout whitespace-pre-wrap break-words">{item.transcript||item.original||'Transcription is not available yet.'}</p></div>
              <div><h4 className="font-semibold mb-2">Proposed prayer request</h4><p className="callout whitespace-pre-wrap break-words">{item.draft||(item.privateRequested?'Private request for your personal review.':'A proposed message is not available yet.')}</p></div>
            </div>
            {item.summary&&<p className="muted mt-3 whitespace-pre-wrap break-words">{item.summary}</p>}
          </details>
          <div className="mt-4 flex gap-3 flex-wrap text-xs muted">
            {item.code&&<span>Review code: <strong>{item.code}</strong></span>}
            {item.expiresAt&&<span className="flex items-center gap-1"><Clock size={12}/>Expires {time(item.expiresAt)}</span>}
            {item.source==='voice'&&<span>{item.audioDeleted?'Recording deleted':'Recording retained'}</span>}
            {item.awaitingEdit&&<span>Waiting for your edited wording</span>}
          </div>
          {item.error&&<p role="status" className="text-sm text-amber-800 mt-3 whitespace-pre-wrap break-words">{item.error}</p>}
          {item.prayerId&&<div className="mt-4"><Button size="sm" disabled={busy} onClick={()=>onReview(item.messageId,item.prayerId)}>{item.messageId?'Review & approve':'Review request'}</Button>{!item.messageId&&item.draft&&<p className="text-sm muted mt-2">Broadcast approval becomes available after sharing permission and prayer-chain recipients are recorded.</p>}</div>}
          {(canRetry||item.status==='review'||item.status==='expired')&&<div className="flex gap-2 mt-4 flex-wrap">
            {canRetry&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>run({type:'automation.retry',id:item.id})}><RefreshCw size={14}/>Retry processing</Button>}
            {(item.status==='review'||item.status==='expired')&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>run({type:'automation.review',id:item.id})}>Refresh review</Button>}
          </div>}
        </article>;
      })}
      {!linkedRequest&&requests.length>limit&&<div className="p-5"><Button variant="outline" size="sm" onClick={()=>setLimit(limit+20)}>Show more requests</Button></div>}
    </div>}
    <details className="border-t p-6 text-sm">
      <summary className="cursor-pointer font-semibold">Message queue and history · {outbox.length}</summary>
      <p className="muted mt-3">“Sent to provider” means Twilio accepted the message. It does not confirm delivery to the phone.</p>
      {!outbox.length?<p className="muted mt-3">No messages queued yet.</p>:<div className="mt-4 divide-y">{outbox.slice(0,limit).map(item=><div key={item.id} className="py-4">
        <div className="flex justify-between gap-3 flex-wrap"><h4 className="font-semibold">{item.kind==='approval'?'Approval request':item.kind==='broadcast'?'Prayer broadcast':'Approval reply'} <span className="font-normal muted">to {item.to}</span></h4><span className={`badge ${item.status==='error'||item.status==='uncertain'?'amber':'gray'}`}>{labels[item.status]??item.status}</span></div>
        <p className="text-xs muted mt-2">{time(item.sentAt||item.createdAt)}{item.nextAttemptAt?` · Next attempt ${time(item.nextAttemptAt)}`:''}</p>
        {item.error&&<p className="text-amber-800 mt-2 whitespace-pre-wrap break-words">{item.error}</p>}
        <details className="mt-3"><summary className="cursor-pointer text-teal-700">Read exact message</summary><p className="callout mt-3 whitespace-pre-wrap break-words">{item.body}</p></details>
      </div>)}</div>}
      {outbox.length>limit&&<Button className="mt-3" size="sm" variant="outline" onClick={()=>setLimit(limit+20)}>Show more messages</Button>}
    </details>
  </section>;
}
