import {applyAction,dispatchCheck,type State,type Message,type Delivery} from './model.ts';
import {deliveryConnection,sendBroadcastSms,sendSes,ProviderRejected,type BroadcastConfig,type BroadcastStore} from './broadcast-worker.ts';
import type {CommunicationsState} from './communications.ts';
const temporary=new Set(['Sending paused','Not due','Outside sending hours','Weekly contact limit reached']);
async function update(store:BroadcastStore,change:(s:CommunicationsState)=>CommunicationsState|void){
 for(let n=0;n<5;n++){const current=await store.load(),copy=structuredClone(current.state),next=change(copy)??copy;if(JSON.stringify(next)===JSON.stringify(current.state))return;try{await store.save(current.version,next);return;}catch(e){if(!(e instanceof Error)||e.message!=='CONFLICT')throw e;}}
 throw Error('Workspace busy.');
}
function check(s:State,d:Delivery,m:Message|undefined,now:Date){
 if(!m||m.program!=='guest')return 'Message unavailable';
 if(!m.approval?.sendRequested)return 'Fresh approval required before live delivery';
 if(d.revision!==m.revision)return 'Message changed since approval';
 return dispatchCheck(s,m,d.target,now,true);
}
/** Prepare due steps even while the browser is closed; deliver only newly, explicitly approved messages. */
export async function runAssimilationWorker(store:BroadcastStore,config:BroadcastConfig,fetcher:typeof fetch=fetch,now=()=>new Date()){
 const connection=deliveryConnection(config),deadline=Date.now()+15000;let processed=0;
 await update(store,s=>{
  const prepared=applyAction(s,{type:'prepare'},'Assimilation scheduler',now()) as CommunicationsState;
  // Do not add an audit row every minute when no work is due.
  if(prepared.messages.length!==s.messages.length)s=prepared;
  for(const d of s.deliveries){const m=s.messages.find(m=>m.id===d.messageId);if(m?.program!=='guest')continue;
   if(d.status==='sending'&&new Date(d.attemptedAt??0).getTime()<now().getTime()-180000){d.status='uncertain';d.reason='Provider result unknown. Check delivery before replacing this message.';}
   if(d.status==='queued'){const reason=check(s,d,m,now());if(reason&&!temporary.has(reason)){d.status='suppressed';d.reason=reason;}}
  }return s;
 });
 for(let n=0;n<20&&Date.now()<deadline;n++){
  const current=(await store.load()).state;
  const d=current.deliveries.find(d=>{const m=current.messages.find(m=>m.id===d.messageId);return d.status==='queued'&&m?.program==='guest'&&connection[m.channel]&&!check(current,d,m,now());});if(!d)break;
  let claimed=false;
  await update(store,s=>{claimed=false;const item=s.deliveries.find(x=>x.id===d.id),m=s.messages.find(m=>m.id===d.messageId);if(item?.status==='queued'&&m&&connection[m.channel]&&!check(s,item,m,now())){item.status='sending';item.attemptedAt=now().toISOString();claimed=true;}});
  if(!claimed)continue;
  const latest=(await store.load()).state,item=latest.deliveries.find(x=>x.id===d.id),m=latest.messages.find(m=>m.id===d.messageId);
  if(!item||item.status!=='sending'||!m)continue;const issue=check(latest,item,m,now());
  if(issue){await update(store,s=>{const d=s.deliveries.find(x=>x.id===item.id);if(d?.status==='sending'){d.status=temporary.has(issue)?'queued':'suppressed';d.reason=issue;}});continue;}
  let status:Delivery['status']='sent',reason='Accepted by provider',providerId:string|undefined;
  const target={...item.target,status:'pending' as const};
  try{providerId=m.channel==='sms'?await sendBroadcastSms(m,target,config.twilio!,fetcher):await sendSes(m,target,config.ses!,fetcher,now());}
  catch(e){status=e instanceof ProviderRejected?'failed':'uncertain';reason=e instanceof ProviderRejected?e.message:'Provider acceptance unknown. Automatic resend blocked.';}
  await update(store,s=>{const d=s.deliveries.find(x=>x.id===item.id);if(d?.status==='sending'){d.status=status;d.reason=reason;d.providerId=providerId;d.at=now().toISOString();}});processed++;
 }
 return {processed};
}
