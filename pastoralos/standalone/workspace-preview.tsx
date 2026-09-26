import {applyServingInvite} from '../lib/pastoral/serving-confirmations';
import {applyCareAction} from '../lib/pastoral/pastoral-care';
import {applyServingAction,servingData,servingDate} from '../lib/pastoral/serving';
import React from 'react';
import {createRoot} from 'react-dom/client';
import PastoralApp from '../app/pastoral-app';
import {initialState,applyAction} from '../lib/pastoral/model';
import {applyCommunicationsAction,type CommunicationsState} from '../lib/pastoral/communications';
import '../app/globals.css';
if(!import.meta.env.DEV)throw Error('Local preview only');
let state:CommunicationsState=initialState(),version=1;
state.settings.paused=false;
state.directoryGroups=[{id:'weekly',name:'Weekly email'},{id:'volunteers',name:'Volunteers'}];
state.people=state.people.map((p,i)=>({...p,sample:false,assimilation:i>=3&&p.stage!=='Regular attendee',contactPermissions:{email:true,sms:true},stage:i<3?'Contact':p.stage,groups:i<4?['weekly']:['volunteers'],tags:i===0?['Volunteer']:[],groupPreferences:{weekly:{email:true,sms:false},volunteers:{email:true,sms:true}}}));
state=applyCommunicationsAction(state,{type:'broadcast.save',channel:'email',subject:'This week at 1AG',body:'Join us this Sunday for worship and fellowship.',groupIds:['weekly']},'Preview',{email:true,sms:true});
state=applyCommunicationsAction(state,{type:'broadcast.save',channel:'sms',subject:'Volunteer reminder',body:'Thank you for serving this Sunday!',groupIds:['volunteers'],scheduledAt:new Date(Date.now()+86400000).toISOString()},'Preview',{email:true,sms:true});
// Fictional local-only text threads for visual verification; never sent to a provider.
state.inbox=[];
for(const [index,p] of state.people.slice(0,4).entries()){
 p.phone='+1202555011'+index;p.name=['Jamie Rivers','Morgan Brooks','Alex Taylor','Casey Reed'][index];p.channelPermissions={sms:index!==3,email:true};
 state.inbox.push({id:'preview-incoming-'+index,personId:p.id,from:p.phone,to:'+12025550199',line:'general',source:'twilio',program:'unassigned',body:['Thank you for checking in! We will see you on Sunday.','Is there a volunteer meeting this week?','That works for us. Thank you!','Please text me the details.'][index],at:new Date(Date.now()-index*3600000).toISOString()});
 state.broadcasts!.push({id:'preview-outgoing-'+index,revision:1,subject:'Checking in',body:'Hi '+p.name.split(' ')[0]+'! Just checking in. Let us know if there is anything we can help with this week.',channel:'sms',smsLine:'general',groupIds:[],personIds:[p.id],scheduledAt:new Date(Date.now()-86400000).toISOString(),createdAt:new Date(Date.now()-86400000).toISOString(),status:'queued',targets:[{personId:p.id,destination:p.phone,context:p.context,status:'sent',providerId:'preview-'+index}]});
}
// Local-only serving assignments exercise confirmation and replacement controls.
state=applyServingAction(state,{type:'serving.service.save',title:'Sunday worship',date:servingDate(new Date(Date.now()+86400000)),time:'10:00'},'Preview');
const previewService=servingData(state).services[0];
state=applyServingAction(state,{type:'serving.area.save',serviceId:previewService.id,serviceVersion:previewService.version,name:'Welcome team',description:'Greet people at the front door.',arrivalTime:'09:30',needed:2,personIds:state.people.slice(0,2).map(p=>p.id),remindersEnabled:true,reminderMinutes:[120]},'Preview');
async function request(path:string,init?:RequestInit){if(path==='/api/health')return Response.json({lastCompletedAt:new Date().toISOString()});if(path==='/api/delivery-connection')return Response.json({sms:true,email:true,emailFrom:'info@1ag.tv',smsFrom:'+12025550199'});if(path==='/api/action'){try{const {action}=JSON.parse(String(init?.body));state=action.type==='serving.invite'?applyServingInvite(state,action,'Preview',{sms:true,email:true}):action.type.startsWith('care.')?applyCareAction(state,action,'preview@example.com'):action.type.startsWith('serving.')?applyServingAction(state,action,'Preview'):action.type.startsWith('conversation.')||action.type.startsWith('directory.')||action.type.startsWith('broadcast.')?applyCommunicationsAction(state,action,'Preview',{email:true,sms:true}):applyAction(state,action,'Preview');version++;}catch(e){return Response.json({error:String(e)},{status:400});}}return Response.json({state,version});}
createRoot(document.getElementById('root')!).render(<PastoralApp user="preview@example.com" request={request}/>);
