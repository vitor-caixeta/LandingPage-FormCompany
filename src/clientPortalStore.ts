export type ClientSession = { access_token: string; refresh_token?: string; expires_at?: number; persistent_until: number };
export type PortalClient = { id:string; name:string; trade_name?:string; kind:"recurring"|"one_off"; accent_color:string; cover_url?:string };
export type PortalProject = { id:string; client_id:string; title:string; description?:string; event_date?:string; cover_url?:string };
export type PortalMedia = { id:string; client_id:string; project_id?:string; kind:"video"|"photo"; source:"instagram"|"youtube"|"upload"|"external"; title:string; description?:string; published_url?:string; storage_path?:string; thumbnail_url?:string; published_at?:string; allow_download:boolean; media_metrics?:PortalMetric[] };
export type PortalMetric = { captured_on:string; views:number; reach:number; likes:number; comments:number; shares:number; saves:number };

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://xmjwdflvcusooinovgrg.supabase.co";
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || "sb_publishable_3WQ418LpynVy6Olq5zWJ7w_ehTHoF9l";
const sessionKey = "form_client_session";
const sessionDuration = 24 * 60 * 60 * 1000;
const refreshMargin = 60 * 1000;

const readStoredSession = () => {
  try { return localStorage.getItem(sessionKey) || sessionStorage.getItem(sessionKey); }
  catch { try { return sessionStorage.getItem(sessionKey); } catch { return null; } }
};

export const saveClientSession = (session:ClientSession|null) => {
  if (!session) {
    try { localStorage.removeItem(sessionKey); } catch { /* armazenamento indisponível */ }
    try { sessionStorage.removeItem(sessionKey); } catch { /* armazenamento indisponível */ }
    return;
  }
  const serialized = JSON.stringify(session);
  try {
    localStorage.setItem(sessionKey, serialized);
    sessionStorage.removeItem(sessionKey);
  } catch {
    try { sessionStorage.setItem(sessionKey, serialized); } catch { /* armazenamento indisponível */ }
  }
};

export const getClientSession = ():ClientSession|null => {
  try {
    const stored = readStoredSession();
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<ClientSession>;
    if (!parsed.access_token) throw new Error("Sessão inválida");
    const session: ClientSession = {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      expires_at: parsed.expires_at,
      persistent_until: parsed.persistent_until || Date.now() + sessionDuration,
    };
    if (session.persistent_until <= Date.now()) {
      saveClientSession(null);
      return null;
    }
    if (!parsed.persistent_until) saveClientSession(session);
    return session;
  } catch {
    saveClientSession(null);
    return null;
  }
};

export const clientSessionNeedsRefresh = (session:ClientSession) => !session.expires_at || session.expires_at * 1000 <= Date.now() + refreshMargin;

let refreshPromise:Promise<ClientSession>|null = null;
export function refreshClientSession(session:ClientSession):Promise<ClientSession> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    if (session.persistent_until <= Date.now()) throw new Error("Sua sessão de 24 horas terminou.");
    if (!session.refresh_token) throw new Error("Não foi possível renovar esta sessão.");
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method:"POST",
      headers:{apikey:supabaseKey,"Content-Type":"application/json"},
      body:JSON.stringify({refresh_token:session.refresh_token}),
    });
    const data = await response.json().catch(()=>({})) as Omit<ClientSession,"persistent_until"> & {error?:string;error_description?:string;message?:string};
    if(!response.ok) throw new Error(data.error_description || data.error || data.message || "Não foi possível renovar a sessão.");
    const refreshed: ClientSession = {
      access_token:data.access_token,
      refresh_token:data.refresh_token || session.refresh_token,
      expires_at:data.expires_at,
      persistent_until:session.persistent_until,
    };
    const current=getClientSession();
    if(current?.persistent_until===session.persistent_until)saveClientSession(refreshed);
    return refreshed;
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function loginClient(username:string,password:string):Promise<ClientSession> {
  const normalized=username.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"");
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method:"POST", headers:{apikey:supabaseKey,"Content-Type":"application/json"}, body:JSON.stringify({email:`${normalized}@clientes.form.internal`,password}) });
  const data = await response.json().catch(()=>({})) as Omit<ClientSession,"persistent_until"> & {error?:string};
  if(!response.ok) throw new Error(data.error || "Usuário ou senha inválidos.");
  const session: ClientSession = {...data,persistent_until:Date.now()+sessionDuration};
  saveClientSession(session);
  return session;
}

const headers=(token:string)=>({apikey:supabaseKey,Authorization:`Bearer ${token}`});
async function select<T>(path:string,token:string):Promise<T>{
  const response=await fetch(`${supabaseUrl}/rest/v1/${path}`,{headers:headers(token)});
  if(!response.ok) throw new Error(response.status===401?"Sua sessão expirou. Entre novamente.":"Não foi possível carregar seu conteúdo.");
  return response.json() as Promise<T>;
}

export async function loadPortal(token:string){
  const [clients,projects,media]=await Promise.all([
    select<PortalClient[]>("clients?select=id,name,trade_name,kind,accent_color,cover_url&limit=1",token),
    select<PortalProject[]>("projects?select=*&status=eq.published&order=event_date.desc.nullslast,created_at.desc",token),
    select<PortalMedia[]>("media_assets?select=*,media_metrics(*)&order=sort_order.asc,created_at.desc",token),
  ]);
  if(!clients[0]) throw new Error("Este acesso está inativo ou não possui um cliente vinculado.");
  return {client:clients[0],projects,media};
}

export function youtubeId(url?:string){return url?.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1]}
export function instagramEmbed(url?:string){return url ? `${url.replace(/\?.*$/,"").replace(/\/$/,"")}/embed` : ""}
