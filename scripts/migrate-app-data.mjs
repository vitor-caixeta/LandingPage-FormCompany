import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((line) => line.includes("=")).map((line) => { const i=line.indexOf("="); return [line.slice(0,i),line.slice(i+1)]; }));
const base=env.VITE_SUPABASE_URL; const secret=env.SUPABASE_SECRET_KEY; const adminId="1024da4a-869d-4fbc-bcee-bde428171ad6";
const headers={apikey:secret,Authorization:`Bearer ${secret}`,"Content-Type":"application/json"};
const apply=process.argv.includes("--apply");
const recoveryFile=process.argv.find((argument)=>argument.startsWith("--recover="))?.slice("--recover=".length);
const ofxFile=process.argv.find((argument)=>argument.startsWith("--ofx="))?.slice("--ofx=".length);
const sections=["clients","accounts","entries"];

function readRecoveryRows(path){
  if(!path)return [];
  const source=readFileSync(path,"utf8");
  const bodyLiteral=source.match(/"body":\s*("(?:\\.|[^"\\])*")/s)?.[1];
  if(!bodyLiteral)throw new Error("Não foi possível encontrar o body na requisição de recuperação.");
  const rows=JSON.parse(JSON.parse(bodyLiteral));
  if(!Array.isArray(rows))throw new Error("O body de recuperação não contém uma lista de seções.");
  for(const row of rows){
    if(!sections.includes(row?.section)||!Array.isArray(row?.value))throw new Error("A requisição de recuperação contém dados fora das seções permitidas.");
  }
  if(new Set(rows.map((row)=>row.section)).size!==rows.length)throw new Error("A requisição de recuperação contém seções duplicadas.");
  return rows;
}
const recoveryRows=readRecoveryRows(recoveryFile);

function canonicalJson(value){
  if(Array.isArray(value))return value.map(canonicalJson);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,canonicalJson(value[key])]));
  return value;
}

function readOfx(path){
  if(!path)return null;
  const source=readFileSync(path,"utf8");
  const transactions=[...source.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g)].map((match)=>Object.fromEntries(
    [...match[1].matchAll(/<([A-Z0-9]+)>([^<\r\n]*)/g)].map((field)=>[field[1],field[2].trim()]),
  ));
  const balance=Number(source.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]+)/)?.[1]);
  if(!transactions.length||!Number.isFinite(balance))throw new Error("O arquivo OFX não contém movimentações ou saldo final válidos.");
  if(new Set(transactions.map((transaction)=>transaction.FITID)).size!==transactions.length)throw new Error("O arquivo OFX contém FITIDs duplicados.");
  return {transactions,balance};
}

function prepareOfxRows(rows,ofx){
  if(!ofx)return {rows,summary:null};
  const prepared=structuredClone(rows);
  const accountsRow=prepared.find((row)=>row.section==="accounts");
  const entriesRow=prepared.find((row)=>row.section==="entries");
  if(!accountsRow||!entriesRow)throw new Error("A recuperação precisa conter as seções accounts e entries antes de importar o OFX.");
  const nubank=accountsRow.value.find((account)=>account.type!=="Cartão"&&`${account.name||""} ${account.bank||""}`.toLowerCase().includes("nubank"));
  if(!nubank)throw new Error("A conta Nubank não foi encontrada nos dados recuperados.");
  const transferTransaction=ofx.transactions.find((transaction)=>Number(transaction.TRNAMT)===9000&&String(transaction.MEMO||"").toUpperCase().includes("BRADESCO"));
  const transferEntry=entriesRow.value.find((entry)=>entry.kind==="transfer"&&entry.destinationAccountId===nubank.id&&Number(entry.amount)===9000&&entry.competenceDate==="2026-09-17");
  if(!transferTransaction||!transferEntry)throw new Error("Não foi possível vincular com segurança a transferência de R$ 9.000 do Bradesco ao Nubank.");
  transferEntry.externalId=transferTransaction.FITID;
  transferEntry.balanceApplied=true;
  const knownExternalIds=new Set(entriesRow.value.flatMap((entry)=>[entry.externalId,entry.id]).filter(Boolean));
  const created=[];
  for(const transaction of ofx.transactions){
    if(transaction.FITID===transferTransaction.FITID)continue;
    const id=`ofx-nubank-${transaction.FITID}`;
    if(knownExternalIds.has(transaction.FITID)||knownExternalIds.has(id))continue;
    const signedAmount=Number(transaction.TRNAMT);
    const memo=String(transaction.MEMO||"Movimentação Nubank");
    const date=String(transaction.DTPOSTED||"").slice(0,8).replace(/^(\d{4})(\d{2})(\d{2})$/,"$1-$2-$3");
    if(!Number.isFinite(signedAmount)||!date)throw new Error(`Movimentação OFX inválida: ${transaction.FITID||"sem FITID"}`);
    const isIncome=signedAmount>0;
    const upperMemo=memo.toUpperCase();
    const isRdbApplication=upperMemo.includes("APLICAÇÃO RDB");
    const counterparty=memo.split(" - ")[1];
    const category=isRdbApplication?"MOVIMENTAÇÃO INTERNA":upperMemo.includes("RECEITA FEDERAL")?"IMPOSTO":isIncome?"RECEITA":upperMemo.includes("ANDERSON CARLOS")?"RETIRADA":"DESPESA";
    created.push({
      id,
      externalId:transaction.FITID,
      kind:isRdbApplication?"transfer":isIncome?"income":"expense",
      bankDescription:memo,
      description:isRdbApplication?"Aplicação RDB · Caixinha Nubank":counterparty?`${isIncome?"Recebimento":"Pagamento"} · ${counterparty}`:memo,
      paymentMethod:isRdbApplication?"Aplicação":"PIX",
      amount:Math.abs(signedAmount),
      category,
      accountId:nubank.id,
      destinationAccountId:isRdbApplication?nubank.id:undefined,
      competenceDate:date,
      dueDate:date,
      paymentDate:date,
      status:isRdbApplication?"Transferido":isIncome?"Recebido":"Pago",
      recurring:false,
      installments:1,
      isCreditCard:false,
      balanceApplied:!isRdbApplication,
    });
  }
  entriesRow.value=[...created,...entriesRow.value];
  const caixinhaBalance=ofx.transactions
    .filter((transaction)=>String(transaction.MEMO||"").toUpperCase().includes("APLICAÇÃO RDB"))
    .reduce((sum,transaction)=>sum-Math.min(Number(transaction.TRNAMT)||0,0),0);
  nubank.balance=ofx.balance+caixinhaBalance;
  return {rows:prepared,summary:{transactions:ofx.transactions.length,created:created.length,linkedTransfers:1,checkingBalance:ofx.balance,caixinhaBalance,finalBalance:nubank.balance}};
}
const ofx=readOfx(ofxFile);

