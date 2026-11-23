import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { Pool } from 'pg';
const R=[];const rec=(n,e,a,p)=>R.push({n,e,a,p});
const serverSource=fs.readFileSync('server.ts','utf8');
rec('file-store room queues honor secondary GA/IT capabilities','hasApplicationRole(actor, ga/it)',
  String(serverSource.includes(": hasApplicationRole(actor, 'ga')") && serverSource.includes(": hasApplicationRole(actor, 'it')")),
  serverSource.includes(": hasApplicationRole(actor, 'ga')") && serverSource.includes(": hasApplicationRole(actor, 'it')"));
const req=async(b,m,p,o={})=>{const r=await fetch(b+p,{method:m,headers:{'Content-Type':'application/json',...(o.token?{Cookie:o.token}:{}),Origin:b},body:o.body===undefined?undefined:JSON.stringify(o.body)});let j={};try{j=await r.json()}catch{}return{status:r.status,json:j,setCookie:r.headers.get('set-cookie')||''}};
const day=()=>new Date(Date.now()+10*86400000).toISOString().slice(0,10);
async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('Unable to allocate a local TCP port')));
        return;
      }
      probe.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

async function main(){
 const sp=path.resolve('dist/server.cjs');if(!fs.existsSync(sp)){console.error('run npm run build first');process.exit(1)}
 const sf=path.resolve('server/data/gabah_state.json');let old=null;if(fs.existsSync(sf)){old=fs.readFileSync(sf,'utf8');fs.rmSync(sf)}
 const port=await getAvailablePort(),b=`http://127.0.0.1:${port}`,ap=crypto.randomBytes(12).toString('base64url'),up=crypto.randomBytes(12).toString('base64url');
 const c=spawn(process.execPath,[sp],{env:{...process.env,PORT:String(port),NODE_ENV:'development',GABAH_INITIAL_ADMIN_PASSWORD:ap,GABAH_INITIAL_USER_PASSWORD:up,GABAH_TEST_PASSWORD:''},stdio:['ignore','pipe','pipe']});let log='';c.stdout.on('data',x=>log+=x);c.stderr.on('data',x=>log+=x);
 const clean=()=>{try{c.kill('SIGKILL')}catch{}if(old!==null)fs.writeFileSync(sf,old)};process.on('exit',clean);
 try{
  let ok=false;for(let i=0;i<60;i++){try{if((await fetch(b+'/api/health')).ok){ok=true;break}}catch{}await new Promise(r=>setTimeout(r,300))}
  rec('boot','200',ok?'200':'down',ok);if(!ok)throw Error(log.slice(-1500));
  const login=async(e)=>{const r=await req(b,'POST','/api/auth/login',{body:{email:e,password:e.startsWith('admin@')?ap:up}});return r.setCookie.split(';',1)[0]||''};
  const [admin,ga,sek,karyawan,humas]=await Promise.all(['admin@foodstation.co.id','ga@foodstation.co.id','sekretariat.direksi@foodstation.co.id','hendra.w@foodstation.co.id','humas@foodstation.co.id'].map(login));
  rec('logins','5 tokens',[admin,ga,sek,karyawan,humas].filter(Boolean).length+' tokens',[admin,ga,sek,karyawan,humas].every(Boolean));
  // Diagnostics: expose the authoritative PostgreSQL policy returned by the
  // authenticated principal so permission failures can be traced to either
  // missing role assignment or missing permission mapping.
  for (const [label,token] of [['GA',ga],['Sekdir',sek],['Humas',humas]]) {
    const me=await req(b,'GET','/api/auth/me',{token});
    const u=me.json?.data||{};
    console.log(`[RBAC DIAG] ${label} id=${u.id} role=${u.role} roles=${JSON.stringify(u.role_keys||[])} permissions=${JSON.stringify((u.permission_keys||[]).filter((k)=>k.startsWith('room_reservations.')))}`);
  }
  // Query PostgreSQL directly: the assignment-management API is PUT-only,
  // so a GET probe would return a misleading empty/404 response.
  if (process.env.DATABASE_URL || process.env.PGHOST) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || undefined,
      host: process.env.PGHOST || (process.env.DATABASE_URL ? undefined : '127.0.0.1'),
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'gabah_db',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
    });
    try {
      const diag = await pool.query(
        `SELECT u.id, u.email, r.role_key, ur.is_primary,
                array_agg(rp.permission_key ORDER BY rp.permission_key)
                  FILTER (WHERE rp.permission_key LIKE 'room_reservations.%') AS room_permissions
           FROM users u
           LEFT JOIN gabah_user_roles ur ON ur.user_id = u.id::text
           LEFT JOIN gabah_roles r ON r.id = ur.role_id
           LEFT JOIN gabah_role_permissions rp ON rp.role_id = r.id
           WHERE u.email IN ('ga@foodstation.co.id','sekretariat.direksi@foodstation.co.id','humas@foodstation.co.id')
           GROUP BY u.id,u.email,r.role_key,ur.is_primary
           ORDER BY u.email,r.role_key`,
      );
      console.log(`[RBAC DIAG] postgres assignments=${JSON.stringify(diag.rows)}`);
      const grants = await pool.query(
        `SELECT r.role_key, array_agg(rp.permission_key ORDER BY rp.permission_key)
           FILTER (WHERE rp.permission_key LIKE 'room_reservations.%') AS room_permissions
           FROM gabah_roles r LEFT JOIN gabah_role_permissions rp ON rp.role_id=r.id
           WHERE r.role_key IN ('ga','sekretaris_direksi','humas','karyawan')
           GROUP BY r.role_key ORDER BY r.role_key`,
      );
      console.log(`[RBAC DIAG] postgres role_grants=${JSON.stringify(grants.rows)}`);
    } finally { await pool.end(); }
  } else {
    console.log('[RBAC DIAG] PostgreSQL connection env is absent in test parent process.');
  }
  const rooms=(await req(b,'GET','/api/meeting-rooms',{token:admin})).json?.data||[],room=rooms.find(x=>x.id==='ROOM-01')||rooms[0],alt=rooms.find(x=>x.id!==room?.id&&x.status!=='maintenance');
  const types=(await req(b,'GET','/api/meeting-types',{token:admin})).json?.data||[],high=types.find(x=>x.priority_level==='high')||{code:'direksi'};
  rec('room fixtures','ROOM-01 + alt',`${room?.id}+${alt?.id}`,Boolean(room&&alt));
  const make=(token,title,x={})=>req(b,'POST','/api/room-reservations',{token,body:{room_id:room.id,title,attendees_count:5,meeting_type:'internal',date:day(),start_time:'10:00',end_time:'11:00',facilities_requested:[],consumption_requested:false,documentation_requested:false,...x}});
  const stringConsumptionFlag=await make(karyawan,'Invalid string consumption flag',{consumption_requested:'false'});
  rec('string consumption flag rejected','400',stringConsumptionFlag.status,stringConsumptionFlag.status===400);
  const stringDocumentationFlag=await make(karyawan,'Invalid string documentation flag',{documentation_requested:'false'});
  rec('string documentation flag rejected','400',stringDocumentationFlag.status,stringDocumentationFlag.status===400);
  const stringOverrideFlag=await make(sek,'Invalid string override flag',{priority:'high',override_conflict:'false'});
  rec('string override flag rejected','400',stringOverrideFlag.status,stringOverrideFlag.status===400);
  const invalidPriority=await make(karyawan,'Invalid priority enum',{priority:'urgent'});
  rec('invalid priority rejected','400',invalidPriority.status,invalidPriority.status===400);
  const invalidConsumptionType=await make(karyawan,'Invalid consumption enum',{consumption_type:'unlisted'});
  rec('invalid consumption type rejected','400',invalidConsumptionType.status,invalidConsumptionType.status===400);
  const invalidDocumentationType=await make(karyawan,'Invalid documentation enum',{documentation_type:'unlisted'});
  rec('invalid documentation type rejected','400',invalidDocumentationType.status,invalidDocumentationType.status===400);
  const countBeforeMalformedFacilities=((await req(b,'GET','/api/room-reservations',{token:admin})).json?.data||[]).length;
  const malformedFacilities=await make(karyawan,'Malformed facility list',{facilities_requested:[42]});
  const countAfterMalformedFacilities=((await req(b,'GET','/api/room-reservations',{token:admin})).json?.data||[]).length;
  rec('malformed facilities rejected without creating reservation','400 + unchanged count',`HTTP ${malformedFacilities.status}, ${countBeforeMalformedFacilities}->${countAfterMalformedFacilities}`,malformedFacilities.status===400&&countBeforeMalformedFacilities===countAfterMalformedFacilities);
  const invalidAttendees=await make(karyawan,'Invalid negative attendees',{attendees_count:-2});
  rec('negative attendee count rejected','400',invalidAttendees.status,invalidAttendees.status===400);
  const fractionalAttendees=await make(karyawan,'Invalid fractional attendees',{attendees_count:1.5});
  rec('fractional attendee count rejected','400',fractionalAttendees.status,fractionalAttendees.status===400);
  const invalidClock=await make(karyawan,'Invalid time format',{start_time:'9:00',end_time:'10:00'});
  rec('non-canonical time rejected','400',invalidClock.status,invalidClock.status===400);
  const invalidCalendarDate=await make(karyawan,'Invalid calendar date',{date:'2026-02-31'});
  rec('impossible calendar date rejected','400',invalidCalendarDate.status,invalidCalendarDate.status===400);
  const invalidConsumptionPax=await make(karyawan,'Invalid consumption pax',{consumption_requested:true,consumption_pax:1.5});
  rec('fractional consumption pax rejected','400',invalidConsumptionPax.status,invalidConsumptionPax.status===400);
  const invalidServingTime=await make(karyawan,'Invalid serving time',{consumption_serving_time:'9:00'});
  rec('invalid serving time rejected','400',invalidServingTime.status,invalidServingTime.status===400);
  const base=await make(karyawan,'Stage3 existing');rec('ordinary booking','201 pending',`${base.status} ${base.json?.data?.status}`,base.status===201&&base.json?.data?.status==='pending_approval');
  const docBooking=await make(karyawan,'Stage3 documentation brief',{start_time:'15:00',end_time:'16:00',documentation_requested:true,documentation_type:'foto',documentation_notes:'Public documentation brief',attendees_list:'PRIVATE attendee list',consumption_requested:true,consumption_type:'lunch_box',consumption_pax:10,consumption_notes:'PRIVATE consumption note',notes:'PRIVATE internal note'});
  const humasQueue=(await req(b,'GET','/api/room-reservations',{token:humas})).json?.data||[];
  const humasItem=humasQueue.find(x=>x.id===docBooking.json?.data?.id);
  rec('Humas documentation queue','requested item visible',humasItem?'visible':'missing',Boolean(docBooking.status===201&&humasItem));
  rec('Humas queue redacts attendee/contact/consumption/internal notes','private fields absent',JSON.stringify({phone:humasItem?.organizer_phone,attendees:humasItem?.attendees_list,consumption:humasItem?.consumption_notes,notes:humasItem?.notes,facilities:humasItem?.facilities_requested}),Boolean(humasItem&&humasItem.organizer_phone===''&&humasItem.attendees_list===undefined&&humasItem.consumption_notes===undefined&&humasItem.notes===undefined&&(humasItem.facilities_requested||[]).length===0));
  rec('Humas queue retains documentation brief','foto + brief',`${humasItem?.documentation_type} ${humasItem?.documentation_notes}`,Boolean(humasItem?.documentation_type==='foto'&&humasItem?.documentation_notes==='Public documentation brief'));
  const col=await make(humas,'Stage3 collision');rec('collision','400',col.status,col.status===400);
  const gaO=await make(ga,'Stage3 GA override',{meeting_type:high.code,priority:'high',override_conflict:true});rec('GA no interrupt','403',gaO.status,gaO.status===403);
  const low=await make(sek,'Stage3 Sekdir low',{priority:'low',override_conflict:true});rec('Sekdir LOW no interrupt','403',low.status,low.status===403);
  const vip=await make(sek,'Stage3 urgent Direksi',{meeting_type:high.code,priority:'high',attendees_count:5,override_conflict:true,interruption_reason:'Urgent Direksi'});rec('Sekdir HIGH interrupt','201 approved',`${vip.status} ${vip.json?.data?.status}`,vip.status===201&&vip.json?.data?.status==='approved');
  const list=(await req(b,'GET','/api/room-reservations',{token:admin})).json?.data||[],moved=list.find(x=>x.id===base.json?.data?.id);rec('moved to alternative',`${alt.id}+interrupted`,`${moved?.room_id}+${Boolean(moved?.is_interrupted)}`,Boolean(moved&&moved.room_id===alt.id&&moved.is_interrupted));
  // FIXTURE (bukan assertion): slot 13:00-14:00 bebas bentrok dengan booking
  // VIP Direksi (ROOM-01 10:00-11:00 approved) agar skenario in_use protection
  // (running meeting) dapat dicapai tanpa melanggar aturan anti-collision.
  const run=await make(karyawan,'Stage3 running',{start_time:'13:00',end_time:'14:00'}),rid=run.json?.data?.id,app=await req(b,'POST',`/api/room-reservations/${rid}/approve`,{token:ga}),ci=await req(b,'POST',`/api/room-reservations/${rid}/checkin`,{token:karyawan});rec('checkin','200 in_use',`${ci.status} ${ci.json?.data?.status}`,ci.status===200&&ci.json?.data?.status==='in_use');
  rec('GA approval','200 approved',`${app.status} ${app.json?.data?.status}`,app.status===200&&app.json?.data?.status==='approved');
  const ri=await make(sek,'Stage3 running interrupt',{meeting_type:high.code,priority:'high',override_conflict:true,start_time:'13:00',end_time:'14:00'});rec('running protected','409',ri.status,ri.status===409);
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