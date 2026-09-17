const normalize=(value="")=>value.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"");
const authHeaders=(secret)=>({apikey:secret,Authorization:`Bearer ${secret}`,"Content-Type":"application/json"});

export default async function handler(request,response){
  if(request.method!=="POST")return response.status(405).json({error:"Método não permitido."});
  const base=process.env.VITE_SUPABASE_URL;const secret=process.env.SUPABASE_SECRET_KEY;const bearer=String(request.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!base||!secret||!bearer)return response.status(401).json({error:"Não autorizado."});
  const verify=await fetch(`${base}/auth/v1/user`,{headers:{apikey:secret,Authorization:`Bearer ${bearer}`}});const admin=verify.ok?await verify.json():null;
  if(admin?.email!=="admin@formcompany.com")return response.status(403).json({error:"Apenas o administrador pode criar acessos."});
  const username=normalize(request.body?.username);const password=String(request.body?.password||"");const clientId=String(request.body?.client_id||"");
  if(username.length<3||password.length<12||!clientId)return response.status(400).json({error:"Informe usuário, cliente e uma senha com pelo menos 12 caracteres."});
  const email=`${username}@clientes.form.internal`;
  const created=await fetch(`${base}/auth/v1/admin/users`,{method:"POST",headers:authHeaders(secret),body:JSON.stringify({email,password,email_confirm:true,app_metadata:{role:"client"},user_metadata:{display_username:username}})});
  const user=await created.json();if(!created.ok)return response.status(400).json({error:user.message||"Não foi possível criar o acesso."});
  const link=await fetch(`${base}/rest/v1/client_access`,{method:"POST",headers:{...authHeaders(secret),Prefer:"return=minimal"},body:JSON.stringify({user_id:user.id,client_id:clientId,username})});
  if(!link.ok){await fetch(`${base}/auth/v1/admin/users/${user.id}`,{method:"DELETE",headers:authHeaders(secret)});return response.status(400).json({error:"Não foi possível vincular o acesso ao cliente."})}
  response.setHeader("Cache-Control","no-store");return response.status(201).json({username});
}
