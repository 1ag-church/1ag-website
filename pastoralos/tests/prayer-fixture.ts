import {initialState} from '../lib/pastoral/model.ts';
import type {PrayerApprovalState} from '../lib/pastoral/prayer-approval.ts';
export function fixture(): PrayerApprovalState {
  const state:PrayerApprovalState=initialState();
  const member={...state.people[0],id:'member',name:'Test Member',phone:'+12025550101',sample:false,prayerMember:true,prayerSms:true};
  state.people=[member,{...member,id:'unselected',phone:'+12025550102',prayerMember:false}];
  state.prayers=[{id:'prayer',name:'Test Requester',original:'Please include my request in the prayer chain.',sharing:'unknown',state:'review',createdAt:new Date().toISOString(),sample:false}];
  state.messages=[];state.deliveries=[];state.tasks=[];state.audit=[];state.inbox=[];
  state.settings={...state.settings,start:'00:00',end:'23:59',paused:false,prayerPaused:false,adminPhone:'+12025550190'};
  state.automation={enabled:true,broadcastsEnabled:true,requests:[{id:'request',prayerId:'prayer',draft:'1AG Prayer Chain: Please pray for our church family.',privateRequested:false,status:'review'}],outbox:[]};
  return state;
}
