import {renderEmail} from './email-design.ts';
import {broadcastIssue,type Broadcast,type BroadcastTarget,type CommunicationsState,type DeliveryConnection} from './communications.ts';
export type BroadcastConfig={twilio?:{accountSid:string;token:string;phone:string};ses?:{region:string;accessKeyId:string;secretAccessKey:string;sessionToken?:string;from:string;replyTo:string;contactList:string;postalAddress:string;enabled:boolean}};
export interface BroadcastStore {load():Promise<{state:CommunicationsState;version:number}>;save(version:number,state:CommunicationsState):Promise<unknown>}
export function deliveryConnection(config:BroadcastConfig):DeliveryConnection {
 const ses=config.ses,email=!!ses?.enabled&&!!ses.accessKeyId&&!!ses.secretAccessKey&&!!ses.contactList&&!!ses.postalAddress&&/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(ses.region)&&ses.from==='info@1ag.tv'&&ses.replyTo==='info@1ag.tv';
 return {sms:!!config.twilio?.token,email,emailFrom:ses?.from??'info@1ag.tv',emailReplyTo:ses?.replyTo??'info@1ag.tv',...(!email?{emailReason:'Amazon SES needs verified sender, production access, credentials, and an unsubscribe contact list.'}:{})};
}
export function readBroadcastConfig(read:(name:string)=>string|undefined,twilio?:BroadcastConfig['twilio']):BroadcastConfig {return {twilio,ses:{region:read('PASTORALOS_SES_REGION')??'us-east-1',accessKeyId:read('PASTORALOS_SES_ACCESS_KEY_ID')??'',secretAccessKey:read('PASTORALOS_SES_SECRET_ACCESS_KEY')??'',sessionToken:read('PASTORALOS_SES_SESSION_TOKEN'),from:'info@1ag.tv',replyTo:'info@1ag.tv',contactList:read('PASTORALOS_SES_CONTACT_LIST')??'',postalAddress:read('PASTORALOS_EMAIL_POSTAL_ADDRESS')??'',enabled:read('PASTORALOS_SES_ENABLED')==='true'}};}
const encoder=new TextEncoder();
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(s)));
async function hmac(key:Uint8Array,data:string):Promise<Uint8Array>{const k=await crypto.subtle.importKey('raw',key as BufferSource,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(data)));}
export class ProviderRejected extends Error {}
const sesRejectionReasons:Record<string,string>={
 AccessDenied:'AWS denied the sending permission.',AccessDeniedException:'AWS denied the sending permission.',
 SignatureDoesNotMatch:'AWS could not verify the signed request.',InvalidSignatureException:'AWS could not verify the signed request.',
 UnrecognizedClientException:'AWS did not recognize the sending credentials.',InvalidClientTokenId:'AWS did not recognize the sending credentials.',
 ExpiredToken:'The AWS session has expired.',ExpiredTokenException:'The AWS session has expired.',
 RequestExpired:'AWS rejected the request timestamp.',RequestTimeTooSkewed:'AWS rejected the request timestamp.',
 IncompleteSignature:'The AWS request signature is incomplete.',MissingAuthenticationToken:'AWS did not receive authentication.',
 MessageRejected:'SES rejected the message.',MailFromDomainNotVerifiedException:'The sending domain is not verified.',
 AccountSuspendedException:'SES has suspended sending.',SendingPausedException:'SES sending is paused.',
 TooManyRequestsException:'The SES sending limit was reached.',BadRequestException:'SES rejected the email request format.',
 NotFoundException:'An SES sending resource was not found.',LimitExceededException:'An SES account limit was reached.',
};
async function sesRejection(response:Response):Promise<string>{
 const fallback=`Amazon SES rejected the email (${response.status}).`;
 // Keep only known error codes and a request ID, never AWS's raw message or payload.
 let body:Record<string,unknown>={};const reader=response.body?.getReader();
 if(reader)try{let size=0,text='';const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>16384){text='';break;}text+=decoder.decode(part.value,{stream:true});}const parsed=JSON.parse(text+decoder.decode());if(parsed&&typeof parsed==='object')body=parsed;}catch{/* The HTTP rejection is still definitive if details cannot be read. */}finally{try{await reader.cancel();}catch{}}
 const raw=response.headers.get('x-amzn-errortype')??body.__type??body.code??body.Code;
 const code=typeof raw==='string'?raw.split('#').pop()!.split(':')[0]:'';
 if(!Object.hasOwn(sesRejectionReasons,code))return fallback;
 const requestId=response.headers.get('x-amzn-requestid');
 let permission='';const message=body.message??body.Message;
 if(['AccessDenied','AccessDeniedException'].includes(code)&&typeof message==='string'){
  const action=message.match(/\bses:[A-Za-z]{1,80}\b/)?.[0];
  const resource=message.match(/arn:aws:ses:([a-z0-9-]+):\d{12}:([a-z-]+)\/([^\s'"`]+)/);
  const cause=['explicit deny in a service control policy','no service control policy allows','explicit deny in an identity-based policy','no identity-based policy allows','explicit deny in a permissions boundary','no permissions boundary allows','explicit deny in a resource-based policy','no resource-based policy allows'].find(reason=>message.includes(reason));
  if(action)permission+=` Required action: ${action}.`;
  if(resource)permission+=` Resource: ${resource[2]} in ${resource[1]}${['1ag.tv','info@1ag.tv'].includes(resource[3])?` (${resource[3]})`:''}.`;
  if(cause)permission+=` Restriction: ${cause}.`;
 }
 return `${fallback} ${code}: ${sesRejectionReasons[code]}${permission}${requestId&&/^[a-zA-Z0-9-]{8,100}$/.test(requestId)?` AWS request ID: ${requestId}.`:''}`;
}
export async function sendSes(b:Pick<Broadcast,'subject'|'body'|'design'>,t:BroadcastTarget,config:NonNullable<BroadcastConfig['ses']>,fetcher:typeof fetch=fetch,now=new Date()):Promise<string>{
 if(!deliveryConnection({ses:config}).email)throw new ProviderRejected('Amazon SES is not configured.');
 const host=`email.${config.region}.amazonaws.com`,path='/v2/email/outbound-emails',stamp=now.toISOString().replace(/[:-]|\.\d{3}/g,''),day=stamp.slice(0,8);
 const footer=`\n\n1AG Church\n${config.postalAddress}\nUnsubscribe: {{amazonSESUnsubscribeUrl}}`;
 const body=JSON.stringify({FromEmailAddress:config.from,ReplyToAddresses:[config.replyTo],Destination:{ToAddresses:[t.destination]},Content:{Simple:{Subject:{Data:b.subject,Charset:'UTF-8'},Body:{Text:{Data:b.body+footer,Charset:'UTF-8'},...(b.design?{Html:{Data:renderEmail(b.design,config.postalAddress).html,Charset:'UTF-8'}}:{})}}},ListManagementOptions:{ContactListName:config.contactList}});
 const headers:Record<string,string>={'content-type':'application/json','host':host,'x-amz-date':stamp};if(config.sessionToken)headers['x-amz-security-token']=config.sessionToken;
 const names=Object.keys(headers).sort(),signed=names.join(';'),canonical=`POST\n${path}\n\n${names.map(n=>`${n}:${headers[n].trim()}\n`).join('')}\n${signed}\n${await sha(body)}`;
 const scope=`${day}/${config.region}/ses/aws4_request`,toSign=`AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${await sha(canonical)}`;
 const key=await hmac(await hmac(await hmac(await hmac(encoder.encode('AWS4'+config.secretAccessKey),day),config.region),'ses'),'aws4_request');
 const signature=hex((await hmac(key,toSign)).buffer as ArrayBuffer);
 headers.authorization=`AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`;
 const response=await fetcher(`https://${host}${path}`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers,body});
 if(!response.ok){if(response.status>=400&&response.status<500)throw new ProviderRejected(await sesRejection(response));await response.body?.cancel();throw Error('SES acceptance unknown.');}
 const result=await response.json();if(typeof result.MessageId!=='string'||!result.MessageId)throw Error('SES acceptance unknown.');return result.MessageId;
}
export async function sendBroadcastSms(b:Pick<Broadcast,'body'>,t:BroadcastTarget,config:NonNullable<BroadcastConfig['twilio']>,fetcher:typeof fetch=fetch):Promise<string>{
 const response=await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{Authorization:`Basic ${btoa(`${config.accountSid}:${config.token}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:config.phone,To:t.destination,Body:b.body})});
 if(!response.ok){await response.body?.cancel();if(response.status>=400&&response.status<500)throw new ProviderRejected(`Twilio rejected the text (${response.status}).`);throw Error('Twilio acceptance unknown.');}
 const result=await response.json();if(!/^SM[0-9a-f]{32}$/i.test(result.sid??'')||result.account_sid!==config.accountSid||result.to!==t.destination||result.from!==config.phone)throw Error('Twilio acceptance unknown.');return result.sid;
}
async function update(store:BroadcastStore,transform:(s:CommunicationsState)=>void){for(let n=0;n<5;n++){const current=await store.load(),s=structuredClone(current.state);transform(s);if(JSON.stringify(s)===JSON.stringify(current.state))return;try{await store.save(current.version,s);return;}catch(e){if(!(e instanceof Error)||e.message!=='CONFLICT')throw e;}}throw Error('Workspace busy.');}
const temporary=new Set(['Workflows paused','Prayer chain paused','Guest follow-up paused','Scheduled for later','Outside sending hours']);
/** Durable claim before submission; ambiguous sends are never automatically retried. */
export async function runBroadcastWorker(store:BroadcastStore,config:BroadcastConfig,fetcher:typeof fetch=fetch,now=()=>new Date()):Promise<{processed:number}>{
 const connection=deliveryConnection(config),deadline=Date.now()+20000;let processed=0;
 await update(store,s=>{for(const b of s.broadcasts??[])for(const t of b.targets){if(t.status==='sending'&&new Date(t.attemptedAt??0).getTime()<now().getTime()-180000){t.status='uncertain';t.reason='Provider result unknown. Check delivery before creating a replacement.';}if(t.status==='pending'&&b.status==='queued'){const issue=broadcastIssue(s,b,t,now());if(issue&&!temporary.has(issue)){t.status='skipped';t.reason=issue;}}}});
 for(let n=0;n<40&&Date.now()<deadline;n++){
  const current=(await store.load()).state;
  const b=current.broadcasts?.find(b=>connection[b.channel]&&b.targets.some(t=>t.status==='pending'&&!broadcastIssue(current,b,t,now())));if(!b)break;
  const target=b.targets.find(t=>t.status==='pending'&&!broadcastIssue(current,b,t,now()))!;let claimed=false;
  await update(store,s=>{claimed=false;const active=s.broadcasts?.find(x=>x.id===b.id),t=active?.targets.find(t=>t.personId===target.personId);if(active&&t?.status==='pending'&&!broadcastIssue(s,active,t,now())){t.status='sending';t.attemptedAt=now().toISOString();claimed=true;}});
  if(!claimed)continue;
  const latest=(await store.load()).state,active=latest.broadcasts?.find(x=>x.id===b.id),t=active?.targets.find(t=>t.personId===target.personId);
  if(!active||!t)continue;const issue=broadcastIssue(latest,active,t,now());if(issue){await update(store,s=>{const item=s.broadcasts?.find(x=>x.id===b.id)?.targets.find(x=>x.personId===target.personId);if(item?.status==='sending'){item.status=temporary.has(issue)?'pending':'skipped';item.reason=issue;}});continue;}
  let providerId:string|undefined,error:string|undefined,status:BroadcastTarget['status']='sent';
  try{providerId=active.channel==='sms'?await sendBroadcastSms(active,t,config.twilio!,fetcher):await sendSes(active,t,config.ses!,fetcher,now());}catch(e){status=e instanceof ProviderRejected?'failed':'uncertain';error=e instanceof ProviderRejected?e.message:'Provider acceptance is unknown. Automatic resend blocked.';}
  await update(store,s=>{const item=s.broadcasts?.find(x=>x.id===b.id)?.targets.find(x=>x.personId===target.personId);if(item?.status==='sending'){item.status=status;item.providerId=providerId;item.reason=error??'Accepted by provider';}});processed++;
 }
 return {processed};
}
