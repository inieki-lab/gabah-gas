import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const results=[];
const record=(name,expected,actual,pass)=>results.push({name,expected,actual,pass:Boolean(pass)});
async function req(base,method,route,{token,body}={}) {
  const r=await fetch(`${base}${route}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  let json={};try{json=await r.json();}catch{}return{status:r.status,json};
}
async function main(){
  const serverPath=path.resolve('dist/server.cjs');
  if(!fs.existsSync(serverPath))throw new Error('dist/server.cjs not found');
  const stateFile=path.resolve('server/data/gabah_state.json');
  const backup=fs.existsSync(stateFile)?fs.readFileSync(stateFile,'utf8'):null;
  if(backup!==null)fs.rmSync(stateFile);
  const port=39000+Math.floor(Math.random()*2000),base=`http://127.0.0.1:${port}`;
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
    const userEmail=`qa-boolean-${stamp}@example.test`;
    const userCreate=await req(base,'POST','/api/users',{token,body:{name:'QA Boolean User',email:userEmail,role:'Karyawan',division:'IT',department:'QA'}});
    const userId=userCreate.json?.data?.id;
    const userBad=userId?await req(base,'PATCH',`/api/users/${encodeURIComponent(userId)}`,{token,body:{is_active:'false'}}):{status:0};
    const userList=(await req(base,'GET','/api/users',{token})).json?.data||[];
    const userAfterBad=userList.find(x=>x.id===userId);
    record('User update rejects string is_active without deactivation','400 + active true',`create ${userCreate.status}, patch ${userBad.status}, active ${userAfterBad?.is_active}`,userCreate.status===201&&userBad.status===400&&userAfterBad?.is_active===true);
    const userValid=userId?await req(base,'PATCH',`/api/users/${encodeURIComponent(userId)}`,{token,body:{is_active:false}}):{status:0};
    record('User update accepts real boolean is_active','200 + inactive',`HTTP ${userValid.status} + ${userValid.json?.data?.is_active}`,userValid.status===200&&userValid.json?.data?.is_active===false);
    const job=await req(base,'POST','/api/master/job-levels',{token,body:{code:`QA${stamp}`,label:'QA Boolean Fixture'}});
    const jobId=job.json?.data?.code;
    const jobBad=jobId?await req(base,'PATCH',`/api/master/job-levels/${jobId}`,{token,body:{is_active:'false'}}):{status:0};
    const jobs=(await req(base,'GET','/api/master/job-levels',{token})).json?.data||[];
    const jobAfter=jobs.find(x=>x.code===jobId);
    record('Job level rejects string boolean without mutation','400 + active true',`create ${job.status}, patch ${jobBad.status}, active ${jobAfter?.is_active}`,job.status===201&&jobBad.status===400&&jobAfter?.is_active===true);
    const jobValid=jobId?await req(base,'PATCH',`/api/master/job-levels/${jobId}`,{token,body:{is_active:false}}):{status:0};
    record('Job level accepts real boolean','200 + inactive',`HTTP ${jobValid.status} + ${jobValid.json?.data?.is_active}`,jobValid.status===200&&jobValid.json?.data?.is_active===false);

    const unit=await req(base,'POST','/api/master/org-units',{token,body:{name:`QA Boolean Unit ${stamp}`,division_code:'IT'}});
    const unitId=unit.json?.data?.id;
    const unitBad=unitId?await req(base,'PATCH',`/api/master/org-units/${unitId}`,{token,body:{is_active:'false'}}):{status:0};
    const units=(await req(base,'GET','/api/master/org-units',{token})).json?.data||[];
    const unitAfter=units.find(x=>x.id===unitId);
    record('Org unit rejects string boolean without mutation','400 + active true',`create ${unit.status}, patch ${unitBad.status}, active ${unitAfter?.is_active}`,unit.status===201&&unitBad.status===400&&unitAfter?.is_active===true);

    const office=await req(base,'POST','/api/master/office-locations',{token,body:{name:`QA Boolean Office ${stamp}`}});
    const officeId=office.json?.data?.id;
    const officeBad=officeId?await req(base,'PATCH',`/api/master/office-locations/${officeId}`,{token,body:{is_active:'false'}}):{status:0};
    const offices=(await req(base,'GET','/api/master/office-locations',{token})).json?.data||[];
    const officeAfter=offices.find(x=>x.id===officeId);
    record('Office location rejects string boolean without mutation','400 + active true',`create ${office.status}, patch ${officeBad.status}, active ${officeAfter?.is_active}`,office.status===201&&officeBad.status===400&&officeAfter?.is_active===true);

    const assetLoc=await req(base,'POST','/api/master/asset-locations',{token,body:{name:`QA Boolean Asset Location ${stamp}`}});
    const assetLocId=assetLoc.json?.data?.id;
    const assetLocBad=assetLocId?await req(base,'PATCH',`/api/master/asset-locations/${assetLocId}`,{token,body:{is_active:'false'}}):{status:0};
    const assetLocs=(await req(base,'GET','/api/master/asset-locations',{token})).json?.data||[];
    const assetLocAfter=assetLocs.find(x=>x.id===assetLocId);
    record('Asset location rejects string boolean without mutation','400 + active true',`create ${assetLoc.status}, patch ${assetLocBad.status}, active ${assetLocAfter?.is_active}`,assetLoc.status===201&&assetLocBad.status===400&&assetLocAfter?.is_active===true);

    const catCode=`QA-${stamp}`;
    const catBadCreate=await req(base,'POST','/api/taxonomy/categories',{token,body:{code:catCode,name:`QA Category ${stamp}`,main_type:'KDR',owner_division:'GA',category_type:'General',is_active:'false'}});
    const catBadLoanable=await req(base,'POST','/api/taxonomy/categories',{token,body:{code:`QA-L-${stamp}`,name:`QA Loanable Category ${stamp}`,main_type:'KDR',owner_division:'GA',category_type:'General',is_loanable_by_default:'false'}});
    record('Category creation rejects string is_active and loanability flags','400 + 400',`HTTP ${catBadCreate.status} + ${catBadLoanable.status}`,catBadCreate.status===400&&catBadLoanable.status===400);
    const existing=(await req(base,'GET','/api/taxonomy/categories',{token})).json?.data||[];
    const cat=existing[0];
    const catBadPatch=cat?await req(base,'PATCH',`/api/taxonomy/categories/${encodeURIComponent(cat.code)}`,{token,body:{is_active:'false'}}):{status:0};
    const catBadLoanPatch=cat?await req(base,'PATCH',`/api/taxonomy/categories/${encodeURIComponent(cat.code)}`,{token,body:{is_loanable_by_default:'false'}}):{status:0};
    record('Category update rejects string boolean flags','400 + 400',`HTTP ${catBadPatch.status} + ${catBadLoanPatch.status}`,catBadPatch.status===400&&catBadLoanPatch.status===400);

    const bulkAsset=await req(base,'POST','/api/assets/bulk-import',{token,body:{assets:[{name:`QA Invalid Loanability ${stamp}`,serial_number:`QA-BOOL-${stamp}`,is_loanable:'maybe'}]}});
    const bulkData=bulkAsset.json?.data;
    record('Asset bulk import rejects unknown loanability text','1 failed, 0 created',`HTTP ${bulkAsset.status}, created ${bulkData?.created}, failed ${bulkData?.failed}`,bulkAsset.status===200&&bulkData?.created===0&&bulkData?.failed===1&&String(bulkData?.errors?.[0]||'').includes('is_loanable'));
    const failed=results.filter(x=>!x.pass);
    console.log('=== MASTER BOOLEAN VALIDATION ===');
    for(const x of results)console.log(`${x.pass?'PASS':'FAIL'} | ${x.name} | expected: ${x.expected} | actual: ${x.actual}`);
    console.log(`TOTAL: ${results.length} | PASS: ${results.length-failed.length} | FAIL: ${failed.length}`);
    process.exit(failed.length?1:0);
  }catch(e){console.error('Verification error:',e.message);console.error('Server log tail:',logs.slice(-1200));process.exit(1);}
}
main();
