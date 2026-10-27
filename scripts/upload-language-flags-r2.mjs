import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../',import.meta.url);
const catalogue=JSON.parse(await readFile(new URL('public/language-flags/catalog.json',root),'utf8'));
const jobs=[...catalogue.map(x=>({file:x.file,type:'image/svg+xml'})),{file:'catalog.json',type:'application/json'},{file:'LICENSE-flag-icons.txt',type:'text/plain'}];
let next=0,done=0;const failed=[];
await Promise.all(Array.from({length:3},async()=>{
  while(next<jobs.length){
    const job=jobs[next++];
    const args=[fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js',root)),'r2','object','put',`zgr-cv-clients/language-flags/catalog/${job.file}`,'--file',fileURLToPath(new URL(`public/language-flags/${job.file}`,root)),'--content-type',job.type,'--remote'];
    const result=await new Promise(resolve=>{
      const child=spawn(process.execPath,args,{cwd:fileURLToPath(root),windowsHide:true,stdio:['ignore','pipe','pipe']});
      let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
      child.on('exit',code=>resolve({code,output}));child.on('error',error=>resolve({code:1,output:String(error)}));
    });
    if(result.code!==0){failed.push(job.file);console.log(`FAILED ${job.file}: ${result.output.slice(-300)}`);}
    done++;if(done%20===0||done===jobs.length)console.log(`R2 ${done}/${jobs.length}; failures ${failed.length}`);
  }
}));
if(failed.length)throw Error(`R2 upload failures: ${failed.join(', ')}`);
