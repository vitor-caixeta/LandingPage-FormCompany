import { readFileSync } from "node:fs";

const [username,password,clientSearch]=process.argv.slice(2);
if(!username||!password||!clientSearch)throw new Error("Uso: node scripts/create-client-login.mjs usuario senha cliente");
if(password.length<12)throw new Error("A senha precisa ter pelo menos 12 caracteres.");
const env=Object.fromEntries(readFileSync(".env.local","utf8").split(/\r?\n/).filter(line=>line.includes("=")).map(line=>{const i=line.indexOf("=");return[line.slice(0,i),line.slice(i+1)]}));
const base=env.VITE_SUPABASE_URL;const secret=env.SUPABASE_SECRET_KEY;const headers={apikey:secret,Authorization:`Bearer ${secret}`,"Content-Type":"application/json"};
const clientsResponse=await fetch(`${base}/rest/v1/clients?select=id,name,trade_name,status&or=(name.ilike.*${encodeURIComponent(clientSearch)}*,trade_name.ilike.*${encodeURIComponent(clientSearch)}*)&limit=1`,{headers});
const clients=await clientsResponse.json();if(!clientsResponse.ok||!clients[0])throw new Error("Cliente não encontrado.");
const normalized=username.toLowerCase().replace(/[^a-z0-9._-]/g,"");const email=`${normalized}@clientes.form.internal`;
const usersResponse=await fetch(`${base}/auth/v1/admin/users?per_page=100`,{headers});const users=(await usersResponse.json()).users||[];let user=users.find(item=>item.email===email);
if(user){const update=await fetch(`${base}/auth/v1/admin/users/${user.id}`,{method:"PUT",headers,body:JSON.stringify({password,email_confirm:true,app_metadata:{role:"client"},user_metadata:{display_username:normalized}})});if(!update.ok)throw new Error(await update.text());user=await update.json()}else{const create=await fetch(`${base}/auth/v1/admin/users`,{method:"POST",headers,body:JSON.stringify({email,password,email_confirm:true,app_metadata:{role:"client"},user_metadata:{display_username:normalized}})});if(!create.ok)throw new Error(await create.text());user=await create.json()}
const link=await fetch(`${base}/rest/v1/client_access?on_conflict=user_id`,{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:user.id,client_id:clients[0].id,username:normalized})});if(!link.ok)throw new Error(await link.text());
console.log(JSON.stringify({username:normalized,client:clients[0].trade_name||clients[0].name,status:"ready"}));
