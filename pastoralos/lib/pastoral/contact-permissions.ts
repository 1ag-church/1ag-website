export type ChannelPermissions = {sms:boolean;email:boolean};
type Contact = {
 channelPermissions?:ChannelPermissions;
 contactPermissions?:ChannelPermissions;
 groupPreferences?:Record<string,ChannelPermissions>;
 guestSms?:boolean; guestEmail?:boolean; prayerSms?:boolean;
};
/** Carry forward existing opt-ins once. Explicit global choices always win, including false. */
export function channelPermissions(person:Contact):ChannelPermissions {
 if(person.channelPermissions)return {...person.channelPermissions};
 const old=Object.values(person.groupPreferences??{});
 return {sms:person.contactPermissions?.sms===true||person.guestSms===true||person.prayerSms===true||old.some(p=>p.sms===true),
 email:person.contactPermissions?.email===true||person.guestEmail===true||old.some(p=>p.email===true)};
}
export function setChannelPermissions(person:Contact,value:unknown) {
 const p=value as ChannelPermissions;
 if(!p||typeof p.sms!=='boolean'||typeof p.email!=='boolean')throw Error('Choose text and email permissions.');
 person.channelPermissions={sms:p.sms,email:p.email};
 // Mirror old fields during the rolling deployment; readers use the global choices.
 person.contactPermissions={...person.channelPermissions};
 person.guestSms=p.sms;person.prayerSms=p.sms;person.guestEmail=p.email;
}
