import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.argv[2]||'http://127.0.0.1:5173';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/,'Only a local preview may be tested.');
async function get(path,headers={}){const r=await fetch(base+path,{headers});return {status:r.status,body:await r.json().catch(()=>null)}}
assert.equal((await get('/api/v1/progress')).status,401);
assert.equal((await get('/api/v1/questions/invalid')).status,404);
const catalog=(await get('/api/v1/catalog')).body;
assert.equal(catalog.total,2464);assert.equal(catalog.pages,1920);assert.equal(catalog.annotations,27);
const list=(await get('/api/v1/questions?page=1.5')).body;assert.equal(list.page,1);assert.equal(list.items.length,40);
assert.ok((await get('/api/v1/questions?q=Self-Consistency')).body.total>0);
const pdf=await fetch(base+'/sources/llm.pdf',{method:'HEAD'});assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/pdf/);
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');assert.ok(cookie,'Local mock sign-in cookie required.');
const headers={'Cookie':cookie,'Content-Type':'application/json'};
let records=(await get('/api/v1/progress',headers)).body.items;
const id='llm-1.1.2',existing=records.find(p=>p.questionId===id);
const write={expectedRevision:existing?.revision||0,mutationId:randomUUID(),status:'learning',favorite:true,note:'Local API verification note'};
async function put(body,extra={}){const r=await fetch(base+'/api/v1/progress/'+id,{method:'PUT',headers:{...headers,...extra},body:JSON.stringify(body)});return {status:r.status,body:await r.json().catch(()=>null)}}
const saved=await put(write);assert.equal(saved.status,200);
const replay=await put(write);assert.equal(replay.status,200);assert.equal(replay.body.reviewCount,saved.body.reviewCount);assert.equal(replay.body.revision,saved.body.revision);
assert.equal((await put({...write,mutationId:randomUUID()})).status,409);
assert.equal((await put({...write,expectedRevision:saved.body.revision,mutationId:randomUUID()},{Origin:'https://other.example'})).status,403);
assert.equal((await put({...write,userId:'another-user'})).status,400);
const persisted=(await get('/api/v1/progress',headers)).body.items.find(p=>p.questionId===id);
assert.equal(persisted.note,write.note);assert.equal(persisted.reviewCount,saved.body.reviewCount);
assert.equal((await get('/api/v1/questions?filter=due',headers)).body.items.some(p=>p.id===id),false);
assert.ok((await get('/api/v1/questions?filter=learning',headers)).body.items.some(p=>p.id===id));
console.log('PASS: catalog, search, paging, PDF, auth, D1 persistence, idempotency, conflict, ownership input rejection, origin guard and due-date filter.');
