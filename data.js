/* Supabase-backed store with the same small API the app was written against:
   db.collection(c).onSnapshot / .doc(id).set|update|delete, db.doc("c/id").
   Everything is cached in memory and in localStorage, so the app opens and reads
   offline; writes made offline are queued and sent when the connection returns. */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function merge(base, patch) {
  const out = { ...(base || {}) };
  for (const [k, v] of Object.entries(patch)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  return out;
}
const rid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").slice(0, 20) : Math.random().toString(36).slice(2) + Date.now().toString(36));
const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export function makeDb(uid, onStatus = () => {}) {
  const CACHE_KEY = "jarvis-cache-" + uid, QUEUE_KEY = "jarvis-queue-" + uid;
  const cache = safe(() => JSON.parse(localStorage.getItem(CACHE_KEY)) || {}, {});
  let queue = safe(() => JSON.parse(localStorage.getItem(QUEUE_KEY)) || [], []);
  const subs = new Set();
  let saveTimer = null;

  const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => safe(() => localStorage.setItem(CACHE_KEY, JSON.stringify(cache))), 300); };
  const saveQueue = () => safe(() => localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)));
  const coll = (c) => (cache[c] = cache[c] || {});
  const notify = (c) => subs.forEach((s) => s.coll === c && s.fire());
  const status = () => onStatus({ online: navigator.onLine, pending: queue.length });

  async function send(op) {
    if (op.kind === "delete") {
      const { error } = await sb.from("docs").delete().match({ owner: uid, coll: op.coll, id: op.id });
      if (error) throw error;
    } else {
      const { error } = await sb.from("docs").upsert({ owner: uid, coll: op.coll, id: op.id, data: op.data, updated_at: new Date().toISOString() });
      if (error) throw error;
    }
  }
  let flushing = false;
  async function flush() {
    if (flushing || !navigator.onLine) return;
    flushing = true;
    while (queue.length) {
      try { await send(queue[0]); queue.shift(); saveQueue(); }
      catch (e) { if (e && e.code && String(e.code).startsWith("4")) { queue.shift(); saveQueue(); } else break; }
    }
    flushing = false; status();
  }
  async function write(op) {
    // Collapse repeated writes to the same document while offline.
    queue = queue.filter((q) => !(q.coll === op.coll && q.id === op.id));
    queue.push(op); saveQueue(); status();
    await flush();
  }

  const snapDoc = (id, d) => ({ id, exists: !!d, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } });
  function docRef(c, id) {
    return {
      id, path: `${c}/${id}`,
      get: async () => snapDoc(id, coll(c)[id]),
      set: async (data) => { coll(c)[id] = data; persist(); notify(c); await write({ kind: "set", coll: c, id, data }); },
      update: async (patch) => { const next = merge(coll(c)[id], patch); coll(c)[id] = next; persist(); notify(c); await write({ kind: "set", coll: c, id, data: next }); },
      delete: async () => { delete coll(c)[id]; persist(); notify(c); await write({ kind: "delete", coll: c, id }); },
      onSnapshot(next) { const s = { coll: c, fire: () => next(snapDoc(id, coll(c)[id])) }; subs.add(s); setTimeout(s.fire); return () => subs.delete(s); },
    };
  }
  function query(c, order = null, lim = null) {
    const docs = () => {
      let rows = Object.entries(coll(c)).map(([id, d]) => snapDoc(id, d));
      if (order) rows.sort((a, b) => { const x = a.data()[order.f] ?? "", y = b.data()[order.f] ?? ""; return (x < y ? -1 : x > y ? 1 : 0) * (order.dir === "desc" ? -1 : 1); });
      if (lim) rows = rows.slice(0, lim);
      return rows;
    };
    return {
      path: c,
      orderBy: (f, dir = "asc") => query(c, { f, dir }, lim),
      limit: (n) => query(c, order, n),
      get: async () => { const d = docs(); return { docs: d, size: d.length, empty: !d.length }; },
      onSnapshot(next) { const s = { coll: c, fire: () => { const d = docs(); next({ docs: d, size: d.length, empty: !d.length, docChanges: () => [], metadata: {} }); } }; subs.add(s); setTimeout(s.fire); return () => subs.delete(s); },
      doc: (id) => docRef(c, id || rid()),
      add: async (data) => { const r = docRef(c, rid()); await r.set(data); return r; },
    };
  }

  async function loadAll() {
    const fresh = {};
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("docs").select("coll,id,data").range(from, from + 999);
      if (error) throw error;
      data.forEach((r) => ((fresh[r.coll] = fresh[r.coll] || {})[r.id] = r.data));
      if (data.length < 1000) break;
    }
    // Keep offline edits that haven't reached the server yet.
    queue.forEach((op) => { const m = (fresh[op.coll] = fresh[op.coll] || {}); if (op.kind === "delete") delete m[op.id]; else m[op.id] = op.data; });
    Object.keys(cache).forEach((k) => delete cache[k]);
    Object.assign(cache, fresh); persist();
    [...new Set([...subs].map((s) => s.coll))].forEach(notify);
  }

  function listen() {
    sb.channel("docs-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: `owner=eq.${uid}` }, (p) => {
        const row = p.new && p.new.coll ? p.new : p.old;
        if (!row || !row.coll) return;
        if (queue.some((q) => q.coll === row.coll && q.id === row.id)) return;
        if (p.eventType === "DELETE") delete coll(row.coll)[row.id]; else coll(row.coll)[row.id] = p.new.data;
        persist(); notify(row.coll);
      })
      .subscribe();
  }

  window.addEventListener("online", () => { status(); flush().then(() => loadAll().catch(() => {})); });
  window.addEventListener("offline", status);

  const db = { doc: (path) => { const [c, id] = path.split("/"); return docRef(c, id); }, collection: (c) => query(c) };
  return {
    db,
    async start() { status(); if (navigator.onLine) { await flush(); await loadAll().catch(() => {}); listen(); } },
    hasCache: () => Object.keys(cache).length > 0,
    exportAll: () => JSON.parse(JSON.stringify(cache)),
  };
}

