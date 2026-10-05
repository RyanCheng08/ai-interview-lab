import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';

// Execute the actual TypeScript adapter, without Vite, a database, or any
// production requests. In-memory Storage and an origin-wide mutex are injected.
async function moduleUrl(path,replacements={}){
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  let code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  for(const [name,url] of Object.entries(replacements))code=code.replaceAll(`from "${name}"`,`from "${url}"`);
  return 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
const contracts=await moduleUrl('lib/contracts.ts');
const progressModule=await moduleUrl('lib/local-progress.ts',{'./contracts':contracts});
const {createLocalProgressStore,PAGES_PROGRESS_KEY}=await import(progressModule);
const {createPagesApiTransport}=await import(await moduleUrl('lib/pages-client.ts',{'./contracts':contracts,'./local-progress':progressModule}));
const raw=JSON.parse(await readFile(new URL('../data/question-bank.json',import.meta.url),'utf8'));
const annotations=JSON.parse(await readFile(new URL('../data/corrections.json',import.meta.url),'utf8'));
const bank={questions:raw.questions,sources:raw.sources,annotations};
class MemoryStorage {
  values=new Map();fail=false;
  getItem(key){return this.values.get(key)??null}
  setItem(key,value){if(this.fail)throw new Error('Quota exceeded');this.values.set(key,value)}
}
function mutex(){let tail=Promise.resolve();return operation=>{const result=tail.then(operation);tail=result.catch(()=>{});return result}}
let time=Date.parse('2026-10-05T00:00:00.000Z');
const storage=new MemoryStorage(),runExclusive=mutex(),now=()=>time;
function client(basePath='/'){
  const progress=createLocalProgressStore({storage,runExclusive,now,basePath});
  return createPagesApiTransport({loadBank:async()=>bank,progress,now,random:()=>0});
}
const api=client(),tab=client();
const write=(expectedRevision,patch)=>({expectedRevision,mutationId:randomUUID(),...patch});
const checkError=(promise,code,status)=>assert.rejects(promise,error=>error.code===code&&error.status===status);
const catalog=await api.get('/api/v1/catalog');
assert.equal(catalog.total,2464);assert.equal(catalog.pages,1920);assert.equal(catalog.annotations,27);assert.equal(catalog.missingAnswers,25);assert.equal(catalog.chapters.length,177);
const page=await api.get('/api/v1/questions?page=1.5');assert.equal(page.page,1);assert.equal(page.pageSize,40);assert.equal(page.items.length,40);
assert.equal((await api.get('/api/v1/questions?page=-2')).page,1);
assert.equal((await api.get('/api/v1/questions?page=99999')).page,10000);
const consistency=await api.get('/api/v1/questions?q=Self-Consistency');assert.equal(consistency.total,3);
const detail=await api.get('/api/v1/questions/prompt-5.3.1');assert.equal(detail.contentLanguage,'zh-CN');assert.ok(detail.annotations.length>0);
const missing=await api.get('/api/v1/questions/prompt-5.2.1');assert.equal(missing.answerMissing,true);
const source=await api.get('/api/v1/questions?sourceId=prompt');assert.equal(source.total,210);assert.ok(source.items.every(q=>q.sourceId==='prompt'));
assert.equal((await api.get('/api/v1/questions?q=nonexistent-question-unique-9876')).total,0);
const first=source.items[0].id,random=await api.get(`/api/v1/questions?sourceId=prompt&random=1&exclude=${first}`);assert.equal(random.pageSize,1);assert.notEqual(random.items[0].id,first);assert.equal(random.total,210);
await checkError(api.get('/api/v1/questions/unknown-1.1.1'),'NOT_FOUND',404);
await checkError(api.get('/api/v1/questions?filter=bogus'),'INVALID_FILTER',400);
await checkError(api.get('https://bad.example/api/v1/catalog'),'NOT_FOUND',404);
await checkError(api.get('/api/v1/questions/%ZZ'),'INVALID_INPUT',400);
const controller=new AbortController();controller.abort();await assert.rejects(api.get('/api/v1/catalog',controller.signal),e=>e.name==='AbortError');
await checkError(api.put('/api/v1/progress/unknown-1.1.1',write(0,{note:'x'})),'NOT_FOUND',404);
await checkError(api.put('/api/v1/progress/llm-1.1.1',{...write(0,{note:'x'}),userId:'other'}),'INVALID_INPUT',400);
await checkError(api.put('/api/v1/progress/llm-1.1.1',write(0,{note:'x'.repeat(12001)})),'INVALID_INPUT',400);
await checkError(api.put('/api/v1/progress/llm-1.1.1',write(0,{})),'INVALID_INPUT',400);
assert.deepEqual((await api.get('/api/v1/progress')).items,[]);
const payload=write(0,{note:'原文笔记',favorite:true,status:'learning'}),saved=await api.put('/api/v1/progress/llm-1.1.1',payload);
assert.equal(saved.revision,1);assert.equal(saved.reviewCount,1);assert.equal(saved.nextReviewAt,'2026-10-06T00:00:00.000Z');assert.equal(saved.lastReviewedAt,'2026-10-05T00:00:00.000Z');assert.equal(saved.favorite,true);
assert.deepEqual(await tab.put('/api/v1/progress/llm-1.1.1',payload),saved,'last mutation retry is idempotent');
assert.equal((await tab.get('/api/v1/progress')).items[0].note,'原文笔记','another tab reads persisted data');
await checkError(tab.put('/api/v1/progress/llm-1.1.1',write(0,{note:'stale'})),'REVISION_CONFLICT',409);
assert.equal((await api.get('/api/v1/questions?filter=favorite')).total,1);assert.equal((await api.get('/api/v1/questions?filter=learning')).total,1);assert.equal((await api.get('/api/v1/questions?filter=due')).total,0);
time+=86400000;assert.equal((await api.get('/api/v1/questions?filter=due')).total,1);
const races=await Promise.allSettled([api.put('/api/v1/progress/llm-1.1.1',write(1,{note:'tab one'})),tab.put('/api/v1/progress/llm-1.1.1',write(1,{note:'tab two'}))]);
assert.equal(races.filter(r=>r.status==='fulfilled').length,1);assert.equal(races.find(r=>r.status==='rejected').reason.code,'REVISION_CONFLICT');
const latest=(await api.get('/api/v1/progress')).items[0];assert.equal(latest.revision,2);assert.equal(latest.reviewCount,1,'note updates do not count as reviews');
await Promise.all([api.put('/api/v1/progress/llm-1.1.2',write(0,{favorite:true})),tab.put('/api/v1/progress/llm-1.1.3',write(0,{status:'mastered'}))]);
assert.equal((await api.get('/api/v1/progress')).items.length,3,'concurrent different questions preserve both writes');
const mastered=(await api.get('/api/v1/progress')).items.find(q=>q.questionId==='llm-1.1.3');assert.equal(mastered.nextReviewAt,'2026-10-13T00:00:00.000Z');
const backup=JSON.parse(await api.exportProgress());assert.equal(backup.application,'ai-interview-lab');assert.equal(backup.version,1);assert.equal(backup.items.length,3);assert.equal(backup.items[0].lastMutationId,undefined);
const otherProject=client('/other-project/');assert.equal((await otherProject.get('/api/v1/progress')).items.length,0,'projects sharing github.io do not share progress');
assert.equal(await otherProject.importProgress(JSON.stringify(backup)),3);
assert.equal((await otherProject.get('/api/v1/progress')).items.find(q=>q.questionId===latest.questionId).revision,latest.revision+1);
assert.equal(await otherProject.importProgress(JSON.stringify(backup)),0,'equal-timestamp reimport preserves local state');
const newer=structuredClone(backup);newer.items[0].updatedAt='2026-10-07T00:00:00.000Z';newer.items[0].note='导入更新';newer.items[0].revision=10;
assert.equal(await otherProject.importProgress(JSON.stringify(newer)),1);const imported=(await otherProject.get('/api/v1/progress')).items.find(q=>q.questionId===newer.items[0].questionId);assert.equal(imported.revision,11);assert.equal(imported.note,'导入更新');
await checkError(otherProject.put('/api/v1/progress/'+imported.questionId,write(latest.revision+1,{note:'old tab'})),'REVISION_CONFLICT',409);
for(const invalid of [
  {...backup,version:2}, {...backup,application:'another-app'}, {...backup,exportedAt:'2026-02-30T00:00:00.000Z'},
  {...backup,items:[{...backup.items[0],questionId:'unknown-1.1.1'}]}, {...backup,items:[backup.items[0],backup.items[0]]},
  {...backup,items:[{...backup.items[0],note:'x'.repeat(12001)}]}, {...backup,items:[{...backup.items[0],revision:-1}]},
  {...backup,items:[{...backup.items[0],updatedAt:'tomorrow'}]}, {...backup,items:[{...backup.items[0],userId:'injected'}]}
])await checkError(otherProject.importProgress(JSON.stringify(invalid)),'INVALID_INPUT',400);
await checkError(otherProject.importProgress('{bad json'),'INVALID_INPUT',400);
const before=storage.getItem(PAGES_PROGRESS_KEY);storage.fail=true;await checkError(api.put('/api/v1/progress/llm-1.1.2',write(1,{note:'quota'})),'STORAGE_UNAVAILABLE',503);storage.fail=false;assert.equal(storage.getItem(PAGES_PROGRESS_KEY),before,'failed storage keeps original progress');
const corrupt=new MemoryStorage();corrupt.setItem(PAGES_PROGRESS_KEY,'{bad');const badStore=createLocalProgressStore({storage:corrupt,runExclusive,now});assert.throws(()=>badStore.read(),e=>e.code==='STORAGE_UNAVAILABLE');await checkError(badStore.write('llm-1.1.1',write(0,{note:'replace'})),'STORAGE_UNAVAILABLE',503);assert.equal(corrupt.getItem(PAGES_PROGRESS_KEY),'{bad','corrupt data is never silently replaced');
const navigatorDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
try{const legacy=createLocalProgressStore({storage:new MemoryStorage(),now});await checkError(legacy.write('llm-1.1.1',write(0,{note:'unsafe'})),'STORAGE_UNAVAILABLE',503)}
finally{if(navigatorDescriptor)Object.defineProperty(globalThis,'navigator',navigatorDescriptor);else delete globalThis.navigator}
console.log('PASS Pages: 2,464 questions, search/annotations/filters, input validation, persisted revisions, cross-tab CAS, review dates, project isolation, backup merge/validation, quota/corruption handling.');
