import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const project=path.resolve(import.meta.dirname,'..');
const version=JSON.parse(await readFile(path.join(project,'package.json'),'utf8')).version;
const label=process.platform+'-'+process.arch;
const root=path.join(project,'dist',`breakpoint-doctor-${version}-${label}`);
const win=process.platform==='win32';
const binary=path.join(root,'runtime',win?'node.exe':'node');
const entry=path.join(root,'bin','breakpoint-doctor.js');
const env={...process.env,PLAYWRIGHT_BROWSERS_PATH:path.join(root,'browsers')};
const run=(args,opts={})=>{
  const p=spawnSync(binary,[entry,...args],{encoding:'utf8',env,timeout:45000,...opts});
  if(p.error||p.status!==0) throw new Error(args.join(' ')+' failed: '+(p.error?.message||p.stderr||p.stdout));
  return p.stdout;
};
const scratch=await mkdtemp(path.join(tmpdir(),'breakpoint-portable-smoke-'));
const port=45000+Math.floor(Math.random()*3000);
const url='http://127.0.0.1:'+port+'/';
let fixture;
try {
  if(!run(['--version']).includes(version))throw new Error('Portable version mismatch');
  fixture=spawn(binary,[path.join(project,'examples','fixture-server.js')],{
    env:{...env,PORT:String(port)},stdio:'ignore'
  });
  let ready=false;
  for(let tries=0;tries<40;tries++){
    try {const response=await fetch(url,{signal:AbortSignal.timeout(500)});
      if(response.ok&&(await response.text()).includes('Breakpoint Doctor example')){ready=true;break;}
    } catch {}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  if(!ready)throw new Error('Cannot start authorized fixture server');
  run(['doctor',url],{timeout:30000});
  run(['scan',url,'--routes','/,/about','--widths','390','--no-screenshots',
    '--strict-coverage','--out',path.join(scratch,'report')],{timeout:60000});
  const report=JSON.parse(await readFile(path.join(scratch,'report','report.json'),'utf8'));
  if(report.status!=='clean'||report.coverage.completed!==2)
    throw new Error('Portable real HTTP scan was not clean and complete: '+report.status);
  console.log('PORTABLE SMOKE PASSED:',label,'browser and runtime bundled, two route scans complete');
} finally {
  fixture?.kill();
  await rm(scratch,{recursive:true,force:true});
}
