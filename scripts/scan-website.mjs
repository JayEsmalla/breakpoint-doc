import { createInterface } from 'node:readline/promises';
import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root=import.meta.dirname;
const rl=createInterface({input:process.stdin,output:process.stdout});
try {
  console.log('Breakpoint Doctor — portable alpha scanner');
  console.log('Scan only websites you own or are authorized to test. Start your dev server first.');
  const raw=(await rl.question('Website URL (e.g. http://localhost:5173): ')).trim();
  let url;
  try {
    url=new URL(raw);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error();
  } catch {console.error('Enter a valid http(s) URL without credentials.');process.exitCode=2;exit();}
  const out=path.join(root,'breakpoint-report');
  const started=Date.now();
  const child=spawn(process.execPath,[
    path.join(root,'bin','breakpoint-doctor.js'),'scan',url.href,
    '--no-screenshots','--strict-coverage','--out',out
  ],{
    stdio:'inherit',shell:false,
    env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:path.join(root,'browsers')}
  });
  const code=await new Promise((resolve,reject)=>{
    child.on('error',reject);
    child.on('exit',code=>resolve(code??2));
  });
  const report=path.join(out,'index.html');
  if ([0,1,3].includes(code) && existsSync(report) && statSync(report).mtimeMs>=started-1000){
    console.log('Opening report: '+report);
    try {spawn('explorer.exe',[report],{detached:true,stdio:'ignore'}).unref();}
    catch {console.log('Open breakpoint-report/index.html manually.');}
  }
  if (code>1) console.log('Review errors and scan coverage before interpreting the report.');
  process.exitCode=code;
} catch(error) {console.error(error.message);process.exitCode=2;} finally {rl.close();}
function exit(){throw new Error('Invalid URL');}
