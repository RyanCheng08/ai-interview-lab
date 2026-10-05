import {ApiError,type ApiTransport,type Annotation,type Catalog,type Question,type QuestionSummary,type Source} from "./contracts";
import {createLocalProgressStore,parseProgressWrite,parseProgressRecord,type LocalProgressStore} from "./local-progress";

type BankInput={questions:Question[];sources:Source[];annotations:Annotation[];bankRevision?:string};
interface PagesTransportOptions {loadBank?:()=>Promise<BankInput>;progress?:LocalProgressStore;now?:()=>number;random?:()=>number;basePath?:string}
interface PortableTransport extends ApiTransport {exportProgress():Promise<string>;importProgress(text:string):Promise<number>}
async function loadStaticBank():Promise<BankInput>{
  // Load the PDF-derived data as a static chunk. Never import lib/bank, an API
  // route, or the account/database integration into this browser entry point.
  const [raw,notes]=await Promise.all([import("../data/question-bank.json"),import("../data/corrections.json")]);
  const revision=(raw.default as unknown as {bankRevision?:unknown}).bankRevision;
  return {questions:raw.default.questions as Question[],sources:raw.default.sources as Source[],annotations:notes.default as Annotation[],...(typeof revision==="string"?{bankRevision:revision}:{})};
}
function abortIfNeeded(signal?:AbortSignal){if(signal?.aborted)throw new DOMException("The operation was aborted.","AbortError")}
function pathUrl(path:string):URL {
  if(!path.startsWith("/api/v1/")||path.startsWith("//"))throw new ApiError("NOT_FOUND",404);
  try{return new URL(path,"https://interview-lab.invalid")}catch{throw new ApiError("INVALID_INPUT",400)}
}
export function createPagesApiTransport(options:PagesTransportOptions={}):PortableTransport {
  const progress=options.progress||createLocalProgressStore({basePath:options.basePath}),now=options.now||Date.now,random=options.random||Math.random;
  let pending:Promise<BankInput&{catalog:Catalog;byId:Map<string,Question>;notes:Map<string,Annotation[]>;search:Map<string,string>}>|undefined;
  function bank(){
    if(!pending)pending=(options.loadBank||loadStaticBank)().then(raw=>{
      const byId=new Map(raw.questions.map(q=>[q.id,q])),notes=new Map<string,Annotation[]>(),chapters=new Map<string,Catalog["chapters"][number]>();
      for(const a of raw.annotations)notes.set(a.questionId,[...(notes.get(a.questionId)||[]),a]);
      const search=new Map<string,string>();
      for(const q of raw.questions){const chapter=chapters.get(q.chapterId)||{id:q.chapterId,sourceId:q.sourceId,title:q.chapterTitle,count:0};chapter.count++;chapters.set(q.chapterId,chapter);search.set(q.id,(q.title+" "+q.number+" "+q.chapterTitle+" "+q.sectionTitle+" "+q.tags.join(" ")+" "+q.examFocus+" "+q.knowledge+" "+q.answer+" "+q.explanation+" "+(notes.get(q.id)||[]).map(a=>a.title+" "+a.body).join(" ")).toLocaleLowerCase())}
      return {...raw,byId,notes,search,catalog:{sources:raw.sources,chapters:[...chapters.values()],total:raw.questions.length,pages:raw.sources.reduce((n,s)=>n+s.pageCount,0),missingAnswers:raw.questions.filter(q=>q.answerMissing).length,annotations:raw.annotations.length}};
    }).catch(error=>{pending=undefined;throw error});
    return pending;
  }
  function summary(q:Question,notes:Map<string,Annotation[]>):QuestionSummary{const {id,sourceId,number,chapterId,chapterTitle,sectionTitle,title,pageStart,answerMissing}=q;return {id,sourceId,number,chapterId,chapterTitle,sectionTitle,title,pageStart,answerMissing,annotationCount:notes.get(id)?.length||0}}
  async function get<T>(path:string,signal?:AbortSignal):Promise<T>{
    abortIfNeeded(signal);const url=pathUrl(path);
    if(url.pathname==="/api/v1/progress"){const result={items:progress.read()};abortIfNeeded(signal);return result as T}
    const b=await bank();abortIfNeeded(signal);
    if(url.pathname==="/api/v1/catalog")return structuredClone(b.catalog) as T;
    if(url.pathname==="/api/v1/questions"){
      const p=url.searchParams,terms=(p.get("q")||"").slice(0,160).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean),source=p.get("sourceId")||"",chapter=p.get("chapterId")||"",filter=p.get("filter")||"all";
      if(!["all","favorite","due","mastered","learning","unseen"].includes(filter))throw new ApiError("INVALID_FILTER",400);
      let matches=b.questions.filter(q=>(!source||q.sourceId===source)&&(!chapter||q.chapterId===chapter)&&terms.every(term=>b.search.get(q.id)?.includes(term)));
      if(filter!=="all"){
        const saved=new Map(progress.read().map(p=>[p.questionId,p])),today=new Date(now()).toISOString();
        matches=matches.filter(q=>{const state=saved.get(q.id);if(filter==="favorite")return !!state?.favorite;if(filter==="due")return !!state?.nextReviewAt&&state.nextReviewAt<=today;return (state?.status||"unseen")===filter});
      }
      if(p.get("random")==="1"){
        const available=matches.filter(q=>q.id!==p.get("exclude")),draw=random(),index=Math.max(0,Math.min(available.length-1,Math.floor((Number.isFinite(draw)?draw:0)*available.length))),item=available.length?available[index]:matches[0];
        return {items:item?[summary(item,b.notes)]:[],total:matches.length,page:1,pageSize:1} as T;
      }
      const page=Math.max(1,Math.min(10000,Math.floor(Number(p.get("page")))||1)),pageSize=40;
      return {items:matches.slice((page-1)*pageSize,page*pageSize).map(q=>summary(q,b.notes)),total:matches.length,page,pageSize} as T;
    }
    const detail=url.pathname.match(/^\/api\/v1\/questions\/([^/]+)$/);
    if(detail){let id:string;try{id=decodeURIComponent(detail[1])}catch{throw new ApiError("INVALID_INPUT",400)}const q=b.byId.get(id);if(!q)throw new ApiError("NOT_FOUND",404);return structuredClone({...q,contentLanguage:"zh-CN",annotations:b.notes.get(id)||[]}) as T}
    throw new ApiError("NOT_FOUND",404);
  }
  async function put<T>(path:string,input:unknown):Promise<T>{
    const match=pathUrl(path).pathname.match(/^\/api\/v1\/progress\/([^/]+)$/);
    if(!match)throw new ApiError("NOT_FOUND",404);
    let id:string;try{id=decodeURIComponent(match[1])}catch{throw new ApiError("INVALID_INPUT",400)}
    if(!(await bank()).byId.has(id))throw new ApiError("NOT_FOUND",404);
    return await progress.write(id,parseProgressWrite(input)) as T;
  }
  async function exportProgress(){const b=await bank();return JSON.stringify({application:"ai-interview-lab",version:1,exportedAt:new Date(now()).toISOString(),...(b.bankRevision?{bankRevision:b.bankRevision}:{}),items:progress.read()},null,2)}
  async function importProgress(text:string){
    if(typeof text!=="string"||text.length>40000000)throw new ApiError("INVALID_INPUT",400);
    let input:unknown;try{input=JSON.parse(text)}catch{throw new ApiError("INVALID_INPUT",400)}
    if(!input||typeof input!=="object"||Array.isArray(input))throw new ApiError("INVALID_INPUT",400);
    const record=input as Record<string,unknown>;
    if(Object.keys(record).some(k=>!["application","version","exportedAt","bankRevision","items"].includes(k))||record.application!=="ai-interview-lab"||record.version!==1||typeof record.exportedAt!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.exportedAt)||!Number.isFinite(Date.parse(record.exportedAt))||new Date(record.exportedAt).toISOString()!==record.exportedAt||(record.bankRevision!==undefined&&(typeof record.bankRevision!=="string"||record.bankRevision.length>128))||!Array.isArray(record.items))throw new ApiError("INVALID_INPUT",400);
    const b=await bank();if(record.items.length>b.questions.length)throw new ApiError("INVALID_INPUT",400);
    const ids=new Set<string>(),items=record.items.map(parseProgressRecord);
    for(const row of items){if(!b.byId.has(row.questionId)||ids.has(row.questionId))throw new ApiError("INVALID_INPUT",400);ids.add(row.questionId)}
    return progress.merge(items);
  }
  return {get,put,exportProgress,importProgress};
}
const portable=createPagesApiTransport({basePath:typeof window==="undefined"?"/":new URL(".",window.location.href).pathname});
export const api:ApiTransport=portable;
export const exportPagesProgress=()=>portable.exportProgress();
export const importPagesProgress=(text:string)=>portable.importProgress(text);
