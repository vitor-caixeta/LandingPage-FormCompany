import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import FinanceDashboard from "./FinanceDashboard";
import { readCloudData, writeCloudSection } from "./cloudStore";

type Session = { access_token: string; user: { email?: string } };
type Client = {
  id: string;
  document: string;
  name: string;
  tradeName?: string;
  contractValue: number;
  videoQuantity: number;
  paymentDay: string;
  paymentDate?: string;
  contractName?: string;
  status: "Ativo" | "Pendente";
};

const sessionKey = "form-admin-session";
const clientsKey = "form-admin-clients";
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  || "https://xmjwdflvcusooinovgrg.supabase.co";
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || "sb_publishable_3WQ418LpynVy6Olq5zWJ7w_ehTHoF9l";

const onlyDigits = (value: string) => value.replace(/\D/g, "").slice(0, 14);
const formatDocument = (value: string) => {
  const digits = onlyDigits(value);
  if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};
const formatMoney = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const formatMoneyInput = (value: string) => {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) && value ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number) : "";
};
const parseMoneyInput = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));
const getPaymentDay = (client: Client) => client.paymentDay || client.paymentDate?.split("-")[2] || "";
const formatPaymentDay = (client: Client) => getPaymentDay(client) ? `Dia ${Number(getPaymentDay(client))}` : "—";

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;
}

function FormMark() {
  return <a className="admin-brand" href="/" aria-label="Voltar para o site da Form"><img src="/LogoForm.png" alt="Form Company" /></a>;
}

function ClientModal({ onClose, onSave, client }: { onClose: () => void; onSave: (client: Client) => void; client?: Client }) {
  const [document, setDocument] = useState(client?.document || "");
  const [name, setName] = useState(client?.name || "");
  const [tradeName, setTradeName] = useState(client?.tradeName || "");
  const [contractValue, setContractValue] = useState(client ? formatMoneyInput(String(client.contractValue).replace(".", ",")) : "");
  const [videoQuantity, setVideoQuantity] = useState(String(client?.videoQuantity || ""));
  const [paymentDay, setPaymentDay] = useState(client ? getPaymentDay(client) : "");
  const [contract, setContract] = useState<File | null>(null);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const digits = onlyDigits(document);
  const isCnpj = digits.length > 11;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function lookupCnpj() {
    if (digits.length !== 14) return;
    setLookupStatus("loading");
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!response.ok) throw new Error();
      const data = await response.json() as { razao_social?: string; nome_fantasia?: string };
      setName(data.razao_social || data.nome_fantasia || "");
      setTradeName(data.nome_fantasia || "");
      setLookupStatus("success");
    } catch { setLookupStatus("error"); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      id: client?.id || crypto.randomUUID(), document: digits, name, tradeName,
      contractValue: parseMoneyInput(contractValue), videoQuantity: Number(videoQuantity), paymentDay,
      contractName: contract?.name || client?.contractName, status: client?.status || "Ativo",
    });
  }

  return <div className="client-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="client-modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title">
      <header className="client-modal-header"><div><p className="dashboard-kicker">{client ? "Editar cadastro" : "Novo cadastro"}</p><h2 id="new-client-title">{client ? "Editar cliente" : "Adicionar cliente"}</h2><p>Preencha os dados comerciais e anexe o contrato.</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">×</button></header>
      <form className="client-form" onSubmit={submit}>
        <label className="dashboard-field full"><span>CPF ou CNPJ</span><div className="document-input"><input value={formatDocument(document)} onChange={(event) => { setDocument(event.target.value); setLookupStatus("idle"); }} onBlur={lookupCnpj} inputMode="numeric" placeholder="00.000.000/0000-00" required /><span className={`lookup-status ${lookupStatus}`}>{lookupStatus === "loading" ? "Consultando..." : lookupStatus === "success" ? "Dados encontrados" : lookupStatus === "error" ? "Não encontrado" : isCnpj ? "CNPJ" : "CPF"}</span></div></label>
        <label className="dashboard-field full"><span>Nome {isCnpj ? "ou razão social" : "completo"}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do cliente" required /></label>
        {isCnpj && <label className="dashboard-field full"><span>Nome fantasia</span><input value={tradeName} onChange={(event) => setTradeName(event.target.value)} placeholder="Nome fantasia" /></label>}
        <label className="dashboard-field"><span>Valor do contrato</span><div className="money-input"><b>R$</b><input value={contractValue} onChange={(event) => setContractValue(event.target.value.replace(/[^\d,.]/g, ""))} onBlur={() => setContractValue(formatMoneyInput(contractValue))} inputMode="decimal" placeholder="0,00" required /></div></label>
        <label className="dashboard-field"><span>Quantidade de vídeos</span><input type="number" min="1" value={videoQuantity} onChange={(event) => setVideoQuantity(event.target.value)} inputMode="numeric" placeholder="Ex.: 8" required /></label>
        <label className="dashboard-field"><span>Dia do pagamento</span><input type="number" min="1" max="31" value={paymentDay} onChange={(event) => setPaymentDay(event.target.value)} inputMode="numeric" placeholder="Ex.: 10" required /></label>
        <label className="contract-upload full"><input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setContract(event.target.files?.[0] || null)} /><Icon><path d="M12 16V4m0 0 4 4m-4-4L8 8"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></Icon><span><strong>{contract ? contract.name : "Enviar contrato"}</strong><small>PDF, DOC ou DOCX · até 10 MB</small></span></label>
        <div className="client-form-actions full"><button className="dashboard-button secondary" type="button" onClick={onClose}>Cancelar</button><button className="dashboard-button primary" type="submit">{client ? "Salvar alterações" : "Cadastrar cliente"} <span>↗</span></button></div>
      </form>
    </section>
  </div>;
}

