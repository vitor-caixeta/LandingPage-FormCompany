export type CloudData = {
  clients?: unknown[];
  accounts?: unknown[];
  entries?: unknown[];
};

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
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: headers(accessToken) });
  if (!response.ok) throw new Error("Não foi possível carregar os dados da nuvem.");
  const user = await response.json() as { user_metadata?: { form_data?: CloudData } };
  return user.user_metadata?.form_data || {};
}

let writeQueue: Promise<void> = Promise.resolve();

export function writeCloudSection(accessToken: string, section: keyof CloudData, value: unknown[]) {
  writeQueue = writeQueue.catch(() => undefined).then(async () => {
    const current = await readCloudData(accessToken);
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: headers(accessToken),
      body: JSON.stringify({ data: { form_data: { ...current, [section]: value } } }),
    });
    if (!response.ok) throw new Error("Não foi possível salvar os dados na nuvem.");
  });
  return writeQueue;
}
