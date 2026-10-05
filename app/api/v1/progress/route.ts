import {getChatGPTUser} from "@/app/chatgpt-auth";import {readProgress} from "@/lib/progress";import {json,error,storageError} from "@/lib/http";
export async function GET(){const user=await getChatGPTUser();if(!user)return error("UNAUTHENTICATED",401);try{return json({items:await readProgress(user.userId)})}catch(e){return storageError(e)}}

