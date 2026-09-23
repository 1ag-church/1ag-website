import {readEmailImage} from './email-image.ts';
import {applyCommunicationsAction,type DeliveryConnection} from './communications.ts';
import { approvePrayerRequest } from './prayer-approval.ts';
import { GREETING_ROOT, readGreetingAudio, validateGreetingAudio, type VoiceGreeting } from './greeting.ts';
import { importPeopleCsv } from './people-csv.ts';
import { importWorkspace } from './workspace-import.ts';
import { applyAction, type State } from './model.ts';
import { supabaseClient, SupabaseWorkspaceStore, type ServerConfig } from './supabase.ts';
import { getAutomation, refreshPrayerReview, adminPhone, rerouteAdminReviews, type AutomationState } from './prayer-flow.ts';

type Staff = { email: string; workspaceOwner: string };
export interface StaffApiDependencies {
  deliveryConnection?():DeliveryConnection;
  uploadEmailImage?(bytes:Uint8Array,type:string,extension:string):Promise<string>;
  uploadGreeting?(bytes:Uint8Array):Promise<string>;
  removeGreeting?(url:string):Promise<void>;
  connection?(connect: boolean): Promise<unknown>;
  authenticate(token: string): Promise<Staff | null>;
  load(owner: string): Promise<{ state: State; version: number }>;
  save(owner: string, version: number, state: State): Promise<{ state: State; version: number }>;
}
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: {
  'Cache-Control': 'no-store', 'Vary': 'Authorization', 'X-Content-Type-Options': 'nosniff',
} });

export function staffApiDependencies(config: ServerConfig): StaffApiDependencies {
  const client = supabaseClient(config), store = new SupabaseWorkspaceStore(client);
  return {
    async uploadEmailImage(bytes,type,extension){
      const path=crypto.randomUUID()+'.'+extension;
      const bucket=client.storage.from('pastoral-email-images');
      const {error}=await bucket.upload(path,bytes,{contentType:type,cacheControl:'31536000',upsert:false});
      if(error)throw Error('Unable to upload the image. Please try again.');
      return bucket.getPublicUrl(path).data.publicUrl;
    },
    async uploadGreeting(bytes) {
      const path=crypto.randomUUID()+'.wav';
      const {error}=await client.storage.from('pastoral-greetings').upload(path,bytes,{contentType:'audio/wav',cacheControl:'31536000',upsert:false});
      if(error)throw Error('Unable to upload the greeting. Please try again.');
      return GREETING_ROOT+path;
    },
    async removeGreeting(url) {if(url.startsWith(GREETING_ROOT))await client.storage.from('pastoral-greetings').remove([url.slice(GREETING_ROOT.length)]);},
    async authenticate(token) {
      // Validate at the Auth server. Never trust decoded JWTs, local sessions,
      // user_metadata, or Sites identity headers on the public Netlify backend.
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user?.email) return null;
      const { data: access, error: accessError } = await client.from('pastoral_staff_access')
        .select('workspace_owner,pastoral_role,active').eq('user_id', data.user.id).maybeSingle();
      if (accessError) throw Error('Access lookup unavailable.');
      if (!access?.active || access.pastoral_role !== 'owner' || !access.workspace_owner) return null;
      return { email: data.user.email, workspaceOwner: access.workspace_owner };
    },
    load: owner => store.load(owner),
    save: (owner, version, state) => store.save(owner, version, state),
  };
}

