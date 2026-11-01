// b1ble-voice: turns B1ble's short spoken answers into speech with ElevenLabs.
// The ElevenLabs key lives only here (secret ELEVENLABS_API_KEY); the app never sees it.
// Only signed-in users can call it, and if ALLOWED_EMAIL is set, only that user.
// It only reads text aloud: no other ElevenLabs feature is reachable through it.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// "George": a calm, mature British voice. The multilingual model speaks Greek in the same voice.
const VOICE = Deno.env.get("ELEVENLABS_VOICE_ID") || "JBFqnCBsd6RMkjVDRZzb";
const MODEL = Deno.env.get("ELEVENLABS_MODEL") || "eleven_flash_v2_5";
const MAX_CHARS = 700; // car-mode answers are a few short sentences; this also caps credit use

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const key = Deno.env.get("ELEVENLABS_API_KEY");
    if (!key) return json({ error: "no_key" }, 503);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "");
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supabase.auth.getUser(token);
    const allowed = Deno.env.get("ALLOWED_EMAIL");
    if (!user || (allowed && user.email?.toLowerCase() !== allowed.toLowerCase())) return json({ error: "not_allowed" }, 403);

    const { text, lang } = await req.json();
    if (typeof text !== "string" || !text.trim()) return json({ error: "empty_text" }, 400);
    const code = typeof lang === "string" && /^[a-z]{2}/i.test(lang) ? lang.slice(0, 2).toLowerCase() : undefined;

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS),
        model_id: MODEL,
        ...(code && MODEL !== "eleven_multilingual_v2" ? { language_code: code } : {}),
        voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: 1.0 },
      }),
    });
    if (!r.ok) {
      let detail = ""; try { const b = await r.json(); detail = b?.detail?.status || b?.detail?.code || ""; } catch {}
      return json({ error: `elevenlabs_${r.status}${detail ? "_" + detail : ""}` }, 502);
    }
    // octet-stream so the app's Supabase client hands it back as a Blob
    return new Response(r.body, { headers: { ...cors, "Content-Type": "application/octet-stream", "Cache-Control": "no-store" } });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
