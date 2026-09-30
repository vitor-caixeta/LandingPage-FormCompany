import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { clientSessionNeedsRefresh, getClientSession, instagramEmbed, loadPortal, loginClient, refreshClientSession, saveClientSession, youtubeId, type ClientSession, type PortalClient, type PortalMedia, type PortalProject } from "./clientPortalStore";
import "./clientPortal.css";
import "./clientPortalOverrides.css";

type Tab="home"|"videos"|"photos"|"reports";
const number=(value:number)=>new Intl.NumberFormat("pt-BR",{notation:"compact",maximumFractionDigits:1}).format(value||0);
function Glyph({children}:{children:ReactNode}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>}
const glyphs={home:<><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,videos:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3Z"/></>,photos:<><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 15-4-4L6 20"/></>,reports:<><path d="M5 20V10m7 10V4m7 16v-7"/></>};

function Login({onLogin}:{onLogin:(session:ClientSession)=>void}){
  const [username,setUsername]=useState("");const [password,setPassword]=useState("");const [show,setShow]=useState(false);const [error,setError]=useState("");const [loading,setLoading]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setLoading(true);setError("");try{onLogin(await loginClient(username,password))}catch(reason){setError(reason instanceof Error?reason.message:"Não foi possível entrar.")}finally{setLoading(false)}}
  return <main className="portal-login"><div className="portal-orb one"/><div className="portal-orb two"/><section className="portal-login-card"><img src="/LogoForm.png" alt="Form Company"/><div><p>Portal do cliente</p><h1>Seu conteúdo,<br/><em>organizado.</em></h1><span>Acesse vídeos, fotos e resultados publicados pela Form.</span></div><form onSubmit={submit}><label><span>Usuário</span><input value={username} onChange={e=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g,""))} autoComplete="username" placeholder="seuusuario" required/></label><label><span>Senha</span><div><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••••••" required/><button type="button" onClick={()=>setShow(v=>!v)}>{show?"Ocultar":"Mostrar"}</button></div></label>{error&&<p className="portal-login-error" role="alert">{error}</p>}<button className="portal-primary" disabled={loading}>{loading?"Entrando…":"Entrar no portal"}<b>↗</b></button></form><small>Área privada · Form Company</small></section></main>
}

function VideoCard({item}:{item:PortalMedia}){const yt=youtubeId(item.published_url);const latest=item.media_metrics?.sort((a,b)=>b.captured_on.localeCompare(a.captured_on))[0];return <article className="portal-video-card"><div className="portal-video-media">{yt?<iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title={item.title} allowFullScreen/>:item.source==="instagram"?<iframe src={instagramEmbed(item.published_url)} title={item.title}/>:item.published_url?<video src={item.published_url} controls preload="metadata"/>:<div className="portal-media-placeholder"><Glyph>{glyphs.videos}</Glyph></div>}</div><div className="portal-card-copy"><span>{item.source}</span><h3>{item.title}</h3>{latest&&<div className="portal-mini-metrics"><b>{number(latest.views)} <small>views</small></b><b>{number(latest.reach)} <small>alcance</small></b></div>}{item.allow_download&&item.storage_path&&<a href={item.storage_path} download>Baixar original ↓</a>}</div></article>}

function PhotoGrid({items}:{items:PortalMedia[]}){return <div className="portal-photo-grid">{items.map((item,index)=><button key={item.id} className={index%7===0?"feature":""} aria-label={`Abrir ${item.title}`}><img src={item.published_url||item.thumbnail_url} alt={item.title} loading="lazy"/><span>{item.title}</span></button>)}</div>}

