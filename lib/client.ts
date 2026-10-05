import {ApiError,type ApiTransport} from "./contracts";
async function request<T>(path:string,init:RequestInit):Promise<T>{
const response=await fetch(path,{...init,credentials:"same-origin",cache:"no-store"});
const body:unknown=await response.json().catch(()=>null);
if(!response.ok)throw new ApiError((body as {error?:{code?:string}}|null)?.error?.code||"UNAVAILABLE",response.status);
return body as T;
}
export const api:ApiTransport={get:(path,signal)=>request(path,{signal}),put:(path,body)=>request(path,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})};

