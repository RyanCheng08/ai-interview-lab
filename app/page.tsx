import InterviewLab from "@/components/interview-lab";
import {getChatGPTUser} from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Page(){const user=await getChatGPTUser();return <InterviewLab user={user?{displayName:user.displayName}:null}/>}