function Portal({session,onExit}:{session:ClientSession;onExit:()=>void}){
  const [tab,setTab]=useState<Tab>("home");const [client,setClient]=useState<PortalClient|null>(null);const [projects,setProjects]=useState<PortalProject[]>([]);const [media,setMedia]=useState<PortalMedia[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  useEffect(()=>{let active=true;setLoading(true);setError("");void loadPortal(session.access_token).then(data=>{if(!active)return;setClient(data.client);setProjects(data.projects);setMedia(data.media)}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:"Falha ao carregar.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[session.access_token]);
  const videos=media.filter(x=>x.kind==="video"),photos=media.filter(x=>x.kind==="photo");
  const totals=useMemo(()=>media.flatMap(x=>x.media_metrics||[]).reduce((sum,row)=>({views:sum.views+row.views,reach:sum.reach+row.reach,likes:sum.likes+row.likes}),{views:0,reach:0,likes:0}),[media]);
  if(loading)return <main className="portal-loading"><img src="/LogoForm.png" alt=""/><span>Preparando seu portal…</span></main>;
  if(error)return <main className="portal-loading error"><h1>Não foi possível abrir o portal</h1><p>{error}</p><button onClick={onExit}>Voltar ao login</button></main>;
  const recurring=client?.kind==="recurring";
  return <main className="client-portal" style={{"--client-accent":client?.accent_color||"#b50000"} as React.CSSProperties}>
    <aside className="portal-sidebar"><img src="/LogoForm.png" alt="Form Company"/><nav>{(["home","videos","photos",...(recurring?["reports"]:[])] as Tab[]).map(id=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Glyph>{glyphs[id]}</Glyph><span>{{home:"Início",videos:"Vídeos",photos:"Fotos",reports:"Relatórios"}[id]}</span></button>)}</nav><button className="portal-exit" onClick={onExit}>Sair</button></aside>
    <section className="portal-content"><header className="portal-top"><div><p>Área do cliente</p><h1>{client?.trade_name||client?.name}</h1></div></header>
      {tab==="home"&&<><section className="portal-hero"><div><span>Seu acervo Form</span><h2>Histórias que<br/><em>continuam em movimento.</em></h2><p>{videos.length} vídeos · {photos.length} fotos · {projects.length} projetos</p></div></section>{recurring&&<section className="portal-kpis"><article><span>Visualizações</span><strong>{number(totals.views)}</strong><small>Conteúdos publicados</small></article><article><span>Alcance</span><strong>{number(totals.reach)}</strong><small>Pessoas alcançadas</small></article><article><span>Interações</span><strong>{number(totals.likes)}</strong><small>Curtidas registradas</small></article></section>}<section className="portal-section"><header><div><span>Últimas entregas</span><h2>Conteúdos recentes</h2></div><button onClick={()=>setTab("videos")}>Ver todos →</button></header><div className="portal-video-grid">{videos.slice(0,3).map(item=><VideoCard key={item.id} item={item}/>)}</div>{!videos.length&&<Empty label="Nenhum vídeo publicado ainda."/>}</section></>}
      {tab==="videos"&&<section className="portal-section page"><header><div><span>Acervo</span><h2>Vídeos</h2></div></header><div className="portal-video-grid">{videos.map(item=><VideoCard key={item.id} item={item}/>)}</div>{!videos.length&&<Empty label="Os vídeos aparecerão aqui quando forem publicados."/>}</section>}
      {tab==="photos"&&<section className="portal-section page"><header><div><span>Galeria</span><h2>Fotos</h2></div></header>{photos.length?<PhotoGrid items={photos}/>:<Empty label="As fotos aparecerão aqui quando forem publicadas."/>}</section>}
      {tab==="reports"&&recurring&&<section className="portal-section page"><header><div><span>Desempenho</span><h2>Relatórios</h2></div></header><div className="portal-report-hero"><div><span>Alcance total</span><strong>{number(totals.reach)}</strong><p>Resultados cadastrados pela equipe Form.</p></div><div className="portal-bars">{videos.slice(0,6).map((item,index)=>{const value=item.media_metrics?.at(-1)?.views||0;const max=Math.max(...videos.map(x=>x.media_metrics?.at(-1)?.views||0),1);return <i key={item.id} style={{height:`${Math.max(8,value/max*100)}%`,"--delay":`${index*.05}s`} as React.CSSProperties}/>})}</div></div></section>}
    </section><nav className="portal-tabbar">{(["home","videos","photos",...(recurring?["reports"]:[])] as Tab[]).map(id=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}><Glyph>{glyphs[id]}</Glyph><span>{{home:"Início",videos:"Vídeos",photos:"Fotos",reports:"Relatórios"}[id]}</span></button>)}</nav>
  </main>
}
function Empty({label}:{label:string}){return <div className="portal-empty"><span>✦</span><p>{label}</p></div>}
export default function ClientPortal(){
  const [session,setSession]=useState<ClientSession|null|undefined>(undefined);

  useEffect(()=>{
    let active=true;
    const syncSession=()=>{if(active)setSession(getClientSession())};
    window.addEventListener("storage",syncSession);
    const stored=getClientSession();
    if(!stored){setSession(null);return()=>{active=false;window.removeEventListener("storage",syncSession)}}
    if(!clientSessionNeedsRefresh(stored)){setSession(stored)}
    else void refreshClientSession(stored).then(refreshed=>{if(active)setSession(refreshed)}).catch(()=>{if(active)setSession(stored)});
    return()=>{active=false;window.removeEventListener("storage",syncSession)};
  },[]);

  useEffect(()=>{
    if(!session)return;
    let active=true;
    let refreshing=false;
    const signOut=()=>{saveClientSession(null);if(active)setSession(null)};
    const remaining=session.persistent_until-Date.now();
    if(remaining<=0){signOut();return}
    const expiryTimer=window.setTimeout(signOut,remaining);
    const renewIfNeeded=async()=>{
      if(!active||refreshing||!clientSessionNeedsRefresh(session))return;
      refreshing=true;
      try{const refreshed=await refreshClientSession(session);if(active)setSession(refreshed)}
      catch(reason){console.error("Falha ao renovar a sessão do cliente",reason)}
      finally{refreshing=false}
    };
    void renewIfNeeded();
    const refreshTimer=window.setInterval(()=>{void renewIfNeeded()},30_000);
    return()=>{active=false;window.clearTimeout(expiryTimer);window.clearInterval(refreshTimer)};
  },[session?.access_token,session?.expires_at,session?.persistent_until,session?.refresh_token]);

  const exit=()=>{saveClientSession(null);setSession(null)};
  if(session===undefined)return <main className="portal-loading"><img src="/LogoForm.png" alt=""/><span>Restaurando sua sessão…</span></main>;
  return session?<Portal session={session} onExit={exit}/>:<Login onLogin={setSession}/>;
}
