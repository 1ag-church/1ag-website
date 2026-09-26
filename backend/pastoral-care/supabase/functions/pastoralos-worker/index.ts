import {runIsolatedJobs} from '../../../lib/pastoral/worker-jobs.ts';
import {runCareReminderWorker} from '../../../lib/pastoral/care-reminders.ts';
import {queueServingReminders} from '../../../lib/pastoral/serving-reminders.ts';
import {runAssimilationWorker} from '../../../lib/pastoral/assimilation-worker.ts';
import {readBroadcastConfig,runBroadcastWorker} from '../../../lib/pastoral/broadcast-worker.ts';
import { runtimeSecrets } from '../../../lib/pastoral/runtime-secrets.ts';
import { supabaseClient, SupabaseWorkspaceStore } from '../../../lib/pastoral/supabase.ts';
import { runPrayerWorker } from '../../../lib/pastoral/prayer-worker.ts';
import { twilioAccount, TWILIO_INBOUND_URL } from '../../../lib/pastoral/twilio-connection.ts';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(req:Request)=>Promise<Response>):void};
Deno.serve(async request=>{
  if(request.method!=='POST')return new Response('POST required.',{status:405});
  const token=request.headers.get('X-PastoralOS-Worker')||'';
  if(!/^[0-9a-f]{64}$/.test(token))return new Response('Unauthorized.',{status:401});
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
  const client=supabaseClient({PASTORALOS_SUPABASE_URL:Deno.env.get('SUPABASE_URL'),PASTORALOS_SUPABASE_SECRET_KEY:keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')});
  const owner='1ag-church',run=crypto.randomUUID();
  const {data:runtime,error}=await client.from('pastoral_worker_runtime').select('notifications_enabled,broadcasts_enabled').eq('owner_id',owner).eq('worker_token_hash',hash).maybeSingle();
  if(error||!runtime)return new Response('Unauthorized.',{status:401});
  const claim=await client.rpc('pastoral_claim_worker',{p_owner:owner,p_hash:hash,p_run:run});
  if(claim.error)return new Response('Worker unavailable.',{status:503});
  if(!claim.data)return Response.json({phase:'busy'});
  try {
    const secrets=runtimeSecrets(name=>Deno.env.get(name));
    const storage=new SupabaseWorkspaceStore(client);
    const store={load:()=>storage.load(owner),save:(version:number,state:Awaited<ReturnType<typeof storage.load>>['state'])=>storage.save(owner,version,state)};
    const config=readBroadcastConfig(name=>Deno.env.get(name),secrets.twilioAuthToken?{accountSid:twilioAccount.accountSid,phone:twilioAccount.phone,token:secrets.twilioAuthToken}:undefined);
    const {results,issues}=await runIsolatedJobs([
      {name:'Care reminders',run:()=>runCareReminderWorker(store,config)},
      {name:'Serving reminders',run:()=>queueServingReminders(store)},
      {name:'Communications',run:()=>runBroadcastWorker(store,config)},
      {name:'Guest follow-up',run:()=>runAssimilationWorker(store,config)},
      {name:'Prayer processing',run:async()=>{
        if(!secrets.twilioAuthToken||!secrets.openaiApiKey)throw Error('Credentials unavailable.');
        return runPrayerWorker(store,{
          openaiKey:secrets.openaiApiKey,notificationsEnabled:runtime.notifications_enabled,broadcastsEnabled:runtime.broadcasts_enabled,
          voice:{token:secrets.twilioAuthToken,accountSid:twilioAccount.accountSid,phone:twilioAccount.phone,baseUrl:TWILIO_INBOUND_URL.replace(/\/inbound$/,''),greetingUrl:'https://1ag.tv/pastoralos/audio/prayer-line-greeting.mp3'},
        });
      }},
    ]);
    const phase=issues.length?'attention':'complete';
    const health=await client.from('pastoral_worker_runtime').update({last_completed_at:new Date().toISOString(),last_phase:phase,last_error:issues.length?'Needs attention: '+issues.join(', '):null}).eq('owner_id',owner).eq('lease_id',run);
    if(health.error)throw Error('Unable to save scheduler status.');
    return Response.json({phase,results,issues},{headers:{'Cache-Control':'no-store'}});
  } catch {
    await client.from('pastoral_worker_runtime').update({last_error:'Worker needs attention; review private tasks and provider status.'}).eq('owner_id',owner).eq('lease_id',run);
    return new Response('Worker processing failed.',{status:503});
  } finally {await client.from('pastoral_worker_runtime').update({lease_until:null,lease_id:null}).eq('owner_id',owner).eq('lease_id',run);}
});

