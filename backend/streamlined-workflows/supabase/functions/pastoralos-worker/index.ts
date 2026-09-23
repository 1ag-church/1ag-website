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
    if(!secrets.twilioAuthToken||!secrets.openaiApiKey)throw Error('Credentials unavailable.');
    const storage=new SupabaseWorkspaceStore(client);
    const result=await runPrayerWorker({load:()=>storage.load(owner),save:(version,state)=>storage.save(owner,version,state)},{
      openaiKey:secrets.openaiApiKey,notificationsEnabled:runtime.notifications_enabled,broadcastsEnabled:runtime.broadcasts_enabled,
      voice:{token:secrets.twilioAuthToken,accountSid:twilioAccount.accountSid,phone:twilioAccount.phone,baseUrl:TWILIO_INBOUND_URL.replace(/\/inbound$/,''),greetingUrl:'https://1ag.tv/pastoralos/audio/prayer-line-greeting.mp3'},
    });
    const broadcasts=await runBroadcastWorker({load:()=>storage.load(owner),save:(version,state)=>storage.save(owner,version,state)},readBroadcastConfig(name=>Deno.env.get(name),{accountSid:twilioAccount.accountSid,phone:twilioAccount.phone,token:secrets.twilioAuthToken}));
    const assimilation=await runAssimilationWorker({load:()=>storage.load(owner),save:(version,state)=>storage.save(owner,version,state)},readBroadcastConfig(name=>Deno.env.get(name),{accountSid:twilioAccount.accountSid,phone:twilioAccount.phone,token:secrets.twilioAuthToken}));
    await client.from('pastoral_worker_runtime').update({last_completed_at:new Date().toISOString(),last_phase:result.phase,last_error:null}).eq('owner_id',owner).eq('lease_id',run);
    return Response.json({...result,broadcasts,assimilation},{headers:{'Cache-Control':'no-store'}});
  } catch {
    await client.from('pastoral_worker_runtime').update({last_error:'Worker needs attention; review private tasks and provider status.'}).eq('owner_id',owner).eq('lease_id',run);
    return new Response('Worker processing failed.',{status:503});
  } finally {await client.from('pastoral_worker_runtime').update({lease_until:null,lease_id:null}).eq('owner_id',owner).eq('lease_id',run);}
});

