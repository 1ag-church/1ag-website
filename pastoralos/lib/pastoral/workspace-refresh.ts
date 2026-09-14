import type {State} from './model.ts';
export type WorkspaceSnapshot={state:State;version:number};
type Request=(path:string,init?:RequestInit)=>Promise<Response>;

// Reads and action responses share a version gate so a delayed read cannot
// undo a newer save. Equal versions retain the existing form/component state.
export function createWorkspaceRefresh(apply:(snapshot:WorkspaceSnapshot)=>void) {
 let version=-1,readId=0;
 function accept(snapshot:WorkspaceSnapshot) {
  if(!Number.isInteger(snapshot.version)||!snapshot.state?.settings)throw Error('Unable to read the workspace. Please try again.');
  if(snapshot.version<=version)return;
  version=snapshot.version;apply(snapshot);
 }
 async function refresh(request:Request):Promise<void> {
  const id=++readId;
  try{
   const response=await request('/api/state',{cache:'no-store'});
   const data=await response.json();
   if(id!==readId)return;
   if(!response.ok)throw Error(data.error||'Unable to refresh the workspace.');
   accept(data);
  }catch(error){if(id===readId)throw error;}
 }
 return {accept,refresh};
}
