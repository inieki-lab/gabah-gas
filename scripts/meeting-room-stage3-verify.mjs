import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
const R=[];const rec=(n,e,a,p)=>R.push({n,e,a,p});
const req=async(b,m,p,o={})=>{const r=await fetch(b+p,{method:m,headers:{'Content-Type':'application/json',...(o.token?{Authorization:`Bearer ${o.token}`}:{})},body:o.body===undefined?undefined:JSON.stringify(o.body)});let j={};try{j=await r.json()}catch{}return{status:r.status,json:j}};
const day=()=>new Date(Date.now()+10*86400000).toISOString().slice(0,10);
async function main(){
 const sp=path.resolve('dist/server.cjs');if(!fs.existsSync(sp)){console.error('run npm run build first');process.exit(1)}
 const sf=path.resolve('server/data/gabah_state.json');let old=null;if(fs.existsSync(sf)){old=fs.readFileSync(sf,'utf8');fs.rmSync(sf)}
 const port=39000+Math.floor(Math.random()*2000),b=`http://127.0.0.1:${port}`,ap=crypto.randomBytes(12).toString('base64url'),up=crypto.randomBytes(12).toString('base64url');
 const c=spawn(process.execPath,[sp],{env:{...process.env,PORT:String(port),NODE_ENV:'development',GABAH_INITIAL_ADMIN_PASSWORD:ap,GABAH_INITIAL_USER_PASSWORD:up,GABAH_TEST_PASSWORD:''},stdio:['ignore','pipe','pipe']});let log='';c.stdout.on('data',x=>log+=x);c.stderr.on('data',x=>log+=x);
 const clean=()=>{try{c.kill('SIGKILL')}catch{}if(old!==null)fs.writeFileSync(sf,old)};process.on('exit',clean);
 try{
  let ok=false;for(let i=0;i<60;i++){try{if((await fetch(b+'/api/health')).ok){ok=true;break}}catch{}await new Promise(r=>setTimeout(r,300))}
  rec('boot','200',ok?'200':'down',ok);if(!ok)throw Error(log.slice(-1500));
  const login=async(e)=>{const r=await req(b,'POST','/api/auth/login',{body:{email:e,password:e.startsWith('admin@')?ap:up}});return r.json?.data?.token||''};
  const [admin,ga,sek,karyawan,humas]=await Promise.all(['admin@foodstation.co.id','ga@foodstation.co.id','sekretariat.direksi@foodstation.co.id','hendra.w@foodstation.co.id','humas@foodstation.co.id'].map(login));
  rec('logins','5 tokens',[admin,ga,sek,karyawan,humas].filter(Boolean).length+' tokens',[admin,ga,sek,karyawan,humas].every(Boolean));
  const rooms=(await req(b,'GET','/api/meeting-rooms',{token:admin})).json?.data||[],room=rooms.find(x=>x.id==='ROOM-01')||rooms[0],alt=rooms.find(x=>x.id!==room?.id&&x.status!=='maintenance');
  const types=(await req(b,'GET','/api/meeting-types',{token:admin})).json?.data||[],high=types.find(x=>x.priority_level==='high')||{code:'direksi'};
  rec('room fixtures','ROOM-01 + alt',`${room?.id}+${alt?.id}`,Boolean(room&&alt));
  const make=(token,title,x={})=>req(b,'POST','/api/room-reservations',{token,body:{room_id:room.id,title,attendees_count:5,meeting_type:'internal',date:day(),start_time:'10:00',end_time:'11:00',facilities_requested:[],consumption_requested:false,documentation_requested:false,...x}});
  const base=await make(karyawan,'Stage3 existing');rec('ordinary booking','201 pending',`${base.status} ${base.json?.data?.status}`,base.status===201&&base.json?.data?.status==='pending_approval');
  const col=await make(humas,'Stage3 collision');rec('collision','400',col.status,col.status===400);
  const gaO=await make(ga,'Stage3 GA override',{meeting_type:high.code,priority:'high',override_conflict:true});rec('GA no interrupt','403',gaO.status,gaO.status===403);
  const low=await make(sek,'Stage3 Sekdir low',{priority:'low',override_conflict:true});rec('Sekdir LOW no interrupt','403',low.status,low.status===403);
  const vip=await make(sek,'Stage3 urgent Direksi',{meeting_type:high.code,priority:'high',attendees_count:5,override_conflict:true,interruption_reason:'Urgent Direksi'});rec('Sekdir HIGH interrupt','201 approved',`${vip.status} ${vip.json?.data?.status}`,vip.status===201&&vip.json?.data?.status==='approved');
  const list=(await req(b,'GET','/api/room-reservations',{token:admin})).json?.data||[],moved=list.find(x=>x.id===base.json?.data?.id);rec('moved to alternative',`${alt.id}+interrupted`,`${moved?.room_id}+${Boolean(moved?.is_interrupted)}`,Boolean(moved&&moved.room_id===alt.id&&moved.is_interrupted));
  const run=await make(karyawan,'Stage3 running'),rid=run.json?.data?.id,app=await req(b,'POST',`/api/room-reservations/${rid}/approve`,{token:ga}),ci=await req(b,'POST',`/api/room-reservations/${rid}/checkin`,{token:karyawan});rec('checkin','200 in_use',`${ci.status} ${ci.json?.data?.status}`,ci.status===200&&ci.json?.data?.status==='in_use');
  rec('GA approval','200 approved',`${app.status} ${app.json?.data?.status}`,app.status===200&&app.json?.data?.status==='approved');
  const ri=await make(sek,'Stage3 running interrupt',{meeting_type:high.code,priority:'high',override_conflict:true});rec('running protected','409',ri.status,ri.status===409);
  const anon=await req(b,'POST',`/api/room-reservations/${rid}/checkin`);rec('anonymous checkin','401',anon.status,anon.status===401);
  const badout=await req(b,'POST',`/api/room-reservations/${rid}/checkout`,{token:humas});rec('unrelated checkout','403',badout.status,badout.status===403);
  const out=await req(b,'POST',`/api/room-reservations/${rid}/checkout`,{token:karyawan});rec('organizer checkout','200 completed',`${out.status} ${out.json?.data?.status}`,out.status===200&&out.json?.data?.status==='completed');
  const out2=await req(b,'POST',`/api/room-reservations/${rid}/checkout`,{token:karyawan});rec('double checkout','409',out2.status,out2.status===409);
  const logs=(await req(b,'GET','/api/audit-logs',{token:admin})).json?.data||[],has=(a,id)=>logs.some(x=>x.action===a&&(!id||x.entity_id===id));
  rec('interruption audit','found',has('ROOM_RESERVATION_INTERRUPTED',base.json?.data?.id)?'found':'missing',has('ROOM_RESERVATION_INTERRUPTED',base.json?.data?.id));
  rec('denied override audit','found',has('ROOM_RESERVATION_OVERRIDE_DENIED')?'found':'missing',has('ROOM_RESERVATION_OVERRIDE_DENIED'));
  const p=R.filter(x=>x.p).length;console.log('\n=== MEETING ROOM STAGE 3 VERIFY ===');R.forEach(x=>console.log(`${x.p?'PASS':'FAIL'} | ${x.n} | expected: ${x.e} | actual: ${x.a}`));console.log(`TOTAL: ${R.length} | PASS: ${p} | FAIL: ${R.length-p}`);process.exit(p===R.length?0:1);
 }catch(e){console.error('Verification error:',e.message);console.error(log.slice(-2000));process.exit(1)}
}
main();