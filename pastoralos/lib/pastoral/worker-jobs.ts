/** Run independent jobs sequentially so shared workspace writes remain bounded.
 * Report only fixed job labels; provider errors may contain private request data.
 */
export async function runIsolatedJobs(jobs:{name:string;run:()=>Promise<unknown>}[]){
 const results:Record<string,unknown>={},issues:string[]=[];
 for(const job of jobs){try{results[job.name]=await job.run();}catch{issues.push(job.name);}}
 return {results,issues};
}
