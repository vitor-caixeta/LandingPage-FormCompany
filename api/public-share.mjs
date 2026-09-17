import { createHash } from "node:crypto";

export default async function handler(request,response){
  if(request.method!=="GET")return response.status(405).json({error:"Método não permitido."});
  const token=String(request.query?.token||"");
  if(token.length<32)return response.status(404).json({error:"Compartilhamento não encontrado."});
  const base=process.env.VITE_SUPABASE_URL;const secret=process.env.SUPABASE_SECRET_KEY;
  if(!base||!secret)return response.status(500).json({error:"Serviço indisponível."});
  const auth={apikey:secret,Authorization:`Bearer ${secret}`};
  const hash=createHash("sha256").update(token).digest("hex");
  const shareResponse=await fetch(`${base}/rest/v1/share_links?select=id,title,allow_download,expires_at,revoked_at,client_id,project_id,clients(name,trade_name)&token_hash=eq.${hash}&limit=1`,{headers:auth});
  const shares=shareResponse.ok?await shareResponse.json():[];const share=shares[0];
  if(!share||share.revoked_at||(share.expires_at&&new Date(share.expires_at)<new Date()))return response.status(404).json({error:"Este compartilhamento não está mais disponível."});
  const query=share.project_id?`project_id=eq.${share.project_id}`:`client_id=eq.${share.client_id}`;
  const mediaResponse=await fetch(`${base}/rest/v1/media_assets?select=id,title,description,kind,source,published_url,storage_path,thumbnail_url,allow_download&${query}&order=sort_order.asc,created_at.desc`,{headers:auth});
  const media=mediaResponse.ok?await mediaResponse.json():[];
  for(const item of media){if(item.storage_path){const signed=await fetch(`${base}/storage/v1/object/sign/client-media/${item.storage_path}`,{method:"POST",headers:{...auth,"Content-Type":"application/json"},body:JSON.stringify({expiresIn:3600})});if(signed.ok){const data=await signed.json();item.signed_url=`${base}/storage/v1${data.signedURL}`}}}
  response.setHeader("Cache-Control","private, no-store");
  return response.status(200).json({title:share.title,client:share.clients?.trade_name||share.clients?.name,allow_download:share.allow_download,media});
}
