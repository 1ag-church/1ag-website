import { z } from 'zod';
import { type State, uid } from './model.ts';
const text=z.string().max(10000), id=z.string().min(1).max(200), num=z.number().int().nonnegative(), bool=z.boolean();
const date=z.string().datetime({offset:true});
const channel=z.enum(['sms','email']), program=z.enum(['guest','prayer']);
const recurrence=z.object({frequency:z.enum(['daily','weekly','monthly']),interval:z.number().int().min(1).max(100),duration:z.number().int().min(1).max(3650),durationUnit:z.enum(['days','weeks','months'])});
const target=z.object({personId:id,destination:text,context:num});
const rule=z.object({id,title:text,stage:text,days:num,recurrence:recurrence.optional(),channel,template:text,enabled:bool,version:num});
const schema=z.object({
 people:z.array(z.object({channelPermissions:z.object({sms:bool,email:bool}).optional(),assimilation:bool.optional(),groups:z.array(id).optional(),tags:z.array(text).optional(),contactPermissions:z.object({sms:bool,email:bool}).optional(),groupPreferences:z.record(z.object({sms:bool,email:bool})).optional(),id,name:text,email:text,phone:text,address:text,household:text,stage:text,paused:bool,archived:bool,prayerMember:bool,guestSms:bool,guestEmail:bool,prayerSms:bool,firstVisit:date,stageEnteredAt:date.optional(),source:text,note:text,context:num,sample:bool,completedAt:date.optional()})),
 prayers:z.array(z.object({id,name:text,original:text,sharing:z.enum(['private','unknown','shareable']),state:z.enum(['review','drafted','closed']),createdAt:date,sample:bool})),
 messages:z.array(z.object({id,program,personId:id.optional(),prayerId:id.optional(),eventId:id.optional(),eventVersion:num.optional(),ruleId:id.optional(),occurrence:z.object({anchor:date,dueAt:date}).optional(),subject:text,body:text,channel,status:z.enum(['pending','approved','held','cancelled']),revision:num,createdAt:date,scheduledAt:date,targets:z.array(target),reason:text})),
 deliveries:z.array(z.object({id,messageId:id,revision:num,target,providerId:text.optional(),attemptedAt:date.optional(),status:z.enum(['sending','queued','suppressed','cancelled','simulated','sent','delivered','failed','uncertain']),reason:text,at:date})),
 rules:z.array(rule),ruleHistory:z.array(rule),
 events:z.array(z.object({id,title:text,kind:z.enum(['starting','pizza']),date,location:text,description:text,cancelled:bool,version:num,registered:z.array(id),attended:z.array(id),sample:bool})),
 tasks:z.array(z.object({id,personId:id.optional(),title:text,detail:text,done:bool,private:bool})),
 audit:z.array(z.object({id,at:date,actor:text,action:text})),
 settings:z.object({paused:bool,guestPaused:bool,prayerPaused:bool,start:z.string().regex(/^\d{2}:\d{2}$/),end:z.string().regex(/^\d{2}:\d{2}$/),timezone:z.literal('America/Chicago'),weeklyLimit:z.number().int().min(1).max(7),churchName:text,tone:text,facts:text}),
 inbox:z.array(z.object({id,personId:z.string(),body:text,at:date,program:z.enum(['guest','prayer','unassigned']),from:text.optional(),source:z.literal('twilio').optional()})),
 smsSuppressions:z.array(z.object({phone:text,at:date,messageSid:id})).optional(),
 visits:z.array(z.object({personId:id,at:date,source:text})).optional(),
});
export function importWorkspace(current:State,payload:unknown,actor:string,now=new Date()):State {
 if(current.people.length||current.prayers.length||current.messages.length||current.inbox.length||current.deliveries.length||current.events.length||current.tasks.length||current.ruleHistory.length||current.visits?.length||current.smsSuppressions?.length)throw Error('Import is available only in an empty workspace. Your existing records were not changed.');
 const wrapped=z.object({format:z.literal('pastoralos-workspace-v1'),state:schema}).safeParse(payload);
 if(!wrapped.success)throw Error('This is not a valid PastoralOS workspace backup.');
 const state:State=wrapped.data.state;
 for(const name of ['people','prayers','messages','deliveries','rules','events','tasks','inbox'] as const){const ids=state[name].map(x=>x.id);if(new Set(ids).size!==ids.length)throw Error('The backup contains duplicate record identifiers.');}
 state.settings.paused=true;
 for(const m of state.messages){delete m.approval;if(m.status==='approved'){m.status='pending';m.revision++;m.reason='Imported from the previous portal; review again before sending.';}}
 for(const d of state.deliveries)if(d.status==='sending'){d.status='uncertain';d.reason='Imported during a provider submission; verify delivery before replacing.';}
 for(const d of state.deliveries)if(d.status==='queued'){d.status='cancelled';d.reason='Import cancelled the previous delivery queue.';}
 state.audit.unshift({id:uid(),at:now.toISOString(),actor,action:'Workspace imported. Sending paused and previous approvals revoked.'});
 return state;
}

