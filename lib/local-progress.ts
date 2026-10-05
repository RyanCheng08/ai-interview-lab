import {ApiError, type ProgressWrite, type StudyProgress, type Status} from "./contracts";

/** Intentionally separate from the account-backed Sites progress and UI preferences. */
export const PAGES_PROGRESS_KEY="interview-lab:github-pages:progress:v1";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUESTION_ID=/^[a-z]+-\d+\.\d+\.\d+$/;
const statuses:Status[]=["unseen","learning","mastered"];
type StoredProgress=StudyProgress&{lastMutationId:string};
type SavedData={version:1;items:Record<string,StoredProgress>};
export type ProgressStorage=Pick<Storage,"getItem"|"setItem">;
export type ExclusiveWriter=<T>(operation:()=>T|Promise<T>)=>Promise<T>;
export interface LocalProgressOptions {
  storage?:ProgressStorage|(()=>ProgressStorage);
  now?:()=>number;
  runExclusive?:ExclusiveWriter;
  mutationId?:()=>string;
  basePath?:string;
}
export interface LocalProgressStore {
  read():StudyProgress[];
  write(questionId:string,input:ProgressWrite):Promise<StudyProgress>;
  merge(items:StudyProgress[]):Promise<number>;
}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==="object"&&!Array.isArray(value)}
function integer(value:unknown,min=0):value is number{return typeof value==="number"&&Number.isSafeInteger(value)&&value>=min}
function timestamp(value:unknown):value is string{return typeof value==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value}
function nullableTimestamp(value:unknown):value is string|null{return value===null||timestamp(value)}
function validRow(value:unknown,id:string):value is StoredProgress {
  if(!object(value))return false;
  return value.questionId===id&&QUESTION_ID.test(id)&&typeof value.favorite==="boolean"&&typeof value.note==="string"&&value.note.length<=12000&&statuses.includes(value.status as Status)&&integer(value.reviewCount)&&integer(value.revision,1)&&nullableTimestamp(value.lastReviewedAt)&&nullableTimestamp(value.nextReviewAt)&&timestamp(value.updatedAt)&&typeof value.lastMutationId==="string"&&UUID.test(value.lastMutationId);
}
function asPublic(row:StoredProgress):StudyProgress {
  const {lastMutationId:_,...progress}=row;return progress;
}
/** Same strict write shape as the /api/v1/progress endpoint. */
export function parseProgressWrite(value:unknown):ProgressWrite {
  if(!object(value)||Object.keys(value).some(k=>!["expectedRevision","mutationId","favorite","note","status"].includes(k))||!integer(value.expectedRevision)||typeof value.mutationId!=="string"||!UUID.test(value.mutationId)||
    (value.favorite!==undefined&&typeof value.favorite!=="boolean")||(value.note!==undefined&&(typeof value.note!=="string"||value.note.length>12000))||(value.status!==undefined&&!statuses.includes(value.status as Status))||
    (value.favorite===undefined&&value.note===undefined&&value.status===undefined))throw new ApiError("INVALID_INPUT",400);
  return value as unknown as ProgressWrite;
}
export function parseProgressRecord(value:unknown):StudyProgress {
  if(!object(value)||Object.keys(value).some(k=>!["questionId","favorite","note","status","reviewCount","lastReviewedAt","nextReviewAt","updatedAt","revision"].includes(k))||typeof value.questionId!=="string"||!validRow({...value,lastMutationId:"00000000-0000-0000-0000-000000000000"},value.questionId))throw new ApiError("INVALID_INPUT",400);
  return value as unknown as StudyProgress;
}
function browserStorage():ProgressStorage{return localStorage}
function browserExclusive(lockName:string):ExclusiveWriter{return async operation=>{
  // localStorage read/check/write is not atomic across tabs. Secure-context Web
  // Locks serialize writers; do not silently overwrite on older browsers.
  if(typeof navigator==="undefined"||!navigator.locks?.request)throw new ApiError("STORAGE_UNAVAILABLE",503);
  return navigator.locks.request(lockName,operation);
}}
export function createLocalProgressStore(options:LocalProgressOptions={}):LocalProgressStore {
  const storage=options.storage,getStorage:()=>ProgressStorage=typeof storage==="function"?storage:()=>storage||browserStorage();
  const basePath=options.basePath||"/",key=PAGES_PROGRESS_KEY+(basePath==="/"?"":":"+basePath);
  const now=options.now||Date.now,exclusive=options.runExclusive||browserExclusive(key+":write"),mutationId=options.mutationId||(()=>crypto.randomUUID());
  function load():SavedData {
    try {
      const raw=getStorage().getItem(key);
      if(raw===null)return {version:1,items:Object.create(null) as Record<string,StoredProgress>};
      const data:unknown=JSON.parse(raw);
      if(!object(data)||data.version!==1||!object(data.items))throw new Error("Invalid progress document");
      const items:Record<string,StoredProgress>=Object.create(null);
      for(const [id,row] of Object.entries(data.items)){
        if(!validRow(row,id))throw new Error("Invalid progress record");
        items[id]=row;
      }
      return {version:1,items};
    }catch {throw new ApiError("STORAGE_UNAVAILABLE",503)}
  }
  return {
    read:()=>Object.values(load().items).map(asPublic),
    write:async(questionId,raw)=>{
      if(!QUESTION_ID.test(questionId))throw new ApiError("NOT_FOUND",404);
      const input=parseProgressWrite(raw);
      return exclusive(()=>{
        // Always read after acquiring the origin-wide lock, including writes
        // made in another tab since this UI loaded its previous revision.
        const data=load(),current=data.items[questionId];
        if(current?.lastMutationId===input.mutationId)return asPublic(current);
        if((current?.revision||0)!==input.expectedRevision)throw new ApiError("REVISION_CONFLICT",409);
        const time=now();
        if(!Number.isFinite(time))throw new ApiError("STORAGE_UNAVAILABLE",503);
        const reviewed=input.status!==undefined,status=input.status??current?.status??"unseen";
        const revision=(current?.revision||0)+1,reviewCount=(current?.reviewCount||0)+(reviewed?1:0);
        if(!Number.isSafeInteger(revision)||!Number.isSafeInteger(reviewCount))throw new ApiError("INVALID_INPUT",400);
        const saved:StoredProgress={questionId,favorite:input.favorite??current?.favorite??false,note:input.note??current?.note??"",status,reviewCount,lastReviewedAt:reviewed?new Date(time).toISOString():current?.lastReviewedAt??null,nextReviewAt:reviewed?new Date(time+(status==="mastered"?7:1)*86400000).toISOString():current?.nextReviewAt??null,updatedAt:new Date(time).toISOString(),revision,lastMutationId:input.mutationId};
        data.items[questionId]=saved;
        try {getStorage().setItem(key,JSON.stringify(data))}catch {throw new ApiError("STORAGE_UNAVAILABLE",503)}
        return asPublic(saved);
      });
    },
    merge:async(rawItems)=>{
      const incoming=rawItems.map(parseProgressRecord);
      return exclusive(()=>{
        const data=load();let imported=0;
        for(const record of incoming){
          const current=data.items[record.questionId];
          if(current&&record.updatedAt<=current.updatedAt)continue;
          const revision=Math.max(current?.revision||0,record.revision)+1;
          if(!Number.isSafeInteger(revision))throw new ApiError("INVALID_INPUT",400);
          data.items[record.questionId]={...record,revision,lastMutationId:mutationId()};imported++;
        }
        if(imported)try{getStorage().setItem(key,JSON.stringify(data))}catch{throw new ApiError("STORAGE_UNAVAILABLE",503)}
        return imported;
      });
    }
  };
}
