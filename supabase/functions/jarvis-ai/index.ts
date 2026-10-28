// jarvis-ai: the only place the Claude API key lives. The app sends a prompt
// (and optional photos) here; only signed-in users can call it, and if
// ALLOWED_EMAIL is set, only that user.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    const allowed = Deno.env.get("ALLOWED_EMAIL");
    if (!user || (allowed && user.email?.toLowerCase() !== allowed.toLowerCase())) return json({ error: "not_allowed" }, 403);

    const { prompt, images = [] } = await req.json();
    if (typeof prompt !== "string" || !prompt) return json({ error: "empty_prompt" }, 400);

    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      ...images.slice(0, 6).map((img: { media_type: string; data: string }) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: img.media_type as "image/jpeg", data: img.data },
      })),
      { type: "text", text: prompt },
    ];

    // fallbacks: "default" re-runs a request the safety classifiers decline on
    // Anthropic's recommended fallback model instead of returning a refusal.
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    } as any);

    if (response.stop_reason === "refusal") return json({ error: "refusal" });
    const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    return json({ text, truncated: response.stop_reason === "max_tokens" });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `claude_api_${e.status}` }, 502);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
