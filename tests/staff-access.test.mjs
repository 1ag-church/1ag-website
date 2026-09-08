import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyWebsiteAdmin } from '../src/staffAccess.js';
function client(user,staff,error=null){return {auth:{getUser:async()=>({data:{user},error})},from(name){assert.equal(name,'pastoral_staff_access');return {select(){return this;},eq(field,id){assert.equal(field,'user_id');assert.equal(id,user.id);return this;},maybeSingle:async()=>({data:staff,error:null})};}};}
test('missing configuration, invalid session, or ordinary account never grants administration',async()=>{
  assert.equal(await verifyWebsiteAdmin(null),false);
  assert.equal(await verifyWebsiteAdmin(client(null,null)),false);
  assert.equal(await verifyWebsiteAdmin(client({id:'one',user_metadata:{website_admin:true}},null)),false);
});
test('administrator must be explicitly active; string booleans do not grant access',async()=>{
  for(const staff of [{active:false,website_admin:true},{active:true,website_admin:false},{active:'true',website_admin:'true'}])assert.equal(await verifyWebsiteAdmin(client({id:'one'},staff)),false);
  assert.equal(await verifyWebsiteAdmin(client({id:'one'},{active:true,website_admin:true})),true);
});
