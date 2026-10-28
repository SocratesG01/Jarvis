import { sb, makeDb, makeAssets, makeSample } from "./data.js";

/* ---------- reference lists ---------- */
const TYPES = ["Restaurant", "Café", "Bar", "Cocktail bar", "Hotel", "Beach bar", "Club", "Taverna", "Kiosk / mini market", "Catering", "Other"];
const STATUSES = { active: "Customer", prospect: "Prospect", closed: "Closed down", lost: "Lost" };
const AREAS = ["Thiseio", "Plaka", "Monastiraki", "Psyrri", "Koukaki", "Kolonaki", "Syntagma", "Exarchia", "Gazi", "Kerameikos", "Pangrati", "Metaxourgeio", "Makrygianni", "Piraeus", "Glyfada"];
const CRITERIA = [["volume", "Potential volume"], ["location", "Location & footfall"], ["fit", "Fit with our range"], ["access", "Access to decision maker"]];
const ASSET_TYPES = ["Beer fridge", "Drinks fridge", "Freezer", "Beer tap / tower", "Keg cooler", "Coffee machine", "Coffee grinder", "Ice machine", "Display cabinet", "Furniture", "Other"];
const POSM_TYPES = ["Umbrella", "Street blackboard", "Table board / menu board", "Coasters (sous-verres)", "Menu holder", "Menu / price list", "Banner / flag", "Light box / neon", "Ice bucket", "Glassware", "Ashtray", "Apron / uniform", "Other"];
const CATEGORIES = ["Beer", "Wine", "Whisky", "Vodka", "Gin", "Rum", "Tequila", "Ouzo / Tsipouro", "Liqueur", "Aperitif", "Soft drinks", "Water", "Juice", "Energy drink", "Coffee", "Other"];
const PHOTO_KINDS = [["exterior", "Shop front"], ["interior", "Inside"], ["backbar", "Back bar"], ["menu", "Menu & price list"], ["other", "Other"]];
const SHOP_TABS = [["overview", "Overview"], ["photos", "Photos"], ["assets", "Assets"], ["posm", "POSM"], ["backbar", "Back bar"], ["menu", "Menu & prices"], ["consumption", "Consumption"], ["contacts", "Contacts"], ["visits", "Visits & tasks"]];
const QUIET_DAYS = 30;

const state = {
  view: "today", shopId: null, shopTab: "overview", catId: null, editing: false, dirty: false, pending: false,
  shopFilter: "all", areaFilter: "all", query: "", marketSeg: "share", marketArea: "all", marketCat: "all", consProduct: null,
  shops: [], tasks: [], visits: [], catalogues: [], settings: {}, loaded: { shops: false, tasks: false }, here: null, near: false, sync: { online: true, pending: 0 }, voiceLang: "el-GR", email: "",
  db: null, assets: null, canWrite: true, noDb: false, armed: null, showDone: false, lightbox: null, busy: false,
};

const app = document.getElementById("app");
const lbRoot = document.getElementById("lightbox-root");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => (n === "" || n == null || isNaN(Number(n))) ? "" : new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n));
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
const fmtMonth = (ym) => ym ? new Date(ym + "-01T00:00:00").toLocaleDateString("en-GB", { month: "short", year: "2-digit" }) : "";
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const img = (id) => `data-photo="${esc(id)}" src="${state.assets ? state.assets.src(id) : ""}"`;
const shopById = (id) => state.shops.find((s) => s.id === id);
const catById = (id) => state.catalogues.find((c) => c.id === id);
const areaOf = (s) => (s.area || "").trim() || "No area";
const scoreOf = (s) => { const sc = s.scores || {}; const vals = CRITERIA.map(([k]) => Number(sc[k]) || 0); if (!vals.some(Boolean)) return null; return Math.round(vals.reduce((a, b) => a + b, 0) / (CRITERIA.length * 5) * 100); };
const daysSinceVisit = (s) => s.lastVisit ? daysBetween(s.lastVisit, todayISO()) : null;
const isQuiet = (s) => s.status === "active" && (s.lastVisit ? daysSinceVisit(s) >= QUIET_DAYS : true);
const hasGeo = (s) => typeof s.lat === "number" && typeof s.lng === "number";
const mapsSearch = (s) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(hasGeo(s) ? `${s.lat},${s.lng}` : [s.name, s.address, s.area, s.city].filter(Boolean).join(", "));
const mapsDir = (s) => "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(hasGeo(s) ? `${s.lat},${s.lng}` : [s.name, s.address, s.area, s.city].filter(Boolean).join(", "));
const canEdit = () => state.canWrite && !state.noDb;
const canUpload = () => canEdit() && !!state.assets;
const cover = (s) => { const p = (s.photos || []).find((x) => x.kind === "exterior") || (s.photos || [])[0]; return p ? p.id : null; };

const distKm = (a, b) => { const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const fmtDist = (km) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("no_gps"));
    navigator.geolocation.getCurrentPosition((p) => { state.here = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() }; resolve(state.here); }, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}
function parseLocation(text) {
  const t = String(text || "").trim();
  const pats = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i, /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/];
  for (const p of pats) { const m = t.match(p); if (m) { const lat = Number(m[1]), lng = Number(m[2]); if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }; } }
  return null;
}

/* brand knowledge from catalogues + recorded back bars */
function brandIndex() {
  const idx = {};
  state.catalogues.forEach((c) => (c.items || []).forEach((it) => { if (it.brand) idx[it.brand.toLowerCase()] = { company: c.company, category: it.category || "" }; }));
  return idx;
}
function datalists() {
  const brands = new Set(), companies = new Set(), areas = new Set(AREAS), cities = new Set(["Athens"]), products = new Set();
  state.catalogues.forEach((c) => { if (c.company) companies.add(c.company); (c.items || []).forEach((it) => it.brand && brands.add(it.brand)); });
  state.shops.forEach((s) => { if (s.area) areas.add(s.area); if (s.city) cities.add(s.city); (s.backbar || []).forEach((b) => { b.brand && brands.add(b.brand); b.company && companies.add(b.company); }); (s.consumption || []).forEach((c) => c.product && products.add(c.product)); (s.products || []).forEach((p) => p.name && products.add(p.name)); });
  const dl = (id, set) => `<datalist id="${id}">${[...set].sort().map((v) => `<option value="${esc(v)}"></option>`).join("")}</datalist>`;
  return dl("dl-brands", brands) + dl("dl-companies", companies) + dl("dl-areas", areas) + dl("dl-cities", cities) + dl("dl-products", products) + dl("dl-cats", new Set(CATEGORIES));
}


/* ---------- navigation ---------- */
const TABS = ["today", "shops", "agenda", "more"];
const PARENT = { map: "more", prospects: "more", market: "more", catalogues: "more", tasks: "agenda", settings: "more" };
const PAGES = [...TABS, ...Object.keys(PARENT)];
const TITLES = { today: "Jarvis", shops: "Shops", agenda: "Agenda", more: "More", map: "Map", prospects: "Prospects", market: "Market share", catalogues: "Catalogues", tasks: "All tasks", settings: "Settings" };
function nav(view) { if (location.hash.slice(1) === view) go(view); else location.hash = view; }
function go(view) { Object.assign(state, { reading: null, view, shopId: null, catId: null, editing: false, armed: null, dirty: false }); render(); window.scrollTo(0, 0); }
function openShop(id, opts = {}) { Object.assign(state, { reading: null, shopId: id, catId: null, editing: !!opts.edit, armed: null, dirty: false, shopTab: opts.tab || "overview", consProduct: null }); render(); window.scrollTo(0, 0); }
function openCat(id) { Object.assign(state, { reading: null, catId: id, shopId: null, editing: false, armed: null, dirty: false }); render(); window.scrollTo(0, 0); }
function routeFromHash() { const h = location.hash.slice(1); go(PAGES.includes(h) ? h : "today"); }
window.addEventListener("hashchange", routeFromHash);