export async function handleStaffApi(request: Request, deps: StaffApiDependencies) {
  const path = new URL(request.url).pathname.replace(/^\/pastoralos/, '');
  if (!['/api/email-image','/api/delivery-connection','/api/session','/api/state','/api/action','/api/import','/api/people-import','/api/twilio','/api/twilio/connect','/api/greeting','/api/greeting/reset'].includes(path)) return json({ error: 'Not found.' }, 404);
  if (request.method !== (['/api/email-image','/api/action','/api/import','/api/people-import','/api/twilio/connect','/api/greeting','/api/greeting/reset'].includes(path) ? 'POST' : 'GET')) return json({ error: 'Method not allowed.' }, 405);
  const origin = request.headers.get('Origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ error: 'Untrusted request.' }, 403);
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.length > 16384) return json({ error: 'Sign in required.' }, 401);
  try {
    const staff = await deps.authenticate(authorization.slice(7));
    if (!staff) return json({ error: 'This account does not have PastoralOS access.' }, 403);
    if(path === '/api/delivery-connection')return json(deps.deliveryConnection?.()??{sms:false,email:false});
    if (path === '/api/session') return json({ email: staff.email });
    if (path.startsWith('/api/twilio')) {
      if (!deps.connection) return json({error:'Twilio setup is unavailable.'},503);
      try { return json(await deps.connection(path.endsWith('/connect'))); }
      catch { return json({error:'Unable to verify or connect Twilio. Check the Auth Token and number routing.'},503); }
    }
    if(path==='/api/email-image'){
      if(!deps.uploadEmailImage)return json({error:'Image uploads are unavailable.'},503);
      try{const image=await readEmailImage(request);return json({url:await deps.uploadEmailImage(image.bytes,image.type,image.extension)});}
      catch(e){return json({error:e instanceof Error?e.message:'Unable to upload image.'},400);}
    }
    const current = await deps.load(staff.workspaceOwner);
    if (path === '/api/state') return json({...current,state:{...current.state,settings:{...current.state.settings,adminPhone:adminPhone(current.state)}}});
    if(path==='/api/greeting'||path==='/api/greeting/reset'){
      const expected=Number(request.headers.get('X-Workspace-Version'));
      if(!request.headers.has('X-Workspace-Version')||!Number.isInteger(expected)||expected!==current.version)return json({error:'The workspace changed. Refresh and try activating the greeting again.'},409);
      const next=structuredClone(current.state) as State & {settings:State['settings'] & {voiceGreeting?:VoiceGreeting}};
      if(path==='/api/greeting/reset'){
        delete next.settings.voiceGreeting;
        next.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),actor:staff.email,action:'Original prayer-line greeting restored'});
        return json(await deps.save(staff.workspaceOwner,current.version,next));
      }
      if(request.headers.get('X-Greeting-Disclosure')!=='confirmed')return json({error:'Confirm that the greeting explains recording, transcription, and prayer-chain sharing.'},400);
      let bytes:Uint8Array,name:string;
      try{bytes=await readGreetingAudio(request);name=decodeURIComponent(request.headers.get('X-Greeting-Name')??'Prayer greeting').replace(/[\x00-\x1f\x7f]/g,'').slice(0,120)||'Prayer greeting';}
      catch(e){return json({error:e instanceof Error?e.message:'Invalid audio greeting.'},400);}
      if(!deps.uploadGreeting)return json({error:'Greeting uploads are unavailable.'},503);
      const url=await deps.uploadGreeting(bytes);
      next.settings.voiceGreeting={url,name,updatedAt:new Date().toISOString(),duration:validateGreetingAudio(bytes),disclosureConfirmed:true};
      next.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),actor:staff.email,action:'Prayer-line greeting replaced; applies to new calls'});
      try{return json(await deps.save(staff.workspaceOwner,current.version,next));}
      catch(e){if(e instanceof Error&&e.message==='CONFLICT')await deps.removeGreeting?.(url);throw e;}
    }
    if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'JSON required.' }, 415);
    const limit = ['/api/import','/api/people-import'].includes(path) ? 2000000 : 150000;
    const reader = request.body?.getReader();
    const chunks: Uint8Array[]=[];let size=0;
    if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return json({error:'This request is too large.'},413);}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const raw = new TextDecoder().decode(bytes);
    if (raw.length > limit) return json({ error: 'This request is too large.' }, 413);
    let data;
    try { data = JSON.parse(raw); } catch { return json({ error: 'Invalid request.' }, 400); }
    if (path === '/api/people-import') {
      if(data?.version!==current.version)return json({error:'The workspace changed. Refresh and review the import again.'},409);
      let state:State;try {state=importPeopleCsv(current.state,data.csv,data.options,staff.email);}catch(e){return json({error:e instanceof Error?e.message:'Invalid CSV.'},400);}
      return json(await deps.save(staff.workspaceOwner,current.version,state));
    }
    if (path === '/api/import') {
      if(data?.version!==current.version)return json({error:'The workspace changed. Refresh before importing.'},409);
      let state: State;
      try {state=importWorkspace(current.state,data.backup,staff.email);}
      catch(e){return json({error:e instanceof Error?e.message:'Invalid backup.'},400);}
      return json(await deps.save(staff.workspaceOwner,current.version,state));
    }
    if (!Number.isInteger(data?.version) || !data?.action || typeof data.action.type !== 'string') return json({ error: 'Invalid action.' }, 400);
    if (data.version !== current.version) return json({ error: 'This workspace changed. Refresh before saving.' }, 409);
    let state: State;
    try {
      if(data.action.type.startsWith('conversation.')||data.action.type.startsWith('directory.')||data.action.type.startsWith('broadcast.')){
        state=applyCommunicationsAction(current.state,data.action,staff.email,deps.deliveryConnection?.()??{sms:false,email:false});
      }else if(data.action.type==='prayer.approve-send') {
        state=approvePrayerRequest(current.state,data.action,staff.email);
      } else if(data.action.type==='automation.retry'||data.action.type==='automation.review') {
        const next=structuredClone(current.state) as AutomationState;
        const r=getAutomation(next).requests.find(r=>r.id===data.action.id);
        if(!r)throw Error('Prayer request unavailable.');
        if(data.action.type==='automation.retry') {
          if(r.status!=='error')throw Error('This request is not waiting for a retry.');
          r.status='received';r.attempts=0;delete r.nextAttemptAt;delete r.error;
          state=next;
        } else {
          if(r.status!=='review'||r.awaitingEdit)throw Error('Finish the edit before requesting a new review.');
          r.fingerprint='';state=refreshPrayerReview(next,r.id);
        }
        state.audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),actor:staff.email,action:data.action.type==='automation.retry'?'Prayer processing retry requested':'Fresh prayer review requested'});
      } else state = applyAction(current.state, data.action, staff.email);
      // Dismissals immediately invalidate review codes and cancel queued notifications.
      if(data.action.type==='prayer.close'||data.action.type==='message.cancel'){
        const next=state as AutomationState;
        for(const r of getAutomation(next).requests){
          const matches=data.action.type==='prayer.close'?r.prayerId===data.action.id:r.messageId===data.action.id;
          if(!matches)continue;
          r.status='rejected';r.awaitingEdit=false;r.fingerprint='';
          for(const o of getAutomation(next).outbox)if(o.requestId===r.id&&o.status==='pending')o.status='cancelled';
        }
      }
      if(adminPhone(state)!==adminPhone(current.state)){
        state=rerouteAdminReviews(state);
      }
    }
    catch (e) { return json({ error: e instanceof Error ? e.message : 'Invalid action.' }, 400); }
    // No caller-supplied owner, role, actor, or replacement state is accepted.
    return json(await deps.save(staff.workspaceOwner, current.version, state));
  } catch (e) {
    if (e instanceof Error && e.message === 'CONFLICT') return json({ error: 'This workspace changed. Refresh before saving.' }, 409);
    return json({ error: 'PastoralOS is temporarily unavailable. Please retry.' }, 503);
  }
}



