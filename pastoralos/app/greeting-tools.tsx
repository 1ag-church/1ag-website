'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import type {State} from '@/lib/pastoral/model';
type Greeting={url:string;name:string;updatedAt:string;duration:number};
const original='https://1ag.tv/pastoralos/audio/prayer-line-greeting.mp3';
/** Normalize browser-decodable audio to a format the phone line can reliably play. */
async function prepareGreeting(file:File):Promise<{blob:Blob;duration:number}>{
 if(!file.size||file.size>20*1024*1024)throw Error('Choose an audio file smaller than 20 MB.');
 const context=new AudioContext();
 try{
  const decoded=await context.decodeAudioData(await file.arrayBuffer());
  if(!Number.isFinite(decoded.duration)||decoded.duration<=0||decoded.duration>120)throw Error('Choose a greeting up to two minutes long.');
  const offline=new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);
  const source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
  const rendered=await offline.startRendering(),samples=rendered.getChannelData(0);
  const bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes);
  const tag=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)v.setUint8(offset+i,value.charCodeAt(i));};
  tag(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const sample=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,sample<0?sample*32768:sample*32767,true);}
  return {blob:new Blob([bytes],{type:'audio/wav'}),duration:samples.length/16000};
 }finally{await context.close();}
}
export function GreetingTools({state,version,request,refresh}:{state:State;version:number;request:(path:string,init?:RequestInit)=>Promise<Response>;refresh:()=>Promise<void>}){
 const active=(state.settings as State['settings']&{voiceGreeting?:Greeting}).voiceGreeting;
 const [candidate,setCandidate]=useState<{name:string;blob:Blob;url:string;duration:number}|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const fileInput=useRef<HTMLInputElement>(null),selection=useRef(0);
 useEffect(()=>()=>{if(candidate)URL.revokeObjectURL(candidate.url);},[candidate]);
 async function choose(file?:File){
  const seq=++selection.current;setCandidate(null);setConfirmed(false);setError('');setSuccess('');if(!file)return;
  setBusy(true);try{const prepared=await prepareGreeting(file);if(seq===selection.current)setCandidate({...prepared,name:file.name,url:URL.createObjectURL(prepared.blob)});}
  catch(e){setError(e instanceof Error&&/Choose/.test(e.message)?e.message:'This recording could not be opened. Try an MP3 or WAV file.');}finally{if(seq===selection.current)setBusy(false);}
 }
 async function save(reset=false){
  if(!reset&&(!candidate||!confirmed))return;
  setBusy(true);setError('');setSuccess('');
  try{
   const headers:Record<string,string>={'X-Workspace-Version':String(version)};
   if(!reset){headers['Content-Type']='audio/wav';headers['X-Greeting-Name']=encodeURIComponent(candidate!.name);headers['X-Greeting-Disclosure']='confirmed';}
   const response=await request(reset?'/api/greeting/reset':'/api/greeting',{method:'POST',headers,body:reset?undefined:candidate!.blob});
   const data=await response.json();if(!response.ok){if(response.status===409)await refresh();throw Error(data.error??'Unable to save the greeting.');}
   setCandidate(null);setConfirmed(false);if(fileInput.current)fileInput.current.value='';await refresh();setSuccess(reset?'Original greeting restored.':'Greeting activated. New callers will hear this recording.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save the greeting.');}finally{setBusy(false);}
 }
 return <section className="panel p-6 mb-6 max-w-4xl"><h2>Prayer chain audio greeting</h2><p className="text-sm muted mt-3">Upload the message callers hear before leaving a prayer request. The beep plays automatically after your greeting.</p>
 <div className="mt-5"><h3 className="text-sm">Current greeting · {active?.name??'Original recording'}</h3><audio key={active?.url??original} controls preload="metadata" src={active?.url??original} className="mt-3 w-full" aria-label="Current prayer-line greeting"/>{active&&<Button variant="outline" size="sm" className="mt-3" disabled={busy} onClick={()=>save(true)}>Use original greeting</Button>}</div>
 <label className="field mt-6"><span>Upload a replacement greeting</span><Input ref={fileInput} type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" disabled={busy} onChange={e=>void choose(e.target.files?.[0])}/><span className="field-note">MP3, WAV, or M4A · up to 2 minutes · maximum source file 20 MB.</span></label>
 {candidate&&<div className="callout mt-4"><h3>Preview · {candidate.name} · {Math.ceil(candidate.duration)} seconds</h3><audio controls src={candidate.url} className="mt-3 w-full" aria-label="New greeting preview"/><label className="check-row mt-4"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/><span>My greeting tells callers their message will be recorded and transcribed, and may be shared with the prayer chain.</span></label><p className="text-sm muted mt-2">Ask callers to say if their request is private. You still approve every broadcast.</p><Button className="mt-4" disabled={busy||!confirmed} onClick={()=>save()}>{busy?'Saving…':'Activate this greeting'}</Button></div>}
 {busy&&!candidate&&<p role="status" className="text-sm mt-3">Preparing the greeting…</p>}{error&&<p role="alert" className="text-red-700 mt-3">{error}</p>}{success&&<p role="status" className="text-teal-700 mt-3">{success}</p>}
 </section>;
}
