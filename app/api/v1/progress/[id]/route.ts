import {z} from "zod";import {getChatGPTUser} from "@/app/chatgpt-auth";import {writeProgress} from "@/lib/progress";import {findQuestion} from "@/lib/bank";import {json,error,storageError} from "@/lib/http";
const schema=z.object({expectedRevision:z.number().int().nonnegative(),mutationId:z.string().uuid(),favorite:z.boolean().optional(),note:z.string().max(12000).optional(),status:z.enum(["unseen","learning","mastered"]).optional()}).strict().refine(x=>x.favorite!==undefined||x.note!==undefined||x.status!==undefined);
export async function PUT(request:Request,context:{params:Promise<{id:string}>}){
const user=await getChatGPTUser();if(!user)return error("UNAUTHENTICATED",401);
const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return error("FORBIDDEN",403);
const {id}=await context.params;if(!findQuestion(id))return error("NOT_FOUND",404);
if(Number(request.headers.get("content-length"))>52000)return error("INVALID_INPUT",400);
const data=schema.safeParse(await request.json().catch(()=>null));if(!data.success)return error("INVALID_INPUT",400);
try{const saved=await writeProgress(user.userId,id,data.data);return saved?json(saved):error("REVISION_CONFLICT",409)}catch(e){return storageError(e)}
}

