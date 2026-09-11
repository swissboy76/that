import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const source=await readFile('dist/_worker.js','utf8');
const moduleCode=source.replace('"privacyNotice": ""','"privacyNotice": "We use your application to respond to your interest."').replace('"privacyNotice":""','"privacyNotice":"We use your application to respond to your interest."');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(moduleCode).toString('base64'))).default;
const env={PUBLIC_SITE_URL:'https://example.pages.dev',SESSION_SECRET:'s'.repeat(64),MEMBERS_PASSWORD:'test-member-password-long',TURNSTILE_SITE_KEY:'test-site',TURNSTILE_SECRET_KEY:'test-secret',GITHUB_REPO:'test/company',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-oauth'};
const request=(path,method='GET',body,headers={})=>new Request(env.PUBLIC_SITE_URL+path,{method,headers:{...(method==='POST'?{'Origin':env.PUBLIC_SITE_URL,'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
const originalFetch=globalThis.fetch;
async function withTurnstile(fn){globalThis.fetch=async()=>new Response(JSON.stringify({success:true,hostname:'example.pages.dev',action:'members'}));try{await fn();}finally{globalThis.fetch=originalFetch;}}
test('member content never appears without a valid server session',async()=>{
 const r=await worker.fetch(request('/members/'),env);assert.equal(r.status,200);const body=await r.text();assert.match(body,/Company password/);assert.doesNotMatch(body,/Rehearsal details will be posted here/);assert.equal(r.headers.get('Cache-Control'),'no-store');
 const r2=await worker.fetch(request('/members/','GET',null,{Cookie:'__Host-that-member=fake.signature'}),env);assert.match(await r2.text(),/Company password/);
});
test('private source URLs and preview host cannot expose private content',async()=>{
 for(const path of ['/private/members.json','/content/site.json','/_worker.js'])assert.equal((await worker.fetch(request(path),env)).status,404);
 assert.equal((await worker.fetch(new Request('https://preview.pages.dev/members/'),env)).status,403);
});
test('login rejects wrong origin, unavailable configuration and bad challenge',async()=>{
 assert.equal((await worker.fetch(request('/api/members/login','POST',{}, {Origin:'https://evil.example'}),env)).status,403);
 assert.equal((await worker.fetch(request('/api/members/login','POST',{}),{})).status,403);
 assert.equal((await worker.fetch(request('/api/members/login','POST',{}),env)).status,400);
});
test('valid login creates secure session; password rotation revokes it; logout clears cookie',async()=>{
 await withTurnstile(async()=>{
  assert.equal((await worker.fetch(request('/api/members/login','POST',{password:'wrong',token:'test'}),env)).status,401);
  const r=await worker.fetch(request('/api/members/login','POST',{password:env.MEMBERS_PASSWORD,token:'test'}),env);assert.equal(r.status,200);const cookie=r.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
  const authorised=await worker.fetch(request('/members/','GET',null,{Cookie:cookie.split(';')[0]}),env);assert.match(await authorised.text(),/Rehearsal details will be posted here/);
  const revoked=await worker.fetch(request('/members/','GET',null,{Cookie:cookie.split(';')[0]}),{...env,MEMBERS_PASSWORD:'new-test-password-long'});assert.match(await revoked.text(),/Company password/);
  const logout=await worker.fetch(request('/api/members/logout','POST',{}),env);assert.equal(logout.status,303);assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
 });
});
test('applications validate before insertion and return success only after persistence',async()=>{
 let rows=[];const DB={prepare(sql){assert.match(sql,/INSERT INTO applications/);return {bind:(...values)=>({run:async()=>{rows.push(values);return {success:true};}})};}};
 const data={name:'Applicant',email:'applicant@example.test',phone:'',interests:['Performing'],experience:'Some experience',consent:true,token:'test'};
 assert.equal((await worker.fetch(request('/api/applications','POST',data),env)).status,503);
 assert.equal((await worker.fetch(request('/api/applications','POST',{...data,email:'invalid'}),{...env,DB})).status,400);assert.equal(rows.length,0);
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,hostname:'example.pages.dev',action:'application'}));
 try{
  const r=await worker.fetch(request('/api/applications','POST',data),{...env,DB});assert.equal(r.status,201);assert.equal(rows.length,1);assert.equal(rows[0][2],'Applicant');assert.equal(rows[0][3],'applicant@example.test');
  const failureDB={prepare(){return {bind(){return {run(){throw Error('Database unavailable');}}}}}};
  const failed=await worker.fetch(request('/api/applications','POST',data),{...env,DB:failureDB});assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/Database unavailable/);
 }finally{globalThis.fetch=originalFetch;}
});
test('OAuth requires matching browser state, private repository and editor write access',async()=>{
 const start=await worker.fetch(request('/api/auth'),env);assert.equal(start.status,302);const state=new URL(start.headers.get('Location')).searchParams.get('state');const cookie=start.headers.get('Set-Cookie').split(';')[0];assert.ok(state.length>30);
 assert.equal((await worker.fetch(request('/api/callback?code=test&state=incorrect','GET',null,{Cookie:cookie}),env)).status,400);
 let call=0;globalThis.fetch=async()=>new Response(JSON.stringify(++call===1?{access_token:'FAKE_TEST_TOKEN'}:{private:true,permissions:{push:true}}));
 try{const done=await worker.fetch(request('/api/callback?code=test&state='+state,'GET',null,{Cookie:cookie}),env);assert.equal(done.status,200);const body=await done.text();assert.match(body,/event.origin!==target/);assert.match(body,/authorization:github:success/);assert.match(done.headers.get('Content-Security-Policy'),/default-src 'none'/);}finally{globalThis.fetch=originalFetch;}
 call=0;globalThis.fetch=async()=>new Response(JSON.stringify(++call===1?{access_token:'FAKE_TEST_TOKEN'}:{private:false,permissions:{push:true}}));
 try{assert.equal((await worker.fetch(request('/api/callback?code=test&state='+state,'GET',null,{Cookie:cookie}),env)).status,403);}finally{globalThis.fetch=originalFetch;}
});
test('CMS collections are editable; deployment assets do not include private source files',async()=>{
 const r=await worker.fetch(request('/admin/config.yml'),env);const config=JSON.parse(await r.text());assert.equal(config.backend.name,'github');assert.equal(config.collections.length,5);assert.equal(config.collections.at(-1).files[0].file,'private/members.json');
 const roots=await readdir('dist');assert.ok(!roots.includes('private'));assert.ok(!roots.includes('content'));assert.ok(!roots.includes('members'));assert.match(await readFile('dist/index.html','utf8'),/stage-04.webp/);
});
