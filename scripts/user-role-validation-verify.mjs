import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const results=[];
const record=(name,expected,actual,pass)=>results.push({name,expected,actual,pass:Boolean(pass)});
async function req(base,method,route,{token,body}={}) {
  const response=await fetch(`${base}${route}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  let json={};try{json=await response.json();}catch{}return{status:response.status,json};
}
async function main(){
  const serverPath=path.resolve('dist/server.cjs');
  if(!fs.existsSync(serverPath))throw new Error('dist/server.cjs not found');
  const stateFile=path.resolve('server/data/gabah_state.json');
  const backup=fs.existsSync(stateFile)?fs.readFileSync(stateFile,'utf8'):null;
  if(backup!==null)fs.rmSync(stateFile);
  const port=41000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
  const adminPassword=crypto.randomBytes(16).toString('base64url');
  const child=spawn(process.execPath,[serverPath],{env:{...process.env,PORT:String(port),NODE_ENV:'development',GABAH_INITIAL_ADMIN_PASSWORD:adminPassword,GABAH_INITIAL_USER_PASSWORD:crypto.randomBytes(16).toString('base64url'),GABAH_TEST_PASSWORD:''},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',x=>logs+=x.toString());child.stderr.on('data',x=>logs+=x.toString());
  const cleanup=()=>{try{child.kill('SIGKILL');}catch{}if(backup!==null)fs.writeFileSync(stateFile,backup);else if(fs.existsSync(stateFile))fs.rmSync(stateFile);};
  process.on('exit',cleanup);process.on('SIGINT',()=>{cleanup();process.exit(130);});
  try{
    let healthy=false;for(let i=0;i<60;i++){try{if((await fetch(`${base}/api/health`)).ok){healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,300));}
    if(!healthy)throw new Error('Server did not become healthy: '+logs.slice(-1200));
    const login=await req(base,'POST','/api/auth/login',{body:{email:'admin@foodstation.co.id',password:adminPassword}});
    const token=login.json?.data?.token||login.json?.token;
    record('Admin login','token',token?'token issued':`HTTP ${login.status}`,Boolean(token));if(!token)throw new Error('Admin login failed');
    const stamp=Date.now().toString().slice(-7);
    const invalidEmail=`qa-invalid-role-${stamp}@example.test`;
    const invalidCreate=await req(base,'POST','/api/users',{token,body:{name:'Invalid Role Fixture',email:invalidEmail,role:'Super User'}});
    const afterInvalid=(await req(base,'GET','/api/users',{token})).json?.data||[];
    record('Unknown role rejected before user creation','400 + no user',`HTTP ${invalidCreate.status}, user exists ${afterInvalid.some(u=>u.email===invalidEmail)}`,invalidCreate.status===400&&!afterInvalid.some(u=>u.email===invalidEmail));
    const validEmail=`qa-valid-role-${stamp}@example.test`;
    const validCreate=await req(base,'POST','/api/users',{token,body:{name:'Valid Role Fixture',email:validEmail,role:'Karyawan',division:'IT',department:'QA'}});
    const userId=validCreate.json?.data?.id;
    const invalidUpdate=userId?await req(base,'PATCH',`/api/users/${encodeURIComponent(userId)}`,{token,body:{role:'Super User'}}):{status:0};
    const afterUpdate=(await req(base,'GET','/api/users',{token})).json?.data||[];
    const userAfter=afterUpdate.find(u=>u.id===userId);
    record('Unknown role rejected before changing existing account','400 + role unchanged',`create ${validCreate.status}, patch ${invalidUpdate.status}, role ${userAfter?.role}`,validCreate.status===201&&invalidUpdate.status===400&&userAfter?.role==='Karyawan');
    const failed=results.filter(x=>!x.pass);
    console.log('=== USER ROLE VALIDATION ===');
    for(const x of results)console.log(`${x.pass?'PASS':'FAIL'} | ${x.name} | expected: ${x.expected} | actual: ${x.actual}`);
    console.log(`TOTAL: ${results.length} | PASS: ${results.length-failed.length} | FAIL: ${failed.length}`);
    process.exit(failed.length?1:0);
  }catch(e){console.error('Verification error:',e.message);console.error('Server log tail:',logs.slice(-1200));process.exit(1);}
}
main();
