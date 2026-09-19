export async function readEmailImage(request:Request):Promise<{bytes:Uint8Array;type:string;extension:string}>{
 const type=request.headers.get('content-type')?.split(';')[0]??'';
 if(!['image/jpeg','image/png'].includes(type))throw Error('Choose a JPG or PNG image.');
 const reader=request.body?.getReader();if(!reader)throw Error('Choose an image.');let size=0;const chunks:Uint8Array[]=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>3*1024*1024){await reader.cancel();throw Error('Choose an image under 3 MB.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const png=[137,80,78,71,13,10,26,10];if(size<24||!(type==='image/png'?png.every((n,i)=>bytes[i]===n):bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw Error('This file is not a valid JPG or PNG.');
 return {bytes,type,extension:type==='image/png'?'png':'jpg'};
}