/* Photos live in the private "photos" bucket under <uid>/. The app stores the
   object path as the photo id; images are shown through signed URLs. */
export function makeAssets(uid) {
  const URL_KEY = "jarvis-urls-" + uid;
  const urls = safe(() => JSON.parse(localStorage.getItem(URL_KEY)) || {}, {});
  const bucket = () => sb.storage.from("photos");
  let pending = new Set(), timer = null;
  async function resolve() {
    const ids = [...pending]; pending = new Set();
    if (!ids.length || !navigator.onLine) return;
    const { data } = await bucket().createSignedUrls(ids, 60 * 60 * 24 * 6);
    (data || []).forEach((r) => { if (r.signedUrl) urls[r.path] = { u: r.signedUrl, t: Date.now() }; });
    safe(() => localStorage.setItem(URL_KEY, JSON.stringify(urls)));
    document.querySelectorAll("img[data-photo]").forEach((img) => { const u = urls[img.dataset.photo]; if (u && img.getAttribute("src") !== u.u) img.src = u.u; });
  }
  const fresh = (id) => urls[id] && Date.now() - urls[id].t < 1000 * 60 * 60 * 24 * 5;
  return {
    src(id) { if (fresh(id)) return urls[id].u; pending.add(id); clearTimeout(timer); timer = setTimeout(resolve, 30); return "data:image/gif;base64,R0lGODlhAQABAAAAACw="; },
    async upload(blob, opts = {}) {
      const ext = (opts.type || blob.type || "image/jpeg").split("/")[1].replace("jpeg", "jpg").replace("svg+xml", "svg");
      const path = `${uid}/${rid()}.${ext}`;
      const { error } = await bucket().upload(path, blob, { contentType: opts.type || blob.type || "image/jpeg", upsert: false });
      if (error) throw { code: "upload_failed", message: error.message };
      return { id: path };
    },
    async delete(id) { await bucket().remove([id]); delete urls[id]; },
    async download(id) { const { data, error } = await bucket().download(id); if (error) throw error; return data; },
  };
}

/* Asks Claude through the jarvis-ai Edge Function (it holds the API key). */
export function makeSample() {
  const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  function parseJson(text) {
    const t = String(text || "").trim();
    const tries = [t, (t.match(/```(?:json)?\s*([\s\S]*?)```/) || [])[1], (() => { const a = t.search(/[[{]/), b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]")); return a >= 0 && b > a ? t.slice(a, b + 1) : null; })()];
    for (const x of tries) { if (!x) continue; try { return JSON.parse(x); } catch {} }
    throw { code: "invalid_json", text: t };
  }
  async function call(prompt, opts = {}) {
    if (!navigator.onLine) throw { code: "offline" };
    const images = opts.images ? await Promise.all([...opts.images].map(async (b) => ({ media_type: b.type && b.type.startsWith("image/") ? b.type : "image/jpeg", data: await toB64(b) }))) : [];
    const aborted = new Promise((_, rej) => opts.signal && opts.signal.addEventListener("abort", () => rej({ code: "cancelled" })));
    const { data, error } = await Promise.race([sb.functions.invoke("jarvis-ai", { body: { prompt, images } }), aborted]);
    if (error) throw { code: "ai_error", message: error.message };
    if (data && data.error) throw { code: data.error === "refusal" ? "refused" : "ai_error", message: data.error };
    return { text: data.text || "" };
  }
  const sample = (prompt, opts) => call(prompt, opts);
  sample.json = async (prompt, opts) => parseJson((await call(prompt, opts)).text);
  sample.limits = async () => ({ maxPromptBytes: 900000, images: { maxCount: 6, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ["image/jpeg", "image/png", "image/webp"] } });
  return sample;
}
