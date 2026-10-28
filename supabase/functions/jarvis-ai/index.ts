// jarvis-ai: the only place the Claude API key lives. The app sends a prompt
// (and optional photos, PDFs, or a web-search request) here; only signed-in
// users can call it, and if ALLOWED_EMAIL is set, only that user. It also
// fetches the user's private calendar feed (ics_url), which browsers can't
// read directly.
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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "");
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await supabase.auth.getUser(token);
    const allowed = Deno.env.get("ALLOWED_EMAIL");
    if (!user || (allowed && user.email?.toLowerCase() !== allowed.toLowerCase())) return json({ error: "not_allowed" }, 403);

    const { prompt, images = [], documents = [], web_search = false, ics_url } = await req.json();
    if (ics_url) {
      if (typeof ics_url !== "string" || !/^https:\/\//.test(ics_url)) return json({ error: "bad_ics_url" }, 400);
      const r = await fetch(ics_url);
      if (!r.ok) return json({ error: `ics_${r.status}` }, 502);
      return json({ ics: (await r.text()).slice(0, 3_000_000), version: 2 });
    }
    if (typeof prompt !== "string" || !prompt) return json({ error: "empty_prompt" }, 400);

    const content: Anthropic.Beta.BetaContentBlockParam[] = [
      ...images.slice(0, 6).map((img: { media_type: string; data: string }) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: img.media_type as "image/jpeg", data: img.data },
      })),
      ...documents.slice(0, 3).map((doc: { media_type: string; data: string }) => ({
        type: "document" as const,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data: doc.data },
      })),
      { type: "text", text: prompt },
    ];
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content }];
    const tools = web_search ? [{ type: "web_search_20260209", name: "web_search", max_uses: 8, user_location: { type: "approximate", city: "Athens", country: "GR", timezone: "Europe/Athens" } }] : undefined;

    // fallbacks: "default" re-runs a request the safety classifiers decline on
    // Anthropic's recommended fallback model instead of returning a refusal.
    let response;
    // A long web search can pause the turn; send it back to let it finish (a few times at most).
    for (let i = 0; i < 4; i++) {
      response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        ...(tools ? { tools } : {}),
        messages,
      } as any);
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content as any });
    }

    if (response.stop_reason === "refusal") return json({ error: "refusal" });
    const text = response.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    return json({ text, truncated: response.stop_reason === "max_tokens", version: 2 });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "rate_limited" }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `claude_api_${e.status}` }, 502);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