function ClientDetails({ client, onClose, onEdit }: { client: Client; onClose: () => void; onEdit: () => void }) {
  return <div className="client-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="client-modal client-details" role="dialog" aria-modal="true"><header className="client-modal-header"><div><p className="dashboard-kicker">Detalhes do cliente</p><h2>{client.tradeName || client.name}</h2><p>{client.name}</p></div><button className="modal-close" type="button" onClick={onClose} aria-label="Fechar">×</button></header><div className="client-details-grid"><div><span>CPF/CNPJ</span><strong>{formatDocument(client.document)}</strong></div><div><span>Valor do contrato</span><strong>{formatMoney(client.contractValue)}</strong></div><div><span>Demanda mensal</span><strong>{client.videoQuantity || 0} vídeos</strong></div><div><span>Pagamento</span><strong>{formatPaymentDay(client)}</strong></div><div className="full"><span>Arquivo do contrato</span><strong>{client.contractName || "Nenhum arquivo anexado"}</strong></div></div><div className="client-details-actions"><button className="dashboard-button secondary" onClick={onClose}>Fechar</button><button className="dashboard-button primary" onClick={onEdit}>Editar cadastro</button></div></section></div>;
}

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [activeArea, setActiveArea] = useState<"clients" | "finance">("clients");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [clients, setClients] = useState<Client[]>(() => { try { return JSON.parse(localStorage.getItem(clientsKey) || "[]") as Client[]; } catch { return []; } });
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const visibleClients = useMemo(() => clients.filter((client) => `${client.name} ${client.tradeName} ${client.document}`.toLowerCase().includes(search.toLowerCase())), [clients, search]);
  const monthlyTotal = clients.reduce((sum, client) => sum + client.contractValue, 0);
  const monthlyVideos = clients.reduce((sum, client) => sum + (client.videoQuantity || 0), 0);

  useEffect(() => {
    let active = true;
    void readCloudData(session.access_token).then((cloud) => {
      if (!active) return;
      if (cloud.clients?.length) {
        const next = cloud.clients as Client[];
        setClients(next);
        localStorage.setItem(clientsKey, JSON.stringify(next));
      } else {
        const local = JSON.parse(localStorage.getItem(clientsKey) || "[]") as Client[];
        if (local.length) void writeCloudSection(session.access_token, "clients", local);
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [session.access_token]);

  function saveClient(client: Client) {
    const exists = clients.some((item) => item.id === client.id);
    const next = exists ? clients.map((item) => item.id === client.id ? client : item) : [client, ...clients];
    setClients(next); localStorage.setItem(clientsKey, JSON.stringify(next)); void writeCloudSection(session.access_token, "clients", next); setModalOpen(false); setEditingClient(null);
  }

  return <main className={`dashboard-page ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    <aside className="dashboard-sidebar"><button className="sidebar-collapse-button" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Abrir menu principal" : "Fechar menu principal"} title={sidebarCollapsed ? "Abrir menu" : "Fechar menu"}><Icon><path d={sidebarCollapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"}/></Icon></button><FormMark /><nav aria-label="Menu administrativo">
      <button className={`sidebar-link ${activeArea === "clients" ? "active" : ""}`} onClick={() => setActiveArea("clients")}><Icon><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></Icon><span>Clientes</span></button>
      <button className={`sidebar-link ${activeArea === "finance" ? "active" : ""}`} onClick={() => setActiveArea("finance")}><Icon><path d="M4 19V9m8 10V5m8 14v-7"/></Icon><span>Financeiro</span></button>
      <button className="sidebar-link"><Icon><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.09h-4V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.09v-4H3A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.09h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.37.36.7.6 1 .27.28.62.4 1 .4h.09v4H21c-.4 0-.73.13-1 .4-.27.28-.48.62-.6 1Z"/></Icon><span>Configurações</span></button>
    </nav><div className="sidebar-user"><span className="user-avatar">A</span><div><strong>Administrador</strong><small>{session.user.email}</small></div><button onClick={onSignOut} aria-label="Sair"><Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></Icon></button></div></aside>
    {activeArea === "clients" ? <section className="dashboard-content"><header className="dashboard-topbar"><div><p className="dashboard-kicker">Área administrativa</p><h1>Clientes</h1><p>Gerencie os contratos e pagamentos da Form.</p></div><button className="dashboard-button primary" onClick={() => setModalOpen(true)}><span className="plus">+</span> Novo cliente</button></header>
      <div className="dashboard-stats"><article><span>Clientes ativos</span><strong>{String(clients.length).padStart(2, "0")}</strong><small>Base atual</small></article><article><span>Valor em contratos</span><strong>{formatMoney(monthlyTotal)}</strong><small>Total cadastrado</small></article><article><span>Vídeos mensais</span><strong>{String(monthlyVideos).padStart(2, "0")}</strong><small>Demanda total</small></article><article><span>Próximo pagamento</span><strong>{clients.length ? formatPaymentDay([...clients].sort((a,b) => Number(getPaymentDay(a)) - Number(getPaymentDay(b)))[0]) : "—"}</strong><small>Agenda financeira</small></article></div>
      <section className="clients-card"><div className="clients-toolbar"><div><h2>Todos os clientes</h2><span>{clients.length} {clients.length === 1 ? "cadastro" : "cadastros"}</span></div><label className="client-search"><Icon><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></Icon><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente..." /></label></div>
        {visibleClients.length ? <div className="clients-table-wrap"><table className="clients-table"><thead><tr><th>Cliente</th><th>CPF/CNPJ</th><th>Contrato</th><th>Demanda</th><th>Pagamento</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visibleClients.map((client) => <tr key={client.id}><td><div className="client-cell"><span className="client-monogram">{client.name.charAt(0)}</span><div><strong>{client.tradeName || client.name}</strong>{client.tradeName && <small>{client.name}</small>}</div></div></td><td>{formatDocument(client.document)}</td><td><div className="contract-cell"><strong>{formatMoney(client.contractValue)}</strong>{client.contractName && <small>{client.contractName}</small>}</div></td><td><strong>{client.videoQuantity || 0} vídeos</strong></td><td>{formatPaymentDay(client)}</td><td><span className="status-pill"><i/> {client.status}</span></td><td><div className="row-actions"><button onClick={() => setSelectedClient(client)} aria-label={`Visualizar ${client.name}`} title="Visualizar"><Icon><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></Icon></button><button onClick={() => { setEditingClient(client); setModalOpen(true); }} aria-label={`Editar ${client.name}`} title="Editar"><Icon><path d="m4 16-1 5 5-1L19 9l-4-4L4 16Z"/><path d="m13 7 4 4"/></Icon></button></div></td></tr>)}</tbody></table></div> : <div className="clients-empty"><span><Icon><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6m3-3h-6"/></Icon></span><h3>{search ? "Nenhum cliente encontrado" : "Sua carteira começa aqui"}</h3><p>{search ? "Tente buscar por outro nome ou documento." : "Cadastre o primeiro cliente e acompanhe contratos e pagamentos em um só lugar."}</p>{!search && <button className="dashboard-button primary" onClick={() => setModalOpen(true)}>Cadastrar primeiro cliente</button>}</div>}
      </section>
    </section> : <section className="dashboard-content finance-host"><FinanceDashboard accessToken={session.access_token} /></section>}
    {activeArea === "clients" && modalOpen && <ClientModal client={editingClient || undefined} onClose={() => { setModalOpen(false); setEditingClient(null); }} onSave={saveClient} />}
    {activeArea === "clients" && selectedClient && <ClientDetails client={selectedClient} onClose={() => setSelectedClient(null)} onEdit={() => { setEditingClient(selectedClient); setSelectedClient(null); setModalOpen(true); }} />}
  </main>;
}

export default function AdminPlaceholder() {
  const [email, setEmail] = useState("admin@formcompany.com"); const [password, setPassword] = useState(""); const [showPassword, setShowPassword] = useState(false); const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(() => { try { const stored = localStorage.getItem(sessionKey); return stored ? JSON.parse(stored) as Session : null; } catch { return null; } });
  useEffect(() => { document.title = "Área administrativa — Form Company"; }, []);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); if (!supabaseUrl || !supabaseKey) { setError("A conexão com o sistema ainda não foi configurada."); return; } setIsLoading(true); try { const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: supabaseKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) }); const data = await response.json() as Session & { error_description?: string; message?: string }; if (!response.ok) throw new Error(data.error_description || data.message || "Não foi possível entrar."); localStorage.setItem(sessionKey, JSON.stringify(data)); setSession(data); setPassword(""); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Não foi possível entrar. Tente novamente."); } finally { setIsLoading(false); } }
  function signOut() { localStorage.removeItem(sessionKey); setSession(null); }
  if (session) return <Dashboard session={session} onSignOut={signOut} />;
  return <main className="admin-page"><div className="admin-frame"><section className="admin-panel"><FormMark /><form className="admin-form" onSubmit={handleSubmit}><div><p className="admin-eyebrow">Área administrativa</p><h1>Bem-vindo de volta.</h1><p className="admin-copy">Entre com seu e-mail para acessar a Form.</p></div><label className="admin-field"><span>E-mail</span><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required /></label><label className="admin-field"><span>Senha</span><span className="admin-password-wrap"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Digite sua senha" required /><button type="button" className="admin-password-toggle" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Ocultar" : "Mostrar"}</button></span></label>{error && <p className="admin-error" role="alert">{error}</p>}<button className="admin-primary-button" type="submit" disabled={isLoading}><span>{isLoading ? "Entrando..." : "Entrar"}</span><span>↗</span></button></form><p className="admin-footer-note">Form Company® · Acesso restrito</p></section><aside className="admin-art-copy" aria-hidden="true"><span>Forma.</span><span>Movimento.</span><span>Resultado.</span></aside></div></main>;
}
