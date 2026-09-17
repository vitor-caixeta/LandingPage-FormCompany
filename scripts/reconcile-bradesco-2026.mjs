import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
  const separator = line.indexOf("=");
  return [line.slice(0, separator), line.slice(separator + 1)];
}));

const baseUrl = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SECRET_KEY;
const userId = "1024da4a-869d-4fbc-bcee-bde428171ad6";
const accountId = "d0e522c8-2dce-4c30-8895-919870de7b24";
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

const response = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, { headers });
if (!response.ok) throw new Error(`Falha ao carregar usuário: ${response.status} ${await response.text()}`);
const user = await response.json();
const formData = user.user_metadata?.form_data || {};
const existingEntries = formData.entries || [];

const entry = (id, date, kind, amount, bankDescription, description, category) => ({
  id, accountId, amount, bankDescription, category,
  competenceDate: date, description, dueDate: date,
  installments: 1, isCreditCard: false, kind,
  paymentDate: date, paymentMethod: "PIX", recurring: false,
  status: kind === "income" ? "Recebido" : "Pago",
});

const additions = [
  entry("pdf-2026-078", "2026-07-10", "income", 26, "PIX RECEBIDO REM: VITOR GABRIEL FERREIRA Docto 0921339", "TRANSFERÊNCIA RECEBIDA - VITOR", "RECEITA"),
  entry("pdf-2026-079", "2026-07-15", "expense", 26, "PIX ENVIADO DES: VITOR GABRIEL FERREIRA Docto 1015584", "TRANSFERÊNCIA PARA VITOR", "RETIRADA"),
  entry("pdf-2026-080", "2026-09-01", "expense", 73.80, "TARIFA BANCARIA CESTA RECEBAFACIL Docto 0030826", "TARIFA BANCÁRIA", "DESPESA BANCÁRIA"),
  entry("pdf-2026-081", "2026-09-08", "income", 1000, "PIX RECEBIDO REM: LEONARDI IMOVEIS LTDA Docto 1105513", "PAGAMENTO LEONARDI IMÓVEIS", "RECEITA"),
  entry("pdf-2026-082", "2026-09-08", "income", 0.23, "RENTAB.INVEST FACILCRED* Docto 1456488", "RENDIMENTO", "RENDIMENTO"),
  entry("pdf-2026-083", "2026-09-08", "income", 0.06, "RENTAB.INVEST FACILCRED* Docto 2892810", "RENDIMENTO", "RENDIMENTO"),
  entry("pdf-2026-084", "2026-09-08", "income", 0.52, "RENTAB.INVEST FACILCRED* Docto 4027382", "RENDIMENTO", "RENDIMENTO"),
  entry("pdf-2026-085", "2026-09-08", "expense", 817.14, "PIX ENVIADO DES: VITOR GABRIEL FERREIRA Docto 1002132", "PAGAMENTO VITOR", "RETIRADA"),
  entry("pdf-2026-086", "2026-09-09", "income", 0.08, "RENTAB.INVEST FACILCRED* Docto 2892810", "RENDIMENTO", "RENDIMENTO"),
  entry("pdf-2026-087", "2026-09-09", "expense", 680, "PIX ENVIADO DES: ANDERSON CARLOS DOS S Docto 1930463", "PAGAMENTO ANDERSON", "RETIRADA"),
  entry("pdf-2026-088", "2026-09-09", "expense", 200, "PIX ENVIADO DES: ANDERSON CARLOS DOS S Docto 1931234", "PAGAMENTO ANDERSON", "RETIRADA"),
  entry("pdf-2026-089", "2026-09-10", "income", 1800, "PIX RECEBIDO REM: ANDREIA FERREIRA GONC Docto 1522434", "RECEBIMENTO ANDREIA FERREIRA", "RECEITA"),
  entry("pdf-2026-090", "2026-09-11", "income", 3000, "PIX RECEBIDO REM: FACULDADES INTEGRADAS Docto 1324501", "PAGAMENTO FACULDADES INTEGRADAS", "RECEITA"),
  entry("pdf-2026-091", "2026-09-14", "income", 0.13, "RENTAB.INVEST FACILCRED* Docto 2892810", "RENDIMENTO", "RENDIMENTO"),
  entry("pdf-2026-092", "2026-09-14", "expense", 500, "PIX ENVIADO DES: 57.233.010 LUCAS BARB Docto 932524", "PAGAMENTO LUCAS BARBOSA", "DESPESA"),
  entry("pdf-2026-093", "2026-09-14", "expense", 500, "PIX ENVIADO DES: JONATHAS MOREIRA PIME Docto 1121397", "PAGAMENTO JONATHAS MOREIRA", "DESPESA"),
];

const existingIds = new Set(existingEntries.map(({ id }) => id));
const entries = [...additions.filter(({ id }) => !existingIds.has(id)), ...existingEntries];
const accounts = (formData.accounts || []).map((account) => account.id === accountId ? { ...account, balance: 9009.77 } : account);
const update = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
  method: "PUT", headers,
  body: JSON.stringify({ user_metadata: { ...user.user_metadata, form_data: { ...formData, accounts, entries } } }),
});
if (!update.ok) throw new Error(`Falha ao atualizar usuário: ${update.status} ${await update.text()}`);

console.log(JSON.stringify({ added: additions.filter(({ id }) => !existingIds.has(id)).length, entries: entries.length, clients: (formData.clients || []).length, balance: accounts.find(({ id }) => id === accountId)?.balance }));