/* ---------- shared bits ---------- */
const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICON = {
  mic: ic('<path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M18 11a6 6 0 0 1-12 0M12 17v4"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  map: ic('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>'),
  locate: ic('<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7.5"/>'),
  edit: ic('<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>'),
  star: ic('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  chart: ic('<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>'),
  book: ic('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h10"/>'),
  check: ic('<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>'),
  gear: ic('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.5-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.5-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.5 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>'),
  nav: ic('<path d="M3 11l18-8-8 18-2-8-8-2z"/>'),
  phone: ic('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  camera: ic('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  shop: ic('<path d="M4 10l1.5-5h13L20 10M4 10v10h16V10M4 10h16M9 20v-5h6v5"/>'),
  chev: ic('<path d="M9 5l7 7-7 7"/>'),
};
const iconBtn = (action, label, icon, v = "") => `<button class="icon-btn" data-action="${action}" ${v ? `data-v="${v}"` : ""} aria-label="${esc(label)}" title="${esc(label)}">${icon}</button>`;
const hue = (t) => [...String(t || "?")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17);
const avatar = (name, cls = "ph") => { const n = String(name || "?").replace(/^Example:\s*/, ""); return `<span class="${cls} av" style="--h:${hue(n)}" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>`; };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function banner() {
  if (state.noDb) return `<div class="banner">You're offline and this phone has no saved copy yet. Connect once to load your shops.</div>`;
  if (!state.canWrite) return `<div class="banner">You can view this data but not change it.</div>`;
  return "";
}

function shopRow(s, extra = "", rank = null) {
  const sc = scoreOf(s);
  const c = cover(s);
  const left = rank != null ? `<div class="score ${sc == null || sc < 50 ? "low" : ""}">${sc == null ? "–" : sc}</div>`
    : c ? `<span class="thumb"><img ${img(c)} alt="" loading="lazy"></span>` : avatar(s.name);
  const last = s.lastVisit ? `Visited ${fmtDate(s.lastVisit)}` : "Not visited yet";
  return `<li><button class="item" data-action="open" data-id="${esc(s.id)}">${left}
    <div class="grow"><div class="title">${rank != null ? `<span class="muted num">#${rank}</span> ` : ""}${esc(s.name || "Untitled shop")}</div>
    <div class="sub">${esc([s.type, areaOf(s) === "No area" ? "" : s.area].filter(Boolean).join(" · "))}${s.type || s.area ? " · " : ""}${extra || last}</div></div>
    ${s.example ? `<span class="pill example">Example</span>` : `<span class="pill ${esc(s.status)}">${esc(STATUSES[s.status] || "")}</span>`}<span class="chev">${ICON.chev}</span>
  </button></li>`;
}

function taskRow(t) {
  const shop = t.shopId ? shopById(t.shopId) : null;
  const overdue = !t.done && t.due && t.due < todayISO();
  return `<li class="item ${t.done ? "done" : ""}">
    <input type="checkbox" class="check" id="task-${esc(t.id)}" data-action="toggle-task" data-id="${esc(t.id)}" ${t.done ? "checked" : ""} ${canEdit() ? "" : "disabled"} aria-label="Mark done">
    <div class="grow"><div class="title">${esc(t.title)}</div>
    <div class="sub">${t.due ? (overdue ? `<span class="pill overdue">Overdue</span> ` : "") + "Due " + fmtDate(t.due) : "No due date"}${shop ? ` · <a href="#" data-action="open" data-id="${esc(shop.id)}">${esc(shop.name)}</a>` : ""}</div></div>
  </li>`;
}

function rmButton(key, label = "Remove") {
  if (!canEdit()) return "";
  const armed = state.armed === key;
  return `<button type="button" class="btn small ${armed ? "danger" : ""}" data-action="rm" data-key="${esc(key)}">${armed ? "Tap again to remove" : label}</button>`;
}

/* field builders */
function fld(f) {
  const id = `f-${f.form}-${f.name}`;
  const req = f.required ? "required" : "";
  let input;
  if (f.type === "select") input = `<select id="${id}" name="${f.name}">${f.options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(f.value ?? "") === String(v) ? "selected" : ""}>${esc(l)}</option>`; }).join("")}</select>`;
  else if (f.type === "textarea") input = `<textarea id="${id}" name="${f.name}" placeholder="${esc(f.ph || "")}" ${req}>${esc(f.value)}</textarea>`;
  else if (f.type === "file") input = `<input id="${id}" name="${f.name}" type="file" accept="image/*" ${f.multiple ? "multiple" : ""}>`;
  else input = `<input id="${id}" name="${f.name}" type="${f.type || "text"}" value="${esc(f.value)}" ${f.list ? `list="${f.list}"` : ""} placeholder="${esc(f.ph || "")}" ${f.attrs || ""} ${req}>`;
  return `<label class="field">${esc(f.label)}${input}</label>`;
}
function adder(form, summary, fields, submit, open = false) {
  if (!canEdit()) return "";
  return `<details class="adder panel" ${open ? "open" : ""}><summary>+ ${esc(summary)}</summary>
    <form class="inline-form" data-form="${form}"><div class="grid2">${fields.filter((f) => f.type !== "textarea" && f.type !== "file").map((f) => fld({ ...f, form })).join("")}</div>
    ${fields.filter((f) => f.type === "textarea" || f.type === "file").map((f) => fld({ ...f, form })).join("")}
    <div class="row-actions"><button class="btn primary" type="submit">${esc(submit)}</button></div></form></details>`;
}

/* ---------- views: today ---------- */
function viewToday() {
  const t = todayISO();
  const open = state.tasks.filter((x) => !x.done);
  const due = open.filter((x) => x.due && x.due <= t).sort((a, b) => a.due.localeCompare(b.due));
  const in7 = state.shops.filter((s) => s.nextVisit && s.nextVisit >= t && daysBetween(t, s.nextVisit) <= 7).sort((a, b) => a.nextVisit.localeCompare(b.nextVisit));
  const quiet = state.shops.filter(isQuiet).sort((a, b) => (a.lastVisit || "").localeCompare(b.lastVisit || ""));
  const top = state.shops.filter((s) => s.status === "prospect").sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1)).slice(0, 3);
  const recent = state.visits.slice(0, 4);
  const counts = { active: 0, prospect: 0, closed: 0 }; state.shops.forEach((s) => { if (counts[s.status] != null) counts[s.status]++; });
  const stat = (n, label, action, v) => `<button class="hero-stat" data-action="${action}" data-v="${v}"><b>${n}</b><span>${label}</span></button>`;
  const quick = (action, v, icon, label) => `<button class="quick-btn" data-action="${action}" ${v ? `data-v="${v}"` : ""}><span class="quick-ic">${icon}</span>${label}</button>`;
  const head = (title, link) => `<div class="section-head"><h2>${title}</h2>${link || ""}</div>`;
  return `${banner()}
  <section class="hero">
    <p class="hero-line">${due.length ? `<b>${plural(due.length, "task")}</b> due` : "No tasks due"} · ${in7.length ? `<b>${plural(in7.length, "visit")}</b> planned this week` : "no visits planned this week"}</p>
    <div class="hero-stats">${stat(counts.active, "Customers", "shop-filter", "active")}${stat(counts.prospect, "Prospects", "go", "prospects")}${stat(new Set(state.shops.map(areaOf)).size, "Areas", "shop-filter", "all")}${stat(counts.closed, "Closed", "shop-filter", "closed")}</div>
  </section>
  <div class="quick">${quick("talk", "", ICON.mic, "Debrief")}${canEdit() ? quick("new-shop", "", ICON.plus, "New shop") : ""}${quick("near-go", "", ICON.locate, "Near me")}${quick("go", "map", ICON.map, "Map")}</div>
  <section class="section">${head("Due today & overdue", `<a href="#agenda" class="link">Agenda</a>`)}
    <div class="panel"><ul class="list">${due.length ? due.map(taskRow).join("") : `<li class="empty">No tasks due. Follow-ups you mention after a visit land here.</li>`}</ul></div></section>
  <section class="section">${head("Planned visits", `<span class="muted small">Next 7 days</span>`)}
    <div class="panel"><ul class="list">${in7.length ? in7.map((s) => shopRow(s, `Visit ${fmtDate(s.nextVisit)}`)).join("") : `<li class="empty">No visits planned. Set a next visit on any shop.</li>`}</ul></div></section>
  <section class="section">${head("Going quiet", `<span class="muted small">${QUIET_DAYS}+ days since visit</span>`)}
    <div class="panel"><ul class="list">${quiet.length ? quiet.map((s) => shopRow(s, s.lastVisit ? `${daysSinceVisit(s)} days since visit` : "Never visited")).join("") : `<li class="empty">Every customer has been visited in the last ${QUIET_DAYS} days.</li>`}</ul></div></section>
  <section class="section">${head("Top prospects", `<a href="#prospects" class="link">See all</a>`)}
    <div class="panel"><ul class="list">${top.length ? top.map((s, i) => shopRow(s, "", i + 1)).join("") : `<li class="empty">No prospects yet. Add a shop and set its status to Prospect.</li>`}</ul></div></section>
  <section class="section">${head("Latest visit notes")}
    <div class="panel"><ul class="list">${recent.length ? recent.map((v) => { const s = shopById(v.shopId); return `<li><button class="item" data-action="open" data-id="${esc(v.shopId)}">${avatar(s ? s.name : "?")}<div class="grow"><div class="title">${esc(s ? s.name : "Shop")}</div><div class="sub">${fmtDate(v.date)} · ${esc(v.notes)}</div></div></button></li>`; }).join("") : `<li class="empty">No visits logged yet.</li>`}</ul></div></section>`;
}

/* ---------- views: agenda ---------- */
function viewAgenda() {
  const t = todayISO(), sel = state.agendaDay || t;
  const days = Array.from({ length: 21 }, (_, i) => addDays(t, i - 1));
  if (!days.includes(sel)) days.push(sel);
  const visitsOn = (day) => state.shops.filter((s) => s.nextVisit === day);
  const tasksOn = (day) => state.tasks.filter((x) => !x.done && x.due === day);
  const strip = `<div class="daystrip" role="group" aria-label="Days">${days.map((day) => { const dt = new Date(day + "T00:00:00"); const n = visitsOn(day).length + tasksOn(day).length; return `<button class="day ${day === t ? "today" : ""}" data-action="agenda-day" data-v="${day}" aria-pressed="${day === sel}"><span>${dt.toLocaleDateString("en-GB", { weekday: "short" })}</span><b>${dt.getDate()}</b><i class="${n ? "on" : ""}"></i></button>`; }).join("")}</div>`;
  const overdue = sel === t ? state.tasks.filter((x) => !x.done && x.due && x.due < t).sort((a, b) => a.due.localeCompare(b.due)) : [];
  const visits = visitsOn(sel), tasks = tasksOn(sel);
  const undated = state.tasks.filter((x) => !x.done && !x.due);
  const label = sel === t ? "Today" : sel === addDays(t, 1) ? "Tomorrow" : new Date(sel + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return `${banner()}${strip}
  <div class="section-head"><h2 class="day-title">${esc(label)}</h2><input type="date" class="date-jump" data-action="agenda-pick" value="${sel}" aria-label="Pick a date"></div>
  ${overdue.length ? `<section class="section"><h3 class="group bad">Overdue</h3><div class="panel"><ul class="list">${overdue.map(taskRow).join("")}</ul></div></section>` : ""}
  <section class="section"><h3 class="group">Visits</h3><div class="panel"><ul class="list">${visits.length ? visits.map((s) => shopRow(s, "Planned visit")).join("") : `<li class="empty">No visits planned. Set a next visit on a shop, or tell Jarvis.</li>`}</ul></div></section>
  <section class="section"><h3 class="group">Tasks</h3><div class="panel"><ul class="list">${tasks.length ? tasks.map(taskRow).join("") : `<li class="empty">Nothing due.</li>`}</ul></div>${taskForm(null, sel)}</section>
  ${undated.length ? `<section class="section"><h3 class="group">No date</h3><div class="panel"><ul class="list">${undated.map(taskRow).join("")}</ul></div></section>` : ""}
  <a href="#tasks" class="link center">See all tasks</a>`;
}

/* ---------- views: more ---------- */
function viewMore() {
  const item = (v, icon, label, sub) => `<li><button class="item" data-action="go" data-v="${v}"><span class="tile-ic">${icon}</span><div class="grow"><div class="title">${label}</div><div class="sub">${sub}</div></div><span class="chev">${ICON.chev}</span></button></li>`;
  const prospects = state.shops.filter((s) => s.status === "prospect").length;
  const openTasks = state.tasks.filter((x) => !x.done).length;
  return `${banner()}<div class="panel profile">${avatar(state.email, "ph big")}<div class="grow"><div class="title">${esc(state.email || "")}</div><div class="sub">${esc(syncText())}</div></div></div>
  <section class="section"><h3 class="group">Insights</h3><div class="panel"><ul class="list">
    ${item("map", ICON.map, "Map", `${state.shops.filter(hasGeo).length} of ${plural(state.shops.length, "shop")} on the map`)}
    ${item("prospects", ICON.star, "Prospects", `${prospects} ranked by score`)}
    ${item("market", ICON.chart, "Market share", "Back bar facings by company")}
    ${item("catalogues", ICON.book, "Catalogues", plural(state.catalogues.length, "company"))}
  </ul></div></section>
  <section class="section"><h3 class="group">Work</h3><div class="panel"><ul class="list">
    ${item("tasks", ICON.check, "All tasks", `${openTasks} open`)}
  </ul></div></section>
  <section class="section"><h3 class="group">App</h3><div class="panel"><ul class="list">
    ${item("settings", ICON.gear, "Settings", "Voice language, backup, sign out")}
  </ul></div></section>`;
}
function syncText() { return state.sync.online ? (state.sync.pending ? `${state.sync.pending} change(s) waiting to upload` : "All changes saved") : `Offline${state.sync.pending ? `, ${state.sync.pending} change(s) will upload later` : ""}`; }

/* ---------- views: prospects ---------- */
function viewProspects() {
  const ranked = state.shops.filter((s) => s.status === "prospect").sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));
  return `${banner()}<p class="muted small">Ranked by a score out of 100 from four ratings: ${CRITERIA.map((c) => c[1].toLowerCase()).join(", ")}. Set them in a shop's Edit screen.</p>
  <div class="panel"><ul class="list">${ranked.length ? ranked.map((s, i) => shopRow(s, "", i + 1)).join("") : `<li class="empty">No prospects yet. Add a shop and set its status to Prospect.</li>`}</ul></div>`;
}

/* ---------- views: shops ---------- */
function viewShops() {
  const q = state.query.trim().toLowerCase();
  const byStatus = state.shops.filter((s) => state.shopFilter === "all" || s.status === state.shopFilter);
  const areaCounts = {}; byStatus.forEach((s) => { const a = areaOf(s); areaCounts[a] = (areaCounts[a] || 0) + 1; });
  let list = byStatus.filter((s) => state.areaFilter === "all" || areaOf(s) === state.areaFilter);
  if (q) list = list.filter((s) => [s.name, s.area, s.city, s.owner, s.type, s.address].join(" ").toLowerCase().includes(q));
  const prospectMode = state.shopFilter === "prospect";
  const groups = {};
  list.forEach((s) => (groups[areaOf(s)] = groups[areaOf(s)] || []).push(s));
  const nearMode = state.near && state.here;
  const chip = (k, label) => `<button class="chip" data-action="filter" data-f="${k}" aria-pressed="${state.shopFilter === k}">${label}</button>`;
  const achip = (k, label, n) => `<button class="chip" data-action="area" data-a="${esc(k)}" aria-pressed="${state.areaFilter === k}">${esc(label)}${n != null ? `<span class="n">${n}</span>` : ""}</button>`;
  let body;
  if (!list.length) body = `<div class="panel"><div class="empty">${state.shops.length ? "No shops match." : "No shops yet. Add your first one, or tell me about it after a visit."}</div></div>`;
  else if (nearMode) {
    const near = list.filter(hasGeo).map((s) => ({ s, d: distKm(state.here, s) })).sort((a, b) => a.d - b.d);
    body = `<div class="panel"><ul class="list">${near.map(({ s, d }) => shopRow(s, fmtDist(d) + " away")).join("") || `<li class="empty">None of these shops has a saved location yet.</li>`}</ul></div>`;
  } else if (prospectMode) {
    const ranked = list.slice().sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));
    body = `<p class="muted small">Ranked by score out of 100 from four ratings: ${CRITERIA.map((c) => c[1].toLowerCase()).join(", ")}.</p><div class="panel"><ul class="list">${ranked.map((s, i) => shopRow(s, "", i + 1)).join("")}</ul></div>`;
  } else body = Object.keys(groups).sort((a, b) => a === "No area" ? 1 : b === "No area" ? -1 : a.localeCompare(b)).map((a) => `<section class="section"><div class="section-head"><h2>${esc(a)}</h2><span class="muted small num">${groups[a].length}</span></div>
      <div class="panel"><ul class="list">${groups[a].sort((x, y) => (x.name || "").localeCompare(y.name || "")).map((s) => shopRow(s)).join("")}</ul></div></section>`).join("");
  return `${banner()}
  <div class="search">${ic('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>')}<input id="shop-search" type="search" placeholder="Search name, area, owner" value="${esc(state.query)}" data-action="search" aria-label="Search shops"></div>
  <div class="scroller"><button class="chip" data-action="near" aria-pressed="${!!state.near}">📍 Near me</button>${chip("all", "All")}${chip("active", "Customers")}${chip("prospect", "Prospects")}${chip("closed", "Closed down")}${chip("lost", "Lost")}</div>
  <div class="scroller" role="group" aria-label="Areas">${achip("all", "All areas", byStatus.length)}${Object.keys(areaCounts).sort().map((a) => achip(a, a, areaCounts[a])).join("")}</div>
  ${body}`;
}

