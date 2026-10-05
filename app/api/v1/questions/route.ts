import {searchBank,summary} from "@/lib/bank";import {json,error,storageError} from "@/lib/http";import {getChatGPTUser} from "@/app/chatgpt-auth";import {readProgress} from "@/lib/progress";
export async function GET(request:Request){
const p=new URL(request.url).searchParams,q=(p.get("q")||"").slice(0,160),source=p.get("sourceId")||"",chapter=p.get("chapterId")||"",filter=p.get("filter")||"all";
const page=Math.max(1,Math.min(10000,Math.floor(Number(p.get("page")))||1)),pageSize=40;
let matches=searchBank(q,source,chapter);
if(filter!=="all"){if(!["favorite","due","mastered","learning","unseen"].includes(filter))return error("INVALID_FILTER",400);const user=await getChatGPTUser();if(!user)return error("UNAUTHENTICATED",401);try{const saved=new Map((await readProgress(user.userId)).map(x=>[x.questionId,x]));matches=matches.filter(x=>{const s=saved.get(x.id);if(filter==="favorite")return s?.favorite;if(filter==="due")return !!s?.nextReviewAt&&s.nextReviewAt<=new Date().toISOString();return (s?.status||"unseen")===filter})}catch(e){return storageError(e)}}
if(p.get("random")==="1"){const available=matches.filter(q=>q.id!==p.get("exclude"));const item=available.length?available[Math.floor(Math.random()*available.length)]:matches[0];return json({items:item?[summary(item)]:[],total:matches.length,page:1,pageSize:1})}
return json({items:matches.slice((page-1)*pageSize,page*pageSize).map(summary),total:matches.length,page,pageSize});
}

