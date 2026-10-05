import {getRawDb} from "@/db";
import type {StudyProgress,ProgressWrite,Status} from "./contracts";
type Row={question_id:string;favorite:number;note:string;status:Status;review_count:number;last_reviewed_at:string|null;next_review_at:string|null;updated_at:string;revision:number;last_mutation_id:string};
function convert(r:Row):StudyProgress{return {questionId:r.question_id,favorite:!!r.favorite,note:r.note,status:r.status,reviewCount:r.review_count,lastReviewedAt:r.last_reviewed_at,nextReviewAt:r.next_review_at,updatedAt:r.updated_at,revision:r.revision}}
export async function readProgress(userId:string){const result=await getRawDb().prepare("SELECT * FROM study_progress WHERE user_id = ?").bind(userId).all<Row>();return result.results.map(convert)}
export async function writeProgress(userId:string,id:string,input:ProgressWrite){
const db=getRawDb();const current=await db.prepare("SELECT * FROM study_progress WHERE user_id = ? AND question_id = ?").bind(userId,id).first<Row>();
if(current?.last_mutation_id===input.mutationId)return convert(current);
if((current?.revision||0)!==input.expectedRevision)return null;
const now=new Date().toISOString(),status=input.status??current?.status??"unseen";
const reviewed=input.status!==undefined;const count=(current?.review_count||0)+(reviewed?1:0);
const next=reviewed?new Date(Date.now()+(status==="mastered"?7:1)*86400000).toISOString():current?.next_review_at??null;
const written=await db.prepare(`INSERT INTO study_progress (user_id,question_id,favorite,note,status,review_count,last_reviewed_at,next_review_at,updated_at,revision,last_mutation_id)
SELECT ?,?,?,?,?,?,?,?,?,1,? WHERE ?=0
ON CONFLICT(user_id,question_id) DO UPDATE SET favorite=?,note=?,status=?,review_count=?,last_reviewed_at=?,next_review_at=?,updated_at=?,revision=study_progress.revision+1,last_mutation_id=? WHERE study_progress.revision=? RETURNING *`)
.bind(userId,id,input.favorite===undefined?(current?.favorite||0):Number(input.favorite),input.note??current?.note??"",status,count,reviewed?now:current?.last_reviewed_at??null,next,now,input.mutationId,current?0:input.expectedRevision,
input.favorite===undefined?(current?.favorite||0):Number(input.favorite),input.note??current?.note??"",status,count,reviewed?now:current?.last_reviewed_at??null,next,now,input.mutationId,input.expectedRevision).first<Row>();
if(written)return convert(written);
const saved=await db.prepare("SELECT * FROM study_progress WHERE user_id = ? AND question_id = ?").bind(userId,id).first<Row>();
return saved?.last_mutation_id===input.mutationId?convert(saved):null;
}