/* ---------- views: map ---------- */
function viewMap() {
  const geo = state.shops.filter(hasGeo).filter((s) => state.areaFilter === "all" || areaOf(s) === state.areaFilter);
  const missing = state.shops.filter((s) => !hasGeo(s));
  const areas = [...new Set(state.shops.filter(hasGeo).map(areaOf))].sort();
  const achip = (k, label) => `<button class="chip" data-action="area" data-a="${esc(k)}" aria-pressed="${state.areaFilter === k}">${esc(label)}</button>`;
  let svg = `<div class="empty">No shops have a location yet. Open a shop, tap Edit details and paste its Google Maps link.</div>`;
  if (geo.length) {
    const pts = state.here ? [...geo, state.here] : geo;
    const W = 400, H = 300, P = 34;
    let minLat = Math.min(...pts.map((s) => s.lat)), maxLat = Math.max(...pts.map((s) => s.lat));
    let minLng = Math.min(...pts.map((s) => s.lng)), maxLng = Math.max(...pts.map((s) => s.lng));
    const padD = 0.002; if (maxLat - minLat < padD) { minLat -= padD; maxLat += padD; } if (maxLng - minLng < padD) { minLng -= padD; maxLng += padD; }
    const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const spanX = (maxLng - minLng) * k, spanY = maxLat - minLat;
    const scale = Math.min((W - 2 * P) / spanX, (H - 2 * P) / spanY);
    const ox = (W - spanX * scale) / 2, oy = (H - spanY * scale) / 2;
    const xy = (s) => [ox + (s.lng - minLng) * k * scale, oy + (maxLat - s.lat) * scale];
    const groups = {}; geo.forEach((s) => (groups[areaOf(s)] = groups[areaOf(s)] || []).push(xy(s)));
    const areaLbls = Object.entries(groups).map(([a, pts]) => { const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length, cy = pts.reduce((t, p) => t + p[1], 0) / pts.length; return `<text class="area-lbl" x="${cx.toFixed(0)}" y="${Math.max(14, cy - 18).toFixed(0)}" text-anchor="middle">${esc(a)}</text>`; }).join("");
    const showNames = geo.length <= 30;
    const dots = geo.map((s) => { const [x, y] = xy(s); return `<g><circle class="dot ${esc(s.status)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" data-action="open" data-id="${esc(s.id)}" tabindex="0" role="button" aria-label="${esc(s.name)}"><title>${esc(s.name)} · ${esc(STATUSES[s.status] || "")}</title></circle>${showNames ? `<text class="lbl" x="${(x > W * 0.65 ? x - 12 : x + 12).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${x > W * 0.65 ? "end" : "start"}">${esc((s.name || "").replace(/^Example:\s*/, "").slice(0, 22))}</text>` : ""}</g>`; }).join("");
    svg = `<div class="map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of your shops by GPS position"><rect class="frame" x="0" y="0" width="${W}" height="${H}" rx="10"/>${areaLbls}${dots}${state.here ? (() => { const [x, y] = xy(state.here); return `<circle class="here-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14"/><circle class="here" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"><title>You are here</title></circle>`; })() : ""}</svg></div>
    <div class="legend"><span><i style="background:var(--good)"></i>Customer</span><span><i style="background:var(--warn)"></i>Prospect</span><span><i style="background:var(--bad)"></i>Closed or lost</span><span><i style="background:var(--here)"></i>You</span></div>`;
  }
  return `${banner()}<p class="muted small">Every shop with a saved location, placed by GPS. Tap a dot to open the shop. The target button at the top shows where you are.</p>
  ${areas.length > 1 ? `<div class="scroller">${achip("all", "All areas")}${areas.map((a) => achip(a, a)).join("")}</div>` : ""}
  <div class="panel">${svg}</div>
  ${missing.length ? `<section class="section"><div class="section-head"><h2>Missing a location</h2><span class="muted small num">${missing.length}</span></div><div class="panel"><ul class="list">${missing.map((s) => shopRow(s, "No GPS yet")).join("")}</ul></div></section>` : ""}`;
}

/* ---------- views: market ---------- */
function marketShare(shops, cat) {
  const byCo = {}, presence = {}; let total = 0; let withData = 0;
  shops.forEach((s) => {
    const rows = (s.backbar || []).filter((b) => cat === "all" || (b.category || "Other") === cat);
    if (rows.length) withData++;
    const seen = new Set();
    rows.forEach((b) => { const co = (b.company || "").trim() || "Unknown company"; const f = Number(b.facings) || 1; byCo[co] = (byCo[co] || 0) + f; total += f; seen.add(co); });
    seen.forEach((co) => presence[co] = (presence[co] || 0) + 1);
  });
  const rows = Object.entries(byCo).map(([co, f]) => ({ co, f, pct: total ? f / total * 100 : 0, shops: presence[co] || 0 })).sort((a, b) => b.f - a.f);
  return { rows, total, withData };
}
function shareBars(rows, mine) {
  if (!rows.length) return `<div class="empty">No back bar labels recorded yet. Add them on a shop's Back bar tab, or send me photos of the back bar.</div>`;
  return `<div class="share">${rows.map((r) => `<div class="share-row ${mine && r.co.toLowerCase() === mine.toLowerCase() ? "mine" : ""}"><span class="name">${esc(r.co)}</span><span class="track" title="${esc(r.co)}: ${r.f} facings, ${r.pct.toFixed(1)}%"><span class="fill" style="display:block;width:${r.pct.toFixed(1)}%"></span></span><span class="val">${r.pct.toFixed(0)}%</span></div>`).join("")}</div>`;
}
function viewMarket() {
  const seg = `<div class="segmented" role="group"><button data-action="seg" data-s="share" aria-pressed="${state.marketSeg === "share"}">Market share</button><button data-action="seg" data-s="catalogues" aria-pressed="${state.marketSeg === "catalogues"}">Catalogues</button></div>`;
  if (state.marketSeg === "catalogues") {
    const cats = state.catalogues.slice().sort((a, b) => (a.company || "").localeCompare(b.company || ""));
    return `${banner()}
    <p class="muted small">One catalogue per company. Brands you add here are recognised when you record a back bar, so each label is counted for the right company.</p>
    <div class="panel"><ul class="list">${cats.length ? cats.map((c) => { const p = (c.photos || [])[0]; return `<li><button class="item" data-action="open-cat" data-id="${esc(c.id)}">${p ? `<span class="thumb"><img ${img(p.id)} alt="" loading="lazy"></span>` : `<span class="ph">${esc((c.company || "?").charAt(0).toUpperCase())}</span>`}<div class="grow"><div class="title">${esc(c.company)}</div><div class="sub">${(c.items || []).length} products · ${(c.photos || []).length} photos</div></div></button></li>`; }).join("") : `<li class="empty">No catalogues yet. Add a company, then upload photos of its catalogue. I can type the products in from the photos.</li>`}</ul></div>
    ${adder("catalogue", "Add company catalogue", [{ name: "company", label: "Company", required: true, list: "dl-companies" }], "Add company")}`;
  }
  const shops = state.shops.filter((s) => state.marketArea === "all" || areaOf(s) === state.marketArea);
  const cats = [...new Set(state.shops.flatMap((s) => (s.backbar || []).map((b) => b.category || "Other")))].sort();
  const { rows, total, withData } = marketShare(shops, state.marketCat);
  const areas = [...new Set(state.shops.filter((s) => (s.backbar || []).length).map(areaOf))].sort();
  const mine = state.settings.myCompany || "";
  const chip = (act, attr, k, label, cur) => `<button class="chip" data-action="${act}" data-v="${esc(k)}" aria-pressed="${cur === k}">${esc(label)}</button>`;
  const brands = {}; shops.forEach((s) => (s.backbar || []).filter((b) => state.marketCat === "all" || (b.category || "Other") === state.marketCat).forEach((b) => { const k = b.brand || "?"; brands[k] = brands[k] || { f: 0, co: b.company || "", shops: new Set() }; brands[k].f += Number(b.facings) || 1; brands[k].shops.add(s.id); }));
  const topBrands = Object.entries(brands).sort((a, b) => b[1].f - a[1].f).slice(0, 12);
  return `${banner()}
  <p class="muted small">Share of back bar facings by company, from the labels recorded in each shop. ${withData} shop${withData === 1 ? "" : "s"} with data, ${total} facings counted.</p>
  ${areas.length ? `<div class="scroller">${chip("m-area", "", "all", "All areas", state.marketArea)}${areas.map((a) => chip("m-area", "", a, a, state.marketArea)).join("")}</div>` : ""}
  ${cats.length ? `<div class="scroller">${chip("m-cat", "", "all", "All categories", state.marketCat)}${cats.map((c) => chip("m-cat", "", c, c, state.marketCat)).join("")}</div>` : ""}
  <section class="section"><h2>Share by company</h2><div class="panel">${shareBars(rows, mine)}</div></section>
  ${rows.length ? `<section class="section"><h2>Presence</h2><div class="panel table-wrap"><table><thead><tr><th>Company</th><th class="r">Facings</th><th class="r">Share</th><th class="r">In shops</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.co)}</td><td class="r num">${r.f}</td><td class="r num">${r.pct.toFixed(1)}%</td><td class="r num">${r.shops}/${withData}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
  ${topBrands.length ? `<section class="section"><h2>Top brands</h2><div class="panel table-wrap"><table><thead><tr><th>Brand</th><th>Company</th><th class="r">Facings</th><th class="r">Shops</th></tr></thead><tbody>${topBrands.map(([b, v]) => `<tr><td>${esc(b)}</td><td class="muted">${esc(v.co)}</td><td class="r num">${v.f}</td><td class="r num">${v.shops.size}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
  ${canEdit() ? `<form class="panel inline-form" data-form="settings"><div class="grid2">${fld({ form: "settings", name: "myCompany", label: "Your company (highlighted in the chart)", value: mine, list: "dl-companies" })}</div><div class="row-actions"><button class="btn small" type="submit">Save</button></div></form>` : ""}`;
}

function viewCatalogue(c) {
  const items = (c.items || []).slice().sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.brand || "").localeCompare(b.brand || ""));
  return `  <section class="section"><div class="section-head"><h2>Catalogue photos</h2>${uploadBtn("cat-photo", "Add photos")}</div>
    <div class="panel">${gallery((c.photos || []), "catalogues", c.id) || `<div class="empty">No photos yet. Upload pages of the catalogue and I'll type the products into the list below.</div>`}</div>${(c.photos || []).length ? readingPanel("catalogue") : ""}</section>
  <section class="section"><div class="section-head"><h2>Products</h2><span class="muted small num">${items.length}</span></div>
    <div class="panel table-wrap">${items.length ? `<table><thead><tr><th>Brand</th><th>Product</th><th>Category</th><th>Size</th><th>Price</th><th></th></tr></thead><tbody>${(c.items || []).map((it, i) => ({ it, i })).sort((a, b) => (a.it.category || "").localeCompare(b.it.category || "") || (a.it.brand || "").localeCompare(b.it.brand || "")).map(({ it, i }) => `<tr><td>${esc(it.brand)}</td><td>${esc(it.product)}</td><td class="muted">${esc(it.category)}</td><td class="num">${esc(it.size)}</td><td class="num">${esc(it.price)}</td><td class="r">${rmButton(`cat:${c.id}:items:${i}`)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No products listed yet.</div>`}</div>
    ${adder("cat-item", "Add product", [{ name: "brand", label: "Brand", required: true }, { name: "product", label: "Product" }, { name: "category", label: "Category", list: "dl-cats" }, { name: "size", label: "Size", ph: "e.g. 70cl, 330ml" }, { name: "price", label: "Price", ph: "e.g. €14.50" }], "Add product")}</section>
  ${canEdit() ? `<div class="row-actions">${rmButton(`catdoc:${c.id}`, "Delete this catalogue")}</div>` : ""}`;
}

/* ---------- views: settings ---------- */
function viewSettings() {
  const vchip = (k, l) => `<button class="chip" data-action="voice-lang" data-v="${k}" aria-pressed="${state.voiceLang === k}">${l}</button>`;
  return `<section class="section"><h2>Account</h2><div class="panel"><dl class="kv"><dt>Signed in as</dt><dd>${esc(state.email || "")}</dd><dt>Sync</dt><dd>${esc(syncText())}</dd></dl></div></section>
  <section class="section"><h2>Voice language</h2><div class="chips">${vchip("el-GR", "Ελληνικά")}${vchip("en-US", "English")}</div><p class="muted small">The language the Talk microphone listens for. Jarvis understands both either way.</p></section>
  <section class="section"><h2>Backup</h2><p class="muted small">Download everything (shops, tasks, visits, catalogues) as one file. Photos stay in your private storage.</p><div class="row-actions"><button class="btn" data-action="backup">Download backup</button></div></section>
  <div class="row-actions"><button class="btn danger" data-action="sign-out">Sign out</button></div>`;
}

/* ---------- views: tasks ---------- */
function viewTasks() {
  const open = state.tasks.filter((t) => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const done = state.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
  return `${banner()}
  ${taskForm(null)}
  <div class="panel"><ul class="list">${open.length ? open.map(taskRow).join("") : `<li class="empty">No open tasks.</li>`}</ul></div>
  ${done.length ? `<button class="back" data-action="toggle-done">${state.showDone ? "Hide" : "Show"} ${done.length} done</button>
  ${state.showDone ? `<div class="panel"><ul class="list">${done.slice(0, 50).map(taskRow).join("")}</ul></div>` : ""}` : ""}`;
}
function taskForm(shopId, due = "") {
  const opts = [["", "None"], ...state.shops.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((s) => [s.id, s.name])];
  const fields = [{ name: "title", label: "Task", required: true, ph: "e.g. Send new price list to the owner" }, { name: "due", label: "Due", type: "date", value: due }];
  if (!shopId) fields.push({ name: "shopId", label: "Shop", type: "select", options: opts });
  return adder(shopId ? `task:${shopId}` : "task", "Add task", fields, "Add task");
}

/* ---------- views: shop wallet ---------- */
function uploadBtn(kind, label) {
  if (!canUpload()) return "";
  return `<span class="row-actions"><label class="btn small upload">Camera<input type="file" accept="image/*" capture="environment" data-upload="${esc(kind)}"></label><label class="btn small upload">${esc(label === "Add photos" ? "Gallery" : label)}<input type="file" accept="image/*" multiple data-upload="${esc(kind)}"></label></span>`;
}
function gallery(photos, coll, docId) {
  if (!photos.length) return "";
  return `<div class="gallery">${photos.map((p) => `<button data-action="lightbox" data-coll="${coll}" data-doc="${esc(docId)}" data-pid="${esc(p.id)}" aria-label="${esc(p.caption || "Photo")}"><img ${img(p.id)} alt="${esc(p.caption || "")}" loading="lazy"></button>`).join("")}</div>`;
}
function photoThumb(s, pid) { return pid ? `<button class="thumb" data-action="lightbox-one" data-pid="${esc(pid)}" aria-label="Open photo"><img ${img(pid)} alt="" loading="lazy"></button>` : ""; }

function tabOverview(s) {
  const sc = scoreOf(s);
  const kv = [["Owner", esc(s.owner)], ["Area", esc([s.area, s.city].filter(Boolean).join(", "))], ["Address", esc(s.address)], ["GPS", hasGeo(s) ? `<span class="num">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</span>` : ""], ["Next visit", fmtDate(s.nextVisit)], ["Last visit", s.lastVisit ? `${fmtDate(s.lastVisit)} (${daysSinceVisit(s)} days ago)` : ""], ["Our investment", s.investAmount ? `<span class="num">${esc(money(s.investAmount))}</span>` : ""], ["Investment details", esc(s.investNotes)]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  const n = (a) => (s[a] || []).length;
  return `<div class="stats"><div class="stat"><b>${n("assets")}</b><span>Company assets</span></div><div class="stat"><b>${n("posm")}</b><span>POSM items</span></div><div class="stat"><b>${n("backbar")}</b><span>Back bar labels</span></div><div class="stat"><b>${n("contacts")}</b><span>Contacts</span></div></div>
  <section class="section"><h2>Details</h2><div class="panel">${kv ? `<dl class="kv">${kv}</dl>` : `<div class="empty">No details yet.</div>`}</div></section>
  <section class="section"><h2>Inside info</h2><div class="panel">${s.insideInfo ? `<div class="prose">${esc(s.insideInfo)}</div>` : `<div class="empty">Nothing yet. Competitor deals, the owner's plans, who really decides.</div>`}</div></section>
  ${s.status === "prospect" ? `<section class="section"><div class="section-head"><h2>Prospect rating</h2><span class="num">${sc == null ? "–" : sc}/100</span></div><div class="panel">${CRITERIA.map(([k, l]) => { const v = Number((s.scores || {})[k]) || 0; return `<div class="crit"><span>${l}</span><span class="num">${v}/5</span><div class="scorebar" style="grid-column:1/-1">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= v ? "on" : ""}"></span>`).join("")}</div></div>`; }).join("")}</div></section>` : ""}
  ${canEdit() ? `<div class="row-actions"><button class="btn" data-action="edit">Edit details</button></div>` : ""}`;
}

function tabPhotos(s) {
  return PHOTO_KINDS.filter(([k]) => k !== "backbar" && k !== "menu").map(([k, l]) => { const ps = (s.photos || []).filter((p) => p.kind === k); return `<section class="section"><div class="section-head"><h2>${l}</h2>${uploadBtn("shop:" + k, "Add photos")}</div><div class="panel">${gallery(ps, "shops", s.id) || `<div class="empty">No photos yet.</div>`}</div></section>`; }).join("")
    + (canUpload() ? "" : `<div class="note">Photo uploads need you to be signed in as the owner of this app.</div>`);
}

function itemTable(s, field, cols, emptyText) {
  const rows = s[field] || [];
  if (!rows.length) return `<div class="empty">${emptyText}</div>`;
  return `<ul class="list">${rows.map((r, i) => `<li class="item">${photoThumb(s, r.photoId) || `<span class="ph" aria-hidden="true">${esc((r[cols[0]] || "?").charAt(0).toUpperCase())}</span>`}<div class="grow"><div class="title">${esc(r[cols[0]])}${r.qty && Number(r.qty) > 1 ? ` <span class="muted num">×${esc(r.qty)}</span>` : ""}</div><div class="sub">${cols.slice(1).map((c) => r[c[0]] ? `${c[1]}: ${c[1] === "S/N" ? `<span class="num">${esc(r[c[0]])}</span>` : esc(r[c[0]])}` : "").filter(Boolean).join(" · ")}</div></div>${rmButton(`shop:${s.id}:${field}:${i}`)}</li>`).join("")}</ul>`;
}

function tabAssets(s) {
  return `<p class="muted small">Company equipment placed in this shop. Add a photo of the label so the serial number and brand are on record.</p>
  <div class="panel">${itemTable(s, "assets", ["type", ["brand", "Brand"], ["serial", "S/N"], ["placed", "Placed"], ["notes", "Notes"]], "No company assets recorded.")}</div>
  ${adder(`asset:${s.id}`, "Add company asset", [{ name: "type", label: "Asset", type: "select", options: ASSET_TYPES }, { name: "brand", label: "Brand", list: "dl-brands" }, { name: "serial", label: "Serial number (S/N)" }, { name: "qty", label: "Qty", type: "number", value: 1, attrs: 'min="1" inputmode="numeric"' }, { name: "placed", label: "Placed", type: "date" }, { name: "notes", label: "Notes" }, ...(canUpload() ? [{ name: "photo", label: "Photo of asset or S/N label", type: "file" }] : [])], "Save asset")}`;
}

function tabPosm(s) {
  const byType = {}; (s.posm || []).forEach((p) => byType[p.type] = (byType[p.type] || 0) + (Number(p.qty) || 1));
  return `${Object.keys(byType).length ? `<div class="chips">${Object.entries(byType).map(([t, n]) => `<span class="pill" style="color:var(--ink)">${esc(t)} <span class="num">${n}</span></span>`).join("")}</div>` : ""}
  <div class="panel">${itemTable(s, "posm", ["type", ["brand", "Brand"], ["placed", "Placed"], ["notes", "Notes"]], "No POSM recorded. Umbrellas, street blackboards, coasters, menu boards and so on.")}</div>
  ${adder(`posm:${s.id}`, "Add POSM", [{ name: "type", label: "POSM", type: "select", options: POSM_TYPES }, { name: "brand", label: "Brand on it", list: "dl-brands" }, { name: "qty", label: "Qty", type: "number", value: 1, attrs: 'min="1" inputmode="numeric"' }, { name: "placed", label: "Placed", type: "date" }, { name: "notes", label: "Notes", ph: "Condition, who supplied it" }, ...(canUpload() ? [{ name: "photo", label: "Photo", type: "file" }] : [])], "Save POSM")}`;
}

function tabBackbar(s) {
  const ps = (s.photos || []).filter((p) => p.kind === "backbar");
  const { rows } = marketShare([s], "all");
  const bb = (s.backbar || []).map((b, i) => ({ b, i })).sort((x, y) => (x.b.category || "").localeCompare(y.b.category || "") || (x.b.company || "").localeCompare(y.b.company || ""));
  return `<section class="section"><div class="section-head"><h2>Back bar photos</h2>${uploadBtn("shop:backbar", "Add photos")}</div>
    <div class="panel">${gallery(ps, "shops", s.id) || `<div class="empty">No photos yet. Snap the back bar, and I can read the labels into the list below.</div>`}</div>${ps.length ? readingPanel("backbar") : ""}</section>
  <section class="section"><div class="section-head"><h2>Labels on the back bar</h2>${s.backbarDate ? `<span class="muted small">Counted ${fmtDate(s.backbarDate)}</span>` : ""}</div>
    <div class="panel table-wrap">${bb.length ? `<table><thead><tr><th>Brand</th><th>Company</th><th>Category</th><th class="r">Facings</th><th></th></tr></thead><tbody>${bb.map(({ b, i }) => `<tr><td>${esc(b.brand)}</td><td class="muted">${esc(b.company)}</td><td class="muted">${esc(b.category)}</td><td class="r num">${esc(b.facings || 1)}</td><td class="r">${rmButton(`shop:${s.id}:backbar:${i}`)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No labels recorded.</div>`}</div>
    ${adder(`backbar:${s.id}`, "Add label", [{ name: "brand", label: "Brand", required: true, list: "dl-brands" }, { name: "company", label: "Company (auto from catalogue)", list: "dl-companies" }, { name: "category", label: "Category", list: "dl-cats" }, { name: "facings", label: "Facings / bottles", type: "number", value: 1, attrs: 'min="1" inputmode="numeric"' }], "Add label")}</section>
  ${rows.length ? `<section class="section"><h2>Share in this shop</h2><div class="panel">${shareBars(rows, state.settings.myCompany)}</div></section>` : ""}`;
}

function tabMenu(s) {
  const ps = (s.photos || []).filter((p) => p.kind === "menu");
  const prods = s.products || [];
  return `<section class="section"><div class="section-head"><h2>Menu & price list photos</h2>${uploadBtn("shop:menu", "Add photos")}</div>
    <div class="panel">${gallery(ps, "shops", s.id) || `<div class="empty">No photos of their menu or price list yet.</div>`}</div></section>
  <section class="section"><h2>Products they buy from us</h2>
    <div class="panel table-wrap">${prods.length ? `<table><thead><tr><th>Product</th><th>Our price / terms</th><th>Shelf price</th><th></th></tr></thead><tbody>${prods.map((p, i) => `<tr><td>${esc(p.name)}${p.notes ? `<div class="muted small">${esc(p.notes)}</div>` : ""}</td><td class="num">${esc(p.price)}</td><td class="num">${esc(p.menuPrice)}</td><td class="r">${rmButton(`shop:${s.id}:products:${i}`)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No products recorded.</div>`}</div>
    ${adder(`product:${s.id}`, "Add product", [{ name: "name", label: "Product", required: true, list: "dl-products" }, { name: "price", label: "Our price / terms", ph: "e.g. €0.85 / bottle" }, { name: "menuPrice", label: "Their menu price", ph: "e.g. €4.50" }, { name: "notes", label: "Notes" }], "Add product")}
    ${s.pricingNotes ? `<div class="panel"><div class="prose">${esc(s.pricingNotes)}</div></div>` : ""}</section>`;
}

function consChart(entries) {
  const months = [...new Set(entries.map((e) => e.month))].sort().slice(-12);
  const vals = months.map((m) => entries.filter((e) => e.month === m).reduce((t, e) => t + (Number(e.qty) || 0), 0));
  const max = Math.max(...vals, 1);
  const W = 360, H = 190, L = 30, B = 22, T = 16, R = 4;
  const bw = (W - L - R) / months.length;
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); const m = max / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
  const y = (v) => H - B - (v / nice) * (H - B - T);
  const ticks = [0, nice / 2, nice];
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly consumption">
    ${ticks.map((t) => `<line class="gridline" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join("")}
    ${months.map((m, i) => { const x = L + i * bw + 3, w = Math.max(4, bw - 6), v = vals[i], top = y(v); const hgt = H - B - top; return `${v > 0 ? "" : "<!--"}<path class="bar ${i === months.length - 1 ? "last" : ""}" d="M${x},${H - B} V${top + Math.min(4, hgt)} q0,-4 4,-4 h${w - 8} q4,0 4,4 V${H - B} Z"><title>${fmtMonth(m)}: ${v}</title></path>${v > 0 ? "" : "-->"}<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${fmtMonth(m).split(" ")[0]}</text>${i === months.length - 1 || v === max ? `<text x="${x + w / 2}" y="${top - 5}" text-anchor="middle" style="fill:var(--ink)">${v}</text>` : ""}`; }).join("")}
  </svg></div>`;
}

function tabConsumption(s) {
  const all = s.consumption || [];
  const products = [...new Set(all.map((e) => e.product))].sort();
  const cur = products.includes(state.consProduct) ? state.consProduct : products[0];
  const entries = all.filter((e) => e.product === cur);
  const unit = entries[0] ? entries[0].unit : "";
  const months = [...new Set(entries.map((e) => e.month))].sort();
  let trend = "";
  if (months.length >= 2) { const sum = (m) => entries.filter((e) => e.month === m).reduce((t, e) => t + (Number(e.qty) || 0), 0); const a = sum(months[months.length - 2]), b = sum(months[months.length - 1]); if (a) { const d = (b - a) / a * 100; trend = `<span class="pill" style="color:${d >= 0 ? "var(--good)" : "var(--bad)"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(0)}% vs previous month</span>`; } }
  return `<p class="muted small">Monthly volumes per product, so you can see whether the shop is growing or slipping.</p>
  ${products.length ? `<div class="scroller">${products.map((p) => `<button class="chip" data-action="cons-product" data-v="${esc(p)}" aria-pressed="${p === cur}">${esc(p)}</button>`).join("")}</div>
  <section class="section"><div class="section-head"><h2>${esc(cur)}${unit ? ` <span class="muted small">(${esc(unit)})</span>` : ""}</h2>${trend}</div><div class="panel">${consChart(entries)}</div></section>
  <div class="panel table-wrap"><table><thead><tr><th>Month</th><th>Product</th><th class="r">Qty</th><th></th></tr></thead><tbody>${all.map((e, i) => ({ e, i })).sort((a, b) => b.e.month.localeCompare(a.e.month)).slice(0, 60).map(({ e, i }) => `<tr><td class="num">${fmtMonth(e.month)}</td><td>${esc(e.product)}</td><td class="r num">${esc(e.qty)} ${esc(e.unit)}</td><td class="r">${rmButton(`shop:${s.id}:consumption:${i}`)}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="panel"><div class="empty">No consumption recorded yet. Add monthly figures below, or send me the sales file and I'll load it.</div></div>`}
  ${adder(`cons:${s.id}`, "Add monthly figure", [{ name: "month", label: "Month", type: "month", required: true, value: todayISO().slice(0, 7) }, { name: "product", label: "Product", required: true, list: "dl-products", value: cur || "" }, { name: "qty", label: "Quantity", type: "number", required: true, attrs: 'min="0" step="any" inputmode="decimal"' }, { name: "unit", label: "Unit", value: unit || "", ph: "kegs, cases, bottles" }], "Add figure")}`;
}

function tabContacts(s) {
  const cs = s.contacts || [];
  return `<div class="panel">${cs.length ? `<ul class="list">${cs.map((c, i) => `<li class="item"><span class="ph" aria-hidden="true">${esc((c.name || "?").charAt(0).toUpperCase())}</span><div class="grow"><div class="title">${esc(c.name)}${c.role ? ` <span class="muted small">${esc(c.role)}</span>` : ""}</div><div class="sub">${c.phone ? `<a href="tel:${esc(c.phone.replace(/\s/g, ""))}" class="num">${esc(c.phone)}</a>` : ""}${c.phone && c.email ? " · " : ""}${c.email ? `<span>${esc(c.email)}</span>` : ""}${c.notes ? `<div>${esc(c.notes)}</div>` : ""}</div></div>${rmButton(`shop:${s.id}:contacts:${i}`)}</li>`).join("")}</ul>` : `<div class="empty">No contacts yet.</div>`}</div>
  ${adder(`contact:${s.id}`, "Add contact", [{ name: "name", label: "Name", required: true }, { name: "role", label: "Role", ph: "Owner, manager, bartender" }, { name: "phone", label: "Phone", type: "tel" }, { name: "email", label: "Email", type: "email" }, { name: "notes", label: "Notes", ph: "Best time to call, birthday, likes" }], "Save contact")}`;
}

function tabVisits(s) {
  const visits = state.visits.filter((v) => v.shopId === s.id);
  const tasks = state.tasks.filter((t) => t.shopId === s.id && !t.done);
  return `<section class="section"><h2>Open tasks</h2><div class="panel"><ul class="list">${tasks.length ? tasks.map(taskRow).join("") : `<li class="empty">No open tasks for this shop.</li>`}</ul></div>${taskForm(s.id)}</section>
  <section class="section"><h2>Visit history</h2>
  ${adder(`visit:${s.id}`, "Log a visit", [{ name: "date", label: "Date", type: "date", required: true, value: todayISO() }, { name: "notes", label: "What happened", type: "textarea", required: true, ph: "Who you met, orders, POSM placed, complaints, next steps" }], "Save visit")}
  <div class="panel">${visits.length ? `<ul class="list">${visits.map((v) => `<li class="item"><div class="grow"><div class="sub num">${fmtDate(v.date)}</div><div style="white-space:pre-wrap">${esc(v.notes)}</div></div></li>`).join("")}</ul>` : `<div class="empty">No visits logged yet.</div>`}</div></section>`;
}

function viewShop(s) {
  if (state.editing) return viewEdit(s);
  const c = cover(s);
  const tabs = { overview: tabOverview, photos: tabPhotos, assets: tabAssets, posm: tabPosm, backbar: tabBackbar, menu: tabMenu, consumption: tabConsumption, contacts: tabContacts, visits: tabVisits };
  const phone = (s.contacts || []).map((x) => x.phone).find(Boolean);
  return `<div class="shop-hero ${c ? "" : "noimg"}">${c ? `<img ${img(c)} alt="Shop front of ${esc(s.name)}">` : avatar(s.name, "hero-av")}
    <div class="shop-hero-text">
      <div class="chips">${s.example ? `<span class="pill example">Example data</span>` : ""}<span class="pill solid ${esc(s.status)}">${esc(STATUSES[s.status] || "")}</span></div>
      <h1>${esc(s.name || "Untitled shop")}</h1>
      <div class="meta">${s.type ? `<span>${esc(s.type)}</span>` : ""}${s.area ? `<span>${esc(s.area)}</span>` : ""}${s.status === "prospect" && scoreOf(s) != null ? `<span>Score <b class="num">${scoreOf(s)}</b>/100</span>` : ""}</div>
    </div></div>
  <div class="actions4">
    <a class="act" href="${mapsDir(s)}" target="_blank" rel="noopener"><span class="act-ic">${ICON.nav}</span>Directions</a>
    ${phone ? `<a class="act" href="tel:${esc(phone.replace(/\s/g, ""))}"><span class="act-ic">${ICON.phone}</span>Call</a>` : `<button class="act" data-action="shop-tab" data-v="contacts"><span class="act-ic">${ICON.phone}</span>Contacts</button>`}
    <button class="act" data-action="talk"><span class="act-ic">${ICON.mic}</span>Debrief</button>
    <button class="act" data-action="shop-tab" data-v="photos"><span class="act-ic">${ICON.camera}</span>Photos</button>
  </div>
  <div class="tabbar" role="tablist" aria-label="Shop sections">${SHOP_TABS.map(([k, l]) => `<button class="tab" role="tab" data-action="shop-tab" data-v="${k}" aria-selected="${state.shopTab === k}">${l}</button>`).join("")}</div>
  ${tabs[state.shopTab](s)}`;
}

function viewEdit(s) {
  const isNew = !s.id;
  const F = "shop";
  const f = (name, label, type = "text", extra = {}) => fld({ form: F, name, label, type, value: s[name], ...extra });
  return `<form class="section" data-form="shop">
    <div class="panel inline-form">
      ${f("name", "Shop name", "text", { required: true })}
      <div class="grid2">
        ${fld({ form: F, name: "type", label: "Type", type: "select", options: TYPES, value: s.type })}
        ${fld({ form: F, name: "status", label: "Status", type: "select", options: Object.entries(STATUSES), value: s.status })}
        ${f("owner", "Owner")}
        ${f("area", "Area", "text", { list: "dl-areas", ph: "e.g. Thiseio" })}
        ${f("city", "City", "text", { list: "dl-cities", value: s.city || "Athens" })}
      </div>
      ${f("address", "Address")}
      ${fld({ form: F, name: "location", label: "Location: paste the Google Maps link or coordinates", value: hasGeo(s) ? `${s.lat}, ${s.lng}` : (s.mapsLink || ""), ph: "37.97591, 23.72066 or https://www.google.com/maps/..." })}
      <div class="row-actions"><button type="button" class="btn small" data-action="use-gps">Use my current location</button><span class="muted small" id="gps-note">Stand at the shop's door for the best fix.</span></div>
      <div class="grid2">${f("lastVisit", "Last visit", "date")}${f("nextVisit", "Next visit", "date")}</div>
    </div>
    <div class="panel inline-form"><h2>Our investment</h2>
      <div class="grid2">${f("investAmount", "Total invested (€)", "number", { attrs: 'inputmode="decimal" min="0" step="any"' })}</div>
      ${fld({ form: F, name: "investNotes", label: "Details", type: "textarea", value: s.investNotes })}</div>
    <div class="panel inline-form">${fld({ form: F, name: "insideInfo", label: "Inside info", type: "textarea", value: s.insideInfo })}
      ${fld({ form: F, name: "pricingNotes", label: "Pricing notes (discounts, terms, competitor offers)", type: "textarea", value: s.pricingNotes })}</div>
    <div class="panel inline-form"><h2>Prospect rating (0 to 5)</h2><div class="grid2">${CRITERIA.map(([k, l]) => fld({ form: F, name: "sc_" + k, label: l, type: "number", value: (s.scores || {})[k], attrs: 'min="0" max="5" step="1"' })).join("")}</div></div>
    <div class="row-actions"><button class="btn primary" type="submit">Save shop</button><button class="btn" type="button" data-action="${isNew ? "back" : "cancel-edit"}">Cancel</button>${isNew ? "" : rmButton(`shopdoc:${s.id}`, "Delete shop")}</div>
  </form>`;
}

/* ---------- lightbox ---------- */
function renderLightbox() {
  const lb = state.lightbox;
  if (!lb) { lbRoot.innerHTML = ""; return; }
  const p = lb.list[lb.index];
  if (!p) { state.lightbox = null; lbRoot.innerHTML = ""; return; }
  const kindLabel = (PHOTO_KINDS.find(([k]) => k === p.kind) || [, ""])[1];
  lbRoot.innerHTML = `<div class="lightbox" role="dialog" aria-label="Photo">
    <div class="bar"><span>${esc(kindLabel)}${p.at ? ` · ${fmtDate(p.at.slice(0, 10))}` : ""}${lb.list.length > 1 ? ` · ${lb.index + 1} of ${lb.list.length}` : ""}</span><button class="btn small" data-lb="close">Close</button></div>
    <div class="img"><img ${img(p.id)} alt="${esc(p.caption || "")}"></div>
    <div class="bar"><span>${lb.list.length > 1 ? `<button class="btn small" data-lb="prev">Previous</button> <button class="btn small" data-lb="next">Next</button>` : ""}</span>
    ${lb.coll && canEdit() ? `<button class="btn small ${lb.armed ? "danger" : ""}" data-lb="delete">${lb.armed ? "Tap again to delete photo" : "Delete photo"}</button>` : ""}</div></div>`;
}
lbRoot.addEventListener("click", async (ev) => {
  const b = ev.target.closest("[data-lb]"); const lb = state.lightbox; if (!lb) return;
  if (!b) { if (ev.target.classList.contains("lightbox") || ev.target.classList.contains("img")) { state.lightbox = null; renderLightbox(); } return; }
  const a = b.dataset.lb;
  if (a === "close") state.lightbox = null;
  else if (a === "prev") { lb.index = (lb.index - 1 + lb.list.length) % lb.list.length; lb.armed = false; }
  else if (a === "next") { lb.index = (lb.index + 1) % lb.list.length; lb.armed = false; }
  else if (a === "delete") {
    if (!lb.armed) lb.armed = true;
    else {
      const pid = lb.list[lb.index].id;
      const doc = lb.coll === "shops" ? shopById(lb.docId) : catById(lb.docId);
      await guarded(() => state.db.doc(`${lb.coll}/${lb.docId}`).update({ photos: (doc.photos || []).filter((p) => p.id !== pid) }));
      if (state.assets) state.assets.delete(pid).catch(() => {});
      state.lightbox = null;
    }
  }
  renderLightbox();
});
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && state.lightbox) { state.lightbox = null; renderLightbox(); } });

/* ---------- render ---------- */
function render() {
  const tab = TABS.includes(state.view) ? state.view : PARENT[state.view];
  document.querySelectorAll("nav.tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === tab ? "page" : "false"));
  renderChrome();
  const overdue = state.tasks.filter((t) => !t.done && t.due && t.due <= todayISO()).length;
  document.getElementById("task-badge").innerHTML = overdue ? `<span class="badge">${overdue}</span>` : "";
  const ready = state.noDb || (state.loaded.shops && state.loaded.tasks);
  if (!ready) { app.innerHTML = `<p class="muted">Loading your shops…</p>`; return; }
  let html;
  if (state.shopId) {
    const s = state.shopId === "new" ? { type: "Restaurant", status: "prospect", city: "Athens" } : shopById(state.shopId);
    html = s ? viewShop(s) : `<button class="back" data-action="back">← Back</button><p class="muted">That shop was removed.</p>`;
  } else if (state.catId) {
    const c = catById(state.catId);
    html = c ? viewCatalogue(c) : `<button class="back" data-action="back">← Back</button><p class="muted">That catalogue was removed.</p>`;
  } else {
    if (state.view === "market" || state.view === "catalogues") state.marketSeg = state.view === "market" ? "share" : "catalogues";
    html = { today: viewToday, shops: viewShops, agenda: viewAgenda, more: viewMore, map: viewMap, prospects: viewProspects, market: viewMarket, catalogues: viewMarket, tasks: viewTasks, settings: viewSettings }[state.view]();
  }
  const openAdders = [...app.querySelectorAll("details.adder[open] form")].map((f) => f.dataset.form);
  app.innerHTML = html + datalists();
  openAdders.forEach((k) => { const f = app.querySelector(`form[data-form="${CSS.escape(k)}"]`); if (f) f.closest("details").open = true; });
  if (state.focusSearch) { const el = document.getElementById("shop-search"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } state.focusSearch = false; }
  renderLightbox();
}
function renderChrome() {
  let title = TITLES[state.view] || "Jarvis", eyebrow = "", back = !!PARENT[state.view], actions = "";
  if (state.shopId) {
    const s = state.shopId === "new" ? null : shopById(state.shopId);
    back = true;
    if (state.shopId === "new") title = "New shop";
    else if (state.editing) { title = "Edit shop"; eyebrow = s ? s.name : ""; }
    else { title = "Shop"; if (s && canEdit()) actions = iconBtn("edit", "Edit shop", ICON.edit); }
  } else if (state.catId) { const c = catById(state.catId); title = c ? c.company : "Catalogue"; eyebrow = "Catalogue"; back = true; }
  else if (state.view === "today") { eyebrow = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); title = greeting(); }
  else if (state.view === "shops") actions = iconBtn("go", "Map", ICON.map, "map") + (canEdit() ? iconBtn("new-shop", "Add shop", ICON.plus) : "");
  else if (state.view === "map") actions = iconBtn("locate-me", "Show where I am", ICON.locate);
  document.getElementById("hdr-title").textContent = title;
  document.getElementById("hdr-eyebrow").textContent = eyebrow;
  document.getElementById("hdr-back").hidden = !back;
  document.getElementById("hdr-actions").innerHTML = actions;
  document.querySelector("header.top").classList.toggle("home", state.view === "today" && !state.shopId && !state.catId);
}
function safeRender() { if (state.editing || state.dirty || state.busy) { state.pending = true; return; } render(); }
function settle() { state.dirty = false; state.pending = false; render(); }

/* ---------- writes ---------- */
async function guarded(fn) {
  try { await fn(); return true; } catch (e) {
    const code = e && e.code;
    const msg = code === "quota_exceeded" ? "Storage is full. Delete some old photos or records." : code === "invalid_argument" || code === "not_granted" ? "You don't have permission to change this data." : code === "file_too_large" ? "That photo is too large." : "Couldn't save. Check your connection and try again.";
    const b = document.createElement("div"); b.className = "banner"; b.setAttribute("role", "alert"); b.textContent = msg; app.prepend(b); window.scrollTo(0, 0);
    if (code === "invalid_argument") state.canWrite = false;
    return false;
  }
}
async function compress(file) {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1800, r = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.84));
    return out || file;
  } catch { return file; }
}
async function uploadImage(file) {
  const b = await compress(file);
  const res = await state.assets.upload(b, { type: b.type && b.type.startsWith("image/") ? b.type : "image/jpeg" });
  return res.id;
}
async function pushTo(coll, id, field, item) {
  const doc = coll === "shops" ? shopById(id) : catById(id);
  return guarded(() => state.db.doc(`${coll}/${id}`).update({ [field]: [...(doc[field] || []), item] }));
}

/* ---------- events ---------- */
async function onAction(ev) {
  const el = ev.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "open") { ev.preventDefault(); openShop(el.dataset.id); }
  else if (a === "open-cat") openCat(el.dataset.id);
  else if (a === "back") {
    if (state.shopId && state.editing && state.shopId !== "new") { state.editing = false; state.armed = null; settle(); }
    else if (state.catId) { state.catId = null; settle(); }
    else if (state.shopId) go(state.view);
    else nav(PARENT[state.view] || "today");
  }
  else if (a === "go") { ev.preventDefault(); nav(el.dataset.v); }
  else if (a === "talk") openTalk();
  else if (a === "shop-filter") { Object.assign(state, { shopFilter: el.dataset.v, areaFilter: "all", near: false }); nav("shops"); }
  else if (a === "near-go") { state.shopFilter = "all"; state.areaFilter = "all"; nav("shops"); locate().then(() => { state.near = true; render(); }).catch(() => {}); }
  else if (a === "agenda-day") { state.agendaDay = el.dataset.v; render(); }
  else if (a === "filter") { state.shopFilter = el.dataset.f; render(); }
  else if (a === "area") { state.areaFilter = el.dataset.a; render(); }
  else if (a === "seg") { state.marketSeg = el.dataset.s; render(); }
  else if (a === "m-area") { state.marketArea = el.dataset.v; render(); }
  else if (a === "m-cat") { state.marketCat = el.dataset.v; render(); }
  else if (a === "shop-tab") { state.shopTab = el.dataset.v; state.armed = null; settle(); }
  else if (a === "cons-product") { state.consProduct = el.dataset.v; render(); }
  else if (a === "new-shop") openShop("new", { edit: true });
  else if (a === "edit") { state.editing = true; render(); window.scrollTo(0, 0); }
  else if (a === "cancel-edit") { state.editing = false; state.armed = null; settle(); }
  else if (a === "toggle-done") { state.showDone = !state.showDone; render(); }
  else if (a === "lightbox") {
    const doc = el.dataset.coll === "shops" ? shopById(el.dataset.doc) : catById(el.dataset.doc);
    const p = (doc.photos || []).find((x) => x.id === el.dataset.pid);
    const list = el.dataset.coll === "shops" ? (doc.photos || []).filter((x) => x.kind === p.kind) : (doc.photos || []);
    state.lightbox = { coll: el.dataset.coll, docId: el.dataset.doc, list, index: Math.max(0, list.findIndex((x) => x.id === p.id)), armed: false }; renderLightbox();
  }
  else if (a === "lightbox-one") { state.lightbox = { list: [{ id: el.dataset.pid }], index: 0 }; renderLightbox(); }
  else if (a === "near") { if (state.near) { state.near = false; render(); } else { el.textContent = "Finding you…"; locate().then(() => { state.near = true; render(); }).catch(() => { el.textContent = "📍 Location blocked"; }); } }
  else if (a === "locate-me") { el.classList.add("busy"); locate().then(render).catch(() => { el.classList.remove("busy"); alert("Location is blocked. Allow it for this app in your phone settings."); }); }
  else if (a === "use-gps") { const note = document.getElementById("gps-note"); note.textContent = "Finding you…"; locate().then((h) => { document.getElementById("f-shop-location").value = `${h.lat.toFixed(6)}, ${h.lng.toFixed(6)}`; note.textContent = `Got it, accurate to about ${Math.round(h.acc)} m.`; state.dirty = true; }).catch(() => { note.textContent = "Couldn't get your location. Allow location for this app in your phone settings."; }); }
  else if (a === "settings") nav("settings");
  else if (a === "sign-out") { await sb.auth.signOut(); location.reload(); }
  else if (a === "backup") { const data = JSON.stringify({ exportedAt: new Date().toISOString(), docs: store.exportAll() }, null, 1); const a2 = document.createElement("a"); a2.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a2.download = `jarvis-backup-${todayISO()}.json`; a2.click(); }
  else if (a === "voice-lang") { state.voiceLang = el.dataset.v; try { localStorage.setItem("jarvis-voice-lang", state.voiceLang); } catch {} render(); }
  else if (a === "read-photos") readPhotos(el.dataset.v);
  else if (a === "read-save") { el.disabled = true; readSave(el.dataset.v); }
  else if (a === "read-cancel") { state.reading = null; render(); }
  else if (a === "rm") {
    const key = el.dataset.key;
    if (state.armed !== key) { state.armed = key; if (state.editing) { el.classList.add("danger"); el.textContent = "Tap again to delete"; } else render(); return; }
    state.armed = null;
    const parts = key.split(":");
    if (parts[0] === "shopdoc") { await guarded(() => state.db.doc("shops/" + parts[1]).delete()); state.editing = false; go("shops"); return; }
    if (parts[0] === "catdoc") { await guarded(() => state.db.doc("catalogues/" + parts[1]).delete()); state.catId = null; state.marketSeg = "catalogues"; settle(); return; }
    const coll = parts[0] === "shop" ? "shops" : "catalogues";
    const [, id, field, idx] = parts;
    const doc = coll === "shops" ? shopById(id) : catById(id);
    const arr = (doc[field] || []).slice(); const [removed] = arr.splice(Number(idx), 1);
    await guarded(() => state.db.doc(`${coll}/${id}`).update({ [field]: arr }));
    if (removed && removed.photoId && state.assets) state.assets.delete(removed.photoId).catch(() => {});
    settle();
  }
}
app.addEventListener("click", onAction);
document.querySelector("header.top").addEventListener("click", onAction);

app.addEventListener("change", async (ev) => {
  const el = ev.target;
  if (el.dataset.action === "agenda-pick") { if (el.value) { state.agendaDay = el.value; render(); } return; }
  if (el.dataset.action === "toggle-task") {
    const done = el.checked;
    await guarded(() => state.db.doc("tasks/" + el.dataset.id).update({ done, doneAt: done ? new Date().toISOString() : "" }));
  } else if (el.dataset.upload && el.files && el.files.length) {
    const [target, kind] = el.dataset.upload.split(":");
    const label = el.closest("label"); const files = [...el.files];
    state.busy = true; label.childNodes[0].textContent = `Uploading ${files.length}…`;
    const ids = [];
    for (const f of files) { const ok = await guarded(async () => ids.push(await uploadImage(f))); if (!ok) break; }
    state.busy = false;
    if (ids.length) {
      const coll = target === "shop" ? "shops" : "catalogues";
      const docId = target === "shop" ? state.shopId : state.catId;
      const doc = coll === "shops" ? shopById(docId) : catById(docId);
      const at = new Date().toISOString();
      await guarded(() => state.db.doc(`${coll}/${docId}`).update({ photos: [...(doc.photos || []), ...ids.map((id) => ({ id, kind: kind || "catalogue", at }))] }));
    }
    settle();
  }
});
app.addEventListener("input", (ev) => {
  if (ev.target.dataset.action === "search") { state.query = ev.target.value; state.focusSearch = true; render(); }
  else if (ev.target.closest("form")) state.dirty = true;
});

app.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!state.db) return;
  const form = ev.target;
  const [kind, id] = form.dataset.form.split(":");
  const fd = new FormData(form);
  const v = (k) => String(fd.get(k) ?? "").trim();
  const btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
  const withPhoto = async (item) => { const f = fd.get("photo"); if (f && f.size && state.assets) { state.busy = true; await guarded(async () => item.photoId = await uploadImage(f)); state.busy = false; } return item; };
  const stamp = new Date().toISOString();
  if (kind === "shop") {
    const data = {};
    ["name", "type", "status", "owner", "area", "city", "address", "lastVisit", "nextVisit", "pricingNotes", "investNotes", "insideInfo"].forEach((k) => data[k] = v(k));
    const amt = v("investAmount"); data.investAmount = amt === "" ? "" : Number(amt);
    data.scores = {}; CRITERIA.forEach(([k]) => { const x = v("sc_" + k); data.scores[k] = x === "" ? 0 : Math.max(0, Math.min(5, Math.round(Number(x)))); });
    const loc = v("location"); const geo = parseLocation(loc);
    if (geo) { data.lat = geo.lat; data.lng = geo.lng; data.mapsLink = loc.startsWith("http") ? loc : ""; } else { data.mapsLink = loc; }
    data.updatedAt = stamp;
    const isNew = state.shopId === "new";
    await guarded(async () => {
      if (isNew) { const ref = state.db.collection("shops").doc(); await ref.set({ ...data, createdAt: stamp, photos: [], contacts: [], assets: [], posm: [], backbar: [], products: [], consumption: [] }); state.shopId = ref.id; }
      else { await state.db.doc("shops/" + state.shopId).update(data); }
    });
    state.editing = false; settle(); window.scrollTo(0, 0); return;
  }
  if (kind === "task") {
    await guarded(() => state.db.collection("tasks").doc().set({ title: v("title"), due: v("due"), shopId: id || v("shopId"), done: false, createdAt: stamp }));
  } else if (kind === "visit") {
    const s = shopById(id); const date = v("date") || todayISO();
    await guarded(async () => {
      await state.db.collection("visits").doc().set({ shopId: id, date, notes: v("notes"), createdAt: stamp });
      if (!s.lastVisit || date > s.lastVisit) await state.db.doc("shops/" + id).update({ lastVisit: date });
    });
  } else if (kind === "asset") {
    await pushTo("shops", id, "assets", await withPhoto({ type: v("type"), brand: v("brand"), serial: v("serial"), qty: v("qty") || "1", placed: v("placed"), notes: v("notes") }));
  } else if (kind === "posm") {
    await pushTo("shops", id, "posm", await withPhoto({ type: v("type"), brand: v("brand"), qty: v("qty") || "1", placed: v("placed"), notes: v("notes") }));
  } else if (kind === "backbar") {
    const known = brandIndex()[v("brand").toLowerCase()] || {};
    const s = shopById(id);
    await guarded(() => state.db.doc("shops/" + id).update({ backbar: [...(s.backbar || []), { brand: v("brand"), company: v("company") || known.company || "", category: v("category") || known.category || "", facings: Number(v("facings")) || 1 }], backbarDate: todayISO() }));
  } else if (kind === "product") {
    await pushTo("shops", id, "products", { name: v("name"), price: v("price"), menuPrice: v("menuPrice"), notes: v("notes") });
  } else if (kind === "cons") {
    state.consProduct = v("product");
    await pushTo("shops", id, "consumption", { month: v("month"), product: v("product"), qty: Number(v("qty")) || 0, unit: v("unit") });
  } else if (kind === "contact") {
    await pushTo("shops", id, "contacts", { name: v("name"), role: v("role"), phone: v("phone"), email: v("email"), notes: v("notes") });
  } else if (kind === "catalogue") {
    const ref = state.db.collection("catalogues").doc();
    if (await guarded(() => ref.set({ company: v("company"), items: [], photos: [], createdAt: stamp }))) { state.dirty = false; openCat(ref.id); return; }
  } else if (kind === "cat-item") {
    await pushTo("catalogues", state.catId, "items", { brand: v("brand"), product: v("product"), category: v("category"), size: v("size"), price: v("price") });
  } else if (kind === "settings") {
    await guarded(() => state.db.doc("meta/settings").set({ ...state.settings, myCompany: v("myCompany") }));
  }
  form.reset();
  settle();
});


/* ---------- Talk to Jarvis ---------- */
const talkRoot = document.getElementById("talk-root");
let talkCtl = null;
function digest(full) {
  return state.shops.map((s) => {
    const d = { id: s.id, name: s.name, area: s.area || "", status: s.status, type: s.type || "" };
    if (hasGeo(s)) { d.lat = +s.lat.toFixed(5); d.lng = +s.lng.toFixed(5); }
    if (full) Object.assign(d, { owner: s.owner || "", lastVisit: s.lastVisit || "", nextVisit: s.nextVisit || "", investAmount: s.investAmount || "", score: scoreOf(s), contacts: (s.contacts || []).map((c) => c.name + (c.role ? ` (${c.role})` : "") + (c.phone ? " " + c.phone : "")), assets: (s.assets || []).map((a) => `${a.type} ${a.brand || ""} S/N ${a.serial || "-"} x${a.qty || 1}`), posm: (s.posm || []).map((p) => `${p.type} ${p.brand || ""} x${p.qty || 1}`), backbar: (s.backbar || []).map((b) => `${b.brand} (${b.company || "?"}) x${b.facings || 1}`), products: (s.products || []).map((p) => `${p.name} ${p.price || ""}`), consumption: (s.consumption || []).slice(-24), insideInfo: s.insideInfo || "" });
    return d;
  });
}
function talkPrompt(text) {
  const cur = state.shopId && state.shopId !== "new" ? shopById(state.shopId) : null;
  const companies = [...new Set(state.catalogues.map((c) => c.company))];
  const brandMap = Object.entries(brandIndex()).slice(0, 400).map(([b, v]) => `${b} = ${v.company}`).join("; ");
  const openTasks = state.tasks.filter((t) => !t.done).map((t) => ({ title: t.title, due: t.due, shop: (shopById(t.shopId) || {}).name || "" }));
  return `You are Jarvis, the field assistant of a HoReCa sales rep in Greece who visits cafés, bars, restaurants and hotels. The rep just spoke (dictated, so expect typos, Greek names in Latin or Greek letters, and loose phrasing). Today is ${todayISO()}.
${state.here && Date.now() - state.here.at < 10 * 60000 ? `The rep's phone GPS says they are at ${state.here.lat.toFixed(5)}, ${state.here.lng.toFixed(5)}. Shops with lat/lng nearby (under ~80 m) are likely the one they mean if they don't name it.` : ""}
${cur ? `The rep currently has this shop open, so assume they mean it unless they name another: ${cur.name} (id ${cur.id}).` : ""}

Decide whether the rep is REPORTING information to save, or ASKING a question about their data.

Known shops (full data):
${JSON.stringify(digest(true))}
Open tasks: ${JSON.stringify(openTasks)}
Company catalogues: ${JSON.stringify(companies)}
Known brand to company: ${brandMap || "none yet"}

Reply with only one JSON object of this shape (omit empty fields):
{
 "kind": "update" or "answer",
 "answer": "for questions: a short, direct spoken-style answer using the data above",
 "summary": "for updates: one sentence describing what you will save",
 "shopId": "id of the existing shop this is about, or null",
 "newShop": {"name":"","type":"Restaurant|Café|Bar|Cocktail bar|Hotel|Beach bar|Club|Taverna|Kiosk / mini market|Catering|Other","area":"","city":"Athens","address":"","status":"active|prospect|closed|lost"} or null (only when no existing shop matches),
 "fields": {"owner":"","address":"","area":"","status":"","nextVisit":"YYYY-MM-DD","investAmount":0,"insideInfoAdd":"text to append","pricingNotesAdd":"text to append","scores":{"volume":0-5,"location":0-5,"fit":0-5,"access":0-5}},
 "visit": {"date":"YYYY-MM-DD","notes":"clean, complete summary of the visit in the rep's words"},
 "contacts": [{"name":"","role":"","phone":"","email":"","notes":""}],
 "assets": [{"type":"${ASSET_TYPES.join("|")}","brand":"","serial":"","qty":"1","notes":""}],
 "posm": [{"type":"${POSM_TYPES.join("|")}","brand":"","qty":"1","notes":""}],
 "backbar": [{"brand":"","company":"","category":"${CATEGORIES.join("|")}","facings":1}],
 "products": [{"name":"","price":"our price/terms","menuPrice":"their menu price","notes":""}],
 "consumption": [{"month":"YYYY-MM","product":"","qty":0,"unit":""}],
 "tasks": [{"title":"short action","due":"YYYY-MM-DD or empty"}]
}
Rules: if the rep describes having been at a shop, include "visit". Turn every promise or follow-up into a task with a due date when one is implied ("next week" = 7 days from today). Only include things the rep actually said; never invent serial numbers, prices or names. Use the company from the brand map when you know it. Resolve relative dates against today.

The rep said:
"""${text}"""`;
}
function changeLines(r) {
  const L = [];
  const shop = r.shopId ? shopById(r.shopId) : null;
  if (r.newShop) L.push(["New shop", `${r.newShop.name}${r.newShop.area ? ", " + r.newShop.area : ""} (${STATUSES[r.newShop.status] || "Prospect"})`]);
  else if (shop) L.push(["Shop", shop.name]);
  const f = r.fields || {};
  Object.entries(f).forEach(([k, v]) => { if (v === "" || v == null || (typeof v === "object" && !Object.keys(v).length)) return; const label = { insideInfoAdd: "Inside info", pricingNotesAdd: "Pricing", nextVisit: "Next visit", investAmount: "Investment" }[k] || k[0].toUpperCase() + k.slice(1); L.push([label, k === "nextVisit" ? fmtDate(v) : k === "investAmount" ? money(v) : k === "scores" ? Object.entries(v).map(([a, b]) => `${a} ${b}/5`).join(", ") : k === "status" ? STATUSES[v] || v : String(v)]); });
  if (r.visit && r.visit.notes) L.push(["Visit " + fmtDate(r.visit.date || todayISO()), r.visit.notes]);
  (r.contacts || []).forEach((c) => L.push(["Contact", [c.name, c.role, c.phone, c.email].filter(Boolean).join(", ")]));
  (r.assets || []).forEach((a) => L.push(["Asset", [a.type, a.brand, a.serial && "S/N " + a.serial, a.qty > 1 && "×" + a.qty].filter(Boolean).join(", ")]));
  (r.posm || []).forEach((p) => L.push(["POSM", [p.type, p.brand, p.qty > 1 && "×" + p.qty, p.notes].filter(Boolean).join(", ")]));
  (r.backbar || []).forEach((b) => L.push(["Back bar", `${b.brand}${b.company ? " (" + b.company + ")" : ""}${b.facings > 1 ? " ×" + b.facings : ""}`]));
  (r.products || []).forEach((p) => L.push(["Product", [p.name, p.price, p.menuPrice && "menu " + p.menuPrice].filter(Boolean).join(", ")]));
  (r.consumption || []).forEach((c) => L.push(["Consumption", `${fmtMonth(c.month)}: ${c.product} ${c.qty} ${c.unit || ""}`]));
  (r.tasks || []).forEach((t) => L.push(["Task", `${t.title}${t.due ? " (due " + fmtDate(t.due) + ")" : ""}`]));
  return L;
}
function renderTalk() {
  const t = state.talk;
  if (!t || !t.open) { talkRoot.innerHTML = ""; return; }
  let body = "";
  if (t.busy) body = `<p class="thinking" role="status">Thinking… this can take up to a minute.</p><div class="row-actions"><button class="btn" data-talk="stop">Stop</button></div>`;
  else if (t.result && t.result.kind === "answer") body = `<div class="panel answer">${esc(t.result.answer || "I couldn't find an answer in your data.")}</div><div class="row-actions"><button class="btn primary" data-talk="again">Ask something else</button><button class="btn" data-talk="close">Done</button></div>`;
  else if (t.result) {
    const lines = changeLines(t.result);
    body = `<p>${esc(t.result.summary || "Here's what I'll save:")}</p>
      <div class="panel"><ul class="change-list">${lines.length ? lines.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join("") : `<li>Nothing to save. Try again with the shop name and what happened.</li>`}</ul></div>
      ${!t.result.shopId && !t.result.newShop && lines.length ? `<div class="banner">I couldn't tell which shop this is. Say the shop's name and try again.</div>` : ""}
      <div class="row-actions">${lines.length && (t.result.shopId || t.result.newShop) ? `<button class="btn primary" data-talk="save">Save all</button>` : ""}<button class="btn" data-talk="again">Change what I said</button><button class="btn" data-talk="close">Discard</button></div>`;
  } else body = `${Rec ? `<button class="mic-btn ${t.listening ? "on" : ""}" data-talk="mic" aria-pressed="${!!t.listening}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12z"/></svg>${t.listening ? "Listening… tap to stop" : "Tap to speak"}</button>` : ""}
    <label class="field" for="talk-text">${Rec ? "Or type. " : "Tap the microphone on your keyboard and speak. "}Name the shop, then say what happened, what they have, and what you promised.</label>
    <textarea id="talk-text" placeholder="e.g. Just left Taverna Thalassa in Thiseio. Met Maria the manager, her number is 694… They ordered 20 kegs. Our umbrellas are torn, need 4 new ones next week. Back bar has 3 Example Gin and 2 Example Whisky.">${esc(t.text || "")}</textarea>
    ${t.error ? `<div class="banner" role="alert">${esc(t.error)}</div>` : ""}
    <div class="row-actions"><button class="btn primary" data-talk="send">Send to Jarvis</button><button class="btn" data-talk="close">Cancel</button></div>`;
  talkRoot.innerHTML = `<div class="sheet-bg"><div class="sheet" role="dialog" aria-label="Talk to Jarvis"><div class="section-head"><h2>Talk to Jarvis</h2>${state.shopId && shopById(state.shopId) ? `<span class="muted small">${esc(shopById(state.shopId).name)}</span>` : ""}</div>${body}</div></div>`;
  const ta = document.getElementById("talk-text"); if (ta && !t.result && !t.listening && !Rec) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
const sampleErr = (e) => ({ not_granted: "Jarvis needs your permission to use Claude. Tap Send again and choose Allow.", rate_limited: "Too many requests at once. Wait a minute and try again.", invalid_json: "I didn't understand that. Try saying it again more simply.", prompt_too_large: "Your data has grown too big to send in one go. Tell Claude in the chat instead.", session_expired: "You've been signed out. Reload the app.", offline: "You're offline. Your words are kept here; send them when you have signal.", ai_error: "Jarvis couldn't reach Claude. Check the connection and try again.", refused: "Claude declined that request. Try rephrasing it." }[e && e.code] || "Something went wrong. Try again.");
async function talkSend() {
  const t = state.talk; const ta = document.getElementById("talk-text");
  t.text = ta ? ta.value.trim() : t.text; t.error = "";
  if (!t.text) { t.error = "Say or type something first."; renderTalk(); return; }
  t.busy = true; renderTalk();
  talkCtl = new AbortController();
  try { t.result = await state.sample.json(talkPrompt(t.text), { signal: talkCtl.signal, cache: false }); if (!t.result || typeof t.result !== "object") throw { code: "invalid_json" }; }
  catch (e) { if (e && e.code !== "cancelled") t.error = sampleErr(e); t.result = null; }
  t.busy = false; renderTalk();
}
async function talkSave() {
  const r = state.talk.result; const stamp = new Date().toISOString(); let id = r.shopId;
  state.busy = true;
  const ok = await guarded(async () => {
    if (!id && r.newShop) { const ref = state.db.collection("shops").doc(); id = ref.id; await ref.set({ name: r.newShop.name || "New shop", type: r.newShop.type || "Other", status: r.newShop.status || "prospect", area: r.newShop.area || "", city: r.newShop.city || "Athens", address: r.newShop.address || "", ...(state.here && Date.now() - state.here.at < 10 * 60000 ? { lat: state.here.lat, lng: state.here.lng } : {}), createdAt: stamp, updatedAt: stamp, photos: [], contacts: [], assets: [], posm: [], backbar: [], products: [], consumption: [], scores: {} }); }
    const s = shopById(id) || {};
    const f = r.fields || {}; const patch = { updatedAt: stamp };
    ["owner", "address", "area", "status", "nextVisit"].forEach((k) => { if (f[k]) patch[k] = f[k]; });
    if (f.investAmount) patch.investAmount = Number(f.investAmount);
    if (f.insideInfoAdd) patch.insideInfo = [s.insideInfo, `${todayISO()}: ${f.insideInfoAdd}`].filter(Boolean).join("\n");
    if (f.pricingNotesAdd) patch.pricingNotes = [s.pricingNotes, `${todayISO()}: ${f.pricingNotesAdd}`].filter(Boolean).join("\n");
    if (f.scores && Object.keys(f.scores).length) patch.scores = { ...(s.scores || {}), ...f.scores };
    const known = brandIndex();
    const add = (field, items, map = (x) => x) => { if (items && items.length) patch[field] = [...(s[field] || []), ...items.map(map)]; };
    add("contacts", r.contacts); add("assets", r.assets); add("posm", r.posm); add("products", r.products); add("consumption", r.consumption, (c) => ({ ...c, qty: Number(c.qty) || 0 }));
    add("backbar", r.backbar, (b) => ({ brand: b.brand, company: b.company || (known[(b.brand || "").toLowerCase()] || {}).company || "", category: b.category || (known[(b.brand || "").toLowerCase()] || {}).category || "", facings: Number(b.facings) || 1 }));
    if (r.backbar && r.backbar.length) patch.backbarDate = todayISO();
    if (r.visit && r.visit.notes) { const date = r.visit.date || todayISO(); await state.db.collection("visits").doc().set({ shopId: id, date, notes: r.visit.notes, createdAt: stamp, source: "voice" }); if (!s.lastVisit || date > s.lastVisit) patch.lastVisit = date; }
    await state.db.doc("shops/" + id).update(patch);
    for (const tk of r.tasks || []) await state.db.collection("tasks").doc().set({ title: tk.title, due: tk.due || "", shopId: id, done: false, createdAt: stamp });
  });
  state.busy = false;
  if (ok) { state.talk = null; renderTalk(); openShop(id, { tab: r.visit ? "visits" : "overview" }); }
  else renderTalk();
}
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const MIC_ERRORS = {
  "not-allowed": "Jarvis isn't allowed to use the microphone. Allow it in your phone's settings, or tap the 🎤 on your keyboard instead.",
  "service-not-allowed": "Your phone doesn't let installed web apps use speech recognition. Tap the box below and use the 🎤 on your keyboard instead.",
  "audio-capture": "No microphone found. Tap the box below and use the 🎤 on your keyboard instead.",
  "network": "Speech recognition needs internet. Check your connection, or use the 🎤 on your keyboard.",
  "language-not-supported": "Your phone can't recognise this language here. Switch the voice language in Settings, or use the 🎤 on your keyboard.",
  "no-speech": "I didn't hear anything. Tap the button and start talking straight away.",
};
function toggleMic() {
  const t = state.talk;
  if (t.listening) { rec && rec.stop(); return; }
  const ta = document.getElementById("talk-text");
  const base = ta ? ta.value.trim() : "";
  let finalText = "", heard = false;
  try {
    rec = new Rec(); rec.lang = state.voiceLang; rec.continuous = !isIOS; rec.interimResults = true;
  } catch { t.error = MIC_ERRORS["service-not-allowed"]; renderTalk(); return; }
  rec.onresult = (e) => { heard = true; let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " "; else interim += e.results[i][0].transcript; } const box = document.getElementById("talk-text"); if (box) box.value = [base, finalText + interim].filter(Boolean).join(" ").trim(); };
  rec.onerror = (e) => { t.error = MIC_ERRORS[e.error] || (e.error === "aborted" ? "" : `The microphone stopped (${e.error}). Use the 🎤 on your keyboard instead.`); };
  rec.onend = () => { const box = document.getElementById("talk-text"); t.text = box ? box.value : t.text; t.listening = false; if (!heard && !t.error) t.error = MIC_ERRORS["no-speech"]; renderTalk(); };
  t.listening = true; t.text = base; t.error = ""; renderTalk();
  try { rec.start(); } catch (e) { t.listening = false; t.error = MIC_ERRORS["service-not-allowed"]; renderTalk(); }
}
talkRoot.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-talk]");
  if (!b) { if (ev.target.classList.contains("sheet-bg") && !state.talk.busy) { state.talk = null; renderTalk(); } return; }
  const a = b.dataset.talk;
  if (a === "mic") toggleMic();
  else if (a === "send") { if (rec && state.talk.listening) rec.stop(); talkSend(); }
  else if (a === "stop") talkCtl && talkCtl.abort();
  else if (a === "again") { state.talk.result = null; renderTalk(); }
  else if (a === "close") { if (rec && state.talk.listening) rec.stop(); state.talk = null; renderTalk(); }
  else if (a === "save") { b.disabled = true; talkSave(); }
});
function openTalk() { state.talk = { open: true, text: "" }; renderTalk(); locate().catch(() => {}); }
document.getElementById("fab").addEventListener("click", openTalk);

/* read labels / catalogue pages from photos */
async function readPhotos(kind) {
  const isCat = kind === "catalogue";
  const doc = isCat ? catById(state.catId) : shopById(state.shopId);
  const max = (state.imgLimits && state.imgLimits.maxCount) || 4;
  const photos = (doc.photos || []).filter((p) => isCat || p.kind === "backbar").slice(-max);
  if (!photos.length) return;
  state.reading = { kind, busy: true }; render();
  try {
    const blobs = await Promise.all(photos.map((p) => state.assets.download(p.id)));
    const known = Object.entries(brandIndex()).slice(0, 400).map(([b, v]) => `${b} = ${v.company}`).join("; ");
    const prompt = isCat
      ? `These photos are pages of a drinks supplier's product catalogue (company: ${doc.company}). List every product you can read. Reply with only a JSON array of {"brand":"","product":"","category":"${CATEGORIES.join("|")}","size":"","price":""}. Leave a field empty if you can't read it; never guess prices.`
      : `These photos show the back bar of a bar or restaurant in Greece. Identify every bottle label you can read and count the visible bottles (facings) per brand. Known brand to company: ${known || "none"}. For other brands, fill "company" with the brand owner if you are confident (e.g. Diageo, Pernod Ricard, Bacardi, Campari, Brown-Forman), else leave it empty. Reply with only a JSON array of {"brand":"","company":"","category":"${CATEGORIES.join("|")}","facings":1}.`;
    const rows = await state.sample.json(prompt, { images: blobs, cache: false });
    state.reading = { kind, rows: Array.isArray(rows) ? rows.filter((x) => x && x.brand) : [] };
  } catch (e) { state.reading = { kind, error: e && e.code === "invalid_json" ? "I couldn't read clear labels in those photos. Try a sharper, closer photo." : sampleErr(e) }; }
  render();
}
function readingPanel(kind) {
  const r = state.reading;
  if (!state.sample || !state.imgLimits || !canEdit()) return "";
  if (!r || r.kind !== kind) return `<button class="btn" data-action="read-photos" data-v="${kind}">${kind === "catalogue" ? "Read products from photos" : "Read labels from photos"}</button>`;
  if (r.busy) return `<p class="thinking" role="status">Reading the photos… this can take a minute.</p>`;
  if (r.error) return `<div class="banner">${esc(r.error)}</div><button class="btn" data-action="read-photos" data-v="${kind}">Try again</button>`;
  return `<div class="panel"><div class="inline-form"><h3>Found ${r.rows.length} ${kind === "catalogue" ? "products" : "labels"}</h3>
    <ul class="change-list">${r.rows.map((x) => `<li><b>${esc(x.category || "")}</b><span>${esc(x.brand)}${x.product ? " " + esc(x.product) : ""}${x.company ? ` (${esc(x.company)})` : ""}${x.facings > 1 ? " ×" + esc(x.facings) : ""}${x.size ? " " + esc(x.size) : ""}${x.price ? " · " + esc(x.price) : ""}</span></li>`).join("")}</ul>
    <div class="row-actions">${r.rows.length ? `<button class="btn primary" data-action="read-save" data-v="${kind}">Add all</button>` : ""}<button class="btn" data-action="read-cancel">Discard</button></div></div></div>`;
}
async function readSave(kind) {
  const rows = state.reading.rows || [];
  if (kind === "catalogue") { const c = catById(state.catId); await guarded(() => state.db.doc("catalogues/" + c.id).update({ items: [...(c.items || []), ...rows.map((x) => ({ brand: x.brand || "", product: x.product || "", category: x.category || "", size: x.size || "", price: x.price || "" }))] })); }
  else { const s = shopById(state.shopId); await guarded(() => state.db.doc("shops/" + s.id).update({ backbar: [...(s.backbar || []), ...rows.map((x) => ({ brand: x.brand, company: x.company || "", category: x.category || "", facings: Number(x.facings) || 1 }))], backbarDate: todayISO() })); }
  state.reading = null; settle();
}

/* ---------- start ---------- */
let store = null;
async function startApp(session) {
  const uid = session.user.id;
  state.email = session.user.email;
  try { state.voiceLang = localStorage.getItem("jarvis-voice-lang") || "el-GR"; } catch { state.voiceLang = "el-GR"; }
  store = makeDb(uid, (st) => { state.sync = st; const dot = document.getElementById("sync-dot"); if (dot) { dot.dataset.state = !st.online ? "offline" : st.pending ? "pending" : "ok"; dot.title = !st.online ? "Offline" : st.pending ? "Uploading changes" : "Synced"; } });
  state.db = store.db;
  state.assets = makeAssets(uid);
  state.sample = makeSample();
  state.imgLimits = (await state.sample.limits()).images;
  routeFromHash();
  const db = state.db;
  db.collection("shops").onSnapshot((snap) => { state.shops = snap.docs.map(clean); state.loaded.shops = true; safeRender(); });
  db.collection("tasks").onSnapshot((snap) => { state.tasks = snap.docs.map(clean); state.loaded.tasks = true; safeRender(); });
  db.collection("visits").orderBy("date", "desc").limit(500).onSnapshot((snap) => { state.visits = snap.docs.map(clean); safeRender(); });
  db.collection("catalogues").onSnapshot((snap) => { state.catalogues = snap.docs.map(clean); safeRender(); });
  db.doc("meta/settings").onSnapshot((d) => { state.settings = d.exists ? d.data() : {}; safeRender(); });
  await store.start();
  if (!navigator.onLine && !store.hasCache()) { state.noDb = true; render(); }
}
const clean = (doc) => ({ ...doc.data(), id: doc.id });
window.jarvisState = state;
app.addEventListener("open-settings", () => { Object.assign(state, { view: "settings", shopId: null, catId: null, editing: false }); render(); window.scrollTo(0, 0); });
export { startApp };
