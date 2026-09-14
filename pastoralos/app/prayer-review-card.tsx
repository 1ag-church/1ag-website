'use client';
import {useEffect,useState} from 'react';
import {Check,PenLine,X} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import type {Action,State} from '@/lib/pastoral/model';
import {prayerDraft,prayerMessage,prayerNeedsApproval,prayerRecipients,type PrayerApprovalState} from '@/lib/pastoral/prayer-approval';

export function PrayerReviewCard({state,prayerId,busy,run}:{state:State;prayerId:string;busy:boolean;run:(action:Action)=>Promise<boolean>}) {
  const draft=prayerDraft(state,prayerId);
  const [body,setBody]=useState(draft),[editing,setEditing]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setBody(draft);setEditing(false);setError('');},[draft,prayerId]);
  const prayer=state.prayers.find(prayer=>prayer.id===prayerId);
  if(!prayer)return null;
  const automation=(state as PrayerApprovalState).automation;
  const request=automation?.requests.find(request=>request.prayerId===prayerId);
  const message=prayerMessage(state,prayerId);
  const recipients=prayerRecipients(state);
  const needsApproval=prayerNeedsApproval(state,prayerId);
  const privateRequest=prayer.sharing==='private'||request?.privateRequested;
  const preparing=!!request&&['received','drafting'].includes(request.status)&&prayer.state!=='closed';
  const summaryError=request?.status==='error'&&prayer.state!=='closed';
  const deliveryReady=!!automation?.enabled&&!!automation.broadcastsEnabled;
  const deliveries=message?state.deliveries.filter(delivery=>delivery.messageId===message.id&&delivery.revision===message.revision):[];
  const sent=deliveries.filter(delivery=>['sent','delivered'].includes(delivery.status)).length;
  const uncertain=deliveries.some(delivery=>['uncertain','failed'].includes(delivery.status));
  const status=prayer.state==='closed'?'Declined':preparing?'Preparing summary':summaryError?'Summary needs attention':needsApproval?'Awaiting your decision':uncertain?'Delivery needs attention':sent===deliveries.length&&sent>0?'Sent to prayer chain':state.settings.paused||state.settings.prayerPaused?'Approved · waiting for workflows to resume':'Approved · queued for prayer chain';
  const audience=needsApproval?recipients:message?.targets??[];
  async function decide(approve:boolean) {
    setError('');
    const saved=await run(approve?{type:'prayer.approve-send',id:prayerId,body}:{type:'prayer.close',id:prayerId});
    if(!saved)setError('Your decision could not be saved. Review any error shown and try again.');
  }
  return <article className="panel p-6 space-y-4">
    <div className="flex justify-between gap-3 flex-wrap"><div><h3>{prayer.name}</h3><p className="text-xs muted mt-1">{new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(prayer.createdAt))} CT</p></div><span className={`badge ${needsApproval?'amber':'gray'}`}>{privateRequest?'Private · pastor only':status}</span></div>
    <details className="text-sm"><summary className="cursor-pointer text-teal-700">Original request</summary><p className="callout mt-3 whitespace-pre-wrap break-words">{prayer.original}</p></details>
    <div><h4 className="font-semibold mb-2">{privateRequest?'Request':'Message to the prayer chain'}</h4>{preparing?<p className="callout">Preparing a concise summary for your approval…</p>:summaryError?<p className="callout">The summary could not be prepared. Your original request is saved.</p>:editing?<Textarea aria-label="Prayer-chain message" value={body} maxLength={6000} rows={6} onChange={event=>setBody(event.target.value)}/>:<p className="callout whitespace-pre-wrap break-words">{body||'No prayer-chain summary was prepared. Review the original request above.'}</p>}</div>
    {!privateRequest&&<details className="text-sm"><summary className="cursor-pointer text-teal-700">{audience.length} designated prayer-chain {audience.length===1?'member':'members'}</summary><ul className="mt-3 space-y-1">{audience.map(target=><li key={target.personId}>{state.people.find(person=>person.id===target.personId)?.name??'Former member'} · {target.destination}</li>)}</ul></details>}
    {needsApproval&&<>
      {privateRequest?<p className="text-sm muted">This request was marked private and will stay with you.</p>:<p className="text-xs muted">Approving shares the message above with these members. {state.settings.paused||state.settings.prayerPaused?'Sending will wait until workflows resume.':`Delivery follows your ${state.settings.start}–${state.settings.end} Central sending hours.`}</p>}
      {!privateRequest&&!deliveryReady&&<p className="text-sm text-amber-800">Prayer-chain delivery is not enabled yet.</p>}
      {!privateRequest&&!recipients.length&&<p className="text-sm text-amber-800">Add prayer-chain members under Members before approving.</p>}
      <div className="flex gap-2 flex-wrap">
        {!privateRequest&&<Button disabled={busy||preparing||summaryError||!body.trim()||!recipients.length||!deliveryReady||prayer.sample} onClick={()=>decide(true)}><Check size={16}/>Approve &amp; send</Button>}
        <Button variant="outline" disabled={busy} onClick={()=>decide(false)}><X size={16}/>{privateRequest?'Close private request':'Decline'}</Button>
        {!privateRequest&&!preparing&&!summaryError&&<Button variant="ghost" disabled={busy} onClick={()=>setEditing(!editing)}><PenLine size={15}/>{editing?'Done editing':'Edit wording'}</Button>}
        {summaryError&&request&&<Button variant="outline" disabled={busy} onClick={()=>run({type:'automation.retry',id:request.id})}>Retry summary</Button>}
      </div>
    </>}
    {!needsApproval&&sent>0&&<p className="text-xs muted">The texting provider accepted {sent} of {deliveries.length} recipient messages.</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </article>;
}
