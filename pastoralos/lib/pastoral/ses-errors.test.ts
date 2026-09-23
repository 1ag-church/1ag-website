import test from 'node:test';
import assert from 'node:assert/strict';
import {ProviderRejected,sendSes} from './broadcast-worker.ts';
const config={region:'us-east-2',accessKeyId:'fake-key',secretAccessKey:'fake-secret',from:'info@1ag.tv',replyTo:'info@1ag.tv',contactList:'test',postalAddress:'Test address',enabled:true};
async function rejected(response:Response){try{await sendSes({subject:'Test',body:'Test'},{personId:'test',context:1,destination:'test@example.com',status:'pending'},config,async()=>response);assert.fail('Expected rejection');}catch(error){assert.ok(error instanceof ProviderRejected);return error.message;}}
test('SES preserves known error code and request ID without returning AWS raw details',async()=>{
 const reason=await rejected(Response.json({__type:'com.amazonaws#SignatureDoesNotMatch',message:'private@example.com fake-secret'},{status:403,headers:{'x-amzn-requestid':'12345678-abcd-1234-abcd-123456789012'}}));
 assert.match(reason,/SignatureDoesNotMatch/);assert.match(reason,/12345678-abcd-1234-abcd-123456789012/);assert.doesNotMatch(reason,/private@example|fake-secret/);
});
test('SES header errors work even when response body is not JSON',async()=>{
 const reason=await rejected(new Response('private diagnostic detail',{status:403,headers:{'x-amzn-errortype':'AccessDeniedException:http'}}));
 assert.match(reason,/AccessDeniedException/);assert.doesNotMatch(reason,/private diagnostic/);
});
test('permission diagnostics retain the action and restriction without private resource or principal values',async()=>{
 const reason=await rejected(Response.json({__type:'AccessDeniedException',message:"User arn:aws:iam::123456789012:user/private-person cannot perform ses:SendRawEmail on resource arn:aws:ses:us-east-2:123456789012:identity/private@example.com because no identity-based policy allows it"},{status:403}));
 assert.match(reason,/Required action: ses:SendRawEmail/);assert.match(reason,/Resource: identity in us-east-2/);assert.match(reason,/no identity-based policy allows/);assert.doesNotMatch(reason,/123456789012|private-person|private@example/);
});
test('unknown codes, unsafe request IDs, and oversized bodies are not exposed',async()=>{
 assert.equal(await rejected(Response.json({code:'private@example.com'},{status:403})),'Amazon SES rejected the email (403).');
 assert.equal(await rejected(Response.json({code:'constructor'},{status:403})),'Amazon SES rejected the email (403).');
 assert.doesNotMatch(await rejected(Response.json({code:'AccessDenied'},{status:403,headers:{'x-amzn-requestid':'private@example.com'}})),/private@example/);
 assert.equal(await rejected(new Response('x'.repeat(17000),{status:403})),'Amazon SES rejected the email (403).');
});
test('broken diagnostic body remains a definite rejection and does not suggest a retry',async()=>{
 const response=new Response(new ReadableStream({start(controller){controller.error(new Error('broken stream'));}}),{status:403});
 assert.equal(await rejected(response),'Amazon SES rejected the email (403).');
});
test('SES server errors remain uncertain',async()=>{
 await assert.rejects(sendSes({subject:'Test',body:'Test'},{personId:'test',context:1,destination:'test@example.com',status:'pending'},config,async()=>Response.json({code:'AccessDeniedException'},{status:503})),error=>error instanceof Error&&!(error instanceof ProviderRejected)&&error.message==='SES acceptance unknown.');
});
