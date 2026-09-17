import { readFileSync } from "node:fs";

const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(line=>line.includes("=")).map(line=>{const i=line.indexOf("=");return[line.slice(0,i),line.slice(i+1)]}));
const base=env.VITE_SUPABASE_URL;const secret=env.SUPABASE_SECRET_KEY;const adminId="1024da4a-869d-4fbc-bcee-bde428171ad6";
const headers={apikey:secret,Authorization:`Bearer ${secret}`,"Content-Type":"application/json"};
const userResponse=await fetch(`${base}/auth/v1/admin/users/${adminId}`,{headers});
if(!userResponse.ok)throw new Error(`Falha ao ler cadastros existentes: ${await userResponse.text()}`);
const user=await userResponse.json();const legacy=user.user_metadata?.form_data?.clients||[];
const rows=legacy.map(client=>({id:client.id,name:client.name,trade_name:client.tradeName||null,document:client.document||null,kind:"recurring",status:client.status==="Inativo"?"inactive":"active"}));
const result=await fetch(`${base}/rest/v1/clients?on_conflict=id`,{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(rows)});
if(!result.ok)throw new Error(`Aplique primeiro a migração SQL: ${await result.text()}`);
console.log(JSON.stringify({migrated:(await result.json()).length,kind:"recurring"}));
