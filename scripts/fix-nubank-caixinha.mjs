import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const base = env.VITE_SUPABASE_URL;
const secret = env.SUPABASE_SECRET_KEY;
const apply = process.argv.includes("--apply");
const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
};

if (!base || !secret) throw new Error("As credenciais do Supabase não foram encontradas em .env.local.");

const canonicalJson = (value) => {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
};

const response = await fetch(`${base}/rest/v1/app_data?select=section,value`, { headers });
if (!response.ok) throw new Error(`Falha ao carregar os dados atuais: ${await response.text()}`);
const current = await response.json();
const accountsRow = current.find((row) => row.section === "accounts");
const entriesRow = current.find((row) => row.section === "entries");
if (!accountsRow || !entriesRow || !Array.isArray(accountsRow.value) || !Array.isArray(entriesRow.value)) {
  throw new Error("As seções accounts e entries não foram encontradas no formato esperado.");
}

const nubank = accountsRow.value.find(
  (account) => account.type !== "Cartão" && `${account.name || ""} ${account.bank || ""}`.toLowerCase().includes("nubank"),
);
if (!nubank) throw new Error("A conta Nubank não foi encontrada.");

const expectedApplications = new Map([
  ["6aad634e-4d18-4356-bfc1-6cbced825f16", 12000],
  ["6ab67e42-99f0-455a-a8f0-8b9672bddf16", 2000],
]);
const applications = entriesRow.value.filter((entry) => expectedApplications.has(entry.externalId));
if (applications.length !== expectedApplications.size) {
  throw new Error(`Foram encontradas ${applications.length} das ${expectedApplications.size} aplicações RDB esperadas.`);
}
for (const entry of applications) {
  if (
    entry.accountId !== nubank.id
    || Number(entry.amount) !== expectedApplications.get(entry.externalId)
    || !String(entry.bankDescription || entry.description || "").toUpperCase().includes("APLICAÇÃO RDB")
  ) {
    throw new Error(`A aplicação ${entry.externalId} não confere com o extrato importado.`);
  }
}
const investedAmount = applications.reduce((sum, entry) => sum + Number(entry.amount), 0);
if (investedAmount !== 14000) throw new Error(`O total das aplicações é ${investedAmount}, e não R$ 14.000,00.`);

const nextAccounts = structuredClone(accountsRow.value);
const nextEntries = structuredClone(entriesRow.value);
const nextNubank = nextAccounts.find((account) => account.id === nubank.id);
nextNubank.balance = 14062.81;
for (const entry of nextEntries.filter((candidate) => expectedApplications.has(candidate.externalId))) {
  entry.kind = "transfer";
  entry.description = "Aplicação RDB · Caixinha Nubank";
  entry.category = "MOVIMENTAÇÃO INTERNA";
  entry.paymentMethod = "Aplicação";
  entry.destinationAccountId = nubank.id;
  entry.status = "Transferido";
  entry.balanceApplied = false;
}

const rowsToWrite = [
  { section: "accounts", value: nextAccounts },
  { section: "entries", value: nextEntries },
];
const summary = {
  nubankAccountId: nubank.id,
  previousBalance: Number(nubank.balance),
  nextBalance: nextNubank.balance,
  applicationsReclassified: applications.length,
  investedAmount,
};

if (!apply) {
  console.log(JSON.stringify({ ...summary, dryRun: true }));
  process.exit(0);
}

const backupPath = join(tmpdir(), `form-nubank-before-caixinha-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(backupPath, JSON.stringify({ appData: current }, null, 2), { mode: 0o600 });

const writeResponse = await fetch(`${base}/rest/v1/app_data?on_conflict=section`, {
  method: "POST",
  headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(rowsToWrite),
});
if (!writeResponse.ok) throw new Error(`Falha ao salvar a correção: ${await writeResponse.text()}`);

const verificationResponse = await fetch(`${base}/rest/v1/app_data?select=section,value`, { headers });
if (!verificationResponse.ok) throw new Error(`A correção foi enviada, mas a verificação falhou: ${await verificationResponse.text()}`);
const verified = await verificationResponse.json();
for (const row of rowsToWrite) {
  const saved = verified.find((candidate) => candidate.section === row.section)?.value;
  if (JSON.stringify(canonicalJson(saved)) !== JSON.stringify(canonicalJson(row.value))) {
    throw new Error(`A verificação da seção ${row.section} não confere com a correção enviada.`);
  }
}

console.log(JSON.stringify({ ...summary, applied: true, backupPath }));
