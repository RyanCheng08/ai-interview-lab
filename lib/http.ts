export function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})}
export function error(code:string,status:number){return json({error:{code}},status)}
export function storageError(e:unknown){console.error("Interview Lab storage:",e);return error("STORAGE_UNAVAILABLE",503)}

