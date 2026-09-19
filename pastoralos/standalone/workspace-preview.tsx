import React from 'react';
import {createRoot} from 'react-dom/client';
import PastoralApp from '../app/pastoral-app';
import {initialState,applyAction} from '../lib/pastoral/model';
import {applyCommunicationsAction,type CommunicationsState} from '../lib/pastoral/communications';
import '../app/globals.css';
if(!import.meta.env.DEV)throw Error('Local preview only');
let state:CommunicationsState=initialState(),version=1;
state.directoryGroups=[{id:'weekly',name:'Weekly email'},{id:'volunteers',name:'Volunteers'}];
state.people=state.people.map((p,i)=>({...p,stage:i<3?'Regular attendee':p.stage,groups:i<4?['weekly']:['volunteers'],tags:i===0?['Volunteer']:[],groupPreferences:{weekly:{email:true,sms:false},volunteers:{email:false,sms:true}}}));
state=applyCommunicationsAction(state,{type:'broadcast.save',channel:'email',subject:'This week at 1AG',body:'Join us this Sunday for worship and fellowship.',groupIds:['weekly']},'Preview',{email:false,sms:true});
state=applyCommunicationsAction(state,{type:'broadcast.save',channel:'sms',subject:'Volunteer reminder',body:'Thank you for serving this Sunday!',groupIds:['volunteers'],scheduledAt:new Date(Date.now()+86400000).toISOString()},'Preview',{email:false,sms:true});
async function request(path:string,init?:RequestInit){if(path==='/api/delivery-connection')return Response.json({sms:true,email:false});if(path==='/api/action'){try{const {action}=JSON.parse(String(init?.body));state=action.type.startsWith('directory.')||action.type.startsWith('broadcast.')?applyCommunicationsAction(state,action,'Preview',{email:false,sms:true}):applyAction(state,action,'Preview');version++;}catch(e){return Response.json({error:String(e)},{status:400});}}return Response.json({state,version});}
createRoot(document.getElementById('root')!).render(<PastoralApp user="preview@example.com" request={request}/>);
