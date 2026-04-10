export function validateEnv() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      '[VILO] Supabase nicht konfiguriert (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen). App läuft im Offline-Modus.'
    );
  }

  if (!openaiKey) {
    console.info(
      '[VILO] OpenAI API-Key nicht gesetzt (VITE_OPENAI_API_KEY). Sprachbefehle nutzen den regelbasierten Parser.'
    );
  }
}
