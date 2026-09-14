'use client';
import {useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {Action,State} from '@/lib/pastoral/model';
import {prayerNeedsApproval,type PrayerApprovalState} from '@/lib/pastoral/prayer-approval';
import {PrayerReviewCard} from './prayer-review-card';

export function PrayerAutomationTools({state,busy,run,onRefresh,linkedRequest}:{state:State;busy:boolean;run:(action:Action)=>Promise<boolean>;onRefresh:()=>Promise<void>;linkedRequest?:string|null}) {
 const [history,setHistory]=useState(false),[refreshing,setRefreshing]=useState(false),[limit,setLimit]=useState(20);
 const automation=(state as PrayerApprovalState).automation;
 const linked=automation?.requests.find(request=>request.id===linkedRequest);
 const prayers=[...state.prayers].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).filter(prayer=>linkedRequest?prayer.id===linked?.prayerId:history||prayerNeedsApproval(state,prayer.id));
 const processing=(automation?.requests??[]).filter(request=>!state.prayers.some(prayer=>prayer.id===request.prayerId)&&(!linkedRequest||request.id===linkedRequest));
 return <section className="space-y-5 mb-6">
  <div className="flex justify-between items-start gap-3 flex-wrap"><div><h2>Prayer requests</h2><p className="text-sm muted mt-2">Review the message. Approve it to send to your prayer chain, or decline it.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>setHistory(!history)}>{history?'Awaiting approval':'Show history'}</Button><Button size="sm" variant="outline" disabled={busy||refreshing} onClick={async()=>{setRefreshing(true);try{await onRefresh();}finally{setRefreshing(false);}}}><RefreshCw size={14} className={refreshing?'animate-spin':''}/>Refresh</Button></div></div>
  {linkedRequest&&<a className="link-button" href="#prayer">View all prayer requests</a>}
  {prayers.slice(0,limit).map(prayer=><PrayerReviewCard key={prayer.id} state={state} prayerId={prayer.id} busy={busy} run={run}/>)}
  {processing.map(request=><article className="panel p-6" key={request.id}><h3>{request.status==='error'?'Request needs attention':'Preparing your prayer request…'}</h3><p className="text-sm muted mt-2">{request.status==='error'?'The original request is saved. Retry processing to prepare it for review.':'It will appear here when the transcript and proposed message are ready.'}</p>{request.status==='error'&&<Button className="mt-3" disabled={busy} onClick={()=>run({type:'automation.retry',id:request.id})}>Retry processing</Button>}</article>)}
  {!prayers.length&&!processing.length&&<div className="panel p-6 muted">{linkedRequest?'This request could not be found.':'No prayer requests waiting here.'}</div>}
  {prayers.length>limit&&<Button variant="outline" onClick={()=>setLimit(limit+20)}>Show more</Button>}
 </section>;
}
