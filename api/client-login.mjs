const normalizeUsername = (value = "") => value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");

export default async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Método não permitido." });
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !publishableKey || !secretKey) return response.status(500).json({ error: "Autenticação indisponível." });
  const username = normalizeUsername(request.body?.username);
  const password = String(request.body?.password || "");
  if (username.length < 3 || password.length < 8) return response.status(400).json({ error: "Usuário ou senha inválidos." });

  const lookup = await fetch(`${supabaseUrl}/rest/v1/client_access?select=username,user_id,clients!inner(status)&username=eq.${encodeURIComponent(username)}&limit=1`, {
    headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` },
  });
  const rows = lookup.ok ? await lookup.json() : [];
  if (!rows[0] || rows[0].clients?.status !== "active") return response.status(401).json({ error: "Usuário ou senha inválidos." });
  const email = `${username}@clientes.form.internal`;
  const login = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: publishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  if (!login.ok) return response.status(401).json({ error: "Usuário ou senha inválidos." });
  const session = await login.json();
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at });
}
