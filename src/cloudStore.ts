export type CloudData = {
  clients?: unknown[];
  accounts?: unknown[];
  entries?: unknown[];
};

export type CloudUser = {
  user_metadata?: { form_data?: CloudData };
};

export function cloudDataFromUser(user?: CloudUser): CloudData {
  return user?.user_metadata?.form_data || {};
}

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  || "https://xmjwdflvcusooinovgrg.supabase.co";
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || "sb_publishable_3WQ418LpynVy6Olq5zWJ7w_ehTHoF9l";

const headers = (accessToken: string) => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
});

export async function readCloudData(accessToken: string): Promise<CloudData> {
  const response = await fetch(`${supabaseUrl}/rest/v1/app_data?select=section,value`, { headers: headers(accessToken) });
  if (!response.ok) throw new Error("Não foi possível carregar os dados da nuvem.");
  const rows = await response.json() as { section: keyof CloudData; value: unknown[] }[];
  return Object.fromEntries(rows.map((row) => [row.section, row.value])) as CloudData;
}

let writeQueue: Promise<void> = Promise.resolve();

export function writeCloudSections(accessToken: string, sections: Partial<Record<keyof CloudData, unknown[]>>) {
  const rows = Object.entries(sections).map(([section, value]) => ({ section, value }));
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const response = await fetch(`${supabaseUrl}/rest/v1/app_data?on_conflict=section`, {
      method: "POST",
      headers: { ...headers(accessToken), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    });
    if (!response.ok) throw new Error("Não foi possível salvar os dados na nuvem.");
  });
  return writeQueue;
}

export function writeCloudSection(accessToken: string, section: keyof CloudData, value: unknown[]) {
  return writeCloudSections(accessToken, { [section]: value });
}
