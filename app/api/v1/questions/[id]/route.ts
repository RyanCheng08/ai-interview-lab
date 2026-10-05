import {findQuestion,getAnnotations} from "@/lib/bank";import {json,error} from "@/lib/http";
export async function GET(_request:Request,context:{params:Promise<{id:string}>}){const {id}=await context.params;const q=findQuestion(id);return q?json({...q,contentLanguage:"zh-CN",annotations:getAnnotations(id)}):error("NOT_FOUND",404)}

