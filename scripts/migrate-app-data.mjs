import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => line.includes("=")).map((line) => { const i=line.indexOf("="); return [line.slice(0,i),line.slice(i+1)]; }));
const base=env.VITE_SUPABASE_URL; const secret=env.SUPABASE_SECRET_KEY; const adminId="1024da4a-869d-4fbc-bcee-bde428171ad6";
const headers={apikey:secret,Authorization:`Bearer ${secret}`,"Content-Type":"application/json"};

const userResponse=await fetch(`${base}/auth/v1/admin/users/${adminId}`,{headers});
if(!userResponse.ok) throw new Error(`Falha ao ler usuário administrador: ${await userResponse.text()}`);
const user=await userResponse.json();
const legacy=user.user_metadata?.form_data||{};
const rows=["clients","accounts","entries"].map((section)=>({section,value:Array.isArray(legacy[section])?legacy[section]:[]}));

const insert=await fetch(`${base}/rest/v1/app_data?on_conflict=section`,{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(rows)});
if(!insert.ok) throw new Error(`Falha ao migrar dados: ${await insert.text()}`);
const saved=await insert.json();
const metadata={...(user.user_metadata||{})}; delete metadata.form_data;
const cleanup=await fetch(`${base}/auth/v1/admin/users/${adminId}`,{method:"PUT",headers,body:JSON.stringify({user_metadata:metadata})});
if(!cleanup.ok) throw new Error(`Dados migrados, mas falhou ao limpar o token antigo: ${await cleanup.text()}`);
console.log(JSON.stringify({migrated:Object.fromEntries(saved.map((row)=>[row.section,row.value.length])),legacyMetadataRemoved:true}));