const userResponse=await fetch(`${base}/auth/v1/admin/users/${adminId}`,{headers});
if(!userResponse.ok) throw new Error(`Falha ao ler usuário administrador: ${await userResponse.text()}`);
const user=await userResponse.json();
const legacy=user.user_metadata?.form_data||{};

const existingResponse=await fetch(`${base}/rest/v1/app_data?select=section,value`,{headers});
if(!existingResponse.ok) throw new Error(`Falha ao verificar dados atuais: ${await existingResponse.text()}`);
const existing=await existingResponse.json();
const existingSections=new Set(existing.map((row)=>row.section));
const missingRows=sections
  .filter((section)=>!existingSections.has(section))
  .map((section)=>({section,value:Array.isArray(legacy[section])?legacy[section]:[]}));
const prepared=ofx?prepareOfxRows(recoveryRows.length?recoveryRows:existing,ofx):{rows:recoveryRows,summary:null};
const preparedRows=prepared.rows;

const summary={
  preserved:Object.fromEntries(existing.map((row)=>[row.section,Array.isArray(row.value)?row.value.length:0])),
  missing:missingRows.map((row)=>row.section),
  legacy:Object.fromEntries(sections.map((section)=>[section,Array.isArray(legacy[section])?legacy[section].length:0])),
  recovery:Object.fromEntries(preparedRows.map((row)=>[row.section,row.value.length])),
  ofx:prepared.summary,
  legacyMetadataPresent:Boolean(user.user_metadata?.form_data),
};
if(!apply){
  console.log(JSON.stringify({...summary,dryRun:true}));
  process.exit(0);
}

const backupPath=join(tmpdir(),`form-app-data-before-cleanup-${new Date().toISOString().replace(/[:.]/g,"-")}.json`);
writeFileSync(backupPath,JSON.stringify({adminId,userMetadata:user.user_metadata,appData:existing},null,2),{mode:0o600});

const rowsToWrite=preparedRows.length?preparedRows:missingRows;
if(rowsToWrite.length){
  const insert=await fetch(`${base}/rest/v1/app_data?on_conflict=section`,{method:"POST",headers:{...headers,Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(rowsToWrite)});
  if(!insert.ok) throw new Error(`Falha ao salvar dados recuperados: ${await insert.text()}`);
  const verificationResponse=await fetch(`${base}/rest/v1/app_data?select=section,value`,{headers});
  if(!verificationResponse.ok)throw new Error(`Dados salvos, mas falhou a verificação: ${await verificationResponse.text()}`);
  const verified=await verificationResponse.json();
  for(const row of rowsToWrite){
    const saved=verified.find((candidate)=>candidate.section===row.section)?.value;
    if(JSON.stringify(canonicalJson(saved))!==JSON.stringify(canonicalJson(row.value)))throw new Error(`A verificação da seção ${row.section} não confere; o metadata antigo não será removido.`);
  }
}
const metadata={...(user.user_metadata||{}),form_data:null};
const cleanup=await fetch(`${base}/auth/v1/admin/users/${adminId}`,{method:"PUT",headers,body:JSON.stringify({user_metadata:metadata})});
if(!cleanup.ok) throw new Error(`Dados migrados, mas falhou ao limpar o token antigo: ${await cleanup.text()}`);
const cleanedUserResponse=await fetch(`${base}/auth/v1/admin/users/${adminId}`,{headers});
if(!cleanedUserResponse.ok)throw new Error(`Metadata atualizado, mas falhou a verificação do usuário: ${await cleanedUserResponse.text()}`);
const cleanedUser=await cleanedUserResponse.json();
if(cleanedUser.user_metadata?.form_data!=null)throw new Error("O Supabase manteve o metadata antigo; a limpeza não foi confirmada.");
console.log(JSON.stringify({...summary,written:rowsToWrite.map((row)=>row.section),legacyMetadataRemoved:true,backupPath}));
