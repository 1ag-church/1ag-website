export type BlockType='heading'|'text'|'image'|'button'|'columns'|'divider'|'video'|'social';
export type EmailBlock={id:string;type:BlockType;text:string;secondary:string;url:string;image:string;align:'left'|'center'|'right';color:string;background:string;size:number;padding:number;bold:boolean};
export type EmailDesign={version:1;background:string;surface:string;font:'Arial'|'Georgia';blocks:EmailBlock[]};
export const blockLabels:Record<BlockType,string>={heading:'Heading',text:'Text',image:'Image',button:'Button',columns:'Columns',divider:'Divider',video:'Video link',social:'Social links'};
export function newBlock(type:BlockType):EmailBlock{return {id:crypto.randomUUID(),type,text:({heading:'This week at 1AG',text:'Write your message here. We are glad you are part of our church family.',image:'Describe your image',button:'Learn more',columns:'First column',divider:'',video:'Watch the video',social:'Facebook'})[type],secondary:type==='columns'?'Second column':'Instagram',url:type==='button'?'https://1ag.tv':'',image:'',align:type==='text'||type==='columns'?'left':'center',color:'#183c45',background:type==='button'?'#167c80':'#ffffff',size:type==='heading'?32:16,padding:20,bold:type==='heading'||type==='button'};}
export function starterDesign(kind='newsletter'):EmailDesign {return {version:1,background:'#f0f3f2',surface:'#ffffff',font:'Arial',blocks:kind==='blank'?[]:[{...newBlock('heading'),text:kind==='invitation'?"You're invited":'This week at 1AG'},newBlock('text'),...(kind==='newsletter'?[newBlock('columns')]:[]),newBlock('button')]};}
export function escapeHtml(s:string):string{return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
export function safeEmailUrl(s:string,image=false):boolean {try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!/[\x00-\x20]/.test(s)&&(!image||!u.pathname.toLowerCase().endsWith('.svg'));}catch{return false;}}
function str(v:unknown,max:number):string{if(typeof v!=='string'||v.length>max)throw Error('Email content is too long or invalid.');return v;}
const color=(v:unknown)=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('Choose a valid email color.');return v;};
export function validateDesign(value:unknown):EmailDesign {
 if(!value||typeof value!=='object')throw Error('Choose an email design.');const d=value as EmailDesign;
 if(d.version!==1||!['Arial','Georgia'].includes(d.font)||!Array.isArray(d.blocks)||d.blocks.length>60)throw Error('An email can contain up to 60 blocks.');
 const ids=new Set<string>();const blocks=d.blocks.map(b=>{if(!b||!Object.hasOwn(blockLabels,b.type))throw Error('Unknown email block.');const id=str(b.id,100);if(!id||ids.has(id))throw Error('Email block IDs must be unique.');ids.add(id);
 if(!['left','center','right'].includes(b.align)||typeof b.bold!=='boolean'||!Number.isInteger(b.size)||b.size<12||b.size>48||!Number.isInteger(b.padding)||b.padding<0||b.padding>60)throw Error('Check email block styles.');
 const url=str(b.url,2000),image=str(b.image,2000);if(url&&!safeEmailUrl(url)||image&&!safeEmailUrl(image,true))throw Error('Use a full https:// link for images and buttons.');
 const secondary=str(b.secondary,4000);if(b.type==='social'&&secondary&&!safeEmailUrl(secondary)&&secondary!=='Instagram')throw Error('Use a full https:// link for the second social link.');
 return {id,type:b.type,text:str(b.text,6000),secondary,url,image,align:b.align,color:color(b.color),background:color(b.background),size:b.size,padding:b.padding,bold:b.bold};});
 if(blocks.reduce((n,b)=>n+b.text.length+b.secondary.length,0)>20000)throw Error('Keep email text under 20,000 characters.');
 return {version:1,background:color(d.background),surface:color(d.surface),font:d.font,blocks};
}
const lines=(s:string)=>escapeHtml(s).replaceAll('\n','<br>');
export function renderBlock(b:EmailBlock,inert=false):string {
 const style=`font-size:${b.size}px;color:${b.color};line-height:1.55;font-weight:${b.bold?'700':'400'};text-align:${b.align};`;
 const link=(label:string,url:string)=>url&&!inert?`<a href="${escapeHtml(url)}" style="color:${b.color}">${escapeHtml(label)}</a>`:escapeHtml(label);
 let content=lines(b.text);
 if(b.type==='heading')content=`<h1 style="margin:0;${style}">${content}</h1>`;
 if(b.type==='image')content=b.image?`<img src="${escapeHtml(b.image)}" alt="${escapeHtml(b.text)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;margin:auto;border:0">`:'<div style="padding:32px;color:#68777d;background:#edf2f2;text-align:center">Add an image</div>';
 if(b.type==='button')content=`<${inert||!b.url?'span':'a'} ${inert||!b.url?'':`href="${escapeHtml(b.url)}"`} style="display:inline-block;background:${b.background};color:#ffffff;padding:13px 24px;border-radius:6px;text-decoration:none;${style}color:#ffffff">${escapeHtml(b.text)}</${inert||!b.url?'span':'a'}>`;
 if(b.type==='columns')content=`<table role="presentation" width="100%"><tr><td class="email-column" width="50%" valign="top" style="padding-right:16px;${style}">${lines(b.text)}</td><td class="email-column" width="50%" valign="top" style="${style}">${lines(b.secondary)}</td></tr></table>`;
 if(b.type==='divider')content='<hr style="border:0;border-top:1px solid #dbe4e4">';
 if(b.type==='video')content=(b.image?`<img src="${escapeHtml(b.image)}" alt="" width="560" style="width:100%;height:auto"><br>`:'')+link('▶ '+b.text,b.url);
 if(b.type==='social')content=link(b.text||'Facebook',b.url)+(safeEmailUrl(b.secondary)?' &nbsp; · &nbsp; '+link('Instagram',b.secondary):'');
 return `<div style="padding:${b.padding}px;background:${b.type==='button'?'transparent':b.background};${style}">${content}</div>`;
}
export function renderEmail(value:EmailDesign,postalAddress?:string):{html:string;text:string}{const d=validateDesign(value);const text=d.blocks.map(b=>b.type==='divider'?'—':b.type==='columns'?b.text+'\n'+b.secondary:[b.text,b.url,b.type==='image'?b.image:'',b.type==='social'&&safeEmailUrl(b.secondary)?b.secondary:''].filter(Boolean).join('\n')).join('\n\n');
 const footer=postalAddress?`<div style="padding:28px;text-align:center;font:12px Arial;color:#65777c">1AG Church<br>${escapeHtml(postalAddress)}<br><a href="{{amazonSESUnsubscribeUrl}}">Unsubscribe</a></div>`:'';
 return {text,html:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:480px){.email-column{display:block!important;width:100%!important;padding:0 0 16px!important}}</style></head><body style="margin:0;padding:24px 8px;background:${d.background};font-family:${d.font},serif"><table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="600" style="width:100%;max-width:600px;background:${d.surface}"><tr><td>${d.blocks.map(b=>renderBlock(b)).join('')}${footer}</td></tr></table></td></tr></table></body></html>`};}
/** Interpret the scheduler's wall clock in church time, including daylight saving. Reject nonexistent spring-forward times. */
export function centralDate(value:string):string {if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Choose a date and time.');const parts=value.match(/\d+/g)!.map(Number),wall=Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4]);for(const offset of [5,6]){const date=new Date(wall+offset*3600000);if(centralInput(date.toISOString())===value)return date.toISOString();}throw Error('That Central time does not exist. Choose another time.');}
export function centralInput(iso:string):string{const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;}
