import { ORIGINAL_GREETING, activeGreeting, callbackGreeting, SHARING_DISCLOSURE } from '../../../lib/pastoral/greeting.ts';
import { handleTwilioWebhook } from '../../../lib/pastoral/twilio-webhook.ts';
import { supabaseClient, SupabaseWorkspaceStore } from '../../../lib/pastoral/supabase.ts';
import { twilioAccount, TWILIO_INBOUND_URL, TWILIO_STATUS_URL } from '../../../lib/pastoral/twilio-connection.ts';
import { runtimeSecrets } from '../../../lib/pastoral/runtime-secrets.ts';
import { handlePrayerVoice } from '../../../lib/pastoral/prayer-voice.ts';
import { ingestPrayerRecording } from '../../../lib/pastoral/prayer-flow.ts';
declare const Deno: { env: {get(name:string):string|undefined}; serve(handler:(req:Request)=>Promise<Response>|Response):void };
Deno.serve(async (request: Request) => {
  try {
    const match=new URL(request.url).pathname.match(/^\/(?:functions\/v1\/)?pastoralos-twilio\/(inbound|status|voice|recorded|recording)$/);
    if(!match)return new Response('Not found.',{status:404});
    const kind=match[1] as 'inbound'|'status'|'voice'|'recorded'|'recording';
    const token=runtimeSecrets(name => Deno.env.get(name)).twilioAuthToken;
    if(!token)return new Response('SMS intake is not connected.',{status:503});
    const keys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
    const config={
      PASTORALOS_SUPABASE_URL:Deno.env.get('SUPABASE_URL'),
      PASTORALOS_SUPABASE_SECRET_KEY:keys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      PASTORALOS_STORAGE:'supabase',PASTORALOS_WORKSPACE_OWNER:'1ag-church',
      PASTORALOS_TWILIO_WEBHOOKS_ENABLED:'true',TWILIO_AUTH_TOKEN:token,
      TWILIO_ACCOUNT_SID:twilioAccount.accountSid,TWILIO_PHONE_NUMBER:twilioAccount.phone,
      PASTORALOS_GENERAL_SMS_NUMBER:Deno.env.get('PASTORALOS_GENERAL_SMS_NUMBER'),
      TWILIO_INBOUND_WEBHOOK_URL:TWILIO_INBOUND_URL,TWILIO_STATUS_WEBHOOK_URL:TWILIO_STATUS_URL,
    };
    // Supabase may strip /functions/v1 internally; signatures bind to the public URL.
    const baseUrl=TWILIO_INBOUND_URL.replace(/\/inbound$/,'');
    const canonical=baseUrl+'/'+kind;
    const normalized=new URL(canonical);normalized.search=new URL(request.url).search;
    const store=new SupabaseWorkspaceStore(supabaseClient(config));
    if(kind==='voice'||kind==='recorded'||kind==='recording') {
      const greetingUrl=kind==='voice'?(activeGreeting((await store.load('1ag-church')).state)?.url??ORIGINAL_GREETING):callbackGreeting(normalized.search);
      return await handlePrayerVoice(new Request(normalized,request),kind,{token,accountSid:twilioAccount.accountSid,phone:twilioAccount.phone,baseUrl,greetingUrl},async event=>{
        for(let attempt=0;attempt<4;attempt++) {
          const current=await store.load('1ag-church');
          const s=ingestPrayerRecording(current.state,{...event,greetingUrl,sharingEvidence:SHARING_DISCLOSURE});
          if(!event.duration){const r=s.automation!.requests.find(r=>r.id===event.recordingSid)!;r.status='error';r.error='Twilio did not produce a usable recording.';if(!s.tasks.some(t=>t.id===`recording-${event.recordingSid}`))s.tasks.unshift({id:`recording-${event.recordingSid}`,title:'Prayer voicemail needs attention',detail:r.error,private:true,done:false});}
          try {await store.save('1ag-church',current.version,s);return;} catch(e){if(!(e instanceof Error)||e.message!=='CONFLICT')throw e;}
        }
        throw Error('Workspace busy.');
      });
    }
    return await handleTwilioWebhook(new Request(normalized,request),config,store,kind);
  } catch { return new Response('SMS intake is temporarily unavailable.',{status:503}); }
});

