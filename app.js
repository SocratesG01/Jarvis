import { sb, makeDb, makeAssets, makeSample } from "./data.js";

/* ---------- reference lists ---------- */
const TYPES = ["Restaurant", "Café", "Bar", "Cocktail bar", "Hotel", "Beach bar", "Club", "Taverna", "Kiosk / mini market", "Catering", "Other"];
const STATUSES = { active: "Πελάτης", az: "ΑΖ", competitor: "Ανταγωνισμός", prospect: "Υποψήφιος", closed: "Έκλεισε", lost: "Χαμένος" };
const AREAS = ["Thiseio", "Plaka", "Monastiraki", "Psyrri", "Koukaki", "Kolonaki", "Syntagma", "Exarchia", "Gazi", "Kerameikos", "Pangrati", "Metaxourgeio", "Makrygianni", "Piraeus", "Glyfada"];
const CRITERIA = [["volume", "Δυνητικός όγκος"], ["location", "Τοποθεσία & κίνηση"], ["fit", "Ταίριασμα με τη γκάμα μας"], ["access", "Πρόσβαση σε αυτόν που αποφασίζει"]];
const ASSET_TYPES = ["Beer fridge", "Drinks fridge", "Freezer", "Beer tap / tower", "Keg cooler", "Coffee machine", "Coffee grinder", "Ice machine", "Display cabinet", "Furniture", "Other"];
const POSM_TYPES = ["Umbrella", "Street blackboard", "Table board / menu board", "Coasters (sous-verres)", "Menu holder", "Menu / price list", "Banner / flag", "Light box / neon", "Ice bucket", "Glassware", "Ashtray", "Apron / uniform", "Other"];
const CATEGORIES = ["Beer", "Wine", "Whisky", "Vodka", "Gin", "Rum", "Tequila", "Ouzo / Tsipouro", "Liqueur", "Aperitif", "Soft drinks", "Water", "Juice", "Energy drink", "Coffee", "Other"];
const PHOTO_KINDS = [["exterior", "Πρόσοψη"], ["interior", "Εσωτερικό"], ["backbar", "Back bar"], ["menu", "Μενού & τιμοκατάλογος"], ["other", "Άλλες"]];
const SHOP_TABS = [["overview", "Επισκόπηση"], ["photos", "Φωτογραφίες"], ["assets", "Εξοπλισμός"], ["posm", "POSM"], ["backbar", "Back bar"], ["menu", "Μενού & τιμές"], ["consumption", "Κατανάλωση"], ["contacts", "Επαφές"], ["visits", "Επισκέψεις & εργασίες"]];
const QUIET_DAYS = 30;
/* Stored values stay in English (so old records and Jarvis keep working); the screen shows Greek. */
const GR = {
  "Restaurant": "Εστιατόριο", "Café": "Καφέ", "Bar": "Μπαρ", "Cocktail bar": "Κοκτέιλ μπαρ", "Hotel": "Ξενοδοχείο", "Beach bar": "Beach bar", "Club": "Κλαμπ", "Taverna": "Ταβέρνα", "Kiosk / mini market": "Περίπτερο / μίνι μάρκετ", "Catering": "Catering", "Other": "Άλλο",
  "Beer fridge": "Ψυγείο μπύρας", "Drinks fridge": "Ψυγείο ποτών", "Freezer": "Καταψύκτης", "Beer tap / tower": "Βρύση / πύργος μπύρας", "Keg cooler": "Ψύκτης βαρελιών", "Coffee machine": "Μηχανή καφέ", "Coffee grinder": "Μύλος καφέ", "Ice machine": "Παγομηχανή", "Display cabinet": "Βιτρίνα", "Furniture": "Έπιπλα",
  "Umbrella": "Ομπρέλα", "Street blackboard": "Μαυροπίνακας δρόμου", "Table board / menu board": "Πινακίδα τραπεζιού / μενού", "Coasters (sous-verres)": "Σουβέρ", "Menu holder": "Θήκη μενού", "Menu / price list": "Μενού / τιμοκατάλογος", "Banner / flag": "Πανό / σημαία", "Light box / neon": "Φωτεινή επιγραφή / νέον", "Ice bucket": "Παγοθήκη", "Glassware": "Ποτήρια", "Ashtray": "Τασάκι", "Apron / uniform": "Ποδιά / στολή",
  "Beer": "Μπύρα", "Wine": "Κρασί", "Whisky": "Ουίσκι", "Vodka": "Βότκα", "Gin": "Τζιν", "Rum": "Ρούμι", "Tequila": "Τεκίλα", "Ouzo / Tsipouro": "Ούζο / Τσίπουρο", "Liqueur": "Λικέρ", "Aperitif": "Απεριτίφ", "Soft drinks": "Αναψυκτικά", "Water": "Νερό", "Juice": "Χυμός", "Energy drink": "Ενεργειακό ποτό", "Coffee": "Καφές",
  "Unknown company": "Άγνωστη εταιρεία",
};
const tr = (v) => GR[v] || v;
const opts = (list) => list.map((v) => [v, tr(v)]);

const state = {
  view: "today", shopId: null, shopTab: "overview", catId: null, editing: false, dirty: false, pending: false,
  shopFilter: "all", areaFilter: "all", query: "", marketSeg: "share", marketArea: "all", marketCat: "all", consProduct: null,
  shops: [], tasks: [], visits: [], catalogues: [], settings: {}, loaded: { shops: false, tasks: false }, here: null, near: false, sync: { online: true, pending: 0 }, voiceLang: "el-GR", email: "",
  db: null, assets: null, canWrite: true, noDb: false, armed: null, showDone: false, lightbox: null, busy: false,
};

const app = document.getElementById("app");
const lbRoot = document.getElementById("lightbox-root");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => (n === "" || n == null || isNaN(Number(n))) ? "" : new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n));
const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
const fmtDate = (iso) => iso ? new Date(iso + "T00:00:00").toLocaleDateString("el-GR", { day: "numeric", month: "short" }) : "";
const fmtMonth = (ym) => ym ? new Date(ym + "-01T00:00:00").toLocaleDateString("el-GR", { month: "short", year: "2-digit" }) : "";
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const img = (id) => `data-photo="${esc(id)}" src="${state.assets ? state.assets.src(id) : ""}"`;
const shopById = (id) => state.shops.find((s) => s.id === id);
const catById = (id) => state.catalogues.find((c) => c.id === id);
const areaOf = (s) => (s.area || "").trim() || "Χωρίς περιοχή";
const scoreOf = (s) => { const sc = s.scores || {}; const vals = CRITERIA.map(([k]) => Number(sc[k]) || 0); if (!vals.some(Boolean)) return null; return Math.round(vals.reduce((a, b) => a + b, 0) / (CRITERIA.length * 5) * 100); };
const daysSinceVisit = (s) => s.lastVisit ? daysBetween(s.lastVisit, todayISO()) : null;
const isQuiet = (s) => s.status === "active" && (s.lastVisit ? daysSinceVisit(s) >= QUIET_DAYS : true);
const hasGeo = (s) => typeof s.lat === "number" && typeof s.lng === "number";
const mapsSearch = (s) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(hasGeo(s) ? `${s.lat},${s.lng}` : [s.name, s.address, s.area, s.city].filter(Boolean).join(", "));
const mapsDir = (s) => "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(hasGeo(s) ? `${s.lat},${s.lng}` : [s.name, s.address, s.area, s.city].filter(Boolean).join(", "));
const canEdit = () => state.canWrite && !state.noDb;
const canUpload = () => canEdit() && !!state.assets;
const cover = (s) => { const p = (s.photos || []).find((x) => x.kind === "exterior") || (s.photos || [])[0]; return p ? p.id : null; };
const arrow = (up) => `<svg class="arr ${up ? "up" : "down"}" viewBox="0 0 10 10" aria-label="${up ? "πάνω" : "κάτω"}"><path d="${up ? "M5 1.5l4 7H1z" : "M5 8.5l4-7H1z"}"/></svg>`;
const norm = (x) => String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const clip = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
const mainContact = (s) => (s.contacts || []).find((c) => c.phone) || (s.contacts || [])[0] || null;
const telHref = (p) => "tel:" + String(p).replace(/[^\d+]/g, "");
const lastOrder = (s) => (s.orders || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0] || null;
const orderText = (o) => (o.items || []).map((i) => [i.product, i.qty, i.unit].filter((x) => x !== "" && x != null).join(" ")).join(", ") || o.notes || "";
const visitsOf = (id) => state.visits.filter((v) => v.shopId === id).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
const visitedOn = (day) => new Set(state.visits.filter((v) => v.date === day).map((v) => v.shopId));
/* The next thing to do for a shop: its earliest open task or its planned visit. */
function nextActionOf(s) {
  const t = todayISO(), c = [];
  const task = state.tasks.filter((x) => !x.done && x.shopId === s.id).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"))[0];
  if (task) c.push({ date: task.due || "", text: task.title, late: !!task.due && task.due < t });
  if (s.nextVisit && s.nextVisit >= t) c.push({ date: s.nextVisit, text: "Επίσκεψη" });
  return c.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))[0] || null;
}
const actionText = (n) => n ? `${n.late ? "Εκπρόθεσμο: " : ""}${n.text}${n.date ? " · " + fmtDate(n.date) : ""}` : "";
/* Who needs attention first, with the reasons, from real data only. Shops already planned for today are left out. */
function priorities() {
  const t = todayISO(), out = [];
  state.shops.forEach((s) => {
    if (s.status === "closed" || s.status === "lost" || s.nextVisit === t) return;
    let score = 0; const why = [];
    const late = state.tasks.filter((x) => !x.done && x.shopId === s.id && x.due && x.due < t).length;
    if (late) { score += 50 + 5 * late; why.push(plural(late, "εκπρόθεσμη εργασία", "εκπρόθεσμες εργασίες")); }
    if (s.nextVisit && s.nextVisit < t && (!s.lastVisit || s.lastVisit < s.nextVisit)) { score += 40; why.push(`χάθηκε η επίσκεψη ${fmtDate(s.nextVisit)}`); }
    if (s.status === "active") {
      const d = daysSinceVisit(s);
      if (d == null) { score += 25; why.push("καμία επίσκεψη ακόμα"); } else if (d >= QUIET_DAYS) { score += 20 + Math.min(30, d - QUIET_DAYS); why.push(`${d} μέρες χωρίς επίσκεψη`); }
      const lo = lastOrder(s), od = lo ? daysBetween(lo.date, t) : null;
      if (od != null && od >= 30) { score += 15; why.push(`παραγγελία πριν ${od} μέρες`); }
      if (score && Number(s.investAmount) > 0) score += Math.min(15, Number(s.investAmount) / 1000);
    }
    if (s.status === "prospect") { const sc = scoreOf(s) ?? 0; if (sc >= 60 && (!s.lastVisit || daysSinceVisit(s) >= 14)) { score += sc / 3; why.push(`υποψήφιος ${sc}/100`); } }
    if (score > 0) out.push({ s, score, why });
  });
  return out.sort((a, b) => b.score - a.score);
}

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
  return `<datalist id="dl-cats">${CATEGORIES.map((v) => `<option value="${esc(v)}" label="${esc(tr(v))}"></option>`).join("")}</datalist>` + dl("dl-brands", brands) + dl("dl-companies", companies) + dl("dl-areas", areas) + dl("dl-cities", cities) + dl("dl-products", products);
}


/* ---------- navigation ---------- */
const TABS = ["today", "shops", "agenda", "more"];
const PARENT = { map: "more", prospects: "more", market: "more", catalogues: "more", tasks: "agenda", settings: "more", route: "agenda", report: "more", alerts: "today", files: "more", watch: "more", sales: "more" };
const PAGES = [...TABS, ...Object.keys(PARENT)];
const TITLES = { today: "Jarvis", shops: "Μαγαζιά", agenda: "Ατζέντα", more: "Άλλα", map: "Χάρτης", prospects: "Υποψήφιοι", market: "Μερίδιο αγοράς", catalogues: "Κατάλογοι", tasks: "Όλες οι εργασίες", settings: "Ρυθμίσεις", route: "Διαδρομή ημέρας", report: "Εβδομαδιαία αναφορά", alerts: "Ειδοποιήσεις", files: "Αρχεία δουλειάς", watch: "Παρακολούθηση αγοράς", sales: "Πωλήσεις & στόχοι" };
function nav(view) { if (location.hash.slice(1) === view) go(view); else location.hash = view; }
function go(view) { Object.assign(state, { reading: null, view, shopId: null, catId: null, editing: false, armed: null, dirty: false }); render(); window.scrollTo(0, 0); }
function openShop(id, opts = {}) { Object.assign(state, { reading: null, shopId: id, catId: null, editing: !!opts.edit, armed: null, dirty: false, shopTab: opts.tab || "overview", consProduct: null }); render(); window.scrollTo(0, 0); }
function openCat(id) { Object.assign(state, { reading: null, catId: id, shopId: null, editing: false, armed: null, dirty: false }); render(); window.scrollTo(0, 0); }
function routeFromHash() {
  const h = location.hash.slice(1);
  if (/^car\b/.test(h)) { // opened from the Siri shortcut / home-screen shortcut: car mode, maybe with a question already asked
    const q = (new URLSearchParams(h.split("?")[1] || "").get("q") || "").trim();
    try { sessionStorage.setItem("jarvis-welcomed", "1"); } catch {}
    history.replaceState(null, "", "#today"); go("today");
    if (state.sample) openCar({ fromLink: true, q }); else state.carPending = { fromLink: true, q };
    return;
  }
  go(PAGES.includes(h) ? h : "today");
}
window.addEventListener("hashchange", routeFromHash);
document.querySelector("nav.tabs").addEventListener("click", (ev) => { const a = ev.target.closest("a[data-tab]"); if (a && location.hash.slice(1) === a.dataset.tab) { ev.preventDefault(); go(a.dataset.tab); } });

/* ---------- shared bits ---------- */
const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const CAR_ICON = ic('<path d="M5 16l1.5-5.2A2 2 0 0 1 8.4 9.3h7.2a2 2 0 0 1 1.9 1.5L19 16"/><rect x="3.5" y="15" width="17" height="4.5" rx="1.5"/><circle cx="7.5" cy="17.3" r="1"/><circle cx="16.5" cy="17.3" r="1"/>');
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
  bell: ic('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  route: ic('<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>'),
  report: ic('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>'),
  chev: ic('<path d="M9 5l7 7-7 7"/>'),
  done: ic('<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.4l2.6 2.6 5-5.2"/>'),
  play: ic('<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/>'),
  trend: ic('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'),
};
const TYPE_ICON = {
  "Restaurant": ic('<path d="M7 3v7M5 3v4a2 2 0 0 0 4 0V3M7 10v11M17 21V3c-2 1-3.5 4-3.5 8H17"/>'),
  "Café": ic('<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2.5M11 3.5v2.5M14 3.5v2.5"/>'),
  "Bar": ic('<path d="M6 8h9v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM15 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M6 8a2.5 2.5 0 0 1 2.5-4 3 3 0 0 1 5 0A2.5 2.5 0 0 1 15 8M9.5 12v6M12 12v6"/>'),
  "Cocktail bar": ic('<path d="M4 4h16l-8 9zM12 13v7M8 20h8M15 8l3.5-5"/>'),
  "Hotel": ic('<path d="M3 19V6M3 15h18v4M21 15v-2.5A2.5 2.5 0 0 0 18.5 10H11v5"/><circle cx="7" cy="12" r="1.6"/>'),
  "Beach bar": ic('<path d="M12 4a8.5 8.5 0 0 1 8.5 8.5h-17A8.5 8.5 0 0 1 12 4zM12 12.5V19a2 2 0 0 0 4 0"/>'),
  "Club": ic('<path d="M9 18V5.5l11-2.5v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  "Taverna": ic('<path d="M8 3h8l-.8 6a3.2 3.2 0 0 1-6.4 0zM12 12.2V20M8.5 20.5h7"/>'),
  "Catering": ic('<path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 9V7.5M10 7.5h4"/>'),
};
const ART = {
  tasks: '<rect class="a" x="12" y="10" width="40" height="48" rx="9"/><rect class="c" x="24" y="5" width="16" height="10" rx="4"/><path class="b" d="M22 33l7 7 14-15"/>',
  calendar: '<rect class="a" x="8" y="12" width="48" height="44" rx="9"/><path class="b" d="M8 25h48M21 6v12M43 6v12"/><circle class="c" cx="32" cy="41" r="6"/>',
  pin: '<ellipse class="a" cx="32" cy="55" rx="19" ry="5"/><path class="b" d="M32 53S18 40 18 28a14 14 0 0 1 28 0c0 12-14 25-14 25z"/><circle class="c" cx="32" cy="28" r="5.5"/>',
  photo: '<rect class="a" x="6" y="14" width="52" height="40" rx="9"/><path class="b" d="M6 44l14-12 12 10 8-6 18 14"/><circle class="c" cx="44" cy="25" r="5"/>',
  chart: '<rect class="a" x="6" y="8" width="52" height="48" rx="9"/><path class="b" d="M18 44V32M28 44V22M38 44V28"/><rect class="c" x="44" y="16" width="6" height="28" rx="3"/>',
};
const art = (k) => `<svg class="art" viewBox="0 0 64 64" aria-hidden="true">${ART[k]}</svg>`;
const emptyLi = (k, text) => `<li class="empty art-row">${art(k)}<span>${text}</span></li>`;
const emptyDiv = (k, text) => `<div class="empty art-row">${art(k)}<span>${text}</span></div>`;
const ACROPOLIS = `<svg class="acropolis" viewBox="0 0 240 120" aria-hidden="true"><path d="M0 118c30-14 60-20 120-20s90 6 120 20"/><path d="M28 98h184M36 92h168M44 86h152"/><path d="M58 86V46M75 86V46M92 86V46M109 86V46M126 86V46M143 86V46M160 86V46M177 86V46"/><path d="M50 46h140M48 40h144M54 40l66-24 66 24"/><path d="M64 30l-2-8M176 30l2-8"/></svg>`;
let arcN = 0;
const arcLogo = (cls = "arc") => { const id = "arcg" + (arcN++); return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="${id}"><stop offset="0" stop-color="#F0FDFF"/><stop offset=".4" stop-color="#67E8F9"/><stop offset="1" stop-color="#0891B2" stop-opacity="0"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="#04121F" stroke="#22D3EE" stroke-opacity=".55" stroke-width="1.5"/><g class="arc-spin"><circle cx="32" cy="32" r="24" fill="none" stroke="#22D3EE" stroke-width="3.2" stroke-dasharray="5.5 3.2"/></g><circle cx="32" cy="32" r="18" fill="none" stroke="#67E8F9" stroke-opacity=".8" stroke-width="1.6"/><g class="arc-spin rev"><path d="M32 16v5M32 43v5M16 32h5M43 32h5M20.7 20.7l3.5 3.5M39.8 39.8l3.5 3.5M43.3 20.7l-3.5 3.5M24.2 39.8l-3.5 3.5" stroke="#A5F3FC" stroke-width="1.6" stroke-linecap="round"/></g><circle cx="32" cy="32" r="13" fill="url(#${id})"/></svg>`; };
/* night view of the Acropolis for the Home header (decorative, drawn in code) */
const NIGHT = (() => {
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const stars = Array.from({ length: 26 }, () => `<circle cx="${(rnd() * 400).toFixed(1)}" cy="${(rnd() * 70).toFixed(1)}" r="${(rnd() * 0.9 + 0.3).toFixed(2)}" fill="#CFEFFF" opacity="${(rnd() * 0.6 + 0.2).toFixed(2)}"/>`).join("");
  const lights = Array.from({ length: 170 }, () => { const x = rnd() * 400, y = 168 + rnd() * 52; const warm = rnd() > 0.35; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(rnd() * 0.9 + 0.35).toFixed(2)}" fill="${warm ? "#FBBF5A" : "#7DD3FC"}" opacity="${(rnd() * 0.6 + 0.35).toFixed(2)}"/>`; }).join("");
  const cols = Array.from({ length: 8 }, (_, i) => `<rect x="${(239 + i * 10.6).toFixed(1)}" y="98" width="5.2" height="30" rx="1" fill="url(#ng-gold)"/>`).join("");
  return `<svg class="night" viewBox="0 0 400 220" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
  <defs><linearGradient id="ng-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A2540"/><stop offset="1" stop-color="#071628"/></linearGradient>
  <linearGradient id="ng-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE3A3"/><stop offset="1" stop-color="#D08A2B"/></linearGradient>
  <radialGradient id="ng-glow"><stop offset="0" stop-color="#F7B955" stop-opacity=".55"/><stop offset="1" stop-color="#F7B955" stop-opacity="0"/></radialGradient>
  <linearGradient id="ng-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B3326"/><stop offset="1" stop-color="#0D1B2A"/></linearGradient></defs>
  <rect width="400" height="220" fill="url(#ng-sky)"/>${stars}
  <path d="M0 150 C60 128 110 140 160 132 S250 118 300 126 S370 120 400 128 V220 H0Z" fill="#0B1E33"/>
  <ellipse cx="282" cy="112" rx="90" ry="46" fill="url(#ng-glow)"/>
  <path d="M170 168 C190 150 205 138 222 132 L232 129 H340 L352 134 C366 142 380 156 396 170Z" fill="url(#ng-rock)"/>
  <rect x="232" y="127" width="106" height="4" rx="1" fill="#E7A94B"/><rect x="236" y="123" width="98" height="4" rx="1" fill="#F2C373"/>${cols}
  <rect x="234" y="92" width="102" height="6" rx="1" fill="url(#ng-gold)"/><path d="M236 92 L285 78 L334 92Z" fill="#E9B160"/>
  <path d="M0 172 C80 160 160 176 240 166 S360 162 400 168 V220 H0Z" fill="#081726"/>${lights}
</svg>`;
})();
const shopAvatar = (s, cls = "ph") => { const icon = TYPE_ICON[s.type]; return icon ? `<span class="${cls} av type" style="--h:${hue(s.area || s.name)}" aria-hidden="true">${icon}</span>` : avatar(s.name, cls); };
const iconBtn = (action, label, icon, v = "") => `<button class="icon-btn" data-action="${action}" ${v ? `data-v="${v}"` : ""} aria-label="${esc(label)}" title="${esc(label)}">${icon}</button>`;
const hue = (t) => [...String(t || "?")].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17);
const avatar = (name, cls = "ph") => { const n = String(name || "?").replace(/^Example:\s*/, ""); return `<span class="${cls} av" style="--h:${hue(n)}" aria-hidden="true">${esc(n.charAt(0).toUpperCase())}</span>`; };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Καλησπέρα" : h < 12 ? "Καλημέρα" : "Καλησπέρα"; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function banner() {
  if (state.noDb) return `<div class="banner">Είσαι εκτός σύνδεσης και αυτό το κινητό δεν έχει ακόμα αποθηκευμένα δεδομένα. Συνδέσου μία φορά για να φορτώσουν τα μαγαζιά σου.</div>`;
  if (!state.canWrite) return `<div class="banner">Μπορείς να δεις αυτά τα δεδομένα αλλά όχι να τα αλλάξεις.</div>`;
  return "";
}

function quickActs(s) {
  const c = mainContact(s);
  return `<span class="qacts">${c && c.phone ? `<a class="icon-btn small" href="${esc(telHref(c.phone))}" aria-label="Κλήση ${esc(c.name || s.name)}" title="Κλήση">${ICON.phone}</a>` : ""}<a class="icon-btn small" href="${mapsDir(s)}" target="_blank" rel="noopener" aria-label="Οδηγίες για ${esc(s.name)}" title="Οδηγίες">${ICON.nav}</a>${canEdit() ? `<button class="icon-btn small" data-action="log-visit" data-id="${esc(s.id)}" aria-label="Καταγραφή επίσκεψης στο ${esc(s.name)}" title="Καταγραφή επίσκεψης">${ICON.done}</button>` : ""}</span>`;
}
function shopRow(s, extra = "", rank = null, quick = false) {
  const sc = scoreOf(s);
  const c = cover(s);
  const left = rank != null ? `<div class="score ${sc == null || sc < 50 ? "low" : ""}">${sc == null ? "–" : sc}</div>`
    : c ? `<span class="thumb"><img ${img(c)} alt="" loading="lazy"></span>` : shopAvatar(s);
  let last = s.lastVisit ? `Επίσκεψη ${fmtDate(s.lastVisit)}` : "Χωρίς επίσκεψη ακόμα";
  if (quick) { const na = nextActionOf(s); if (na) last += " · Επόμενο: " + actionText(na); }
  return `<li${quick ? ` class="qrow"` : ""}><button class="item" data-action="open" data-id="${esc(s.id)}">${left}
    <div class="grow"><div class="title">${rank != null ? `<span class="muted num">#${rank}</span> ` : ""}${esc(s.name || "Μαγαζί χωρίς όνομα")}${quick ? (s.example ? ` <span class="pill example">Παράδειγμα</span>` : ` <span class="pill ${esc(s.status)}">${esc(STATUSES[s.status] || "")}</span>`) : ""}</div>
    <div class="sub">${esc([tr(s.type), areaOf(s) === "Χωρίς περιοχή" ? "" : s.area].filter(Boolean).join(" · "))}${s.type || s.area ? " · " : ""}${extra || last}</div></div>
    ${quick ? "" : `${s.example ? `<span class="pill example">Παράδειγμα</span>` : `<span class="pill ${esc(s.status)}">${esc(STATUSES[s.status] || "")}</span>`}<span class="chev">${ICON.chev}</span>`}
  </button>${quick ? quickActs(s) : ""}</li>`;
}

function taskRow(t) {
  const shop = t.shopId ? shopById(t.shopId) : null;
  const overdue = !t.done && t.due && t.due < todayISO();
  return `<li class="item ${t.done ? "done" : ""}">
    <input type="checkbox" class="check" id="task-${esc(t.id)}" data-action="toggle-task" data-id="${esc(t.id)}" ${t.done ? "checked" : ""} ${canEdit() ? "" : "disabled"} aria-label="Ολοκληρώθηκε">
    <div class="grow"><div class="title">${esc(t.title)}</div>
    <div class="sub">${t.due ? (overdue ? `<span class="pill overdue">Εκπρόθεσμη</span> ` : "") + "Λήξη " + fmtDate(t.due) : "Χωρίς ημερομηνία"}${shop ? ` · <a href="#" data-action="open" data-id="${esc(shop.id)}">${esc(shop.name)}</a>` : ""}</div></div>
  </li>`;
}

function rmButton(key, label = "Διαγραφή") {
  if (!canEdit()) return "";
  const armed = state.armed === key;
  return `<button type="button" class="btn small ${armed ? "danger" : ""}" data-action="rm" data-key="${esc(key)}">${armed ? "Πάτα ξανά για διαγραφή" : label}</button>`;
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
const WEATHER = { 0: ["Αίθριος", "sun"], 1: ["Κυρίως αίθριος", "sun"], 2: ["Λίγα σύννεφα", "cloud-sun"], 3: ["Συννεφιά", "cloud"], 45: ["Ομίχλη", "cloud"], 48: ["Ομίχλη", "cloud"], 51: ["Ψιχάλες", "rain"], 53: ["Ψιχάλες", "rain"], 55: ["Ψιχάλες", "rain"], 61: ["Βροχή", "rain"], 63: ["Βροχή", "rain"], 65: ["Δυνατή βροχή", "rain"], 80: ["Μπόρες", "rain"], 81: ["Μπόρες", "rain"], 82: ["Μπόρες", "rain"], 95: ["Καταιγίδα", "rain"], 96: ["Καταιγίδα", "rain"], 99: ["Καταιγίδα", "rain"] };
const WICON = {
  sun: '<circle cx="12" cy="12" r="4.2" fill="#FBBF24" stroke="none"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" stroke="#FBBF24"/>',
  "cloud-sun": '<circle cx="9" cy="9" r="3.4" fill="#FBBF24" stroke="none"/><path d="M8 19h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.5 1.5A2.8 2.8 0 0 0 8 19z" fill="#CBD5E1" stroke="none"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.4 1.8A3.2 3.2 0 0 0 7 18z" fill="#CBD5E1" stroke="none"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.4 1.8A3.2 3.2 0 0 0 7 15z" fill="#CBD5E1" stroke="none"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" stroke="#60A5FA"/>',
};
async function loadWeather() {
  if (state.weatherAt && Date.now() - state.weatherAt < 30 * 60000) return;
  state.weatherAt = Date.now();
  const at = state.here || { lat: 37.9755, lng: 23.7348 };
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${at.lat.toFixed(3)}&longitude=${at.lng.toFixed(3)}&current=temperature_2m,weather_code&timezone=auto`);
    const j = await r.json();
    state.weather = { t: Math.round(j.current.temperature_2m), code: j.current.weather_code };
    const el = document.getElementById("jx-weather"); if (el) el.outerHTML = weatherHtml();
  } catch { state.weatherAt = 0; }
}
function weatherHtml() {
  const w = state.weather; const [label, icon] = w ? (WEATHER[w.code] || ["", "cloud"]) : ["", "sun"];
  return `<span class="jx-weather" id="jx-weather" title="${esc(label)}"><svg viewBox="0 0 24 24" aria-hidden="true" stroke-width="1.8" stroke-linecap="round">${WICON[icon]}</svg><span><b>${w ? w.t + "°C" : "–°C"}</b><small>Αθήνα</small></span></span>`;
}
const clockText = () => new Date().toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" });
setInterval(() => { const el = document.getElementById("jx-time"); if (el) el.textContent = clockText(); }, 20000);

/* Athens reference places for the territory map */
const PLACES = [["Αθήνα", 37.9755, 23.7348, 1], ["Πειραιάς", 37.9420, 23.6465, 1], ["Γλυφάδα", 37.8625, 23.7540, 1], ["Κηφισιά", 38.0740, 23.8110, 1], ["Μαρούσι", 38.0500, 23.8060, 1], ["Περιστέρι", 38.0130, 23.6900, 0], ["Χαλάνδρι", 38.0210, 23.7990, 0], ["Καλλιθέα", 37.9550, 23.7020, 0], ["Ν. Σμύρνη", 37.9450, 23.7140, 0],
  ["Πλάκα", 37.9715, 23.7300, 2], ["Μοναστηράκι", 37.9762, 23.7255, 2], ["Θησείο", 37.9767, 23.7190, 2], ["Ψυρρή", 37.9788, 23.7238, 2], ["Κουκάκι", 37.9645, 23.7235, 2], ["Κολωνάκι", 37.9790, 23.7430, 2], ["Σύνταγμα", 37.9755, 23.7348, 2], ["Εξάρχεια", 37.9866, 23.7339, 2], ["Γκάζι", 37.9783, 23.7120, 2], ["Παγκράτι", 37.9686, 23.7470, 2]];
function territoryMap() {
  const geo = state.shops.filter(hasGeo);
  const W = 340, H = 190;
  let minLat = 37.955, maxLat = 37.995, minLng = 23.700, maxLng = 23.760;
  geo.forEach((s) => { minLat = Math.min(minLat, s.lat); maxLat = Math.max(maxLat, s.lat); minLng = Math.min(minLng, s.lng); maxLng = Math.max(maxLng, s.lng); });
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  let spanX = (maxLng - minLng) * k, spanY = maxLat - minLat;
  const want = W / H; if (spanX / spanY < want) { const d = (spanY * want - spanX) / k / 2; minLng -= d; maxLng += d; spanX = (maxLng - minLng) * k; } else { const d = (spanX / want - spanY) / 2; minLat -= d; maxLat += d; spanY = maxLat - minLat; }
  const pad = 0.12; minLat -= spanY * pad; maxLat += spanY * pad; minLng -= spanX * pad / k; maxLng += spanX * pad / k; spanX *= 1 + 2 * pad; spanY *= 1 + 2 * pad;
  const xy = (lat, lng) => [((lng - minLng) * k) / spanX * W, (maxLat - lat) / spanY * H];
  const zoomedIn = spanY < 0.08;
  const places = PLACES.filter(([, lat, lng, lvl]) => (zoomedIn ? lvl !== 0 : lvl !== 2) && lat > minLat && lat < maxLat && lng > minLng && lng < maxLng).map(([n, lat, lng]) => [n, ...xy(lat, lng)])
    .reduce((kept, p) => { const box = [p[1] - 3, p[2] - 8, p[1] + 8 + p[0].length * 4.8, p[2] + 6]; if (!kept.some((q) => box[0] < q.box[2] && q.box[0] < box[2] && box[1] < q.box[3] && q.box[1] < box[3])) kept.push(Object.assign(p, { box })); return kept; }, []);
  let seed = 3; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const [cx, cy] = xy(37.9755, 23.7348);
  const roads = Array.from({ length: 34 }, (_, i) => { const a = (i / 34) * Math.PI * 2 + rnd() * 0.3, r1 = 8 + rnd() * 30, r2 = 120 + rnd() * 160; return `<path d="M${(cx + Math.cos(a) * r1).toFixed(0)} ${(cy + Math.sin(a) * r1).toFixed(0)} Q${(cx + Math.cos(a + 0.25) * r2 * 0.5).toFixed(0)} ${(cy + Math.sin(a + 0.25) * r2 * 0.5).toFixed(0)} ${(cx + Math.cos(a) * r2).toFixed(0)} ${(cy + Math.sin(a) * r2).toFixed(0)}"/>`; }).join("")
    + Array.from({ length: 5 }, (_, i) => `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${24 + i * 26}"/>`).join("");
  const sea = [[37.80, 23.55], [37.95, 23.55], [37.948, 23.62], [37.937, 23.655], [37.932, 23.69], [37.915, 23.70], [37.89, 23.725], [37.865, 23.745], [37.85, 23.77], [37.80, 23.80]].map(([a, b]) => xy(a, b).map((v) => v.toFixed(0)).join(",")).join(" ");
  const dots = geo.map((s) => { const [x, y] = xy(s.lat, s.lng); return `<g class="tm-dot ${esc(s.status)}"><circle class="halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6"/></g>`; }).join("");
  const labels = places.map(([n, x, y]) => `<text x="${(x + 6).toFixed(0)}" y="${(y + 4).toFixed(0)}">${esc(n)}</text><circle class="tm-place" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8"/>`).join("");
  return `<svg class="tm" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><polygon class="tm-sea" points="${sea}"/><g class="tm-roads">${roads}</g>${labels}${dots}</svg>`;
}
const dayStarted = () => { try { return localStorage.getItem("jarvis-day") === todayISO(); } catch { return false; } };
function viewToday() {
  const t = todayISO();
  loadWeather();
  loadCalendar();
  const name = state.settings.myName ?? "Σωκράτη";
  const open = state.tasks.filter((x) => !x.done);
  const overdue = open.filter((x) => x.due && x.due < t).sort((a, b) => a.due.localeCompare(b.due));
  const todayTasks = open.filter((x) => x.due === t);
  const visited = visitedOn(t);
  const planned = state.shops.filter((s) => s.nextVisit === t);
  /* today's visits = planned for today plus any shop visited today (each shop once) */
  const todayShops = [...planned, ...state.shops.filter((s) => visited.has(s.id) && s.nextVisit !== t)];
  const doneN = todayShops.filter((s) => visited.has(s.id)).length;
  const events = calOn(t);
  const pri = priorities().slice(0, 5);
  const started = dayStarted();
  const customers = state.shops.filter((s) => s.status === "active");
  const weekAgo = addDays(t, -7);
  const newCustomers = state.shops.filter((s) => (s.statusHistory || []).some((h) => h.to === "active" && (h.at || "").slice(0, 10) >= weekAgo)).length;
  const month = t.slice(0, 7), target = Number(state.settings.visitTarget) || 40;
  const monthVisits = state.visits.filter((v) => (v.date || "").startsWith(month)).length;
  const pct = Math.min(100, Math.round(monthVisits / target * 100));
  const card = (action, v, icon, n, label, sub, extra = "") => `<button class="jx-stat" data-action="${action}" data-v="${v}"><span class="jx-ic">${icon}</span><b>${n}</b><span class="jx-label">${label}</span>${extra}<span class="jx-sub2">${sub}</span></button>`;
  const brief = [plural(todayShops.length, "επίσκεψη", "επισκέψεις"), events.length ? plural(events.length, "ραντεβού", "ραντεβού") : "", todayTasks.length ? plural(todayTasks.length, "εργασία", "εργασίες") : "", overdue.length ? `<span class="warn">${overdue.length} εκπρόθεσμα</span>` : ""].filter(Boolean).join(" · ");
  const visitRow = (s) => { const done = visited.has(s.id); return `<li class="jx-qrow"><button class="jx-row" data-action="open" data-id="${esc(s.id)}"><i class="d ${done ? "done" : "visit"}"></i><span class="jx-when">${done ? "Έγινε" : "Επίσκεψη"}</span><span class="jx-what"><b>${esc(s.name)}</b><small>${esc([tr(s.type), s.area, actionText(nextActionOf(s))].filter(Boolean).join(" · "))}</small></span></button>${done ? "" : quickActs(s)}</li>`; };
  const evRow = (e) => `<li><button class="jx-row" data-action="go" data-v="agenda"><i class="d cal"></i><span class="jx-when">${esc(e.time || "Όλη μέρα")}</span><span class="jx-what"><b>${esc(e.title)}</b><small>${esc(e.where || "Ημερολόγιο")}</small></span><span class="chev">${ICON.chev}</span></button></li>`;
  const plan = [...events.map(evRow), ...todayShops.sort((a, b) => visited.has(a.id) - visited.has(b.id)).map(visitRow), ...todayTasks.map(taskRow)];
  const sales = salesSummary();
  return `${banner()}
  <section class="jx-hero">${NIGHT}
    <div class="jx-top"><h1 class="jx-hi">${greeting()}${name ? `, <span class="jx-name">${esc(name)}</span>` : ""}</h1>${weatherHtml()}</div>
    <p class="jx-brief"><b>${esc(new Date().toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" }))}</b><br>${brief}</p>
    ${canEdit() ? `<button class="jx-start" data-action="start-day">${started ? ICON.route : ICON.play}<span><b>${started ? "Συνέχισε τη μέρα" : "Ξεκίνα τη μέρα μου"}</b><small>${started ? `${doneN} από ${plural(todayShops.length, "επίσκεψη", "επισκέψεις")} έγιναν` : "Ο Jarvis φτιάχνει τη διαδρομή με τις προτεραιότητές σου"}</small></span><span class="chev">${ICON.chev}</span></button>` : ""}
    ${canEdit() ? `<button class="jx-car" data-action="car">${CAR_ICON}<span>Λειτουργία αυτοκινήτου</span></button>` : ""}
  </section>
  <section class="jx-card jx-sched">
    <div class="jx-sched-head"><span class="jx-ic">${ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M12 14h2M8 17h2"/>')}</span><span class="grow"><b>Σήμερα</b><small>${todayShops.length ? `${doneN}/${todayShops.length} επισκέψεις` : "Καμία προγραμματισμένη επίσκεψη"}</small></span><a href="#route" class="link">Διαδρομή ›</a></div>
    <ul class="jx-list">${plan.length ? plan.join("") : `<li class="jx-empty">${art("calendar")}<span>Τίποτα προγραμματισμένο. Πάτα «Ξεκίνα τη μέρα μου» και ο Jarvis διαλέγει από τις προτεραιότητες.</span></li>`}</ul>
  </section>
  ${overdue.length ? `<section class="section"><div class="section-head"><h2 class="bad-h">Εκπρόθεσμα follow-ups</h2>${overdue.length > 5 ? `<a href="#tasks" class="link">Όλα (${overdue.length}) ›</a>` : ""}</div><div class="panel"><ul class="list">${overdue.slice(0, 5).map(taskRow).join("")}</ul></div></section>` : ""}
  ${pri.length ? `<section class="section"><div class="section-head"><h2>Προτεραιότητες</h2><span class="muted small">ποιους να δεις πρώτα</span></div><div class="panel"><ul class="list">${pri.map((p) => shopRow(p.s, p.why.join(" · "), null, true)).join("")}</ul></div></section>` : ""}
  <button class="jx-ask" data-action="talk"><span class="jx-ask-ic">${ic('<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M8 10h8M8 13h5"/>')}</span><span class="grow"><b>Ρώτα τον JARVIS</b><small>«Ποιες εκκρεμότητες έχω αυτή την εβδομάδα;»</small></span><span class="chev">${ICON.chev}</span></button>
  <div class="jx-stats">
    ${card("shop-filter", "active", ic('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 6M18 19a5 5 0 0 0-2.5-4.3"/>'), customers.length, "Πελάτες", newCustomers ? `<span class="up">+${newCustomers}</span> νέοι τις τελευταίες 7 μέρες` : `${plural(state.shops.length, "μαγαζί", "μαγαζιά")} συνολικά`)}
    ${card("go", "settings", ic('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M12 12l7-7M16 5h3v3"/>'), pct + "%", "Στόχος επισκέψεων", `${monthVisits} από ${target} αυτόν τον μήνα`, `<span class="jx-bar"><span style="width:${pct}%"></span></span>`)}
    ${card("go", "sales", ICON.trend, sales.targets ? `${sales.hit}/${sales.targets}` : sales.won, sales.targets ? "Στόχοι προϊόντων" : "Νέοι πελάτες μήνα", sales.targets ? `${sales.won} νέοι πελάτες τον μήνα` : "Όρισε στόχους στις Πωλήσεις")}
    ${card("go", "tasks", ic('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 12l2 2 4-4"/>'), open.length, "Ανοιχτές εργασίες", overdue.length ? `<span class="warn">${overdue.length} εκπρόθεσμες</span>` : "όλες εντός χρόνου")}
  </div>
  <button class="jx-card jx-map" data-action="go" data-v="map">
    ${territoryMap()}
    <span class="jx-map-head"><span class="jx-pin">${ic('<path d="M12 21s-6.5-6-6.5-11.5a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/>')}</span><span><b>Η περιοχή σου</b><small>${state.shops.filter(hasGeo).length} από ${plural(state.shops.length, "μαγαζί", "μαγαζιά")} στον χάρτη</small></span><span class="chev">${ICON.chev}</span></span>
  </button>
  ${weekCard()}`;
}
function startDay() {
  const t = todayISO();
  let ids = state.shops.filter((s) => s.nextVisit === t).map((s) => s.id);
  if (ids.length < 4) ids = [...ids, ...priorities().map((p) => p.s.id).filter((id) => !ids.includes(id)).slice(0, 6 - ids.length)];
  state.route = { day: t, ids, manual: false, all: false }; saveRoute();
  try { localStorage.setItem("jarvis-day", t); } catch {}
  nav("route");
  locate().then(() => { if (state.view === "route") render(); }).catch(() => {});
}

function weekCard() {
  const t = todayISO(), monday = addDays(t, -((new Date(t + "T00:00:00").getDay() + 6) % 7));
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(monday, -7 * (7 - i)));
  const counts = weeks.map((w) => state.visits.filter((v) => v.date >= w && v.date < addDays(w, 7)).length);
  const max = Math.max(1, ...counts), W = 300, H = 86, bw = W / 8;
  const bars = counts.map((n, i) => { const h = Math.max(4, (n / max) * (H - 26)); const x = i * bw + 6, y = H - 16 - h; return `<rect class="wbar ${i === 7 ? "now" : ""}" x="${x}" y="${y}" width="${bw - 12}" height="${h}" rx="5"><title>${fmtDate(weeks[i])}: ${n}</title></rect>${n ? `<text x="${x + (bw - 12) / 2}" y="${y - 4}" text-anchor="middle">${n}</text>` : ""}<text class="wl" x="${x + (bw - 12) / 2}" y="${H - 2}" text-anchor="middle">${new Date(weeks[i] + "T00:00:00").getDate()}/${new Date(weeks[i] + "T00:00:00").getMonth() + 1}</text>`; }).join("");
  const now = counts[7], prev = counts[6];
  const delta = prev ? Math.round((now - prev) / prev * 100) : null;
  return `<section class="panel week-card"><div class="week-head"><div><span class="eyebrow">Επισκέψεις εβδομάδας</span><div class="week-num">${now}${delta != null && now ? `<span class="trend ${delta >= 0 ? "up" : "down"}">${arrow(delta >= 0)} ${Math.abs(delta)}%</span>` : ""}</div></div><span class="muted small">8 εβδομάδες</span></div>
    <svg class="week-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Επισκέψεις ανά εβδομάδα">${bars}</svg></section>`;
}

/* ---------- views: agenda ---------- */
function viewAgenda() {
  const t = todayISO(), sel = state.agendaDay || t;
  const days = Array.from({ length: 21 }, (_, i) => addDays(t, i - 1));
  if (!days.includes(sel)) days.push(sel);
  loadCalendar();
  const visitsOn = (day) => state.shops.filter((s) => s.nextVisit === day);
  const tasksOn = (day) => state.tasks.filter((x) => !x.done && x.due === day);
  const strip = `<div class="daystrip" role="group" aria-label="Ημέρες">${days.map((day) => { const dt = new Date(day + "T00:00:00"); const n = visitsOn(day).length + tasksOn(day).length + calOn(day).length; return `<button class="day ${day === t ? "today" : ""}" data-action="agenda-day" data-v="${day}" aria-pressed="${day === sel}"><span>${dt.toLocaleDateString("el-GR", { weekday: "short" })}</span><b>${dt.getDate()}</b><i class="${n ? "on" : ""}"></i></button>`; }).join("")}</div>`;
  const overdue = sel === t ? state.tasks.filter((x) => !x.done && x.due && x.due < t).sort((a, b) => a.due.localeCompare(b.due)) : [];
  const visits = visitsOn(sel), tasks = tasksOn(sel);
  const undated = state.tasks.filter((x) => !x.done && !x.due);
  const label = sel === t ? "Σήμερα" : sel === addDays(t, 1) ? "Αύριο" : new Date(sel + "T00:00:00").toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" });
  return `${banner()}${strip}
  <button class="panel route-cta" data-action="go" data-v="route"><span class="tile-ic">${ICON.route}</span><span class="grow"><b>Διαδρομή ημέρας</b><small>Διάλεξε μαγαζιά, ο Jarvis βρίσκει την καλύτερη σειρά</small></span><span class="chev">${ICON.chev}</span></button>
  <div class="section-head"><h2 class="day-title">${esc(label)}</h2><input type="date" class="date-jump" data-action="agenda-pick" value="${sel}" aria-label="Διάλεξε ημερομηνία"></div>
  ${overdue.length ? `<section class="section"><h3 class="group bad">Εκπρόθεσμες</h3><div class="panel"><ul class="list">${overdue.map(taskRow).join("")}</ul></div></section>` : ""}
  ${calOn(sel).length ? `<section class="section"><h3 class="group">Ημερολόγιο</h3><div class="panel"><ul class="list">${calOn(sel).map(calRow).join("")}</ul></div></section>` : ""}
  <section class="section"><h3 class="group">Επισκέψεις</h3><div class="panel"><ul class="list">${visits.length ? visits.map((s) => shopRow(s, "Προγραμματισμένη επίσκεψη")).join("") : emptyLi("calendar", "Καμία επίσκεψη. Όρισε επόμενη επίσκεψη σε ένα μαγαζί ή πες το στον Jarvis.")}</ul></div></section>
  <section class="section"><h3 class="group">Εργασίες</h3><div class="panel"><ul class="list">${tasks.length ? tasks.map(taskRow).join("") : emptyLi("tasks", "Τίποτα για αυτή τη μέρα.")}</ul></div>${taskForm(null, sel)}</section>
  ${undated.length ? `<section class="section"><h3 class="group">Χωρίς ημερομηνία</h3><div class="panel"><ul class="list">${undated.map(taskRow).join("")}</ul></div></section>` : ""}
  <a href="#tasks" class="link center">Όλες οι εργασίες</a>`;
}

/* ---------- views: more ---------- */
function viewMore() {
  const item = (v, icon, label, sub) => `<li><button class="item" data-action="go" data-v="${v}"><span class="tile-ic">${icon}</span><div class="grow"><div class="title">${label}</div><div class="sub">${sub}</div></div><span class="chev">${ICON.chev}</span></button></li>`;
  const prospects = state.shops.filter((s) => s.status === "prospect").length;
  const openTasks = state.tasks.filter((x) => !x.done).length;
  return `${banner()}<div class="panel profile">${avatar(state.email, "ph big")}<div class="grow"><div class="title">${esc(state.email || "")}</div><div class="sub">${esc(syncText())}</div></div></div>
  <section class="section"><h3 class="group">Αναλύσεις</h3><div class="panel"><ul class="list">
    ${item("sales", ICON.trend, "Πωλήσεις & στόχοι", "Στόχοι, διανομή, ευκαιρίες, χαμένες ευκαιρίες")}
    ${item("map", ICON.map, "Χάρτης", `${state.shops.filter(hasGeo).length} από ${plural(state.shops.length, "μαγαζί", "μαγαζιά")} στον χάρτη`)}
    ${item("prospects", ICON.star, "Υποψήφιοι", `${prospects} με κατάταξη βαθμολογίας`)}
    ${item("market", ICON.chart, "Μερίδιο αγοράς", "Φιάλες στο back bar ανά εταιρεία")}
    ${item("catalogues", ICON.book, "Κατάλογοι", plural(state.catalogues.length, "εταιρεία", "εταιρείες"))}
    ${item("watch", ICON.star, "Παρακολούθηση αγοράς", "Νέα ανοίγματα και κλεισίματα στην περιοχή σου")}
  </ul></div></section>
  <section class="section"><h3 class="group">Δουλειά</h3><div class="panel"><ul class="list">
    ${item("route", ICON.route, "Διαδρομή ημέρας", "Η καλύτερη σειρά για τις επισκέψεις σου")}
    ${item("report", ICON.report, "Εβδομαδιαία αναφορά", "Έτοιμη να τη στείλεις")}
    ${item("alerts", ICON.bell, "Ειδοποιήσεις", `${urgentCount()} εκκρεμότητες`)}
    ${item("files", ICON.report, "Αρχεία δουλειάς", "Excel, CSV ή PDF στα σωστά μαγαζιά")}
    ${item("tasks", ICON.check, "Όλες οι εργασίες", `${openTasks} ανοιχτές`)}
  </ul></div></section>
  <section class="section"><h3 class="group">Εφαρμογή</h3><div class="panel"><ul class="list">
    ${item("settings", ICON.gear, "Ρυθμίσεις", "Ημερολόγιο, γλώσσα φωνής, αντίγραφο ασφαλείας")}
  </ul></div></section>`;
}
function syncText() { return state.sync.online ? (state.sync.pending ? `${state.sync.pending} αλλαγές περιμένουν να ανέβουν` : "Όλες οι αλλαγές αποθηκεύτηκαν") : `Εκτός σύνδεσης${state.sync.pending ? `, ${state.sync.pending} αλλαγές θα ανέβουν αργότερα` : ""}`; }

/* ---------- views: day route ---------- */
/* Nearest-neighbour order from where you are (or the first stop), then a quick 2-opt pass to remove crossings. */
function orderStops(stops, start) {
  if (stops.length < 2) return stops.slice();
  const left = stops.slice(); const out = [];
  let cur = start || left.shift(); if (!start) out.push(cur);
  while (left.length) { let bi = 0, bd = Infinity; left.forEach((s, i) => { const d = distKm(cur, s); if (d < bd) { bd = d; bi = i; } }); cur = left.splice(bi, 1)[0]; out.push(cur); }
  const pts = start ? [start, ...out] : out; const off = start ? 1 : 0;
  for (let improved = true, n = 0; improved && n < 50; n++) {
    improved = false;
    for (let i = off; i < pts.length - 2; i++) for (let j = i + 1; j < pts.length - 1; j++) {
      const a = pts[i - 1] || null, b = pts[i], c = pts[j], d = pts[j + 1];
      if (!a) continue;
      if (distKm(a, b) + distKm(c, d) > distKm(a, c) + distKm(b, d) + 1e-9) { pts.splice(i, j - i + 1, ...pts.slice(i, j + 1).reverse()); improved = true; }
    }
  }
  return start ? pts.slice(1) : pts;
}
function routeMap(stops, start) {
  const pts = [...(start ? [start] : []), ...stops]; if (!pts.length) return "";
  const W = 340, H = 170, lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  let sx = Math.max((maxLng - minLng) * k, 0.004), sy = Math.max(maxLat - minLat, 0.004);
  if (sx / sy < W / H) sx = sy * W / H; else sy = sx * H / W;
  const cx = (minLng + maxLng) / 2, cy = (minLat + maxLat) / 2, pad = 1.25;
  const xy = (p) => [W / 2 + ((p.lng - cx) * k) / (sx * pad) * W, H / 2 - (p.lat - cy) / (sy * pad) * H];
  const line = pts.map((p) => xy(p).map((v) => v.toFixed(1)).join(",")).join(" ");
  return `<svg class="route-map tm" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${line}"/>${start ? (() => { const [x, y] = xy(start); return `<circle class="me" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>`; })() : ""}${stops.map((s, i) => { const [x, y] = xy(s); return `<g class="stop ${esc(s.status)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/><text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="middle">${i + 1}</text></g>`; }).join("")}</svg>`;
}
/* The day route is kept per day on this phone, so it survives closing the app. */
function routeState() {
  const t = todayISO();
  if (state.route && state.route.day === t) return state.route;
  let saved = null; try { saved = JSON.parse(localStorage.getItem("jarvis-route") || "null"); } catch {}
  state.route = saved && saved.day === t ? saved : { day: t, ids: state.shops.filter((s) => s.nextVisit === t).map((s) => s.id), manual: false, all: false };
  if (state.route && !state.route.day) state.route.day = t;
  return state.route;
}
function saveRoute() { try { localStorage.setItem("jarvis-route", JSON.stringify(state.route)); } catch {} }
function viewRoute() {
  const t = todayISO(), R = routeState();
  R.ids = R.ids.filter((id) => shopById(id));
  const here = state.here && Date.now() - state.here.at < 30 * 60000 ? state.here : null;
  const chosen = R.ids.map(shopById);
  const geo = chosen.filter(hasGeo), noGeo = chosen.filter((s) => !hasGeo(s));
  const stops = R.manual ? chosen : orderStops(geo, here).concat(noGeo);
  const legs = stops.map((s, i) => !hasGeo(s) ? 0 : i ? (hasGeo(stops[i - 1]) ? distKm(stops[i - 1], s) : 0) : here ? distKm(here, s) : 0);
  const km = legs.reduce((a, b) => a + b, 0);
  const max = 10, go = stops.filter(hasGeo).slice(0, max);
  const ll = (p) => `${p.lat},${p.lng}`;
  const mids = here ? go.slice(0, -1) : go.slice(1, -1);
  const gmaps = go.length ? "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=" + ll(here || go[0]) + "&destination=" + ll(go[go.length - 1]) + (mids.length ? "&waypoints=" + encodeURIComponent(mids.map(ll).join("|")) : "") : "";
  const visited = visitedOn(t);
  const pri = new Map(priorities().map((p) => [p.s.id, p]));
  const why = (s) => s.nextVisit === t ? "Προγραμματισμένη σήμερα" : pri.has(s.id) ? pri.get(s.id).why.join(" · ") : s.status === "prospect" && scoreOf(s) != null ? `Υποψήφιος ${scoreOf(s)}/100` : STATUSES[s.status] || "";
  const sel = new Set(R.ids);
  const pool = state.shops.filter((s) => !sel.has(s.id) && s.status !== "closed" && s.status !== "lost" && (R.all || pri.has(s.id) || s.nextVisit === t));
  const groups = {}; pool.forEach((s) => (groups[areaOf(s)] = groups[areaOf(s)] || []).push(s));
  const score = (s) => s.nextVisit === t ? 1000 : pri.has(s.id) ? pri.get(s.id).score : 0;
  const areaScore = (a) => groups[a].reduce((m, s) => Math.max(m, score(s)), 0);
  const areas = Object.keys(groups).sort((a, b) => areaScore(b) - areaScore(a) || a.localeCompare(b));
  const cand = (s) => `<li><button class="item pick" data-action="route-toggle" data-id="${esc(s.id)}"><span class="pick-box">${ICON.plus}</span>${shopAvatar(s)}<div class="grow"><div class="title">${esc(s.name)}</div><div class="sub">${esc([why(s), here && hasGeo(s) ? fmtDist(distKm(here, s)) : "", hasGeo(s) ? "" : "χωρίς τοποθεσία"].filter(Boolean).join(" · "))}</div></div></button></li>`;
  const stopTasks = state.tasks.filter((x) => !x.done && sel.has(x.shopId)).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const stopRow = (s, i) => `<li class="item stop-row ${visited.has(s.id) ? "visited" : ""}"><span class="stop-n">${visited.has(s.id) ? "✓" : i + 1}</span><div class="grow"><div class="title"><a href="#" data-action="open" data-id="${esc(s.id)}">${esc(s.name)}</a></div><div class="sub">${esc([s.area, legs[i] ? "+" + fmtDist(legs[i]) : "", hasGeo(s) ? "" : "χωρίς τοποθεσία", visited.has(s.id) ? "έγινε" : why(s)].filter(Boolean).join(" · "))}</div>${visited.has(s.id) ? "" : `<div class="stop-acts">${quickActs(s)}</div>`}</div>
    <div class="stop-move"><button class="icon-btn small" data-action="route-move" data-id="${esc(s.id)}" data-v="-1" aria-label="Πιο νωρίς" ${i ? "" : "disabled"}>${ic('<path d="M6 15l6-6 6 6"/>')}</button><button class="icon-btn small" data-action="route-move" data-id="${esc(s.id)}" data-v="1" aria-label="Πιο αργά" ${i < stops.length - 1 ? "" : "disabled"}>${ic('<path d="M6 9l6 6 6-6"/>')}</button><button class="icon-btn small" data-action="route-toggle" data-id="${esc(s.id)}" aria-label="Αφαίρεση">${ic('<path d="M6 6l12 12M18 6L6 18"/>')}</button></div></li>`;
  return `${banner()}
  <section class="section"><div class="panel route-card">${geo.length ? routeMap(stops.filter(hasGeo), here) : ""}
    <div class="route-sum">${stops.length ? `<b class="num">${stops.length}</b> ${stops.length === 1 ? "στάση" : "στάσεις"}${geo.length ? ` · <b class="num">${km.toFixed(1)} km</b> · περίπου <b class="num">${Math.round(km / 22 * 60 + stops.length * 20)}</b> λεπτά μαζί με 20' ανά επίσκεψη` : ""}${visited.size ? ` · <b class="num">${stops.filter((s) => visited.has(s.id)).length}</b> έγιναν` : ""}` : "Διάλεξε πελάτες από κάτω. Ο Jarvis σου δείχνει πρώτα τις προτεραιότητες, ομαδοποιημένες ανά περιοχή."}</div>
    ${here ? "" : `<div class="row-actions"><button class="btn small" data-action="route-locate">${ICON.locate} Ξεκίνα από εκεί που είμαι</button></div>`}
  </div></section>
  ${stops.length ? `<section class="section"><div class="section-head"><h2>Η σειρά σου</h2>${R.manual ? `<button class="link" data-action="route-auto">Βέλτιστη σειρά</button>` : `<span class="muted small">με τα βέλη αλλάζεις τη σειρά</span>`}</div><div class="panel"><ol class="list stops">${stops.map(stopRow).join("")}</ol></div>
    <div class="row-actions">${gmaps ? `<a class="btn primary" href="${gmaps}" target="_blank" rel="noopener">${ICON.nav} Άνοιγμα στο Google Maps</a>` : ""}${canEdit() ? `<button class="btn" data-action="route-plan">Βάλ' τα στο σημερινό πρόγραμμα</button>` : ""}</div>${go.length < stops.filter(hasGeo).length ? `<p class="muted small">Το Google Maps δέχεται έως ${max} στάσεις μαζί. Ανοίγουν οι πρώτες ${max}.</p>` : ""}</section>` : ""}
  ${stopTasks.length ? `<section class="section"><h2>Θέματα για τις στάσεις σου</h2><div class="panel"><ul class="list">${stopTasks.slice(0, 8).map(taskRow).join("")}</ul></div></section>` : ""}
  <section class="section"><div class="section-head"><h2>Πρόσθεσε στάσεις</h2></div>
    <div class="chips"><button class="chip" data-action="route-all" data-v="0" aria-pressed="${!R.all}">Προτεραιότητες</button><button class="chip" data-action="route-all" data-v="1" aria-pressed="${!!R.all}">Όλο το χαρτοφυλάκιο</button></div>
    ${areas.length ? areas.map((a) => `<div class="section-head area-head"><h3 class="group"><i class="area-dot" style="--h:${hue(a)}"></i>${esc(a)} <span class="muted num">${groups[a].length}</span></h3><button class="link" data-action="route-area" data-v="${esc(a)}">+ Όλα</button></div><div class="panel"><ul class="list">${groups[a].sort((x, y) => score(y) - score(x) || (x.name || "").localeCompare(y.name || "")).slice(0, 25).map(cand).join("")}</ul></div>`).join("")
      : `<div class="panel"><ul class="list">${emptyLi("pin", R.all ? "Όλα τα μαγαζιά είναι ήδη στη διαδρομή." : pri.size ? "Όλες οι προτεραιότητες είναι ήδη στη διαδρομή. Πάτα «Όλο το χαρτοφυλάκιο» για περισσότερα." : "Καμία προτεραιότητα σήμερα. Πάτα «Όλο το χαρτοφυλάκιο» για να διαλέξεις.")}</ul></div>`}
  </section>`;
}

/* ---------- sales: distribution, opportunities, targets (all from stored records) ---------- */
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const monthAdd = (m, n) => { const d = new Date(m + "-01T00:00:00"); d.setMonth(d.getMonth() + n); return ym(d); };
/* Products a shop takes: consumption or orders in the last 6 months, its product list, and our brands on its back bar. */
function carries(s) {
  const since = monthAdd(todayISO().slice(0, 7), -5), mine = norm(state.settings.myCompany), out = new Map();
  const add = (name) => { const k = norm(name).trim(); if (k && !out.has(k)) out.set(k, String(name).trim()); };
  (s.consumption || []).filter((c) => (c.month || "") >= since && Number(c.qty) > 0).forEach((c) => add(c.product));
  (s.orders || []).filter((o) => (o.date || "").slice(0, 7) >= since).forEach((o) => (o.items || []).forEach((i) => add(i.product)));
  (s.products || []).forEach((p) => add(p.name));
  if (mine) (s.backbar || []).filter((b) => norm(b.company) === mine).forEach((b) => add(b.brand));
  return out;
}
function distribution() {
  const cust = state.shops.filter((s) => s.status === "active" && !s.example);
  const counts = new Map();
  cust.forEach((s) => carries(s).forEach((name, k) => { const c = counts.get(k) || { name, shops: [] }; c.shops.push(s); counts.set(k, c); }));
  return { total: cust.length, rows: [...counts.values()].sort((a, b) => b.shops.length - a.shops.length || a.name.localeCompare(b.name)) };
}
function posmSpread() {
  const cust = state.shops.filter((s) => s.status === "active" && !s.example), counts = new Map();
  cust.forEach((s) => new Set((s.posm || []).map((p) => p.type).filter(Boolean)).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
  return { total: cust.length, counts };
}
/* What is missing at one shop, with the evidence. */
function oppsFor(s, dist = distribution(), posm = posmSpread()) {
  if (!["active", "az"].includes(s.status)) return [];
  const have = carries(s), out = [], mine = norm(state.settings.myCompany);
  const common = (n, total) => total >= 2 && n >= 2 && n / total >= 0.3;
  dist.rows.filter((r) => common(r.shops.length, dist.total) && !have.has(norm(r.name))).slice(0, 4)
    .forEach((r) => out.push({ kind: "product", key: r.name, text: `Δεν παίρνει ${r.name}`, why: `Το παίρνουν ${r.shops.length} από ${dist.total} πελάτες σου`, weight: r.shops.length / dist.total }));
  if (mine) {
    const ourCats = new Set((s.backbar || []).filter((b) => norm(b.company) === mine).map((b) => b.category).filter(Boolean));
    const known = new Set(state.catalogues.filter((c) => norm(c.company) === mine).flatMap((c) => (c.items || []).map((i) => i.category)).filter(Boolean));
    (s.backbar || []).filter((b) => b.category && norm(b.company) !== mine && b.company && known.has(b.category) && !ourCats.has(b.category)).slice(0, 2)
      .forEach((b) => out.push({ kind: "product", key: b.brand, text: `${tr(b.category)}: έχει ${b.brand} (${b.company})`, why: "Δεν έχει δικό μας προϊόν σε αυτή την κατηγορία στο back bar", weight: 0.5 }));
  }
  const hasPosm = new Set((s.posm || []).map((p) => p.type));
  [...posm.counts.entries()].filter(([t, n]) => common(n, posm.total) && !hasPosm.has(t)).sort((a, b) => b[1] - a[1]).slice(0, 2)
    .forEach(([t, n]) => out.push({ kind: "posm", key: t, text: `Λείπει POSM: ${tr(t)}`, why: `Το έχουν ${n} από ${posm.total} πελάτες σου`, weight: n / posm.total * 0.8 }));
  return out.slice(0, 6);
}
function salesData(off = 0) {
  const t = todayISO(), cur = monthAdd(t.slice(0, 7), off), prev = monthAdd(cur, -1);
  const shops = state.shops.filter((s) => !s.example);
  const dim = new Date(Number(cur.slice(0, 4)), Number(cur.slice(5, 7)), 0).getDate();
  const frac = off === 0 ? Number(t.slice(8, 10)) / dim : 1;
  const vol = (m) => { const map = new Map(); shops.forEach((s) => (s.consumption || []).filter((c) => c.month === m).forEach((c) => { const k = norm(c.product); const r = map.get(k) || { name: c.product, unit: c.unit || "", qty: 0, shops: new Set() }; r.qty += Number(c.qty) || 0; r.shops.add(s.id); if (!r.unit && c.unit) r.unit = c.unit; map.set(k, r); })); return map; };
  const now = vol(cur), before = vol(prev);
  const inM = (iso) => (iso || "").slice(0, 7) === cur;
  const changes = shops.flatMap((s) => (s.statusHistory || []).filter((h) => inM(h.at)).map((h) => ({ ...h, shop: s })));
  const won = changes.filter((h) => h.to === "active" && h.from !== "active");
  const lost = changes.filter(LOST);
  const targets = (state.settings.targets || []).map((x, i) => { const r = now.get(norm(x.product)), goal = Number(x.qty) || 0, got = r ? r.qty : 0; return { product: x.product, i, goal, got, unit: x.unit || (r ? r.unit : ""), pct: goal ? got / goal : 0 }; });
  const visitTarget = Number(state.settings.visitTarget) || 40, accountsTarget = Number(state.settings.accountsTarget) || 0;
  const visits = state.visits.filter((v) => (v.date || "").slice(0, 7) === cur).length;
  /* by customer: this month vs last month, per product */
  const byShop = shops.map((s) => { const c = (m) => { const map = new Map(); (s.consumption || []).filter((e) => e.month === m).forEach((e) => { const k = norm(e.product); const r = map.get(k) || { name: e.product, unit: e.unit || "", qty: 0 }; r.qty += Number(e.qty) || 0; map.set(k, r); }); return map; }; return { s, now: c(cur), before: c(prev) }; }).filter((x) => x.now.size || x.before.size);
  /* missed opportunities */
  const missed = [];
  byShop.filter((x) => x.s.status === "active").forEach((x) => x.before.forEach((b, k) => { const n = x.now.get(k); const got = n ? n.qty : 0; const exp = b.qty * frac; if (b.qty > 0 && (off !== 0 || frac >= 0.5) && got < exp * 0.7) missed.push({ id: x.s.id, text: `${x.s.name}: ${b.name} ${got ? "έπεσε" : "χωρίς παραγγελία"}`, sub: `${fmtQty(got)} ${b.unit} αυτόν τον μήνα, ${fmtQty(b.qty)} ${b.unit} τον προηγούμενο`, w: 3 }); }));
  shops.filter((s) => s.status === "active").forEach((s) => { const lo = lastOrder(s), lc = (s.consumption || []).map((c) => c.month).sort().pop(); const last = [lo && lo.date, lc && lc + "-28"].filter(Boolean).sort().pop(); if (last && daysBetween(last, t) > 60) missed.push({ id: s.id, text: `${s.name}: καμία παραγγελία πάνω από 60 μέρες`, sub: `Τελευταία κίνηση ${fmtMonth(last.slice(0, 7))}`, w: 2 }); });
  shops.filter((s) => s.nextVisit && s.nextVisit < t && inM(s.nextVisit) && (!s.lastVisit || s.lastVisit < s.nextVisit)).forEach((s) => missed.push({ id: s.id, text: `Χάθηκε η επίσκεψη στο ${s.name}`, sub: `Ήταν για ${fmtDate(s.nextVisit)}`, w: 1 }));
  shops.filter((s) => s.status === "prospect" && (scoreOf(s) ?? 0) >= 60 && (!s.lastVisit || daysSinceVisit(s) >= 30)).forEach((s) => missed.push({ id: s.id, text: `Υποψήφιος ${scoreOf(s)}/100 χωρίς επίσκεψη: ${s.name}`, sub: s.lastVisit ? `Τελευταία επίσκεψη ${fmtDate(s.lastVisit)}` : "Καμία επίσκεψη ακόμα", w: 1 }));
  lost.forEach((h) => missed.push({ id: h.shop.id, text: `Χάσαμε το ${h.shop.name}`, sub: `${STATUSES[h.to] || h.to}${h.reason ? " · " + h.reason : ""}`, w: 4 }));
  return { cur, prev, off, frac, now, before, won, lost, targets, visits, visitTarget, accountsTarget, byShop, missed: missed.sort((a, b) => b.w - a.w) };
}
const fmtQty = (n) => new Intl.NumberFormat("el-GR", { maximumFractionDigits: 1 }).format(Number(n) || 0);
function salesSummary() { const d = salesData(0); return { targets: d.targets.length, hit: d.targets.filter((x) => x.pct >= 1).length, won: d.won.length }; }
function viewSales() {
  const off = state.salesMonth || 0, d = salesData(off), dist = distribution(), posm = posmSpread();
  const mlabel = (m) => new Date(m + "-01T00:00:00").toLocaleDateString("el-GR", { month: "long", year: "numeric" });
  const tile = (n, l, cls = "") => `<div class="stat ${cls}"><b>${n}</b><span>${l}</span></div>`;
  const bar = (name, pct, val, pace, act = "") => `<div class="share-row target-row"><span class="name">${name}</span><span class="track">${pace != null && pace < 1 ? `<i class="pace" style="left:${(pace * 100).toFixed(1)}%" title="Εκεί που θα έπρεπε να είσαι σήμερα"></i>` : ""}<span class="fill ${pct >= 1 ? "full" : pace != null && pct < pace * 0.8 ? "behind" : ""}" style="width:${Math.min(100, pct * 100).toFixed(1)}%"></span></span><span class="val">${val}</span>${act}</div>`;
  const pace = off === 0 ? d.frac : null;
  const targetRows = [
    bar("Επισκέψεις", d.visits / d.visitTarget, `${d.visits}/${d.visitTarget}`, pace),
    ...(d.accountsTarget ? [bar("Νέοι πελάτες", d.won.length / d.accountsTarget, `${d.won.length}/${d.accountsTarget}`, pace)] : []),
    ...d.targets.map((x) => bar(esc(x.product), x.pct, `${fmtQty(x.got)}/${fmtQty(x.goal)} ${esc(x.unit)}`, pace, canEdit() ? `<button class="icon-btn small" data-action="target-rm" data-v="${x.i}" aria-label="Διαγραφή στόχου">${ic('<path d="M6 6l12 12M18 6L6 18"/>')}</button>` : "")),
  ].join("");
  const prodRows = [...d.now.values(), ...[...d.before.entries()].filter(([k]) => !d.now.has(k)).map(([, r]) => ({ ...r, qty: 0 }))].sort((a, b) => b.qty - a.qty);
  const delta = (a, b) => b ? (a === b ? `<span class="trend">ίδιο</span>` : `<span class="trend ${a > b ? "up" : "down"}">${arrow(a > b)} ${Math.abs(Math.round((a - b) / b * 100))}%</span>`) : a ? `<span class="trend up">νέο</span>` : "";
  const topShops = d.byShop.filter((x) => x.now.size).map((x) => ({ ...x, n: [...x.now.values()].reduce((a, r) => a + r.qty, 0) })).sort((a, b) => b.n - a.n).slice(0, 12);
  const allOpps = state.shops.filter((s) => s.status === "active" && !s.example).flatMap((s) => oppsFor(s, dist, posm).map((o) => ({ ...o, s }))).sort((a, b) => b.weight - a.weight).slice(0, 15);
  const noData = !d.now.size && !d.before.size;
  return `${banner()}<div class="chips">${[[0, "Αυτός ο μήνας"], [-1, "Προηγούμενος"], [-2, "Πριν 2 μήνες"]].map(([k, l]) => `<button class="chip" data-action="sales-month" data-v="${k}" aria-pressed="${off === k}">${l}</button>`).join("")}</div>
  <p class="muted small">${esc(mlabel(d.cur))}${off === 0 ? ` · ημέρα ${todayISO().slice(8, 10)} από ${Math.round(Number(todayISO().slice(8, 10)) / d.frac)}` : ""}. Όλα τα νούμερα βγαίνουν από τις καταχωρίσεις σου: παραγγελίες, κατανάλωση, επισκέψεις και αλλαγές κατάστασης.</p>
  <div class="stats">${tile(`${d.visits}`, "Επισκέψεις")}${tile(d.won.length, "Νέοι πελάτες", d.won.length ? "good" : "")}${tile(d.lost.length, "Χάσαμε", d.lost.length ? "bad" : "")}${tile(d.targets.length ? `${d.targets.filter((x) => x.pct >= 1).length}/${d.targets.length}` : "–", "Στόχοι που πιάστηκαν")}</div>
  <section class="section"><div class="section-head"><h2>Στόχοι</h2>${pace != null ? `<span class="muted small"><i class="pace-key"></i> ρυθμός μέχρι σήμερα</span>` : ""}</div><div class="panel"><div class="share">${targetRows}</div>
    ${canEdit() ? `<details class="adder"><summary>+ Στόχος προϊόντος για κάθε μήνα</summary><form class="inline-form" data-form="target"><div class="grid2">${fld({ form: "target", name: "product", label: "Προϊόν", list: "dl-products", required: true })}${fld({ form: "target", name: "qty", label: "Ποσότητα τον μήνα", type: "number", required: true, attrs: 'min="1" step="any" inputmode="decimal"' })}${fld({ form: "target", name: "unit", label: "Μονάδα", ph: "κιβώτια" })}</div><div class="row-actions"><button class="btn primary small" type="submit">Αποθήκευση στόχου</button></div></form></details>` : ""}</div>
    <p class="muted small">Ο στόχος επισκέψεων και νέων πελατών αλλάζει από τις <a href="#settings" class="link small">Ρυθμίσεις</a>.</p></section>
  ${noData ? `<section class="section"><div class="panel">${emptyDiv("chart", "Δεν υπάρχουν ακόμα όγκοι πωλήσεων. Μπαίνουν όταν καταγράφεις παραγγελία στην «Επίσκεψη», όταν το πεις στον Jarvis, από την καρτέλα Κατανάλωση ή από αρχείο πωλήσεων στα Αρχεία δουλειάς.")}</div></section>`
    : `<section class="section"><h2>Όγκοι ανά προϊόν</h2><div class="panel table-wrap"><table><thead><tr><th>Προϊόν</th><th class="r">${esc(fmtMonth(d.cur))}</th><th class="r">${esc(fmtMonth(d.prev))}</th><th class="r">Μαγαζιά</th></tr></thead><tbody>${prodRows.map((r) => { const b = d.before.get(norm(r.name)); return `<tr><td>${esc(r.name)}</td><td class="r num">${fmtQty(r.qty)} ${esc(r.unit)} ${delta(r.qty, b ? b.qty : 0)}</td><td class="r num">${b ? fmtQty(b.qty) : "–"}</td><td class="r num">${r.shops ? r.shops.size : 0}</td></tr>`; }).join("")}</tbody></table></div>${off === 0 ? `<p class="muted small">Ο τρέχων μήνας δεν έχει τελειώσει, οπότε τα νούμερα είναι μέχρι σήμερα.</p>` : ""}</section>
  <section class="section"><h2>Ανά πελάτη</h2><div class="panel"><ul class="list">${topShops.length ? topShops.map((x) => `<li><button class="item" data-action="open" data-id="${esc(x.s.id)}">${shopAvatar(x.s)}<div class="grow"><div class="title">${esc(x.s.name)}</div><div class="sub">${[...x.now.entries()].map(([k, r]) => { const b = x.before.get(k); return `${esc(r.name)} ${fmtQty(r.qty)} ${esc(r.unit)}${b ? ` (${b.qty <= r.qty ? "↑" : "↓"} από ${fmtQty(b.qty)})` : ""}`; }).join(" · ")}</div></div><span class="chev">${ICON.chev}</span></button></li>`).join("") : emptyLi("chart", "Καμία κίνηση αυτόν τον μήνα.")}</ul></div></section>`}
  <section class="section"><div class="section-head"><h2>Διανομή προϊόντων</h2><span class="muted small">${plural(dist.total, "πελάτης", "πελάτες")}</span></div><div class="panel">${dist.rows.length ? `<div class="share">${dist.rows.slice(0, 12).map((r) => bar(esc(r.name), dist.total ? r.shops.length / dist.total : 0, `${r.shops.length}/${dist.total}`, null)).join("")}</div>` : emptyDiv("chart", "Η διανομή φαίνεται όταν οι πελάτες σου έχουν προϊόντα, παραγγελίες ή κατανάλωση.")}</div><p class="muted small">Πόσοι πελάτες παίρνουν κάθε προϊόν τους τελευταίους 6 μήνες (παραγγελίες, κατανάλωση, λίστα προϊόντων${state.settings.myCompany ? ", δικές μας φιάλες στο back bar" : ""}).</p></section>
  <section class="section"><div class="section-head"><h2>Ευκαιρίες διανομής</h2><span class="muted small">τι λείπει σε ποιον</span></div><div class="panel"><ul class="list">${allOpps.length ? allOpps.map((o) => `<li><button class="item opp" data-action="open" data-id="${esc(o.s.id)}"><span class="opp-ic ${o.kind}">${o.kind === "posm" ? ICON.star : ICON.plus}</span><div class="grow"><div class="title">${esc(o.s.name)}: ${esc(o.text)}</div><div class="sub">${esc(o.why)}</div></div><span class="chev">${ICON.chev}</span></button></li>`).join("") : emptyLi("chart", "Καμία ευκαιρία ακόμα. Εμφανίζονται όταν ένα προϊόν ή POSM υπάρχει σε τουλάχιστον 30% των πελατών σου και λείπει από κάποιον.")}</ul></div></section>
  <section class="section"><h2>Χαμένες ευκαιρίες</h2><div class="panel"><ul class="list">${d.missed.length ? d.missed.slice(0, 15).map((m) => `<li><button class="item alert warn" data-action="open" data-id="${esc(m.id)}"><i class="d"></i><div class="grow"><div class="title">${esc(m.text)}</div><div class="sub">${esc(m.sub)}</div></div><span class="chev">${ICON.chev}</span></button></li>`).join("") : emptyLi("tasks", "Τίποτα αυτόν τον μήνα.")}</ul></div></section>
  ${d.won.length ? `<section class="section"><h2>Νέοι πελάτες</h2><div class="panel"><ul class="list">${d.won.map((h) => shopRow(h.shop, `${fmtDate((h.at || "").slice(0, 10))}${h.from ? " · από " + (STATUSES[h.from] || h.from) : ""}`)).join("")}</ul></div></section>` : ""}`;
}

/* ---------- status history (ours / ΑΖ / competition) ---------- */
const statusEntry = (from, to, reason = "") => ({ from: from || "", to, at: new Date().toISOString(), reason });
const WON = (h) => h.to === "active" && h.from && h.from !== "active";
const LOST = (h) => h.from === "active" && ["competitor", "az", "lost", "closed"].includes(h.to);
function statusTimeline(s) {
  const h = (s.statusHistory || []).slice().reverse();
  if (!h.length) return "";
  return `<section class="section"><h2>Ιστορικό κατάστασης</h2><div class="panel"><ol class="timeline">${h.map((x) => `<li class="${WON(x) ? "won" : LOST(x) ? "lost" : ""}"><i class="st-dot ${esc(x.to)}"></i><div><b>${x.from ? `${esc(STATUSES[x.from] || x.from)} → ` : ""}${esc(STATUSES[x.to] || x.to)}</b>${WON(x) ? ` <span class="pill active">Κερδίσαμε</span>` : LOST(x) ? ` <span class="pill lost">Χάσαμε</span>` : ""}<div class="sub">${esc(fmtDate((x.at || "").slice(0, 10)))}${x.reason ? " · " + esc(x.reason) : ""}</div></div></li>`).join("")}</ol></div></section>`;
}

/* ---------- views: weekly report ---------- */
function weekOf(offset = 0) { const t = todayISO(); const mon = addDays(t, -((new Date(t + "T00:00:00").getDay() + 6) % 7) + 7 * offset); return [mon, addDays(mon, 7)]; }
function reportData(offset) {
  const [a, b] = weekOf(offset), inR = (d) => d && d >= a && d < b;
  const visits = state.visits.filter((v) => inR(v.date)).sort((x, y) => x.date.localeCompare(y.date));
  const changes = state.shops.flatMap((s) => (s.statusHistory || []).filter((h) => inR((h.at || "").slice(0, 10)) && h.from).map((h) => ({ ...h, shop: s })));
  return {
    a, b, visits, shopsVisited: new Set(visits.map((v) => v.shopId)).size,
    newShops: state.shops.filter((s) => inR((s.createdAt || "").slice(0, 10))),
    won: changes.filter(WON), lost: changes.filter(LOST),
    done: state.tasks.filter((x) => x.done && inR((x.doneAt || "").slice(0, 10))),
    overdue: state.tasks.filter((x) => !x.done && x.due && x.due < todayISO()),
    quiet: state.shops.filter(isQuiet),
    next: state.shops.filter((s) => s.nextVisit && s.nextVisit >= b && s.nextVisit < addDays(b, 7)),
  };
}
function reportText(r) {
  const nm = (id) => (shopById(id) || {}).name || "Μαγαζί";
  const L = [`Εβδομαδιαία αναφορά ${fmtDate(r.a)} έως ${fmtDate(addDays(r.b, -1))}`, "",
    `Επισκέψεις: ${r.visits.length} σε ${plural(r.shopsVisited, "μαγαζί", "μαγαζιά")}`,
    `Νέα μαγαζιά: ${r.newShops.length}${r.newShops.length ? " (" + r.newShops.map((s) => s.name).join(", ") + ")" : ""}`,
    `Κερδίσαμε: ${r.won.length}${r.won.length ? " (" + r.won.map((h) => `${h.shop.name} από ${STATUSES[h.from] || h.from}`).join(", ") + ")" : ""}`,
    `Χάσαμε: ${r.lost.length}${r.lost.length ? " (" + r.lost.map((h) => `${h.shop.name} προς ${STATUSES[h.to] || h.to}${h.reason ? ", " + h.reason : ""}`).join("; ") + ")" : ""}`,
    `Εργασίες που ολοκληρώθηκαν: ${r.done.length}`, `Εκπρόθεσμες εργασίες: ${r.overdue.length}`, `Πελάτες χωρίς επίσκεψη ${QUIET_DAYS}+ μέρες: ${r.quiet.length}`];
  if (r.visits.length) { L.push("", "Επισκέψεις της εβδομάδας:"); r.visits.forEach((v) => L.push(`- ${fmtDate(v.date)} ${nm(v.shopId)}: ${(v.notes || "").replace(/\s+/g, " ").slice(0, 220)}`)); }
  if (r.next.length) { L.push("", "Επόμενη εβδομάδα:"); r.next.sort((x, y) => x.nextVisit.localeCompare(y.nextVisit)).forEach((s) => L.push(`- ${fmtDate(s.nextVisit)} ${s.name}`)); }
  return L.join("\n");
}
function viewReport() {
  const off = state.reportWeek || 0, r = reportData(off);
  const text = state.reportText && state.reportText.off === off ? state.reportText.text : reportText(r);
  const tile = (n, l, cls = "") => `<div class="stat ${cls}"><b>${n}</b><span>${l}</span></div>`;
  return `${banner()}<div class="chips">${[[0, "Αυτή η εβδομάδα"], [-1, "Προηγούμενη"], [-2, "Πριν 2 εβδομάδες"]].map(([k, l]) => `<button class="chip" data-action="report-week" data-v="${k}" aria-pressed="${off === k}">${l}</button>`).join("")}</div>
  <p class="muted small">${fmtDate(r.a)} έως ${fmtDate(addDays(r.b, -1))}</p>
  <div class="stats">${tile(r.visits.length, "Επισκέψεις")}${tile(r.newShops.length, "Νέα μαγαζιά")}${tile(r.won.length, "Κερδίσαμε", "good")}${tile(r.lost.length, "Χάσαμε", r.lost.length ? "bad" : "")}${tile(r.done.length, "Εργασίες έγιναν")}${tile(r.overdue.length, "Εκπρόθεσμες", r.overdue.length ? "bad" : "")}</div>
  <section class="section"><div class="section-head"><h2>Το κείμενο της αναφοράς</h2>${state.sample ? `<button class="link" data-action="report-ai" ${state.reportBusy ? "disabled" : ""}>${state.reportBusy ? "Ο Jarvis γράφει…" : "✨ Γράψ' το ωραία με τον Jarvis"}</button>` : ""}</div>
  <div class="panel"><textarea class="report-text" id="report-text" rows="14">${esc(text)}</textarea></div>
  ${state.reportErr ? `<p class="small" style="color:var(--bad)">${esc(state.reportErr)}</p>` : ""}
  <div class="row-actions"><button class="btn primary" data-action="report-share">Κοινοποίηση</button><button class="btn" data-action="report-copy">Αντιγραφή</button><a class="btn" href="mailto:?subject=${encodeURIComponent("Εβδομαδιαία αναφορά " + fmtDate(r.a))}&body=${encodeURIComponent(text)}">Email</a></div></section>`;
}
async function reportAi() {
  const off = state.reportWeek || 0, r = reportData(off);
  state.reportBusy = true; state.reportErr = ""; render();
  const prompt = `You write a weekly field-sales report for a HoReCa sales rep in Athens, to send to their manager. Write it in Greek, as a short, professional email body (no subject line): a two-sentence overview, then short sections for visits and highlights, wins and losses against the competition, problems or risks, and plan for next week. Use only the facts below; do not invent numbers or names. Plain text, no markdown symbols except "-" for bullets.

Facts:
${reportText(r)}`;
  try { const res = await state.sample(prompt, { cache: false }); state.reportText = { off, text: (res.text || "").trim() }; }
  catch (e) { state.reportErr = sampleErr(e); }
  state.reportBusy = false; render();
}

/* ---------- alerts ---------- */
function alertsList() {
  const t = todayISO(), A = [];
  state.tasks.filter((x) => !x.done && x.due && x.due < t).sort((a, b) => a.due.localeCompare(b.due)).forEach((x) => A.push({ lvl: "bad", text: `Εκπρόθεσμη εργασία: ${x.title}`, sub: `Έληγε ${fmtDate(x.due)}${x.shopId && shopById(x.shopId) ? " · " + shopById(x.shopId).name : ""}`, id: x.shopId }));
  state.tasks.filter((x) => !x.done && x.due === t).forEach((x) => A.push({ lvl: "warn", text: `Για σήμερα: ${x.title}`, sub: x.shopId && shopById(x.shopId) ? shopById(x.shopId).name : "", id: x.shopId }));
  state.shops.filter((s) => s.nextVisit && s.nextVisit < t && (!s.lastVisit || s.lastVisit < s.nextVisit)).forEach((s) => A.push({ lvl: "warn", text: `Χάθηκε η επίσκεψη στο ${s.name}`, sub: `Ήταν για ${fmtDate(s.nextVisit)}. Όρισε νέα ημερομηνία.`, id: s.id }));
  state.shops.filter(isQuiet).sort((a, b) => (a.lastVisit || "").localeCompare(b.lastVisit || "")).forEach((s) => A.push({ lvl: "warn", text: `${s.name}: ${s.lastVisit ? `${daysSinceVisit(s)} μέρες χωρίς επίσκεψη` : "καμία επίσκεψη ακόμα"}`, sub: [tr(s.type), s.area].filter(Boolean).join(" · "), id: s.id }));
  state.shops.filter((s) => s.status === "prospect" && (scoreOf(s) ?? 0) >= 60 && (!s.lastVisit || daysSinceVisit(s) >= 14)).forEach((s) => A.push({ lvl: "info", text: `Υποψήφιος υψηλής αξίας: ${s.name} (${scoreOf(s)}/100)`, sub: "Κλείσε μια επίσκεψη", id: s.id }));
  if (new Date().getDay() === 5) A.push({ lvl: "info", text: "Η εβδομαδιαία αναφορά σου είναι έτοιμη", sub: "Δες την και στείλ' την", go: "report" });
  return A;
}
const urgentCount = () => alertsList().filter((x) => x.lvl !== "info").length;
function viewAlerts() {
  const A = alertsList();
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  return `${banner()}${perm === "default" ? `<div class="panel notice"><div class="grow"><b>Ειδοποιήσεις στο κινητό</b><div class="sub">Μια σύνοψη στην οθόνη του κινητού μία φορά τη μέρα, όταν ανοίγεις τον Jarvis.</div></div><button class="btn small primary" data-action="notif-on">Ενεργοποίηση</button></div>` : ""}
  <div class="panel"><ul class="list">${A.length ? A.map((x) => `<li><button class="item alert ${x.lvl}" ${x.go ? `data-action="go" data-v="${x.go}"` : x.id ? `data-action="open" data-id="${esc(x.id)}"` : `data-action="go" data-v="agenda"`}><i class="d"></i><div class="grow"><div class="title">${esc(x.text)}</div>${x.sub ? `<div class="sub">${esc(x.sub)}</div>` : ""}</div><span class="chev">${ICON.chev}</span></button></li>`).join("") : emptyLi("tasks", "Όλα καθαρά. Καμία εκκρεμότητα.")}</ul></div>`;
}
function notifyDaily() {
  try {
    const n = urgentCount();
    if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
    if (!("Notification" in window) || Notification.permission !== "granted" || !n) return;
    if (localStorage.getItem("jarvis-notified") === todayISO()) return;
    localStorage.setItem("jarvis-notified", todayISO());
    const A = alertsList().filter((x) => x.lvl !== "info");
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(`Jarvis: ${plural(n, "εκκρεμότητα", "εκκρεμότητες")} σήμερα`, { body: A.slice(0, 3).map((x) => x.text).join("\n"), icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "jarvis-daily", data: { url: "./#alerts" } })).catch(() => {});
  } catch {}
}

/* ---------- work files (Excel, CSV, PDF) ---------- */
let xlsxLib = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return xlsxLib || (xlsxLib = new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; sc.onload = () => res(window.XLSX); sc.onerror = () => { xlsxLib = null; rej({ code: "offline" }); }; document.head.appendChild(sc); }));
}
const MAX_FILE_TEXT = 350000;
async function fileToInput(file) {
  const name = file.name || "αρχείο", low = name.toLowerCase();
  if (low.endsWith(".pdf") || file.type === "application/pdf") {
    if (file.size > 25 * 1024 * 1024) throw { code: "file_big" };
    return { name, documents: [file], text: "" };
  }
  let text;
  if (/\.(xlsx|xlsm|xls|ods)$/.test(low)) {
    const X = await loadXlsx(); const wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    text = wb.SheetNames.map((n) => `### Sheet: ${n}\n` + X.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })).join("\n\n");
  } else text = await file.text();
  if (text.length > MAX_FILE_TEXT) throw { code: "file_big" };
  return { name, documents: [], text };
}
function filePrompt(inp, note) {
  const companies = [...new Set(state.catalogues.map((c) => c.company))];
  return `You help a HoReCa field sales rep in Athens file a work document (price list, consumption report, customer list, catalogue, etc.) into their app. Today is ${todayISO()}.
${note ? `The rep says about this file: """${note}"""\n` : ""}
Known shops: ${JSON.stringify(digest(false))}
Known company catalogues: ${JSON.stringify(companies)}
Shop status meanings: active = our customer, az = an ΑΖ shop, competitor = works with the competition, prospect = possible new customer, closed, lost.

Match rows to known shops by name (allow Greek/Latin spellings and small differences). Reply with only one JSON object:
{
 "summary": "2-3 sentences in Greek: what this file is and what you will save",
 "updates": [{
   "shopId": "id of the matching known shop, or null",
   "newShop": {"name":"","type":"${TYPES.join("|")}","area":"","city":"Athens","address":"","status":"active|az|competitor|prospect"} or null (only for shops not in the list, and only if the file is a customer/prospect list),
   "fields": {"owner":"","address":"","area":"","status":"","nextVisit":"YYYY-MM-DD","investAmount":0,"insideInfoAdd":"","pricingNotesAdd":""},
   "contacts": [{"name":"","role":"","phone":"","email":"","notes":""}],
   "products": [{"name":"","price":"our price/terms","menuPrice":"their menu price","notes":""}],
   "consumption": [{"month":"YYYY-MM","product":"","qty":0,"unit":""}],
   "assets": [{"type":"${ASSET_TYPES.join("|")}","brand":"","serial":"","qty":"1","notes":""}],
   "posm": [{"type":"${POSM_TYPES.join("|")}","brand":"","qty":"1","notes":""}]
 }],
 "catalogue": {"company":"","items":[{"brand":"","product":"","category":"${CATEGORIES.join("|")}","size":"","price":""}]} or null (only if the file is a supplier price list / catalogue not tied to one shop)
}
Omit empty fields. Only include what the file actually says; never invent numbers. Keep field names and type/category values exactly as listed. At most 80 updates.
${inp.text ? `\nFile "${inp.name}":\n"""\n${inp.text}\n"""` : `\nThe file "${inp.name}" is attached as a PDF.`}`;
}
async function readFile(file, note) {
  state.fileJob = { name: file.name, busy: true }; render();
  try {
    const inp = await fileToInput(file);
    const r = await state.sample.json(filePrompt(inp, note), { documents: inp.documents, cache: false });
    if (!r || typeof r !== "object") throw { code: "invalid_json" };
    r.updates = (r.updates || []).filter((u) => (u.shopId && shopById(u.shopId)) || u.newShop);
    state.fileJob = { name: file.name, result: r };
  } catch (e) {
    state.fileJob = { name: file.name, error: e && e.code === "file_big" ? "Το αρχείο είναι πολύ μεγάλο για μία φορά. Χώρισέ το σε μικρότερα (π.χ. ένα φύλλο ή λίγες σελίδες τη φορά)." : e && e.code === "invalid_json" ? "Δεν βρήκα κάτι να περάσω από αυτό το αρχείο." : sampleErr(e) };
  }
  render();
}
const updLine = (u) => { const n = (k) => (u[k] || []).length; return [u.newShop ? "νέο μαγαζί" : "", Object.keys(u.fields || {}).filter((k) => u.fields[k]).length ? "στοιχεία" : "", n("products") && plural(n("products"), "προϊόν/τιμή", "προϊόντα/τιμές"), n("consumption") && plural(n("consumption"), "γραμμή κατανάλωσης", "γραμμές κατανάλωσης"), n("contacts") && plural(n("contacts"), "επαφή", "επαφές"), n("assets") && plural(n("assets"), "εξοπλισμός", "εξοπλισμοί"), n("posm") && "POSM " + n("posm")].filter(Boolean).join(", "); };
async function fileSave() {
  const r = state.fileJob.result, stamp = new Date().toISOString();
  state.busy = true; state.fileJob.saving = true; render();
  const ok = await guarded(async () => {
    for (const u of r.updates) await applyUpdate({ ...u, source: "file" }, stamp);
    if (r.catalogue && r.catalogue.company && (r.catalogue.items || []).length) {
      const ex = state.catalogues.find((c) => (c.company || "").toLowerCase() === r.catalogue.company.toLowerCase());
      if (ex) await state.db.doc("catalogues/" + ex.id).update({ items: [...(ex.items || []), ...r.catalogue.items] });
      else await state.db.collection("catalogues").doc().set({ company: r.catalogue.company, items: r.catalogue.items, photos: [], createdAt: stamp });
    }
  });
  state.busy = false;
  state.fileJob = ok ? { name: state.fileJob.name, saved: `Αποθηκεύτηκαν ${plural(r.updates.length, "μαγαζί", "μαγαζιά")}${r.catalogue && r.catalogue.company ? ` και ο κατάλογος ${r.catalogue.company}` : ""}.` } : { ...state.fileJob, saving: false };
  settle();
}
function viewFiles() {
  const j = state.fileJob;
  const nm = (u) => u.newShop ? u.newShop.name : (shopById(u.shopId) || {}).name;
  let body = "";
  if (j && j.busy) body = `<div class="panel notice"><span class="spinner"></span><div class="grow"><b>Διαβάζω το «${esc(j.name)}»…</b><div class="sub">Μπορεί να πάρει ένα λεπτό για μεγάλα αρχεία.</div></div></div>`;
  else if (j && j.error) body = `<div class="banner">${esc(j.error)}</div>`;
  else if (j && j.saved) body = `<div class="panel notice"><div class="grow"><b>Έτοιμο ✓</b><div class="sub">${esc(j.saved)}</div></div></div>`;
  else if (j && j.result) {
    const r = j.result;
    body = `<section class="section"><h2>Από το «${esc(j.name)}»</h2><div class="panel"><div class="prose">${esc(r.summary || "")}</div>
      <ul class="list">${r.updates.map((u) => `<li class="item"><div class="grow"><div class="title">${esc(nm(u) || "")}</div><div class="sub">${esc(updLine(u))}</div></div>${u.newShop ? `<span class="pill prospect">Νέο</span>` : ""}</li>`).join("")}
      ${r.catalogue && r.catalogue.company ? `<li class="item"><div class="grow"><div class="title">Κατάλογος ${esc(r.catalogue.company)}</div><div class="sub">${plural((r.catalogue.items || []).length, "προϊόν", "προϊόντα")}</div></div></li>` : ""}
      ${!r.updates.length && !(r.catalogue && r.catalogue.company) ? `<li class="empty">Δεν βρήκα κάτι να περάσω.</li>` : ""}</ul></div>
      <div class="row-actions">${r.updates.length || (r.catalogue && r.catalogue.company) ? `<button class="btn primary" data-action="file-save" ${j.saving ? "disabled" : ""}>${j.saving ? "Αποθήκευση…" : "Αποθήκευση όλων"}</button>` : ""}<button class="btn" data-action="file-cancel">Ακύρωση</button></div></section>`;
  }
  return `${banner()}<p class="muted small">Ανέβασε τιμοκατάλογο, αναφορά κατανάλωσης, λίστα πελατών ή κατάλογο (Excel, CSV ή PDF). Ο Jarvis βρίσκει σε ποια μαγαζιά αντιστοιχεί κάθε γραμμή και σου δείχνει τι θα αποθηκεύσει πριν το περάσει.</p>
  ${canEdit() && state.sample && !(j && (j.busy || j.result)) ? `<div class="panel inline-form"><label class="field">Τι είναι το αρχείο; (προαιρετικό)<input id="file-note" placeholder="π.χ. κατανάλωση Σεπτεμβρίου, νέα τιμολογιακή"></label><label class="btn primary upload">${ICON.report} Διάλεξε αρχείο<input type="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.txt,.pdf,application/pdf" data-action="file-pick"></label></div>` : ""}
  ${body}`;
}

/* ---------- calendar ---------- */
const icsDate = (d) => d.replace(/-/g, "");
const icsEsc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => "\\" + m);
function gcalLink(title, day, details = "", where = "") {
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) + "&dates=" + icsDate(day) + "/" + icsDate(addDays(day, 1)) + "&details=" + encodeURIComponent(details) + "&location=" + encodeURIComponent(where);
}
function exportIcs() {
  const t = todayISO(), L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Jarvis//EL", "CALSCALE:GREGORIAN"];
  const ev = (uid, day, title, desc, where) => L.push("BEGIN:VEVENT", `UID:${uid}@jarvis`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${icsDate(day)}`, `DTEND;VALUE=DATE:${icsDate(addDays(day, 1))}`, `SUMMARY:${icsEsc(title)}`, ...(desc ? [`DESCRIPTION:${icsEsc(desc)}`] : []), ...(where ? [`LOCATION:${icsEsc(where)}`] : []), "END:VEVENT");
  state.shops.filter((s) => s.nextVisit && s.nextVisit >= t).forEach((s) => ev("visit-" + s.id + "-" + s.nextVisit, s.nextVisit, `Επίσκεψη: ${s.name}`, [tr(s.type), STATUSES[s.status]].filter(Boolean).join(" · "), [s.address, s.area, s.city].filter(Boolean).join(", ")));
  state.tasks.filter((x) => !x.done && x.due && x.due >= t).forEach((x) => ev("task-" + x.id, x.due, `Εργασία: ${x.title}`, x.shopId && shopById(x.shopId) ? shopById(x.shopId).name : "", ""));
  L.push("END:VCALENDAR");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([L.join("\r\n")], { type: "text/calendar" })); a.download = `jarvis-${t}.ics`; a.click();
}
/* Reads a calendar feed into [{day, time, end, title, where}] for the next weeks (repeating events included). */
function parseIcs(text, from, to) {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const unesc = (v) => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
  const parseDt = (p, v) => {
    if (/VALUE=DATE(?!-)/.test(p) || /^\d{8}$/.test(v)) return { day: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`, time: "" };
    const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/); if (!m) return null;
    const d = m[7] ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    return { day: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  };
  const events = [], overrides = new Set(); let cur = null;
  for (const ln of lines) {
    if (ln === "BEGIN:VEVENT") { cur = { ex: [] }; continue; }
    if (ln === "END:VEVENT") { if (cur && cur.start && cur.status !== "CANCELLED") events.push(cur); if (cur && cur.rid) overrides.add(cur.uid + "|" + cur.rid); cur = null; continue; }
    if (!cur) continue;
    const i = ln.indexOf(":"); if (i < 0) continue;
    const [name, ...params] = ln.slice(0, i).split(";"), p = params.join(";"), v = ln.slice(i + 1);
    if (name === "DTSTART") cur.start = parseDt(p, v);
    else if (name === "DTEND") cur.end = parseDt(p, v);
    else if (name === "SUMMARY") cur.title = unesc(v);
    else if (name === "LOCATION") cur.where = unesc(v);
    else if (name === "UID") cur.uid = v;
    else if (name === "STATUS") cur.status = v;
    else if (name === "RRULE") cur.rrule = Object.fromEntries(v.split(";").map((kv) => kv.split("=")));
    else if (name === "RECURRENCE-ID") cur.rid = (parseDt(p, v) || {}).day;
    else if (name === "EXDATE") v.split(",").forEach((x) => { const d = parseDt(p, x); if (d) cur.ex.push(d.day); });
  }
  const out = [], WD = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  for (const e of events) {
    const base = { time: e.start.time, end: e.end && e.end.day === e.start.day ? e.end.time : "", title: e.title || "(χωρίς τίτλο)", where: e.where || "" };
    if (!e.rrule || e.rid) { if (e.start.day >= from && e.start.day < to) out.push({ ...base, day: e.start.day }); continue; }
    const R = e.rrule, step = Number(R.INTERVAL) || 1, until = R.UNTIL ? (parseDt("", R.UNTIL) || {}).day : null, max = Number(R.COUNT) || 1000;
    const byday = R.BYDAY ? R.BYDAY.split(",").map((x) => WD.indexOf(x.slice(-2))) : null;
    let n = 0;
    for (let day = e.start.day, guard = 0; guard < 2000 && day < to && (!until || day <= until) && n < max; guard++) {
      const dt = new Date(day + "T00:00:00");
      let hit = true;
      if (R.FREQ === "WEEKLY") { const wk = Math.floor(daysBetween(e.start.day, day) / 7); hit = wk % step === 0 && (byday ? byday.includes(dt.getDay()) : dt.getDay() === new Date(e.start.day + "T00:00:00").getDay()); }
      else if (R.FREQ === "DAILY") hit = daysBetween(e.start.day, day) % step === 0;
      else if (R.FREQ === "MONTHLY") hit = dt.getDate() === +e.start.day.slice(8) && ((dt.getFullYear() * 12 + dt.getMonth()) - (+e.start.day.slice(0, 4) * 12 + +e.start.day.slice(5, 7) - 1)) % step === 0;
      else if (R.FREQ === "YEARLY") hit = day.slice(5) === e.start.day.slice(5);
      else hit = day === e.start.day;
      if (hit) { n++; if (day >= from && !e.ex.includes(day) && !overrides.has(e.uid + "|" + day)) out.push({ ...base, day }); }
      day = addDays(day, 1);
    }
  }
  return out.sort((a, b) => (a.day + (a.time || "00:00")).localeCompare(b.day + (b.time || "00:00")));
}
const calWhy = (w) => /^ics_404/.test(w) ? "Το Google δεν βρήκε αυτό το ημερολόγιο. Μάλλον αντέγραψες τη δημόσια διεύθυνση ή κόπηκε ένα κομμάτι. Αντέγραψε ξανά τη «Μυστική διεύθυνση σε μορφή iCal» (περιέχει τη λέξη private)."
  : /^ics_40[13]/.test(w) ? "Το Google δεν επιτρέπει την πρόσβαση με αυτόν τον σύνδεσμο. Αντέγραψε ξανά τη «Μυστική διεύθυνση σε μορφή iCal»."
  : w === "bad_ics_url" ? "Ο σύνδεσμος πρέπει να ξεκινά με https:// και να τελειώνει σε basic.ics."
  : w === "not_allowed" ? "Ο server δεν σε αναγνώρισε. Αποσυνδέσου και συνδέσου ξανά."
  : `Δεν μπόρεσα να διαβάσω το ημερολόγιο (${w || "άγνωστο σφάλμα"}).`;
const cleanIcs = (u) => String(u || "").replace(/\s+/g, "").replace(/^webcal:\/\//i, "https://");
async function loadCalendar(force = false) {
  const url = state.settings.icsUrl;
  if (!url || !state.sample || !state.sample.ics) { state.cal = null; return; }
  if (!force && state.cal && state.cal.url === url && Date.now() - state.cal.at < 30 * 60000) return;
  if (state.calLoading) return;
  state.calLoading = true;
  try {
    const t = todayISO(), events = parseIcs(await state.sample.ics(url), addDays(t, -7), addDays(t, 60));
    state.cal = { url, at: Date.now(), events };
    try { localStorage.setItem("jarvis-cal", JSON.stringify(state.cal)); } catch {}
  } catch (e) { state.cal = { ...(state.cal || { events: [] }), url, at: Date.now(), error: e && e.code === "server_old" ? "server_old" : "load", why: String((e && e.message) || (e && e.code) || "") }; }
  state.calLoading = false; safeRender();
}
const calOn = (day) => (state.cal && state.cal.url === state.settings.icsUrl ? state.cal.events : []).filter((e) => e.day === day);
const calRow = (e) => `<li class="item cal-ev"><span class="cal-time">${e.time ? esc(e.time) + (e.end ? `<small>${esc(e.end)}</small>` : "") : "Όλη μέρα"}</span><div class="grow"><div class="title">${esc(e.title)}</div>${e.where ? `<div class="sub">${esc(e.where)}</div>` : ""}</div></li>`;

/* ---------- market watch (openings and closures, from the web) ---------- */
const CHANGE = { opened: ["Άνοιξε", "good"], opening: ["Ανοίγει", "warn"], closed: ["Έκλεισε", "bad"] };
const normName = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9α-ω]+/g, "");
const matchShop = (name) => { const n = normName(name); return n.length < 3 ? null : state.shops.find((s) => { const m = normName(s.name); return m && (m === n || (m.length > 4 && n.includes(m)) || (n.length > 4 && m.includes(n))); }) || null; };
async function scanArea(area) {
  state.watchBusy = area; state.watchErr = ""; render();
  const prompt = `Search the web for HoReCa venues (bars, cocktail bars, restaurants, tavernas, cafés, hotels, beach bars, clubs) in the ${area} area of Athens, Greece that opened, are about to open, or closed in roughly the last 90 days. Today is ${todayISO()}. Search in Greek and in English (for example "νέο μπαρ ${area}", "άνοιξε εστιατόριο ${area}", "έκλεισε ${area}", "new bar ${area} Athens"). Include only venues you found real evidence for, with the page that says so.
Reply with only one JSON object:
{"items":[{"name":"","type":"${TYPES.join("|")}","area":"${area}","address":"","change":"opened|opening|closed","date":"YYYY-MM-DD or YYYY-MM or empty","note":"one sentence in Greek","url":"source page"}]}
Use an empty list if you found nothing reliable.`;
  try {
    const r = await state.sample.json(prompt, { webSearch: true, cache: false });
    const items = (r && r.items || []).filter((x) => x && x.name && CHANGE[x.change]).slice(0, 30);
    await guarded(() => state.db.doc("meta/watch").set({ ...(state.watch || {}), [area]: { at: new Date().toISOString(), items } }));
  } catch (e) { state.watchErr = e && e.code === "invalid_json" ? "Δεν βρήκα καθαρά αποτελέσματα. Δοκίμασε ξανά αργότερα." : sampleErr(e); }
  state.watchBusy = null; render();
}
function viewWatch() {
  const areas = [...new Set(state.shops.map((s) => s.area).filter(Boolean))].sort();
  const sel = state.watchArea || areas[0] || "Κέντρο Αθήνας";
  const data = (state.watch || {})[sel];
  const item = (x, i) => { const sh = matchShop(x.name), [lbl, cls] = CHANGE[x.change];
    const act = sh ? (x.change === "closed" && !["closed", "lost"].includes(sh.status) && canEdit() ? `<button class="btn small" data-action="watch-close" data-id="${esc(sh.id)}">Σήμανση ως «Έκλεισε»</button>` : `<button class="btn small" data-action="open" data-id="${esc(sh.id)}">Άνοιγμα</button>`) : x.change !== "closed" && canEdit() ? `<button class="btn small primary" data-action="watch-add" data-area="${esc(sel)}" data-i="${i}">Πρόσθεσε ως υποψήφιο</button>` : "";
    return `<li class="item watch-item"><div class="grow"><div class="title"><span class="pill ${cls}">${lbl}</span> ${esc(x.name)}</div><div class="sub">${esc([tr(x.type), x.address, x.date].filter(Boolean).join(" · "))}</div>${x.note ? `<div class="small">${esc(x.note)}</div>` : ""}<div class="row-actions">${act}${x.url ? `<a class="link small" href="${esc(x.url)}" target="_blank" rel="noopener">Πηγή ›</a>` : ""}</div>${sh ? `<div class="sub">Το έχεις ήδη: ${esc(sh.name)} (${esc(STATUSES[sh.status] || "")})</div>` : ""}</div></li>`; };
  return `${banner()}<p class="muted small">Ο Jarvis ψάχνει στο ίντερνετ για μαγαζιά που άνοιξαν, ανοίγουν ή έκλεισαν στην περιοχή σου τους τελευταίους 3 μήνες. Κάθε σάρωση κάνει έως 8 αναζητήσεις (περίπου 0,10 € μαζί με τη χρήση του Claude).</p>
  <div class="scroller">${(areas.length ? areas : [sel]).map((a) => `<button class="chip" data-action="watch-area" data-v="${esc(a)}" aria-pressed="${a === sel}">${esc(a)}${(state.watch || {})[a] ? `<span class="n">${(state.watch[a].items || []).length}</span>` : ""}</button>`).join("")}</div>
  <div class="row-actions"><button class="btn primary" data-action="watch-scan" data-v="${esc(sel)}" ${state.watchBusy || !canEdit() || !state.sample ? "disabled" : ""}>${state.watchBusy === sel ? "Ψάχνω… (έως 1–2 λεπτά)" : `Σάρωση: ${esc(sel)}`}</button>${data ? `<span class="muted small">Τελευταία σάρωση ${esc(fmtDate(data.at.slice(0, 10)))}</span>` : ""}</div>
  ${state.watchErr ? `<div class="banner">${esc(state.watchErr)}</div>` : ""}
  ${data ? `<div class="panel"><ul class="list">${data.items.length ? data.items.map(item).join("") : emptyLi("pin", "Δεν βρέθηκαν ανοίγματα ή κλεισίματα σε αυτή την περιοχή.")}</ul></div>` : ""}`;
}

/* ---------- views: prospects ---------- */
function viewProspects() {
  const ranked = state.shops.filter((s) => s.status === "prospect").sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));
  return `${banner()}<p class="muted small">Κατάταξη με βαθμό στα 100 από τέσσερις αξιολογήσεις: ${CRITERIA.map((c) => c[1].toLowerCase()).join(", ")}. Τις ορίζεις στην επεξεργασία του μαγαζιού.</p>
  <div class="panel"><ul class="list">${ranked.length ? ranked.map((s, i) => shopRow(s, "", i + 1)).join("") : `<li class="empty">Δεν υπάρχουν υποψήφιοι ακόμα. Πρόσθεσε ένα μαγαζί με κατάσταση «Υποψήφιος».</li>`}</ul></div>`;
}

/* ---------- views: shops ---------- */
function viewShops() {
  const q = state.query.trim().toLowerCase();
  const byStatus = state.shops.filter((s) => state.shopFilter === "all" || s.status === state.shopFilter);
  const areaCounts = {}; byStatus.forEach((s) => { const a = areaOf(s); areaCounts[a] = (areaCounts[a] || 0) + 1; });
  let list = byStatus.filter((s) => state.areaFilter === "all" || areaOf(s) === state.areaFilter);
  if (q) { const nq = norm(q); list = list.filter((s) => norm([s.name, s.area, s.city, s.owner, s.type, tr(s.type), s.address, s.insideInfo, ...(s.contacts || []).flatMap((c) => [c.name, c.role, c.phone, c.email]), ...(s.products || []).map((p) => p.name), ...(s.backbar || []).map((b) => b.brand)].join(" ")).includes(nq) || norm(String(q).replace(/\s/g, "")).length > 3 && (s.contacts || []).some((c) => String(c.phone || "").replace(/\s/g, "").includes(String(q).replace(/\s/g, "")))); }
  const prospectMode = state.shopFilter === "prospect";
  const groups = {};
  list.forEach((s) => (groups[areaOf(s)] = groups[areaOf(s)] || []).push(s));
  const nearMode = state.near && state.here;
  const count = (k) => k === "all" ? state.shops.length : state.shops.filter((s) => s.status === k).length;
  const chip = (k, label) => `<button class="chip" data-action="filter" data-f="${k}" aria-pressed="${state.shopFilter === k}">${k !== "all" ? `<i class="st-dot ${k}"></i>` : ""}${label}<span class="n">${count(k)}</span></button>`;
  const split = ["active", "az", "competitor"].map((k) => [k, count(k)]), splitTotal = split.reduce((a, [, n]) => a + n, 0);
  const achip = (k, label, n) => `<button class="chip" data-action="area" data-a="${esc(k)}" aria-pressed="${state.areaFilter === k}">${k === "all" ? "" : `<i class="area-dot" style="--h:${hue(k)}"></i>`}${esc(label)}${n != null ? `<span class="n">${n}</span>` : ""}</button>`;
  let body;
  if (!list.length) body = `<div class="panel">${emptyDiv("pin", state.shops.length ? "Κανένα μαγαζί δεν ταιριάζει." : "Δεν υπάρχουν μαγαζιά ακόμα. Πρόσθεσε το πρώτο ή πες το στον Jarvis μετά από μια επίσκεψη.")}</div>`;
  else if (nearMode) {
    const near = list.filter(hasGeo).map((s) => ({ s, d: distKm(state.here, s) })).sort((a, b) => a.d - b.d);
    body = `<div class="panel"><ul class="list">${near.map(({ s, d }) => shopRow(s, fmtDist(d) + " μακριά")).join("") || `<li class="empty">Κανένα από αυτά τα μαγαζιά δεν έχει αποθηκευμένη τοποθεσία.</li>`}</ul></div>`;
  } else if (prospectMode) {
    const ranked = list.slice().sort((a, b) => (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1));
    body = `<p class="muted small">Κατάταξη με βαθμό στα 100 από τέσσερις αξιολογήσεις: ${CRITERIA.map((c) => c[1].toLowerCase()).join(", ")}.</p><div class="panel"><ul class="list">${ranked.map((s, i) => shopRow(s, "", i + 1)).join("")}</ul></div>`;
  } else body = Object.keys(groups).sort((a, b) => a === "Χωρίς περιοχή" ? 1 : b === "Χωρίς περιοχή" ? -1 : a.localeCompare(b)).map((a) => `<section class="section"><div class="section-head"><h2>${esc(a)}</h2><span class="muted small num">${groups[a].length}</span></div>
      <div class="panel"><ul class="list">${groups[a].sort((x, y) => (x.name || "").localeCompare(y.name || "")).map((s) => shopRow(s, "", null, true)).join("")}</ul></div></section>`).join("");
  return `${banner()}
  <div class="search">${ic('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>')}<input id="shop-search" type="search" placeholder="Αναζήτηση: όνομα, επαφή, τηλέφωνο, προϊόν" value="${esc(state.query)}" data-action="search" aria-label="Αναζήτηση μαγαζιών"></div>
  <div class="scroller"><button class="chip" data-action="near" aria-pressed="${!!state.near}">📍 Κοντά μου</button>${chip("all", "Όλα")}${chip("active", "Πελάτες")}${chip("az", "ΑΖ")}${chip("competitor", "Ανταγωνισμός")}${chip("prospect", "Υποψήφιοι")}${chip("closed", "Έκλεισαν")}${chip("lost", "Χαμένοι")}</div>
  ${splitTotal ? `<div class="split panel"><div class="split-bar">${split.map(([k, n]) => n ? `<span class="${k}" style="flex:${n}"></span>` : "").join("")}</div><div class="split-legend">${split.map(([k, n]) => `<button data-action="filter" data-f="${k}"><i class="st-dot ${k}"></i>${STATUSES[k]} <b class="num">${n}</b> <span class="muted">${Math.round(n / splitTotal * 100)}%</span></button>`).join("")}</div></div>` : ""}
  <div class="scroller" role="group" aria-label="Περιοχές">${achip("all", "Όλες οι περιοχές", byStatus.length)}${Object.keys(areaCounts).sort().map((a) => achip(a, a, areaCounts[a])).join("")}</div>
  ${body}`;
}

/* ---------- views: map ---------- */
function viewMap() {
  const geo = state.shops.filter(hasGeo).filter((s) => state.areaFilter === "all" || areaOf(s) === state.areaFilter);
  const missing = state.shops.filter((s) => !hasGeo(s));
  const areas = [...new Set(state.shops.filter(hasGeo).map(areaOf))].sort();
  const achip = (k, label) => `<button class="chip" data-action="area" data-a="${esc(k)}" aria-pressed="${state.areaFilter === k}">${esc(label)}</button>`;
  let svg = emptyDiv("pin", "Κανένα μαγαζί δεν έχει τοποθεσία ακόμα. Άνοιξε ένα μαγαζί, πάτα επεξεργασία και επικόλλησε τον σύνδεσμο του Google Maps.");
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
    svg = `<div class="map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Χάρτης με τα μαγαζιά σου"><rect class="frame" x="0" y="0" width="${W}" height="${H}" rx="10"/>${areaLbls}${dots}${state.here ? (() => { const [x, y] = xy(state.here); return `<circle class="here-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14"/><circle class="here" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"><title>Είσαι εδώ</title></circle>`; })() : ""}</svg></div>
    <div class="legend"><span><i class="st-dot active"></i>Πελάτης</span><span><i class="st-dot az"></i>ΑΖ</span><span><i class="st-dot competitor"></i>Ανταγωνισμός</span><span><i style="background:var(--warn)"></i>Υποψήφιος</span><span><i style="background:var(--bad)"></i>Έκλεισε ή χάθηκε</span><span><i style="background:var(--here)"></i>Εσύ</span></div>`;
  }
  return `${banner()}<p class="muted small">Όλα τα μαγαζιά με αποθηκευμένη τοποθεσία. Πάτα μια κουκκίδα για να ανοίξεις το μαγαζί. Το κουμπί στόχου επάνω δείχνει πού βρίσκεσαι.</p>
  ${areas.length > 1 ? `<div class="scroller">${achip("all", "Όλες οι περιοχές")}${areas.map((a) => achip(a, a)).join("")}</div>` : ""}
  <div class="panel">${svg}</div>
  ${missing.length ? `<section class="section"><div class="section-head"><h2>Χωρίς τοποθεσία</h2><span class="muted small num">${missing.length}</span></div><div class="panel"><ul class="list">${missing.map((s) => shopRow(s, "Χωρίς GPS ακόμα")).join("")}</ul></div></section>` : ""}`;
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
  if (!rows.length) return emptyDiv("chart", "Δεν έχουν καταγραφεί ετικέτες back bar. Πρόσθεσέ τες στην καρτέλα Back bar ενός μαγαζιού ή φωτογράφισε το back bar.");
  return `<div class="share">${rows.map((r) => `<div class="share-row ${mine && r.co.toLowerCase() === mine.toLowerCase() ? "mine" : ""}"><span class="name">${esc(tr(r.co))}</span><span class="track" title="${esc(r.co)}: ${r.f} φιάλες, ${r.pct.toFixed(1)}%"><span class="fill" style="display:block;width:${r.pct.toFixed(1)}%"></span></span><span class="val">${r.pct.toFixed(0)}%</span></div>`).join("")}</div>`;
}
function viewMarket() {
  const seg = `<div class="segmented" role="group"><button data-action="seg" data-s="share" aria-pressed="${state.marketSeg === "share"}">Μερίδιο</button><button data-action="seg" data-s="catalogues" aria-pressed="${state.marketSeg === "catalogues"}">Κατάλογοι</button></div>`;
  if (state.marketSeg === "catalogues") {
    const cats = state.catalogues.slice().sort((a, b) => (a.company || "").localeCompare(b.company || ""));
    return `${banner()}
    <p class="muted small">Ένας κατάλογος ανά εταιρεία. Τα brands που προσθέτεις εδώ αναγνωρίζονται στο back bar, ώστε κάθε ετικέτα να μετράει στη σωστή εταιρεία.</p>
    <div class="panel"><ul class="list">${cats.length ? cats.map((c) => { const p = (c.photos || [])[0]; return `<li><button class="item" data-action="open-cat" data-id="${esc(c.id)}">${p ? `<span class="thumb"><img ${img(p.id)} alt="" loading="lazy"></span>` : `<span class="ph">${esc((c.company || "?").charAt(0).toUpperCase())}</span>`}<div class="grow"><div class="title">${esc(c.company)}</div><div class="sub">${(c.items || []).length} προϊόντα · ${(c.photos || []).length} φωτογραφίες</div></div></button></li>`; }).join("") : `<li class="empty">Δεν υπάρχουν κατάλογοι. Πρόσθεσε μια εταιρεία και ανέβασε φωτογραφίες του καταλόγου της. Ο Jarvis διαβάζει τα προϊόντα από τις φωτογραφίες.</li>`}</ul></div>
    ${adder("catalogue", "Νέος κατάλογος εταιρείας", [{ name: "company", label: "Εταιρεία", required: true, list: "dl-companies" }], "Προσθήκη εταιρείας")}`;
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
  <p class="muted small">Μερίδιο φιαλών στο back bar ανά εταιρεία, από τις ετικέτες κάθε μαγαζιού. ${plural(withData, "μαγαζί", "μαγαζιά")} με στοιχεία, ${total} φιάλες συνολικά.</p>
  ${areas.length ? `<div class="scroller">${chip("m-area", "", "all", "Όλες οι περιοχές", state.marketArea)}${areas.map((a) => chip("m-area", "", a, a, state.marketArea)).join("")}</div>` : ""}
  ${cats.length ? `<div class="scroller">${chip("m-cat", "", "all", "Όλες οι κατηγορίες", state.marketCat)}${cats.map((c) => chip("m-cat", "", c, tr(c), state.marketCat)).join("")}</div>` : ""}
  <section class="section"><h2>Μερίδιο ανά εταιρεία</h2><div class="panel">${shareBars(rows, mine)}</div></section>
  ${rows.length ? `<section class="section"><h2>Παρουσία</h2><div class="panel table-wrap"><table><thead><tr><th>Εταιρεία</th><th class="r">Φιάλες</th><th class="r">Μερίδιο</th><th class="r">Μαγαζιά</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(tr(r.co))}</td><td class="r num">${r.f}</td><td class="r num">${r.pct.toFixed(1)}%</td><td class="r num">${r.shops}/${withData}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
  ${topBrands.length ? `<section class="section"><h2>Κορυφαία brands</h2><div class="panel table-wrap"><table><thead><tr><th>Brand</th><th>Εταιρεία</th><th class="r">Φιάλες</th><th class="r">Μαγαζιά</th></tr></thead><tbody>${topBrands.map(([b, v]) => `<tr><td>${esc(b)}</td><td class="muted">${esc(v.co)}</td><td class="r num">${v.f}</td><td class="r num">${v.shops.size}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
  ${canEdit() ? `<form class="panel inline-form" data-form="settings"><div class="grid2">${fld({ form: "settings", name: "myCompany", label: "Η εταιρεία σου (τονίζεται στο γράφημα)", value: mine, list: "dl-companies" })}</div><div class="row-actions"><button class="btn small" type="submit">Αποθήκευση</button></div></form>` : ""}`;
}

function viewCatalogue(c) {
  const items = (c.items || []).slice().sort((a, b) => (a.category || "").localeCompare(b.category || "") || (a.brand || "").localeCompare(b.brand || ""));
  return `  <section class="section"><div class="section-head"><h2>Φωτογραφίες καταλόγου</h2>${uploadBtn("cat-photo", "Add photos")}</div>
    <div class="panel">${gallery((c.photos || []), "catalogues", c.id) || `<div class="empty">Δεν υπάρχουν φωτογραφίες. Ανέβασε σελίδες του καταλόγου και ο Jarvis θα περάσει τα προϊόντα στη λίστα από κάτω.</div>`}</div>${(c.photos || []).length ? readingPanel("catalogue") : ""}</section>
  <section class="section"><div class="section-head"><h2>Προϊόντα</h2><span class="muted small num">${items.length}</span></div>
    <div class="panel table-wrap">${items.length ? `<table><thead><tr><th>Brand</th><th>Προϊόν</th><th>Κατηγορία</th><th>Μέγεθος</th><th>Τιμή</th><th></th></tr></thead><tbody>${(c.items || []).map((it, i) => ({ it, i })).sort((a, b) => (a.it.category || "").localeCompare(b.it.category || "") || (a.it.brand || "").localeCompare(b.it.brand || "")).map(({ it, i }) => `<tr><td>${esc(it.brand)}</td><td>${esc(it.product)}</td><td class="muted">${esc(tr(it.category))}</td><td class="num">${esc(it.size)}</td><td class="num">${esc(it.price)}</td><td class="r">${rmButton(`cat:${c.id}:items:${i}`)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Δεν υπάρχουν προϊόντα ακόμα.</div>`}</div>
    ${adder("cat-item", "Νέο προϊόν", [{ name: "brand", label: "Brand", required: true }, { name: "product", label: "Προϊόν" }, { name: "category", label: "Κατηγορία", list: "dl-cats" }, { name: "size", label: "Μέγεθος", ph: "π.χ. 70cl, 330ml" }, { name: "price", label: "Τιμή", ph: "π.χ. €14,50" }], "Προσθήκη")}</section>
  ${canEdit() ? `<div class="row-actions">${rmButton(`catdoc:${c.id}`, "Διαγραφή καταλόγου")}</div>` : ""}`;
}

/* ---------- views: settings ---------- */
function viewSettings() {
  const vchip = (k, l) => `<button class="chip" data-action="voice-lang" data-v="${k}" aria-pressed="${state.voiceLang === k}">${l}</button>`;
  const profile = canEdit() ? `<section class="section"><h2>Προφίλ</h2><form class="panel inline-form" data-form="profile"><div class="grid2">${fld({ form: "profile", name: "myName", label: "Πώς να σε λέει ο Jarvis", value: state.settings.myName ?? "Σωκράτη" })}${fld({ form: "profile", name: "visitTarget", label: "Στόχος επισκέψεων τον μήνα", type: "number", value: state.settings.visitTarget || 40, attrs: 'min="1" inputmode="numeric"' })}${fld({ form: "profile", name: "accountsTarget", label: "Στόχος νέων πελατών τον μήνα", type: "number", value: state.settings.accountsTarget || "", attrs: 'min="0" inputmode="numeric"' })}</div><div class="row-actions"><button class="btn primary small" type="submit">Αποθήκευση</button></div></form></section>` : "";
  const cal = canEdit() ? `<section class="section"><h2>Ημερολόγιο</h2><form class="panel inline-form" data-form="calendar">${fld({ form: "calendar", name: "icsUrl", label: "Ιδιωτική διεύθυνση iCal του Google Calendar", value: state.settings.icsUrl || "", ph: "https://calendar.google.com/calendar/ical/.../basic.ics" })}
    <p class="muted small">Στο Google Calendar (από υπολογιστή): Ρυθμίσεις → το ημερολόγιό σου → «Ενσωμάτωση ημερολογίου» → «Μυστική διεύθυνση σε μορφή iCal». Αντέγραψέ την εδώ και τα ραντεβού σου θα φαίνονται στην Ατζέντα. Μένει ιδιωτική στον λογαριασμό σου.</p>
    ${state.cal && state.cal.error ? `<p class="small" style="color:var(--bad)">${state.cal.error === "server_old" ? "Χρειάζεται η ενημερωμένη έκδοση του jarvis-ai στο Supabase." : calWhy(state.cal.why)}</p>` : state.cal && state.cal.url === state.settings.icsUrl ? `<p class="muted small">Συνδεδεμένο ✓ ${plural(state.cal.events.length, "ραντεβού", "ραντεβού")} τις επόμενες εβδομάδες.</p>` : ""}
    <div class="row-actions"><button class="btn primary small" type="submit">Αποθήκευση</button>${state.settings.icsUrl ? `<button class="btn small" type="button" data-action="cal-refresh">Ανανέωση</button>` : ""}</div></form>
    <div class="row-actions"><button class="btn" data-action="cal-export">Λήψη επισκέψεων & εργασιών (.ics)</button></div><p class="muted small">Το αρχείο .ics ανοίγει σε Google Calendar, Outlook ή iPhone και περνάει όλες τις προγραμματισμένες επισκέψεις και εργασίες.</p></section>` : "";
  return `${profile}${cal}<section class="section"><h2>Λογαριασμός</h2><div class="panel"><dl class="kv"><dt>Συνδεδεμένος ως</dt><dd>${esc(state.email || "")}</dd><dt>Συγχρονισμός</dt><dd>${esc(syncText())}</dd></dl></div></section>
  <section class="section"><h2>Γλώσσα φωνής</h2><div class="chips">${vchip("el-GR", "Ελληνικά")}${vchip("en-US", "English")}</div><p class="muted small">Η γλώσσα που ακούει το μικρόφωνο του Talk. Ο Jarvis καταλαβαίνει και τις δύο.</p></section>
  <section class="section"><h2>«Hey Siri, Jarvis»</h2><div class="panel siri-steps"><p class="small">Με μία φράση ο Jarvis ανοίγει σε λειτουργία αυτοκινήτου, με την ερώτησή σου ήδη σταλμένη. Φτιάξε μία φορά τη συντόμευση:</p>
    <ol class="small"><li>Άνοιξε την εφαρμογή <b>Συντομεύσεις</b> (Shortcuts) και πάτα <b>+</b>.</li><li>Πρόσθεσε <b>Υπαγόρευση κειμένου</b> (Dictate Text), γλώσσα Ελληνικά.</li><li>Πρόσθεσε <b>Κωδικοποίηση URL</b> (URL Encode).</li><li>Πρόσθεσε <b>Άνοιγμα URL</b> (Open URL) με αυτή τη διεύθυνση και στο τέλος το αποτέλεσμα της κωδικοποίησης:<code class="siri-url">${esc(location.origin + location.pathname)}#car?q=</code></li><li>Ονόμασε τη συντόμευση <b>Jarvis</b>.</li></ol>
    <p class="small">Μετά πες <b>«Hey Siri, Jarvis»</b>, πες την ερώτησή σου, και ο Jarvis θα σου απαντήσει φωναχτά. Την πρώτη φορά συνδέσου στο Safari και επίτρεψε το μικρόφωνο (Ρυθμίσεις → Safari → Μικρόφωνο → Να επιτρέπεται).</p>
    <div class="row-actions"><button class="btn small" data-action="copy-car-link">Αντιγραφή διεύθυνσης</button><button class="btn small" data-action="car">Δοκίμασε τη λειτουργία αυτοκινήτου</button></div></div></section>
  <section class="section"><h2>Αντίγραφο ασφαλείας</h2><p class="muted small">Κατέβασε όλα τα δεδομένα (μαγαζιά, εργασίες, επισκέψεις, καταλόγους) σε ένα αρχείο. Οι φωτογραφίες μένουν στον ιδιωτικό σου χώρο.</p><div class="row-actions"><button class="btn" data-action="backup">Λήψη αντιγράφου</button></div></section>
  <div class="row-actions"><button class="btn danger" data-action="sign-out">Αποσύνδεση</button></div>`;
}

/* ---------- views: tasks ---------- */
function viewTasks() {
  const open = state.tasks.filter((t) => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  const done = state.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
  return `${banner()}
  ${taskForm(null)}
  <div class="panel"><ul class="list">${open.length ? open.map(taskRow).join("") : `<li class="empty">Δεν υπάρχουν ανοιχτές εργασίες.</li>`}</ul></div>
  ${done.length ? `<button class="back" data-action="toggle-done">${state.showDone ? "Απόκρυψη" : "Εμφάνιση"} ${done.length} ολοκληρωμένων</button>
  ${state.showDone ? `<div class="panel"><ul class="list">${done.slice(0, 50).map(taskRow).join("")}</ul></div>` : ""}` : ""}`;
}
function taskForm(shopId, due = "") {
  const shopOpts = [["", "Κανένα"], ...state.shops.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((s) => [s.id, s.name])];
  const fields = [{ name: "title", label: "Εργασία", required: true, ph: "π.χ. Στείλε τον νέο τιμοκατάλογο στον ιδιοκτήτη" }, { name: "due", label: "Ημερομηνία", type: "date", value: due }];
  if (!shopId) fields.push({ name: "shopId", label: "Μαγαζί", type: "select", options: shopOpts });
  return adder(shopId ? `task:${shopId}` : "task", "Νέα εργασία", fields, "Προσθήκη εργασίας");
}

/* ---------- views: shop wallet ---------- */
function uploadBtn(kind, label) {
  if (!canUpload()) return "";
  return `<span class="row-actions"><label class="btn small upload">Κάμερα<input type="file" accept="image/*" capture="environment" data-upload="${esc(kind)}"></label><label class="btn small upload">${esc(label === "Add photos" ? "Συλλογή" : label)}<input type="file" accept="image/*" multiple data-upload="${esc(kind)}"></label></span>`;
}
function gallery(photos, coll, docId) {
  if (!photos.length) return "";
  return `<div class="gallery">${photos.map((p) => `<button data-action="lightbox" data-coll="${coll}" data-doc="${esc(docId)}" data-pid="${esc(p.id)}" aria-label="${esc(p.caption || "Φωτογραφία")}"><img ${img(p.id)} alt="${esc(p.caption || "")}" loading="lazy"></button>`).join("")}</div>`;
}
function photoThumb(s, pid) { return pid ? `<button class="thumb" data-action="lightbox-one" data-pid="${esc(pid)}" aria-label="Άνοιγμα φωτογραφίας"><img ${img(pid)} alt="" loading="lazy"></button>` : ""; }

function profileCard(s) {
  const c = mainContact(s), lv = visitsOf(s.id)[0], lo = lastOrder(s), na = nextActionOf(s);
  const addr = [s.address, s.area, s.city].filter(Boolean).join(", ");
  const cell = (label, body, cls = "") => `<div class="pc-cell ${cls}"><span class="eyebrow">${label}</span>${body}</div>`;
  const none = (t, hint) => `<b class="muted">${t}</b>${hint ? `<small>${hint}</small>` : ""}`;
  return `<section class="section"><div class="panel pcard">
    ${cell("Επόμενη ενέργεια", na ? `<b>${esc(na.text)}</b><small>${na.date ? fmtDate(na.date) : "Χωρίς ημερομηνία"}</small>` : none("Καμία", "Όρισε επίσκεψη ή follow-up"), na && na.late ? "late" : "next")}
    ${cell("Τελευταία επίσκεψη", lv ? `<b>${fmtDate(lv.date)} <span class="muted small">(πριν ${daysBetween(lv.date, todayISO())} μέρες)</span></b><small>${esc(clip(lv.notes, 120))}</small>` : s.lastVisit ? `<b>${fmtDate(s.lastVisit)}</b>` : none("Καμία ακόμα"))}
    ${cell("Τελευταία παραγγελία", lo ? `<b>${fmtDate(lo.date)}</b><small>${esc(clip(orderText(lo), 120))}</small>` : none("Καμία", "Καταγράφεται με «Επίσκεψη» ή από τον Jarvis"))}
    ${cell("Επαφή", c ? `<b>${esc(c.name || "Χωρίς όνομα")}${c.role ? ` <span class="muted small">${esc(c.role)}</span>` : ""}</b><small>${c.phone ? `<a href="${esc(telHref(c.phone))}" class="num">${esc(c.phone)}</a>` : ""}${c.phone && c.email ? " · " : ""}${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ""}</small>` : `<b class="muted">Καμία</b><small><button class="link small" data-action="shop-tab" data-v="contacts">Πρόσθεσε επαφή</button></small>`)}
    ${cell("Τοποθεσία", addr || hasGeo(s) ? `<b>${esc(addr || "Σημείο GPS")}</b><small><a href="${mapsSearch(s)}" target="_blank" rel="noopener">Άνοιγμα στον χάρτη</a></small>` : none("Χωρίς διεύθυνση", "Πρόσθεσέ τη από την επεξεργασία"))}
  </div></section>`;
}
function tabOverview(s) {
  const sc = scoreOf(s);
  const kv = [["Ιδιοκτήτης", esc(s.owner)], ["Περιοχή", esc([s.area, s.city].filter(Boolean).join(", "))], ["Διεύθυνση", esc(s.address)], ["GPS", hasGeo(s) ? `<span class="num">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</span>` : ""], ["Επόμενη επίσκεψη", s.nextVisit ? `${fmtDate(s.nextVisit)} <a class="link small" href="${gcalLink("Επίσκεψη: " + s.name, s.nextVisit, [tr(s.type), s.owner].filter(Boolean).join(" · "), [s.address, s.area, s.city].filter(Boolean).join(", "))}" target="_blank" rel="noopener">+ Google Calendar</a>` : ""], ["Τελευταία επίσκεψη", s.lastVisit ? `${fmtDate(s.lastVisit)} (πριν ${daysSinceVisit(s)} μέρες)` : ""], ["Η επένδυσή μας", s.investAmount ? `<span class="num">${esc(money(s.investAmount))}</span>` : ""], ["Λεπτομέρειες επένδυσης", esc(s.investNotes)]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  const n = (a) => (s[a] || []).length;
  return `${profileCard(s)}${oppsFor(s).length ? `<section class="section"><div class="section-head"><h2>Ευκαιρίες</h2><span class="muted small">τι λείπει εδώ</span></div><div class="panel"><ul class="list">${oppsFor(s).map((o) => `<li class="item opp"><span class="opp-ic ${o.kind}">${o.kind === "posm" ? ICON.star : ICON.plus}</span><div class="grow"><div class="title">${esc(o.text)}</div><div class="sub">${esc(o.why)}</div></div></li>`).join("")}</ul></div></section>` : ""}
  <div class="stats"><div class="stat"><b>${n("assets")}</b><span>Εξοπλισμός</span></div><div class="stat"><b>${n("posm")}</b><span>POSM</span></div><div class="stat"><b>${n("backbar")}</b><span>Ετικέτες back bar</span></div><div class="stat"><b>${n("contacts")}</b><span>Επαφές</span></div></div>
  <section class="section"><h2>Στοιχεία</h2><div class="panel">${kv ? `<dl class="kv">${kv}</dl>` : `<div class="empty">Δεν υπάρχουν στοιχεία ακόμα.</div>`}</div></section>
  <section class="section"><h2>Εσωτερική πληροφόρηση</h2><div class="panel">${s.insideInfo ? `<div class="prose">${esc(s.insideInfo)}</div>` : `<div class="empty">Τίποτα ακόμα. Συμφωνίες ανταγωνιστών, σχέδια ιδιοκτήτη, ποιος αποφασίζει πραγματικά.</div>`}</div></section>
  ${s.status === "prospect" ? `<section class="section"><div class="section-head"><h2>Αξιολόγηση υποψηφίου</h2><span class="num">${sc == null ? "–" : sc}/100</span></div><div class="panel">${CRITERIA.map(([k, l]) => { const v = Number((s.scores || {})[k]) || 0; return `<div class="crit"><span>${l}</span><span class="num">${v}/5</span><div class="scorebar" style="grid-column:1/-1">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= v ? "on" : ""}"></span>`).join("")}</div></div>`; }).join("")}</div></section>` : ""}
  ${statusTimeline(s)}
  ${canEdit() ? `<div class="row-actions"><button class="btn" data-action="edit">Επεξεργασία στοιχείων</button></div>` : ""}`;
}

function tabPhotos(s) {
  return PHOTO_KINDS.filter(([k]) => k !== "backbar" && k !== "menu").map(([k, l]) => { const ps = (s.photos || []).filter((p) => p.kind === k); return `<section class="section"><div class="section-head"><h2>${l}</h2>${uploadBtn("shop:" + k, "Add photos")}</div><div class="panel">${gallery(ps, "shops", s.id) || emptyDiv("photo", "Δεν υπάρχουν φωτογραφίες ακόμα.")}</div></section>`; }).join("")
    + (canUpload() ? "" : `<div class="note">Για να ανεβάσεις φωτογραφίες πρέπει να είσαι συνδεδεμένος ως ιδιοκτήτης της εφαρμογής.</div>`);
}

function itemTable(s, field, cols, emptyText) {
  const rows = s[field] || [];
  if (!rows.length) return `<div class="empty">${emptyText}</div>`;
  return `<ul class="list">${rows.map((r, i) => `<li class="item">${photoThumb(s, r.photoId) || `<span class="ph" aria-hidden="true">${esc((r[cols[0]] || "?").charAt(0).toUpperCase())}</span>`}<div class="grow"><div class="title">${esc(tr(r[cols[0]]))}${r.qty && Number(r.qty) > 1 ? ` <span class="muted num">×${esc(r.qty)}</span>` : ""}</div><div class="sub">${cols.slice(1).map((c) => r[c[0]] ? `${c[1]}: ${c[1] === "S/N" ? `<span class="num">${esc(r[c[0]])}</span>` : esc(r[c[0]])}` : "").filter(Boolean).join(" · ")}</div></div>${rmButton(`shop:${s.id}:${field}:${i}`)}</li>`).join("")}</ul>`;
}

function tabAssets(s) {
  return `<p class="muted small">Εξοπλισμός της εταιρείας στο μαγαζί. Πρόσθεσε φωτογραφία της ετικέτας για να καταγραφούν σειριακός αριθμός και brand.</p>
  <div class="panel">${itemTable(s, "assets", ["type", ["brand", "Brand"], ["serial", "S/N"], ["placed", "Τοποθέτηση"], ["notes", "Σημειώσεις"]], "Δεν έχει καταγραφεί εξοπλισμός.")}</div>
  ${adder(`asset:${s.id}`, "Νέος εξοπλισμός", [{ name: "type", label: "Είδος", type: "select", options: opts(ASSET_TYPES) }, { name: "brand", label: "Brand", list: "dl-brands" }, { name: "serial", label: "Σειριακός αριθμός (S/N)" }, { name: "qty", label: "Τεμάχια", type: "number", value: 1, attrs: 'min="1" inputmode="numeric"' }, { name: "placed", label: "Τοποθέτηση", type: "date" }, { name: "notes", label: "Σημειώσεις" }, ...(canUpload() ? [{ name: "photo", label: "Φωτογραφία εξοπλισμού ή ετικέτας S/N", type: "file" }] : [])], "Αποθήκευση")}`;
}

function tabPosm(s) {
  const byType = {}; (s.posm || []).forEach((p) => byType[p.type] = (byType[p.type] || 0) + (Number(p.qty) || 1));
  return `${Object.keys(byType).length ? `<div class="chips">${Object.entries(byType).map(([t, n]) => `<span class="pill" style="color:var(--ink)">${esc(tr(t))} <span class="num">${n}</span></span>`).join("")}</div>` : ""}
  <div class="panel">${itemTable(s, "posm", ["type", ["brand", "Brand"], ["placed", "Τοποθέτηση"], ["notes", "Σημειώσεις"]], "Δεν έχει καταγραφεί POSM. Ομπρέλες, μαυροπίνακες, σουβέρ, πινακίδες μενού κ.λπ.")}</div>
  ${adder(`posm:${s.id}`, "Νέο POSM", [{ name: "type", label: "POSM", type: "select", options: opts(POSM_TYPES) }, { name: "brand", label: "Brand", list: "dl-brands" }, { name: "qty", label: "Τεμάχια", type: "number", value: 1, attrs: 'min="1" inputmode="numeric"' }, { name: "placed", label: "Τοποθέτηση", type: "date" }, { name: "notes", label: "Σημειώσεις", ph: "Κατάσταση, ποιος το έδωσε" }, ...(canUpload() ? [{ name: "photo", label: "Φωτογραφία", type: "file" }] : [])], "Αποθήκευση")}`;
}

function tabBackbar(s) {
  const ps = (s.photos || []).filter((p) => p.kind === "backbar");
  const { rows } = marketShare([s], "all");
  const bb = (s.backbar || []).map((b, i) => ({ b, i })).sort((x, y) => (x.b.category || "").localeCompare(y.b.category || "") || (x.b.company || "").localeCompare(y.b.company || ""));
  return `<section class="section"><div class="section-head"><h2>Φωτογραφίες back bar</h2>${uploadBtn("shop:backbar", "Add photos")}</div>
    <div class="panel">${gallery(ps, "shops", s.id) || `<div class="empty">Δεν υπάρχουν φωτογραφίες. Φωτογράφισε το back bar και ο Jarvis θα διαβάσει τις ετικέτες.</div>`}</div>${ps.length ? readingPanel("backbar") : ""}</section>
  <section class="section"><div class="section-head"><h2>Ετικέτες στο back bar</h2>${s.backbarDate ? `<span class="muted small">Μέτρηση ${fmtDate(s.backbarDate)}</span>` : ""}</div>
    <div class="panel table-wrap">${bb.length ? `<table><thead><tr><th>Brand</th><th>Εταιρεία</th><th>Κατηγορία</th><th class="r">Φιάλες</th><th></th></tr></thead><tbody>${bb.map(({ b, i }) => `<tr><td>${esc(b.brand)}</td><td class="muted">${esc(b.company)}</td><td class="muted">${esc(tr(b.category))}</td><td class="r num">${esc(b.facings || 1)}</td><td class="r">${rmButton(`shop:${s.id}:backbar:${i}`)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Δεν έχουν καταγραφεί ετικέτες.</div>`}</div>
    ${adder(`backbar:${s.id}`, "Νέα ετικέτα", [{ name: "brand", label: "Brand", required: true, list: "dl-brands" }, { name: "company", label: "Εταιρεία (αυτόματα από τον κατάλογο)", list: "dl-companies" }, { name: "category", label: "Κατηγορία", list: "dl-cats" }, { name: "facings", label: "Φιάλες", type: "number", value: 1, attrs: 'min="1" inputmode="numeric"' }], "Προσθήκη")}</section>
  ${rows.length ? `<section class="section"><h2>Μερίδιο σε αυτό το μαγαζί</h2><div class="panel">${shareBars(rows, state.settings.myCompany)}</div></section>` : ""}`;
}

function tabMenu(s) {
  const ps = (s.photos || []).filter((p) => p.kind === "menu");
  const prods = s.products || [];
  return `<section class="section"><div class="section-head"><h2>Φωτογραφίες μενού & τιμοκαταλόγου</h2>${uploadBtn("shop:menu", "Add photos")}</div>
    <div class="panel">${gallery(ps, "shops", s.id) || `<div class="empty">Δεν υπάρχουν φωτογραφίες μενού ή τιμοκαταλόγου.</div>`}</div></section>
  <section class="section"><h2>Προϊόντα που αγοράζουν από εμάς</h2>
    <div class="panel table-wrap">${prods.length ? `<table><thead><tr><th>Προϊόν</th><th>Δική μας τιμή / όροι</th><th>Τιμή μενού</th><th></th></tr></thead><tbody>${prods.map((p, i) => `<tr><td>${esc(p.name)}${p.notes ? `<div class="muted small">${esc(p.notes)}</div>` : ""}</td><td class="num">${esc(p.price)}</td><td class="num">${esc(p.menuPrice)}</td><td class="r">${rmButton(`shop:${s.id}:products:${i}`)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">Δεν έχουν καταγραφεί προϊόντα.</div>`}</div>
    ${adder(`product:${s.id}`, "Νέο προϊόν", [{ name: "name", label: "Προϊόν", required: true, list: "dl-products" }, { name: "price", label: "Δική μας τιμή / όροι", ph: "π.χ. €0,85 / φιάλη" }, { name: "menuPrice", label: "Τιμή στο μενού τους", ph: "π.χ. €4,50" }, { name: "notes", label: "Σημειώσεις" }], "Προσθήκη")}
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
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Μηνιαία κατανάλωση">
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
  if (months.length >= 2) { const sum = (m) => entries.filter((e) => e.month === m).reduce((t, e) => t + (Number(e.qty) || 0), 0); const a = sum(months[months.length - 2]), b = sum(months[months.length - 1]); if (a) { const d = (b - a) / a * 100; trend = `<span class="pill" style="color:${d >= 0 ? "var(--good)" : "var(--bad)"}">${arrow(d >= 0)} ${Math.abs(d).toFixed(0)}% σε σχέση με τον προηγούμενο μήνα</span>`; } }
  return `<p class="muted small">Μηνιαίοι όγκοι ανά προϊόν, για να βλέπεις αν το μαγαζί ανεβαίνει ή πέφτει.</p>
  ${products.length ? `<div class="scroller">${products.map((p) => `<button class="chip" data-action="cons-product" data-v="${esc(p)}" aria-pressed="${p === cur}">${esc(p)}</button>`).join("")}</div>
  <section class="section"><div class="section-head"><h2>${esc(cur)}${unit ? ` <span class="muted small">(${esc(unit)})</span>` : ""}</h2>${trend}</div><div class="panel">${consChart(entries)}</div></section>
  <div class="panel table-wrap"><table><thead><tr><th>Μήνας</th><th>Προϊόν</th><th class="r">Ποσότητα</th><th></th></tr></thead><tbody>${all.map((e, i) => ({ e, i })).sort((a, b) => b.e.month.localeCompare(a.e.month)).slice(0, 60).map(({ e, i }) => `<tr><td class="num">${fmtMonth(e.month)}</td><td>${esc(e.product)}</td><td class="r num">${esc(e.qty)} ${esc(e.unit)}</td><td class="r">${rmButton(`shop:${s.id}:consumption:${i}`)}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="panel"><div class="empty">Δεν έχει καταγραφεί κατανάλωση. Πρόσθεσε μηνιαία νούμερα από κάτω ή στείλε το αρχείο πωλήσεων.</div></div>`}
  ${adder(`cons:${s.id}`, "Νέο μηνιαίο νούμερο", [{ name: "month", label: "Μήνας", type: "month", required: true, value: todayISO().slice(0, 7) }, { name: "product", label: "Προϊόν", required: true, list: "dl-products", value: cur || "" }, { name: "qty", label: "Ποσότητα", type: "number", required: true, attrs: 'min="0" step="any" inputmode="decimal"' }, { name: "unit", label: "Μονάδα", value: unit || "", ph: "βαρέλια, κιβώτια, φιάλες" }], "Προσθήκη")}`;
}

function tabContacts(s) {
  const cs = s.contacts || [];
  return `<div class="panel">${cs.length ? `<ul class="list">${cs.map((c, i) => `<li class="item"><span class="ph" aria-hidden="true">${esc((c.name || "?").charAt(0).toUpperCase())}</span><div class="grow"><div class="title">${esc(c.name)}${c.role ? ` <span class="muted small">${esc(c.role)}</span>` : ""}</div><div class="sub">${c.phone ? `<a href="tel:${esc(c.phone.replace(/\s/g, ""))}" class="num">${esc(c.phone)}</a>` : ""}${c.phone && c.email ? " · " : ""}${c.email ? `<span>${esc(c.email)}</span>` : ""}${c.notes ? `<div>${esc(c.notes)}</div>` : ""}</div></div>${rmButton(`shop:${s.id}:contacts:${i}`)}</li>`).join("")}</ul>` : `<div class="empty">Δεν υπάρχουν επαφές ακόμα.</div>`}</div>
  ${adder(`contact:${s.id}`, "Νέα επαφή", [{ name: "name", label: "Όνομα", required: true }, { name: "role", label: "Ρόλος", ph: "Ιδιοκτήτης, υπεύθυνος, bartender" }, { name: "phone", label: "Τηλέφωνο", type: "tel" }, { name: "email", label: "Email", type: "email" }, { name: "notes", label: "Σημειώσεις", ph: "Καλύτερη ώρα για τηλέφωνο, γενέθλια, προτιμήσεις" }], "Αποθήκευση")}`;
}

const visitItem = (v) => `<li class="item"><div class="grow"><div class="sub num">${fmtDate(v.date)}${v.outcome ? ` · <span class="outcome ${esc(v.outcome)}">${esc(lbl(OUTCOMES, v.outcome))}</span>` : ""}${v.potential ? ` · Δυναμική: ${esc(lbl(POTENTIAL, v.potential))}` : ""}</div><div style="white-space:pre-wrap">${esc(v.notes)}</div>${(v.discussed || []).length ? `<div class="sub">Συζητήσαμε: ${esc(v.discussed.join(", "))}</div>` : ""}${(v.order || []).length ? `<div class="sub">Παραγγελία: ${esc(orderText({ items: v.order }))}</div>` : ""}${v.competition ? `<div class="sub">Ανταγωνισμός: ${esc(v.competition)}</div>` : ""}</div></li>`;
function tabVisits(s) {
  const visits = visitsOf(s.id);
  const tasks = state.tasks.filter((t) => t.shopId === s.id && !t.done);
  return `<section class="section"><h2>Ανοιχτές εργασίες</h2><div class="panel"><ul class="list">${tasks.length ? tasks.map(taskRow).join("") : `<li class="empty">Δεν υπάρχουν ανοιχτές εργασίες για αυτό το μαγαζί.</li>`}</ul></div>${taskForm(s.id)}</section>
  <section class="section"><h2>Ιστορικό επισκέψεων</h2>
  ${canEdit() ? `<div class="row-actions"><button class="btn primary" data-action="log-visit" data-id="${esc(s.id)}">${ICON.done} Καταγραφή επίσκεψης</button></div>` : ""}
  <div class="panel">${visits.length ? `<ul class="list">${visits.map(visitItem).join("")}</ul>` : `<div class="empty">Δεν έχουν καταγραφεί επισκέψεις ακόμα.</div>`}</div></section>
  ${(s.orders || []).length ? `<section class="section"><h2>Παραγγελίες</h2><div class="panel"><ul class="list">${(s.orders || []).map((o, i) => ({ o, i })).sort((a, b) => (b.o.date || "").localeCompare(a.o.date || "")).map(({ o, i }) => `<li class="item"><div class="grow"><div class="sub num">${fmtDate(o.date)}</div><div>${esc(orderText(o))}</div></div>${rmButton(`shop:${s.id}:orders:${i}`)}</li>`).join("")}</ul></div></section>` : ""}`;
}

function viewShop(s) {
  if (state.editing) return viewEdit(s);
  const c = cover(s);
  const tabs = { overview: tabOverview, photos: tabPhotos, assets: tabAssets, posm: tabPosm, backbar: tabBackbar, menu: tabMenu, consumption: tabConsumption, contacts: tabContacts, visits: tabVisits };
  const phone = (s.contacts || []).map((x) => x.phone).find(Boolean);
  return `<div class="shop-hero ${c ? "" : "noimg"}">${c ? `<img ${img(c)} alt="Πρόσοψη ${esc(s.name)}">` : ACROPOLIS + shopAvatar(s, "hero-av")}
    <div class="shop-hero-text">
      <div class="chips">${s.example ? `<span class="pill example">Δεδομένα παράδειγμα</span>` : ""}<span class="pill solid ${esc(s.status)}">${esc(STATUSES[s.status] || "")}</span></div>
      <h1>${esc(s.name || "Μαγαζί χωρίς όνομα")}</h1>
      <div class="meta">${s.type ? `<span>${esc(tr(s.type))}</span>` : ""}${s.area ? `<span>${esc(s.area)}</span>` : ""}${s.status === "prospect" && scoreOf(s) != null ? `<span>Βαθμός <b class="num">${scoreOf(s)}</b>/100</span>` : ""}</div>
    </div></div>
  <div class="actions4">
    <a class="act" href="${mapsDir(s)}" target="_blank" rel="noopener"><span class="act-ic">${ICON.nav}</span>Οδηγίες</a>
    ${phone ? `<a class="act" href="tel:${esc(phone.replace(/\s/g, ""))}"><span class="act-ic">${ICON.phone}</span>Κλήση</a>` : `<button class="act" data-action="shop-tab" data-v="contacts"><span class="act-ic">${ICON.phone}</span>Επαφές</button>`}
    ${canEdit() && s.id ? `<button class="act" data-action="log-visit" data-id="${esc(s.id)}"><span class="act-ic">${ICON.done}</span>Επίσκεψη</button>` : `<button class="act" data-action="shop-tab" data-v="photos"><span class="act-ic">${ICON.camera}</span>Φωτογραφίες</button>`}
    <button class="act" data-action="talk"><span class="act-ic">${ICON.mic}</span>Jarvis</button>
  </div>
  <div class="tabbar" role="tablist" aria-label="Ενότητες μαγαζιού">${SHOP_TABS.map(([k, l]) => `<button class="tab" role="tab" data-action="shop-tab" data-v="${k}" aria-selected="${state.shopTab === k}">${l}</button>`).join("")}</div>
  ${tabs[state.shopTab](s)}`;
}

function viewEdit(s) {
  const isNew = !s.id;
  const F = "shop";
  const f = (name, label, type = "text", extra = {}) => fld({ form: F, name, label, type, value: s[name], ...extra });
  return `<form class="section" data-form="shop">
    <div class="panel inline-form">
      ${f("name", "Όνομα μαγαζιού", "text", { required: true })}
      <div class="grid2">
        ${fld({ form: F, name: "type", label: "Είδος", type: "select", options: opts(TYPES), value: s.type })}
        ${fld({ form: F, name: "status", label: "Κατάσταση", type: "select", options: Object.entries(STATUSES), value: s.status })}
        ${isNew ? "" : f("statusReason", "Αιτία αν αλλάζεις κατάσταση", "text", { value: "", ph: "π.χ. καλύτερη τιμή από ανταγωνισμό" })}
        ${f("owner", "Ιδιοκτήτης")}
        ${f("area", "Περιοχή", "text", { list: "dl-areas", ph: "π.χ. Θησείο" })}
        ${f("city", "Πόλη", "text", { list: "dl-cities", value: s.city || "Athens" })}
      </div>
      ${f("address", "Διεύθυνση")}
      ${fld({ form: F, name: "location", label: "Τοποθεσία: επικόλλησε τον σύνδεσμο Google Maps ή συντεταγμένες", value: hasGeo(s) ? `${s.lat}, ${s.lng}` : (s.mapsLink || ""), ph: "37.97591, 23.72066 or https://www.google.com/maps/..." })}
      <div class="row-actions"><button type="button" class="btn small" data-action="use-gps">Χρήση της τρέχουσας θέσης μου</button><span class="muted small" id="gps-note">Στάσου στην πόρτα του μαγαζιού για καλύτερη ακρίβεια.</span></div>
      <div class="grid2">${f("lastVisit", "Τελευταία επίσκεψη", "date")}${f("nextVisit", "Επόμενη επίσκεψη", "date")}</div>
    </div>
    <div class="panel inline-form"><h2>Η επένδυσή μας</h2>
      <div class="grid2">${f("investAmount", "Συνολική επένδυση (€)", "number", { attrs: 'inputmode="decimal" min="0" step="any"' })}</div>
      ${fld({ form: F, name: "investNotes", label: "Λεπτομέρειες", type: "textarea", value: s.investNotes })}</div>
    <div class="panel inline-form">${fld({ form: F, name: "insideInfo", label: "Εσωτερική πληροφόρηση", type: "textarea", value: s.insideInfo })}
      ${fld({ form: F, name: "pricingNotes", label: "Σημειώσεις τιμών (εκπτώσεις, όροι, προσφορές ανταγωνισμού)", type: "textarea", value: s.pricingNotes })}</div>
    <div class="panel inline-form"><h2>Αξιολόγηση υποψηφίου (0 έως 5)</h2><div class="grid2">${CRITERIA.map(([k, l]) => fld({ form: F, name: "sc_" + k, label: l, type: "number", value: (s.scores || {})[k], attrs: 'min="0" max="5" step="1"' })).join("")}</div></div>
    <div class="row-actions"><button class="btn primary" type="submit">Αποθήκευση</button><button class="btn" type="button" data-action="${isNew ? "back" : "cancel-edit"}">Ακύρωση</button>${isNew ? "" : rmButton(`shopdoc:${s.id}`, "Διαγραφή μαγαζιού")}</div>
  </form>`;
}

/* ---------- lightbox ---------- */
function renderLightbox() {
  const lb = state.lightbox;
  if (!lb) { lbRoot.innerHTML = ""; return; }
  const p = lb.list[lb.index];
  if (!p) { state.lightbox = null; lbRoot.innerHTML = ""; return; }
  const kindLabel = (PHOTO_KINDS.find(([k]) => k === p.kind) || [, ""])[1];
  lbRoot.innerHTML = `<div class="lightbox" role="dialog" aria-label="Φωτογραφία">
    <div class="bar"><span>${esc(kindLabel)}${p.at ? ` · ${fmtDate(p.at.slice(0, 10))}` : ""}${lb.list.length > 1 ? ` · ${lb.index + 1} από ${lb.list.length}` : ""}</span><button class="btn small" data-lb="close">Κλείσιμο</button></div>
    <div class="img"><img ${img(p.id)} alt="${esc(p.caption || "")}"></div>
    <div class="bar"><span>${lb.list.length > 1 ? `<button class="btn small" data-lb="prev">Προηγούμενη</button> <button class="btn small" data-lb="next">Επόμενη</button>` : ""}</span>
    ${lb.coll && canEdit() ? `<button class="btn small ${lb.armed ? "danger" : ""}" data-lb="delete">${lb.armed ? "Πάτα ξανά για διαγραφή" : "Διαγραφή φωτογραφίας"}</button>` : ""}</div></div>`;
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
  renderWelcome();
  const overdue = state.tasks.filter((t) => !t.done && t.due && t.due <= todayISO()).length;
  document.getElementById("task-badge").innerHTML = overdue ? `<span class="badge">${overdue}</span>` : "";
  const ready = state.noDb || (state.loaded.shops && state.loaded.tasks);
  if (!ready) { app.innerHTML = `<p class="muted">Φορτώνω τα μαγαζιά σου…</p>`; return; }
  let html;
  if (state.shopId) {
    const s = state.shopId === "new" ? { type: "Restaurant", status: "prospect", city: "Athens" } : shopById(state.shopId);
    html = s ? viewShop(s) : `<button class="back" data-action="back">← Πίσω</button><p class="muted">Αυτό το μαγαζί διαγράφηκε.</p>`;
  } else if (state.catId) {
    const c = catById(state.catId);
    html = c ? viewCatalogue(c) : `<button class="back" data-action="back">← Πίσω</button><p class="muted">Αυτός ο κατάλογος διαγράφηκε.</p>`;
  } else {
    if (state.view === "market" || state.view === "catalogues") state.marketSeg = state.view === "market" ? "share" : "catalogues";
    html = { today: viewToday, shops: viewShops, agenda: viewAgenda, more: viewMore, map: viewMap, prospects: viewProspects, market: viewMarket, catalogues: viewMarket, tasks: viewTasks, settings: viewSettings, route: viewRoute, report: viewReport, alerts: viewAlerts, files: viewFiles, watch: viewWatch, sales: viewSales }[state.view]();
  }
  const openAdders = [...app.querySelectorAll("details.adder[open] form")].map((f) => f.dataset.form);
  app.innerHTML = html + datalists();
  openAdders.forEach((k) => { const f = app.querySelector(`form[data-form="${CSS.escape(k)}"]`); if (f) f.closest("details").open = true; });
  if (state.focusSearch) { const el = document.getElementById("shop-search"); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } state.focusSearch = false; }
  renderLightbox();
  notifyDaily();
}
/* ---------- welcome screen (once per app launch) ---------- */
const welcome = document.getElementById("welcome");
const TIPS = [
  "Βγήκες από ένα μαγαζί; Πάτα «Μίλα» και πες τι έγινε. Ο Jarvis γράφει την επίσκεψη και τις εργασίες.",
  "Φωτογράφισε το back bar και ο Jarvis μετράει τις ετικέτες για το μερίδιο αγοράς.",
  "Στο «Κοντά μου» βλέπεις τα πιο κοντινά μαγαζιά από εκεί που βρίσκεσαι.",
  "Ρώτα τον Jarvis: «Ποια μαγαζιά στην Πλάκα δεν έχω επισκεφτεί αυτόν τον μήνα;»",
  "Στην Ατζέντα βλέπεις μέρα με τη μέρα επισκέψεις και εργασίες.",
];
function showWelcome() {
  try { if (sessionStorage.getItem("jarvis-welcomed")) return; } catch {}
  document.getElementById("wl-tip").textContent = TIPS[new Date().getDate() % TIPS.length];
  welcome.hidden = false; renderWelcome();
}
function renderWelcome() {
  if (welcome.hidden) return;
  const t = todayISO();
  document.getElementById("wl-date").textContent = new Date().toLocaleDateString("el-GR", { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("wl-greet").textContent = greeting();
  const ready = state.loaded.shops && state.loaded.tasks;
  const due = state.tasks.filter((x) => !x.done && x.due && x.due <= t).length;
  const visits = state.shops.filter((s) => s.nextVisit && s.nextVisit >= t && daysBetween(t, s.nextVisit) <= 7).length;
  const customers = state.shops.filter((s) => s.status === "active").length;
  const card = (n, label, icon) => `<div class="wl-card wl-stat"><span class="wl-ic">${icon}</span><b>${ready ? n : "–"}</b><span>${label}</span></div>`;
  document.getElementById("wl-sub").textContent = !ready ? "Ετοιμάζω τη μέρα σου…" : due ? `Έχεις ${plural(due, "εργασία", "εργασίες")} για σήμερα. Πάμε!` : "Καμία εκκρεμότητα για σήμερα. Καλή δουλειά!";
  document.getElementById("wl-cards").innerHTML = card(due, "Εργασίες σήμερα", ICON.check) + card(visits, "Επισκέψεις εβδομάδας", ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')) + card(customers, "Πελάτες", ICON.shop);
}
function closeWelcome(then) {
  try { sessionStorage.setItem("jarvis-welcomed", "1"); } catch {}
  welcome.classList.add("leaving");
  setTimeout(() => { welcome.hidden = true; welcome.classList.remove("leaving"); if (then) then(); }, 380);
}
welcome.addEventListener("click", (ev) => { const b = ev.target.closest("[data-wl]"); if (b) closeWelcome(b.dataset.wl === "talk" ? openTalk : null); });

function renderChrome() {
  let title = TITLES[state.view] || "Jarvis", eyebrow = "", back = !!PARENT[state.view], actions = "";
  if (state.shopId) {
    const s = state.shopId === "new" ? null : shopById(state.shopId);
    back = true;
    if (state.shopId === "new") title = "Νέο μαγαζί";
    else if (state.editing) { title = "Επεξεργασία"; eyebrow = s ? s.name : ""; }
    else { title = "Μαγαζί"; if (s && canEdit()) actions = iconBtn("edit", "Επεξεργασία", ICON.edit); }
  } else if (state.catId) { const c = catById(state.catId); title = c ? c.company : "Κατάλογος"; eyebrow = "Κατάλογος"; back = true; }
  else if (state.view === "today") { eyebrow = "Ο βοηθός πωλήσεών σου"; title = "J.A.R.V.I.S."; const n = urgentCount(); actions = `<button class="icon-btn bell" data-action="go" data-v="alerts" aria-label="Ειδοποιήσεις${n ? ": " + n : ""}">${ICON.bell}${n ? `<span class="badge">${n > 9 ? "9+" : n}</span>` : ""}</button>` + iconBtn("go", "Ρυθμίσεις", ICON.gear, "settings"); }
  else if (state.view === "route") actions = iconBtn("route-locate", "Πού βρίσκομαι", ICON.locate);
  else if (state.view === "shops") actions = iconBtn("go", "Χάρτης", ICON.map, "map") + (canEdit() ? iconBtn("new-shop", "Νέο μαγαζί", ICON.plus) : "");
  else if (state.view === "map") actions = iconBtn("locate-me", "Πού βρίσκομαι", ICON.locate);
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
    const msg = code === "quota_exceeded" ? "Ο χώρος γέμισε. Διάγραψε παλιές φωτογραφίες ή εγγραφές." : code === "invalid_argument" || code === "not_granted" ? "Δεν έχεις δικαίωμα να αλλάξεις αυτά τα δεδομένα." : code === "file_too_large" ? "Η φωτογραφία είναι πολύ μεγάλη." : "Δεν αποθηκεύτηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.";
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
  else if (a === "car") openCar();
  else if (a === "copy-car-link") { const u = location.origin + location.pathname + "#car?q="; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast("Αντιγράφηκε ✓"), () => toast(u)); }
  else if (a === "route-toggle") { const R = routeState(), id = el.dataset.id; R.ids = R.ids.includes(id) ? R.ids.filter((x) => x !== id) : [...R.ids, id]; saveRoute(); render(); }
  else if (a === "route-move") { const R = routeState(); const cur = [...app.querySelectorAll(".stops [data-action='route-move'][data-v='1']")].map((b) => b.dataset.id); const i = cur.indexOf(el.dataset.id), j = i + Number(el.dataset.v); if (i < 0 || j < 0 || j >= cur.length) return; [cur[i], cur[j]] = [cur[j], cur[i]]; R.ids = cur; R.manual = true; saveRoute(); render(); }
  else if (a === "route-auto") { routeState().manual = false; saveRoute(); render(); }
  else if (a === "route-all") { routeState().all = el.dataset.v === "1"; saveRoute(); render(); }
  else if (a === "route-area") { const R = routeState(), t = todayISO(), pri = new Set(priorities().map((p) => p.s.id)); state.shops.filter((s) => areaOf(s) === el.dataset.v && !R.ids.includes(s.id) && s.status !== "closed" && s.status !== "lost" && (R.all || pri.has(s.id) || s.nextVisit === t)).forEach((s) => R.ids.push(s.id)); saveRoute(); render(); }
  else if (a === "start-day") startDay();
  else if (a === "sales-month") { state.salesMonth = Number(el.dataset.v); render(); }
  else if (a === "target-rm") { const targets = (state.settings.targets || []).filter((_, i) => i !== Number(el.dataset.v)); await guarded(() => state.db.doc("meta/settings").set({ ...state.settings, targets })); }
  else if (a === "log-visit") { ev.preventDefault(); openLog(el.dataset.id); }
  else if (a === "route-locate") { el.classList.add("busy"); locate().then(render).catch(() => { el.classList.remove("busy"); alert("Η τοποθεσία είναι κλειδωμένη. Επέτρεψέ την για την εφαρμογή στις ρυθμίσεις του κινητού."); }); }
  else if (a === "route-plan") { const t = todayISO(); await guarded(async () => { for (const id of routeState().ids) { const s = shopById(id); if (s && s.nextVisit !== t) await state.db.doc("shops/" + id).update({ nextVisit: t }); } }); el.textContent = "Μπήκαν στο πρόγραμμα ✓"; }
  else if (a === "report-week") { state.reportWeek = Number(el.dataset.v); state.reportErr = ""; render(); }
  else if (a === "report-ai") reportAi();
  else if (a === "file-save") fileSave();
  else if (a === "file-cancel") { state.fileJob = null; render(); }
  else if (a === "watch-area") { state.watchArea = el.dataset.v; state.watchErr = ""; render(); }
  else if (a === "watch-scan") scanArea(el.dataset.v);
  else if (a === "watch-add") { const x = state.watch[el.dataset.area].items[Number(el.dataset.i)]; await guarded(() => applyUpdate({ newShop: { name: x.name, type: TYPES.includes(x.type) ? x.type : "Other", area: x.area || el.dataset.area, city: "Athens", address: x.address || "", status: "prospect" }, fields: { insideInfoAdd: `${CHANGE[x.change][0]}${x.date ? " " + x.date : ""}. ${x.note || ""} ${x.url || ""}`.trim() }, source: "watch" }, new Date().toISOString())); el.textContent = "Προστέθηκε ✓"; el.disabled = true; }
  else if (a === "watch-close") { const s = shopById(el.dataset.id); await guarded(() => state.db.doc("shops/" + s.id).update({ status: "closed", statusHistory: [...(s.statusHistory || []), statusEntry(s.status, "closed", "Βρέθηκε στην παρακολούθηση αγοράς")] })); render(); }
  else if (a === "cal-export") exportIcs();
  else if (a === "cal-refresh") { el.textContent = "Ανανέωση…"; loadCalendar(true); }
  else if (a === "report-copy") { const tx = document.getElementById("report-text").value; navigator.clipboard.writeText(tx).then(() => { el.textContent = "Αντιγράφηκε ✓"; }).catch(() => { document.getElementById("report-text").select(); }); }
  else if (a === "report-share") { const tx = document.getElementById("report-text").value; if (navigator.share) navigator.share({ title: "Εβδομαδιαία αναφορά", text: tx }).catch(() => {}); else navigator.clipboard.writeText(tx).then(() => { el.textContent = "Αντιγράφηκε ✓"; }).catch(() => {}); }
  else if (a === "notif-on") { Notification.requestPermission().then(() => { try { localStorage.removeItem("jarvis-notified"); } catch {} render(); }); }
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
  else if (a === "near") { if (state.near) { state.near = false; render(); } else { el.textContent = "Σε εντοπίζω…"; locate().then(() => { state.near = true; render(); }).catch(() => { el.textContent = "📍 Η τοποθεσία είναι κλειδωμένη"; }); } }
  else if (a === "locate-me") { el.classList.add("busy"); locate().then(render).catch(() => { el.classList.remove("busy"); alert("Η τοποθεσία είναι κλειδωμένη. Επέτρεψέ την για την εφαρμογή στις ρυθμίσεις του κινητού."); }); }
  else if (a === "use-gps") { const note = document.getElementById("gps-note"); note.textContent = "Σε εντοπίζω…"; locate().then((h) => { document.getElementById("f-shop-location").value = `${h.lat.toFixed(6)}, ${h.lng.toFixed(6)}`; note.textContent = `Βρέθηκε, με ακρίβεια περίπου ${Math.round(h.acc)} μ.`; state.dirty = true; }).catch(() => { note.textContent = "Δεν βρέθηκε η θέση σου. Επέτρεψε την τοποθεσία για την εφαρμογή στις ρυθμίσεις του κινητού."; }); }
  else if (a === "settings") nav("settings");
  else if (a === "sign-out") { await sb.auth.signOut(); location.reload(); }
  else if (a === "backup") { const data = JSON.stringify({ exportedAt: new Date().toISOString(), docs: store.exportAll() }, null, 1); const a2 = document.createElement("a"); a2.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a2.download = `jarvis-backup-${todayISO()}.json`; a2.click(); }
  else if (a === "voice-lang") { state.voiceLang = el.dataset.v; try { localStorage.setItem("jarvis-voice-lang", state.voiceLang); } catch {} render(); }
  else if (a === "read-photos") readPhotos(el.dataset.v);
  else if (a === "read-save") { el.disabled = true; readSave(el.dataset.v); }
  else if (a === "read-cancel") { state.reading = null; render(); }
  else if (a === "rm") {
    const key = el.dataset.key;
    if (state.armed !== key) { state.armed = key; if (state.editing) { el.classList.add("danger"); el.textContent = "Πάτα ξανά για διαγραφή"; } else render(); return; }
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
  if (el.dataset.action === "file-pick") { const f = el.files && el.files[0]; if (f) readFile(f, (document.getElementById("file-note") || {}).value || ""); return; }
  if (el.dataset.action === "agenda-pick") { if (el.value) { state.agendaDay = el.value; render(); } return; }
  if (el.dataset.action === "toggle-task") {
    const done = el.checked;
    await guarded(() => state.db.doc("tasks/" + el.dataset.id).update({ done, doneAt: done ? new Date().toISOString() : "" }));
  } else if (el.dataset.upload && el.files && el.files.length) {
    const [target, kind] = el.dataset.upload.split(":");
    const label = el.closest("label"); const files = [...el.files];
    state.busy = true; label.childNodes[0].textContent = `Ανεβαίνουν ${files.length}…`;
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
  if (ev.target.id === "report-text") { state.reportText = { off: state.reportWeek || 0, text: ev.target.value }; return; }
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
    const old = isNew ? null : shopById(state.shopId);
    if (isNew) data.statusHistory = [statusEntry("", data.status)];
    else if (old && old.status !== data.status) data.statusHistory = [...(old.statusHistory || []), statusEntry(old.status, data.status, v("statusReason"))];
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
  } else if (kind === "profile") {
    await guarded(() => state.db.doc("meta/settings").set({ ...state.settings, myName: v("myName"), visitTarget: Number(v("visitTarget")) || 40, accountsTarget: Number(v("accountsTarget")) || 0 }));
  } else if (kind === "calendar") {
    const icsUrl = cleanIcs(v("icsUrl"));
    await guarded(() => state.db.doc("meta/settings").set({ ...state.settings, icsUrl }));
    state.settings.icsUrl = icsUrl; loadCalendar(true);
  } else if (kind === "target") {
    const targets = [...(state.settings.targets || []).filter((x) => norm(x.product) !== norm(v("product"))), { product: v("product"), qty: Number(v("qty").replace(",", ".")) || 0, unit: v("unit") }];
    await guarded(() => state.db.doc("meta/settings").set({ ...state.settings, targets }));
  } else if (kind === "settings") {
    await guarded(() => state.db.doc("meta/settings").set({ ...state.settings, myCompany: v("myCompany") }));
  }
  form.reset();
  settle();
});


/* ---------- one-tap visit completion ---------- */
const OUTCOMES = [["", "Διάλεξε"], ["positive", "Θετική"], ["neutral", "Ουδέτερη"], ["negative", "Αρνητική"], ["absent", "Δεν βρήκα τον υπεύθυνο"]];
const POTENTIAL = [["", "Δεν συζητήθηκε"], ["none", "Καμία"], ["low", "Χαμηλή"], ["medium", "Μέτρια"], ["high", "Υψηλή"]];
const lbl = (list, k) => (list.find((x) => x[0] === k) || [, ""])[1];
const logRoot = document.createElement("div"); document.body.appendChild(logRoot);
function openLog(id) { if (!shopById(id) || !canEdit()) return; state.log = { id, lines: 1 }; renderLog(); }
function closeLog() { if (rec && state.log && state.log.listening) rec.stop(); state.log = null; renderLog(); }
const orderLine = (i, v = {}) => `<div class="oline">${fld({ form: "log", name: "p" + i, label: "Προϊόν", list: "dl-products", value: v.product || "" })}${fld({ form: "log", name: "q" + i, label: "Ποσότητα", type: "number", value: v.qty ?? "", attrs: 'min="0" step="any" inputmode="decimal"' })}${fld({ form: "log", name: "u" + i, label: "Μονάδα", value: v.unit || "", ph: "κιβώτια" })}</div>`;
function renderLog() {
  const L = state.log, s = L && shopById(L.id);
  if (!s) { logRoot.innerHTML = ""; return; }
  const t = todayISO();
  const f = (name, label, type = "text", extra = {}) => fld({ form: "log", name, label, type, ...extra });
  logRoot.innerHTML = `<div class="sheet-bg" data-log="bg"><form class="sheet log-sheet" data-form="log" role="dialog" aria-label="Ολοκλήρωση επίσκεψης" novalidate>
    <div class="section-head"><h2>Ολοκλήρωση επίσκεψης</h2><span class="muted small">${esc(s.name)}</span></div>
    <div class="panel voice-fill"><div class="inline-form">
      <label class="field" for="log-say">Πες ή γράψε τι έγινε και ο Jarvis συμπληρώνει τα πεδία. Τα ελέγχεις πριν την αποθήκευση.</label>
      <textarea id="log-say" rows="3" placeholder="π.χ. Είδα τον Νίκο. Μιλήσαμε για Mythos και Fix. Παρήγγειλε 10 κιβώτια Fix. Ο ανταγωνισμός του έφερε νέο ψυγείο. Να του πάω τιμοκατάλογο την Παρασκευή."></textarea>
      <div class="row-actions">${Rec ? `<button type="button" class="btn small ${L.listening ? "danger" : ""}" data-log="mic">${ICON.mic} ${L.listening ? "Σε ακούω… πάτα για τέλος" : "Μίλα"}</button>` : ""}<button type="button" class="btn small primary" data-log="fill" ${L.busy ? "disabled" : ""}>${L.busy ? "Ο Jarvis συμπληρώνει…" : "✨ Συμπλήρωση πεδίων"}</button></div>
      ${L.msg ? `<p class="small ${L.msgOk ? "ok-text" : "bad-text"}" role="status">${esc(L.msg)}</p>` : ""}
    </div></div>
    <div class="grid2">${f("date", "Ημερομηνία", "date", { value: t, required: true })}${f("outcome", "Αποτέλεσμα", "select", { options: OUTCOMES })}</div>
    ${f("discussed", "Προϊόντα που συζητήσαμε", "text", { ph: "χωρισμένα με κόμμα", list: "dl-products" })}
    <fieldset class="order-lines"><legend>Παραγγελία</legend><div id="log-lines">${Array.from({ length: L.lines }, (_, i) => orderLine(i)).join("")}</div><button type="button" class="btn small" data-log="line">+ Προϊόν</button></fieldset>
    <div class="grid2">${f("potential", "Δυναμική παραγγελίας", "select", { options: POTENTIAL })}${f("nextVisit", "Επόμενη επίσκεψη", "date", { value: s.nextVisit && s.nextVisit > t ? s.nextVisit : "" })}</div>
    ${f("competition", "Δραστηριότητα ανταγωνισμού", "text", { ph: "π.χ. νέο ψυγείο, προσφορά 5+1, άλλαξαν brand στη βρύση" })}
    ${f("notes", "Σημειώσεις", "textarea", { ph: "Ποιον είδες, τι ειπώθηκε, τι υποσχέθηκες" })}
    <div class="grid2">${f("task", "Επόμενο follow-up", "text", { ph: "π.χ. Φέρε τιμοκατάλογο" })}${f("taskDue", "Μέχρι", "date")}</div>
    ${L.error ? `<div class="banner" role="alert">${esc(L.error)}</div>` : ""}
    <div class="row-actions sticky-actions"><button class="btn primary" type="submit">Αποθήκευση επίσκεψης</button><button class="btn" type="button" data-log="close">Ακύρωση</button></div>
  </form></div>${datalists()}`;
}
function logValues(form) {
  const fd = new FormData(form), v = (k) => String(fd.get(k) ?? "").trim();
  const items = [];
  for (let i = 0; fd.has("p" + i); i++) { const p = v("p" + i), q = Number(v("q" + i).replace(",", ".")); if (p && q > 0) items.push({ product: p, qty: q, unit: v("u" + i) }); }
  return { date: isDate(v("date")) ? v("date") : todayISO(), outcome: v("outcome"), discussed: v("discussed").split(/[,;]/).map((x) => x.trim()).filter(Boolean), items, potential: v("potential"), nextVisit: isDate(v("nextVisit")) ? v("nextVisit") : "", competition: v("competition"), notes: v("notes"), task: v("task") ? { title: v("task"), due: isDate(v("taskDue")) ? v("taskDue") : "" } : null };
}
function addOrder(s, patch, date, items, source) {
  const clean = (items || []).filter((i) => i && i.product && Number(i.qty) > 0).map((i) => ({ product: String(i.product).trim(), qty: Number(i.qty), unit: i.unit || "" }));
  if (!clean.length) return;
  patch.orders = [...(patch.orders || s.orders || []), { date, items: clean, source }];
  patch.consumption = [...(patch.consumption || s.consumption || []), ...clean.map((i) => ({ month: date.slice(0, 7), product: i.product, qty: i.qty, unit: i.unit, source: "order" }))];
}
async function saveVisit(s, x, stamp, source) {
  const notes = x.notes || [x.items.length ? "Παραγγελία: " + orderText({ items: x.items }) : "", x.discussed.length ? "Συζητήσαμε: " + x.discussed.join(", ") : ""].filter(Boolean).join(". ") || "Επίσκεψη";
  const visit = { shopId: s.id, date: x.date, notes, createdAt: stamp, source };
  if (x.outcome) visit.outcome = x.outcome;
  if (x.discussed.length) visit.discussed = x.discussed;
  if (x.potential) visit.potential = x.potential;
  if (x.competition) visit.competition = x.competition;
  if (x.items.length) visit.order = x.items;
  await state.db.collection("visits").doc().set(visit);
  const patch = { updatedAt: stamp };
  if (!s.lastVisit || x.date > s.lastVisit) patch.lastVisit = x.date;
  if (x.nextVisit) patch.nextVisit = x.nextVisit;
  if (x.competition) patch.insideInfo = [s.insideInfo, `${x.date}: Ανταγωνισμός: ${x.competition}`].filter(Boolean).join("\n");
  addOrder(s, patch, x.date, x.items, source);
  await state.db.doc("shops/" + s.id).update(patch);
  if (x.task) await state.db.collection("tasks").doc().set({ title: x.task.title, due: x.task.due, shopId: s.id, done: false, createdAt: stamp });
}
async function logFill() {
  const L = state.log, s = shopById(L.id), say = document.getElementById("log-say"), text = say ? say.value.trim() : "";
  if (!text) { L.msg = "Πες ή γράψε πρώτα τι έγινε."; L.msgOk = false; renderLog(); return; }
  if (!state.sample) { L.msg = "Ο Jarvis δεν είναι διαθέσιμος τώρα. Συμπλήρωσε τα πεδία με το χέρι."; L.msgOk = false; renderLog(); return; }
  const keep = logValues(logRoot.querySelector("form")), keepFd = new FormData(logRoot.querySelector("form"));
  const redraw = () => { renderLog(); restoreForm(keepFd); document.getElementById("log-say").value = text; };
  L.busy = true; L.msg = ""; L.say = text; redraw();
  const prompt = `A HoReCa sales rep in Greece just finished a visit at "${s.name}" (${tr(s.type) || ""}, ${s.area || ""}) and dictated what happened (expect typos and loose phrasing). Today is ${todayISO()}. Known products: ${JSON.stringify([...new Set(state.shops.flatMap((x) => (x.consumption || []).map((c) => c.product).concat((x.products || []).map((p) => p.name))).concat(state.catalogues.flatMap((c) => (c.items || []).map((i) => i.brand))).filter(Boolean))].slice(0, 200))}.
Return only this JSON (omit what was not said; never invent):
{"outcome":"positive|neutral|negative|absent","discussed":["product names"],"order":[{"product":"","qty":0,"unit":""}],"potential":"none|low|medium|high","competition":"what the competition is doing there","notes":"clean summary in Greek","nextVisit":"YYYY-MM-DD","task":{"title":"short follow-up in Greek","due":"YYYY-MM-DD"}}
Resolve relative dates against today. "order" is only what the shop actually ordered now.
The rep said:
"""${text}"""`;
  try {
    const r = await state.sample.json(prompt, { cache: false });
    L.busy = false; L.msg = "Συμπληρώθηκε. Έλεγξε τα πεδία και πάτα Αποθήκευση."; L.msgOk = true;
    const order = (Array.isArray(r.order) ? r.order : []).filter((o) => o && o.product);
    L.lines = Math.max(L.lines, [...keepFd.keys()].filter((k) => /^p\d+$/.test(k) && keepFd.get(k)).length + order.length); redraw();
    const set = (n, v) => { const el = logRoot.querySelector(`[name="${n}"]`); if (el && v != null && v !== "") el.value = v; };
    set("outcome", OUTCOMES.some((o) => o[0] === r.outcome) ? r.outcome : keep.outcome);
    set("discussed", [...new Set([...keep.discussed, ...(Array.isArray(r.discussed) ? r.discussed : [])])].join(", "));
    const free = Array.from({ length: L.lines }, (_, i) => i).filter((i) => !logRoot.querySelector(`[name="p${i}"]`).value);
    order.forEach((o, k) => { const i = free[k]; if (i == null) return; set("p" + i, o.product); set("q" + i, Number(o.qty) || ""); set("u" + i, o.unit || ""); });
    set("potential", POTENTIAL.some((o) => o[0] === r.potential) ? r.potential : keep.potential);
    set("competition", r.competition || keep.competition);
    set("notes", [keep.notes, r.notes].filter(Boolean).join("\n"));
    set("nextVisit", isDate(r.nextVisit) ? r.nextVisit : keep.nextVisit);
    if (r.task && r.task.title) { set("task", r.task.title); set("taskDue", isDate(r.task.due) ? r.task.due : ""); }
  } catch (e) { L.busy = false; L.msg = sampleErr(e) + " Μπορείς να συμπληρώσεις τα πεδία με το χέρι."; L.msgOk = false; redraw(); }
}
function logMic() {
  const L = state.log;
  if (L.listening) { rec && rec.stop(); return; }
  const box = document.getElementById("log-say"); const base = box ? box.value.trim() : "";
  try { rec = new Rec(); } catch { L.msg = MIC_ERRORS["service-not-allowed"]; L.msgOk = false; renderLog(); return; }
  rec.lang = state.voiceLang; rec.continuous = true; rec.interimResults = true;
  let finalText = "";
  rec.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " "; else interim += e.results[i][0].transcript; } const b = document.getElementById("log-say"); if (b) b.value = [base, finalText + interim].filter(Boolean).join(" ").trim(); };
  rec.onerror = (e) => { L.msg = MIC_ERRORS[e.error] || MIC_ERRORS["service-not-allowed"]; L.msgOk = false; };
  rec.onend = () => { const b = document.getElementById("log-say"), v = b ? b.value : ""; L.listening = false; const form = logRoot.querySelector("form"); const keep = form ? new FormData(form) : null; renderLog(); restoreForm(keep); const nb = document.getElementById("log-say"); if (nb) nb.value = v; };
  L.listening = true; L.msg = ""; const form = logRoot.querySelector("form"); const keep = form ? new FormData(form) : null; renderLog(); restoreForm(keep); document.getElementById("log-say").value = base;
  try { rec.start(); } catch { L.listening = false; L.msg = MIC_ERRORS["service-not-allowed"]; renderLog(); }
}
function restoreForm(fd) { if (!fd) return; for (const [k, v] of fd.entries()) { const el = logRoot.querySelector(`[name="${k}"]`); if (el && typeof v === "string") el.value = v; } }
logRoot.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-log]");
  if (!b) return;
  const a = b.dataset.log;
  if (a === "bg") { if (ev.target === b && !state.log.busy) closeLog(); return; }
  if (a === "close") closeLog();
  else if (a === "line") { const box = document.getElementById("log-lines"); box.insertAdjacentHTML("beforeend", orderLine(box.children.length)); state.log.lines = box.children.length; }
  else if (a === "fill") logFill();
  else if (a === "mic") logMic();
});
logRoot.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target, L = state.log, s = shopById(L.id), x = logValues(form);
  const btn = form.querySelector('[type="submit"]'); btn.disabled = true; btn.textContent = "Αποθήκευση…";
  const ok = await guarded(() => saveVisit(s, x, new Date().toISOString(), L.say ? "voice" : "manual"));
  if (ok) { state.log = null; renderLog(); toast(`Η επίσκεψη στο ${s.name} αποθηκεύτηκε${x.items.length ? " με παραγγελία" : ""}${x.task ? " και follow-up" : ""} ✓`); settle(); }
  else { L.error = "Δεν αποθηκεύτηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά. Τα στοιχεία σου είναι ακόμα εδώ."; btn.disabled = false; btn.textContent = "Αποθήκευση επίσκεψης"; const err = document.createElement("div"); err.className = "banner"; err.setAttribute("role", "alert"); err.textContent = L.error; btn.parentElement.before(err); }
});
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("on"), 3200);
}

/* ---------- Talk to Jarvis ---------- */
const talkRoot = document.getElementById("talk-root");
let talkCtl = null;
/* Everything Jarvis may answer from. Records carry ids (v: visit, t: task, o: order, s: shop) so answers can cite them. */
function digest(full, curId = null) {
  return state.shops.map((s) => {
    const d = { id: "s:" + s.id, name: s.name, area: s.area || "", status: s.status, type: s.type || "" };
    if (hasGeo(s)) { d.lat = +s.lat.toFixed(5); d.lng = +s.lng.toFixed(5); }
    if (full) {
      const mine = s.id === curId;
      Object.assign(d, { owner: s.owner || "", address: s.address || "", lastVisit: s.lastVisit || "", nextVisit: s.nextVisit || "", investAmount: s.investAmount || "", score: scoreOf(s), contacts: (s.contacts || []).map((c) => [c.name, c.role && `(${c.role})`, c.phone, c.email].filter(Boolean).join(" ")), assets: (s.assets || []).map((a) => `${a.type} ${a.brand || ""} S/N ${a.serial || "-"} x${a.qty || 1}${a.notes ? " " + a.notes : ""}`), posm: (s.posm || []).map((p) => `${p.type} ${p.brand || ""} x${p.qty || 1}${p.notes ? " " + p.notes : ""}`), backbar: (s.backbar || []).map((b) => `${b.brand} (${b.company || "?"}) x${b.facings || 1}`), products: (s.products || []).map((p) => `${p.name} ${p.price || ""}`), consumption: (s.consumption || []).slice(-24).map((c) => `${c.month} ${c.product} ${c.qty} ${c.unit || ""}`), insideInfo: clip(s.insideInfo, mine ? 2000 : 500), pricingNotes: clip(s.pricingNotes, 300),
        visits: visitsOf(s.id).slice(0, mine ? 12 : 3).map((v) => ({ id: "v:" + v.id, date: v.date, notes: clip(v.notes, mine ? 900 : 260), outcome: v.outcome || undefined, competition: v.competition || undefined })),
        orders: (s.orders || []).map((o, i) => ({ id: `o:${s.id}:${i}`, date: o.date, items: orderText(o) })).slice(-6),
        missing: oppsFor(s).map((o) => o.text) });
    }
    return d;
  });
}
function talkPrompt(text, opts = {}) {
  const cur = state.shopId && state.shopId !== "new" ? shopById(state.shopId) : null;
  const companies = [...new Set(state.catalogues.map((c) => c.company))];
  const brandMap = Object.entries(brandIndex()).slice(0, 400).map(([b, v]) => `${b} = ${v.company}`).join("; ");
  const openTasks = state.tasks.filter((t) => !t.done).map((t) => ({ id: "t:" + t.id, title: t.title, due: t.due, shop: (shopById(t.shopId) || {}).name || "", shopId: t.shopId ? "s:" + t.shopId : "" }));
  const hist = (opts.history || (state.talk && state.talk.history) || []).map((h) => `Rep: ${h.q}\nJarvis: ${h.a}`).join("\n\n");
  return `You are Jarvis, the field assistant of a HoReCa sales rep in Greece who visits cafés, bars, restaurants and hotels. The rep just spoke (dictated, so expect typos, Greek names in Latin or Greek letters, and loose phrasing). Today is ${todayISO()}.
${state.here && Date.now() - state.here.at < 10 * 60000 ? `The rep's phone GPS says they are at ${state.here.lat.toFixed(5)}, ${state.here.lng.toFixed(5)}. Shops with lat/lng nearby (under ~80 m) are likely the one they mean if they don't name it.` : ""}
${cur ? `The rep currently has this shop open, so assume they mean it unless they name another: ${cur.name} (id ${cur.id}).` : ""}

Decide whether the rep is REPORTING information to save, or ASKING a question about their data.

Shop status meanings: active = our customer, az = an ΑΖ shop, competitor = a shop that works with the competition, prospect = possible new customer, closed / lost.
Known shops (full data; "missing" = products or POSM most of the rep's customers have but this shop lacks):
${JSON.stringify(digest(true, cur && cur.id))}
Open tasks: ${JSON.stringify(openTasks)}
Company catalogues: ${JSON.stringify(companies)}
The rep's own company: ${state.settings.myCompany || "not set"}
${hist ? `Earlier in this conversation:
${hist}
` : ""}
Known brand to company: ${brandMap || "none yet"}

Reply with only one JSON object of this shape (omit empty fields):
{
 "kind": "update" or "answer",
 "answer": "for questions and requests for help: a clear answer in Greek using ONLY the records above. If the records don't contain it, say so plainly. For a visit preparation use short labelled lines: Ποιον θα δεις, Τι έγινε τελευταία, Τι παίρνουν / τελευταία παραγγελία, Ανοιχτά θέματα, Τι λείπει (ευκαιρίες), Τι να πεις. Line breaks allowed; no markdown except '-' bullets.",
 "sources": ["ids of the exact records the answer relies on, e.g. v:..., t:..., o:..., s:..."],
 "actions": [{"type":"task","shopId":"s:...","title":"","due":"YYYY-MM-DD"},{"type":"nextVisit","shopId":"s:...","date":"YYYY-MM-DD"},{"type":"note","shopId":"s:...","text":""}] (optional, with "answer" only: concrete follow-ups the rep can approve; at most 6),
 "summary": "for updates: one sentence describing what you will save",
 "shopId": "id of the existing shop this is about, or null",
 "newShop": {"name":"","type":"Restaurant|Café|Bar|Cocktail bar|Hotel|Beach bar|Club|Taverna|Kiosk / mini market|Catering|Other","area":"","city":"Athens","address":"","status":"active|az|competitor|prospect|closed|lost"} or null (only when no existing shop matches),
 "fields": {"owner":"","address":"","area":"","status":"","statusReason":"why the status changed, if the rep said","nextVisit":"YYYY-MM-DD","investAmount":0,"insideInfoAdd":"text to append","pricingNotesAdd":"text to append","scores":{"volume":0-5,"location":0-5,"fit":0-5,"access":0-5}},
 "visit": {"date":"YYYY-MM-DD","notes":"clean, complete summary of the visit in the rep's words","outcome":"positive|neutral|negative|absent","discussed":["products talked about"],"potential":"none|low|medium|high","competition":"what the competition is doing there"},
 "order": {"date":"YYYY-MM-DD","items":[{"product":"","qty":0,"unit":""}]} (only what the shop ordered now; do not also put it in consumption),
 "contacts": [{"name":"","role":"","phone":"","email":"","notes":""}],
 "assets": [{"type":"${ASSET_TYPES.join("|")}","brand":"","serial":"","qty":"1","notes":""}],
 "posm": [{"type":"${POSM_TYPES.join("|")}","brand":"","qty":"1","notes":""}],
 "backbar": [{"brand":"","company":"","category":"${CATEGORIES.join("|")}","facings":1}],
 "products": [{"name":"","price":"our price/terms","menuPrice":"their menu price","notes":""}],
 "consumption": [{"month":"YYYY-MM","product":"","qty":0,"unit":""}],
 "tasks": [{"title":"short action","due":"YYYY-MM-DD or empty"}]
}
Write "answer", "summary", visit notes and task titles in Greek, unless the rep spoke English. Keep the field names and the type/category values exactly as listed (in English).
Shop ids in your reply ("shopId", actions) are the plain id without the "s:" prefix.
${opts.car ? `CAR MODE: the rep is driving and will only HEAR your reply, read aloud by the phone. Write "answer" and "summary" as natural speech: at most 3 short sentences, no lists, no bullets, no symbols, no ids, dates as words (e.g. "την Τρίτη 4 Νοεμβρίου"). For a visit preparation give only the 2 or 3 things that matter most. Updates still go in the fields as usual.
` : ""}Rules: an answer must only state facts found in the records, and "sources" must list every record used (never invent ids). When the rep asks what to do, for suggestions or follow-ups, put them in "actions"; never say you changed anything, the rep approves first. If the rep describes having been at a shop, include "visit". Turn every promise or follow-up into a task with a due date when one is implied ("next week" = 7 days from today). Only include things the rep actually said; never invent serial numbers, prices or names. Use the company from the brand map when you know it. Resolve relative dates against today.

The rep said:
"""${text}"""`;
}
function changeLines(r) {
  const L = [];
  const shop = r.shopId ? shopById(r.shopId) : null;
  if (r.newShop) L.push(["Νέο μαγαζί", `${r.newShop.name}${r.newShop.area ? ", " + r.newShop.area : ""} (${STATUSES[r.newShop.status] || "Υποψήφιος"})`]);
  else if (shop) L.push(["Μαγαζί", shop.name]);
  const f = r.fields || {};
  Object.entries(f).forEach(([k, v]) => { if (v === "" || v == null || (typeof v === "object" && !Object.keys(v).length)) return; const label = { insideInfoAdd: "Πληροφόρηση", pricingNotesAdd: "Τιμές", nextVisit: "Επόμενη επίσκεψη", investAmount: "Επένδυση", owner: "Ιδιοκτήτης", address: "Διεύθυνση", area: "Περιοχή", status: "Κατάσταση", statusReason: "Αιτία", scores: "Αξιολόγηση" }[k] || k[0].toUpperCase() + k.slice(1); L.push([label, k === "nextVisit" ? fmtDate(v) : k === "investAmount" ? money(v) : k === "scores" ? Object.entries(v).map(([a, b]) => `${(CRITERIA.find((c) => c[0] === a) || [, a])[1]} ${b}/5`).join(", ") : k === "status" ? STATUSES[v] || v : String(v)]); });
  if (r.visit && r.visit.notes) L.push(["Επίσκεψη " + fmtDate(r.visit.date || todayISO()), [r.visit.notes, r.visit.outcome && "Αποτέλεσμα: " + lbl(OUTCOMES, r.visit.outcome), (r.visit.discussed || []).length && "Συζητήσαμε: " + r.visit.discussed.join(", "), r.visit.potential && "Δυναμική: " + lbl(POTENTIAL, r.visit.potential), r.visit.competition && "Ανταγωνισμός: " + r.visit.competition].filter(Boolean).join("\n")]);
  if (r.order && (r.order.items || []).length) L.push(["Παραγγελία " + fmtDate(r.order.date || (r.visit && r.visit.date) || todayISO()), orderText(r.order)]);
  (r.contacts || []).forEach((c) => L.push(["Επαφή", [c.name, c.role, c.phone, c.email].filter(Boolean).join(", ")]));
  (r.assets || []).forEach((a) => L.push(["Εξοπλισμός", [tr(a.type), a.brand, a.serial && "S/N " + a.serial, a.qty > 1 && "×" + a.qty].filter(Boolean).join(", ")]));
  (r.posm || []).forEach((p) => L.push(["POSM", [tr(p.type), p.brand, p.qty > 1 && "×" + p.qty, p.notes].filter(Boolean).join(", ")]));
  (r.backbar || []).forEach((b) => L.push(["Back bar", `${b.brand}${b.company ? " (" + b.company + ")" : ""}${b.facings > 1 ? " ×" + b.facings : ""}`]));
  (r.products || []).forEach((p) => L.push(["Προϊόν", [p.name, p.price, p.menuPrice && "μενού " + p.menuPrice].filter(Boolean).join(", ")]));
  (r.consumption || []).forEach((c) => L.push(["Κατανάλωση", `${fmtMonth(c.month)}: ${c.product} ${c.qty} ${c.unit || ""}`]));
  (r.tasks || []).forEach((t) => L.push(["Εργασία", `${t.title}${t.due ? " (έως " + fmtDate(t.due) + ")" : ""}`]));
  return L;
}
function sourceOf(ref) {
  const [k, a, b] = String(ref || "").split(":");
  if (k === "v") { const v = state.visits.find((x) => x.id === a); const sh = v && shopById(v.shopId); if (v) return { shopId: v.shopId, tab: "visits", label: `Επίσκεψη ${fmtDate(v.date)}${sh ? " · " + sh.name : ""}`, sub: clip(v.notes, 90) }; }
  if (k === "t") { const x = state.tasks.find((y) => y.id === a); if (x) return { shopId: x.shopId || "", tab: "visits", label: `Εργασία: ${x.title}`, sub: [x.due ? "έως " + fmtDate(x.due) : "", x.done ? "ολοκληρώθηκε" : "", (shopById(x.shopId) || {}).name].filter(Boolean).join(" · ") }; }
  if (k === "o") { const sh = shopById(a), o = sh && (sh.orders || [])[Number(b)]; if (o) return { shopId: sh.id, tab: "visits", label: `Παραγγελία ${fmtDate(o.date)} · ${sh.name}`, sub: clip(orderText(o), 90) }; }
  if (k === "s") { const sh = shopById(a); if (sh) return { shopId: sh.id, tab: "overview", label: sh.name, sub: [STATUSES[sh.status], sh.area].filter(Boolean).join(" · ") }; }
  return null;
}
const plainId = (x) => String(x || "").replace(/^s:/, "");
function talkActions(r) {
  return (Array.isArray(r.actions) ? r.actions : []).map((x) => ({ ...x, shopId: plainId(x.shopId) })).filter((x) => (x.type === "task" && x.title) || (x.type === "nextVisit" && shopById(x.shopId) && isDate(x.date)) || (x.type === "note" && shopById(x.shopId) && x.text)).slice(0, 6);
}
const actLabel = (x) => x.type === "task" ? `Εργασία: ${x.title}${isDate(x.due) ? " έως " + fmtDate(x.due) : ""}` : x.type === "nextVisit" ? `Επόμενη επίσκεψη ${fmtDate(x.date)}` : `Σημείωση: ${x.text}`;
function talkPresets() {
  const cur = state.shopId && state.shopId !== "new" && shopById(state.shopId);
  const P = cur ? [["Προετοιμασία επίσκεψης", `Προετοίμασε την επίσκεψή μου στο ${cur.name}.`], ["Σύνοψη σημειώσεων", `Κάνε μου σύνοψη όλων των σημειώσεων και επισκέψεων για το ${cur.name}.`], ["Τι λείπει εδώ;", `Ποια προϊόντα ή POSM λείπουν από το ${cur.name};`], ["Πρότεινε follow-ups", `Τι follow-ups προτείνεις για το ${cur.name};`]]
    : [["Τι να κάνω σήμερα;", "Τι να κάνω σήμερα; Ποιους πελάτες να δω πρώτα και γιατί;"], ["Εκκρεμότητες εβδομάδας", "Ποιες εκκρεμότητες έχω αυτή την εβδομάδα;"], ["Ποια προϊόντα λείπουν;", "Ποια προϊόντα λείπουν από τους πελάτες μου;"], ["Ποιοι κινδυνεύουν;", "Ποιοι πελάτες κινδυνεύουν ή έχουν πέσει;"], ["Πρότεινε follow-ups", "Πρότεινε follow-ups για τις εκκρεμότητές μου."]];
  return `<div class="talk-quick" role="group" aria-label="Γρήγορες ερωτήσεις">${P.map(([l, q]) => `<button class="chip" data-talk="preset" data-q="${esc(q)}">${esc(l)}</button>`).join("")}</div>`;
}
/* Saves approved follow-ups from an answer: tasks, next visits, notes. */
async function applyActions(pick) {
  const stamp = new Date().toISOString();
  for (const x of pick) {
    if (x.type === "task") await state.db.collection("tasks").doc().set({ title: x.title, due: isDate(x.due) ? x.due : "", shopId: shopById(x.shopId) ? x.shopId : "", done: false, createdAt: stamp });
    else if (x.type === "nextVisit") await state.db.doc("shops/" + x.shopId).update({ nextVisit: x.date, updatedAt: stamp });
    else if (x.type === "note") { const sh = shopById(x.shopId); await state.db.doc("shops/" + x.shopId).update({ insideInfo: [sh.insideInfo, `${todayISO()}: ${x.text}`].filter(Boolean).join("\n"), updatedAt: stamp }); }
  }
}
async function talkApply() {
  const t = state.talk, acts = talkActions(t.result);
  const pick = [...talkRoot.querySelectorAll("[data-act]")].filter((b) => b.checked).map((b) => acts[Number(b.dataset.act)]);
  if (!pick.length) return;
  const ok = await guarded(() => applyActions(pick));
  t.applied = ok ? plural(pick.length, "αλλαγή αποθηκεύτηκε", "αλλαγές αποθηκεύτηκαν") : "";
  t.error = ok ? "" : "Δεν αποθηκεύτηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.";
  renderTalk();
  if (ok) toast(t.applied + " ✓");
}
function renderTalk() {
  const t = state.talk;
  if (!t || !t.open) { talkRoot.innerHTML = ""; return; }
  let body = "";
  if (t.busy) body = `<p class="thinking" role="status">Σκέφτομαι… μπορεί να πάρει έως ένα λεπτό.</p><div class="row-actions"><button class="btn" data-talk="stop">Διακοπή</button></div>`;
  else if (t.result && t.result.kind === "answer") {
    const src = (t.result.sources || []).map(sourceOf).filter(Boolean), acts = talkActions(t.result);
    body = `${t.text ? `<p class="muted small talk-q">«${esc(clip(t.text, 140))}»</p>` : ""}<div class="panel answer">${esc(t.result.answer || "Δεν βρήκα απάντηση στα δεδομένα σου.")}</div>
    ${src.length ? `<div class="sources"><span class="eyebrow">Από τις καταχωρίσεις σου</span><ul>${src.map((x) => `<li><button class="src" data-talk="src" data-id="${esc(x.shopId)}" data-tab="${x.tab}"><b>${esc(x.label)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</button></li>`).join("")}</ul></div>` : `<p class="muted small">Δεν αναφέρθηκε συγκεκριμένη καταχώριση. Έλεγξε την απάντηση πριν βασιστείς σε αυτή.</p>`}
    ${acts.length ? `<div class="panel"><div class="inline-form"><h3>Προτεινόμενες ενέργειες</h3><p class="muted small">Δεν αλλάζει τίποτα μέχρι να εγκρίνεις.</p><ul class="list acts">${acts.map((x, i) => `<li class="item"><input type="checkbox" class="check" id="act-${i}" data-act="${i}" ${t.applied ? "disabled" : "checked"}><label for="act-${i}" class="grow"><div class="title">${esc(actLabel(x))}</div><div class="sub">${esc(x.shopId && shopById(x.shopId) ? shopById(x.shopId).name : "Χωρίς μαγαζί")}</div></label></li>`).join("")}</ul>${t.applied ? `<p class="ok-text small" role="status">${esc(t.applied)} ✓</p>` : `<div class="row-actions"><button class="btn primary" data-talk="apply">Έγκριση επιλεγμένων</button></div>`}</div></div>` : ""}
    ${t.error ? `<div class="banner" role="alert">${esc(t.error)}</div>` : ""}
    <div class="row-actions">${TTS ? `<button class="btn" data-talk="speak">Διάβασέ το</button>` : ""}<button class="btn primary" data-talk="again">Ρώτα κάτι άλλο</button><button class="btn" data-talk="close">Τέλος</button></div>`;
  }
  else if (t.result) {
    const lines = changeLines(t.result);
    body = `<p>${esc(t.result.summary || "Αυτά θα αποθηκεύσω:")}</p>
      <div class="panel"><ul class="change-list">${lines.length ? lines.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join("") : `<li>Δεν υπάρχει κάτι να αποθηκευτεί. Δοκίμασε ξανά λέγοντας το όνομα του μαγαζιού και τι έγινε.</li>`}</ul></div>
      ${!t.result.shopId && !t.result.newShop && lines.length ? `<div class="banner">Δεν κατάλαβα ποιο μαγαζί είναι. Πες το όνομα του μαγαζιού και δοκίμασε ξανά.</div>` : ""}
      <div class="row-actions">${lines.length && (t.result.shopId || t.result.newShop) ? `<button class="btn primary" data-talk="save">Αποθήκευση όλων</button>` : ""}<button class="btn" data-talk="again">Αλλαγή</button><button class="btn" data-talk="close">Απόρριψη</button></div>`;
  } else body = `<button class="car-entry" data-talk="car">${CAR_ICON}<span><b>Λειτουργία αυτοκινήτου</b><small>Ο Jarvis μιλάει και σε ακούει, χωρίς να αγγίζεις το κινητό</small></span></button>${talkPresets()}${Rec ? `<button class="mic-btn ${t.listening ? "on" : ""}" data-talk="mic" aria-pressed="${!!t.listening}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12z"/></svg>${t.listening ? "Σε ακούω… πάτα για τέλος" : "Πάτα και μίλα"}</button>` : ""}
    <label class="field" for="talk-text">${Rec ? "Ή γράψε. " : "Πάτα το μικρόφωνο στο πληκτρολόγιο και μίλα. "}Πες το όνομα του μαγαζιού, τι έγινε, τι έχουν και τι υποσχέθηκες.</label>
    <textarea id="talk-text" placeholder="π.χ. Μόλις έφυγα από την Ταβέρνα Θάλασσα στο Θησείο. Είδα τη Μαρία, την υπεύθυνη, το κινητό της είναι 694… Παρήγγειλαν 20 βαρέλια. Οι ομπρέλες μας είναι σκισμένες, θέλουν 4 καινούργιες την επόμενη εβδομάδα.">${esc(t.text || "")}</textarea>
    ${t.error ? `<div class="banner" role="alert">${esc(t.error)}</div>` : ""}
    <div class="row-actions"><button class="btn primary" data-talk="send">Στείλε στον Jarvis</button><button class="btn" data-talk="close">Ακύρωση</button></div>`;
  talkRoot.innerHTML = `<div class="sheet-bg"><div class="sheet" role="dialog" aria-label="Μίλα στον Jarvis"><div class="section-head"><h2>Μίλα στον Jarvis</h2>${state.shopId && shopById(state.shopId) ? `<span class="muted small">${esc(shopById(state.shopId).name)}</span>` : ""}</div>${body}</div></div>`;
  const ta = document.getElementById("talk-text"); if (ta && !t.result && !t.listening && !Rec) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
const sampleErr = (e) => ({ not_granted: "Ο Jarvis χρειάζεται άδεια για να χρησιμοποιήσει το Claude. Πάτα ξανά Αποστολή και επίλεξε Allow.", rate_limited: "Πολλά αιτήματα μαζί. Περίμενε ένα λεπτό και δοκίμασε ξανά.", invalid_json: "Δεν το κατάλαβα. Δοκίμασε να το πεις πιο απλά.", prompt_too_large: "Τα δεδομένα σου έγιναν πολύ μεγάλα για μία αποστολή. Πες το στο Claude στη συνομιλία.", session_expired: "Αποσυνδέθηκες. Άνοιξε ξανά την εφαρμογή.", offline: "Είσαι εκτός σύνδεσης. Τα λόγια σου μένουν εδώ, στείλ' τα όταν έχεις σήμα.", ai_error: "Ο Jarvis δεν μπόρεσε να συνδεθεί με το Claude. Έλεγξε τη σύνδεση και δοκίμασε ξανά.", refused: "Το Claude αρνήθηκε αυτό το αίτημα. Δοκίμασε να το διατυπώσεις αλλιώς.", server_old: "Αυτό χρειάζεται την ενημερωμένη έκδοση του jarvis-ai στο Supabase. Ακολούθησε τα βήματα που σου έστειλα και δοκίμασε ξανά." }[e && e.code] || "Κάτι πήγε στραβά. Δοκίμασε ξανά.");
async function talkSend() {
  const t = state.talk; const ta = document.getElementById("talk-text");
  t.text = ta ? ta.value.trim() : t.text; t.error = "";
  if (!t.text) { t.error = "Πες ή γράψε κάτι πρώτα."; renderTalk(); return; }
  t.busy = true; renderTalk();
  talkCtl = new AbortController();
  try {
    t.result = await state.sample.json(talkPrompt(t.text), { signal: talkCtl.signal, cache: false });
    if (!t.result || typeof t.result !== "object") throw { code: "invalid_json" };
    t.result.shopId = plainId(t.result.shopId) || null; if (t.result.shopId && !shopById(t.result.shopId)) t.result.shopId = null;
    t.applied = "";
  }
  catch (e) { if (e && e.code !== "cancelled") t.error = sampleErr(e); t.result = null; }
  t.busy = false; renderTalk();
}
/* Saves one update (from Talk or from a work file): shop fields, items, visit, tasks. Returns the shop id. */
async function applyUpdate(r, stamp) {
  let id = r.shopId;
  if (!id && r.newShop) { const ref = state.db.collection("shops").doc(); id = ref.id; await ref.set({ name: r.newShop.name || "Νέο μαγαζί", type: r.newShop.type || "Other", status: r.newShop.status || "prospect", area: r.newShop.area || "", city: r.newShop.city || "Athens", address: r.newShop.address || "", ...(!r.source && state.here && Date.now() - state.here.at < 10 * 60000 ? { lat: state.here.lat, lng: state.here.lng } : {}), createdAt: stamp, updatedAt: stamp, statusHistory: [statusEntry("", r.newShop.status || "prospect")], photos: [], contacts: [], assets: [], posm: [], backbar: [], products: [], consumption: [], scores: {} }); }
  const s = shopById(id) || {};
  const f = r.fields || {}; const patch = { updatedAt: stamp };
  ["owner", "address", "area", "status", "nextVisit"].forEach((k) => { if (f[k]) patch[k] = f[k]; });
  if (!r.newShop && f.status && f.status !== s.status) patch.statusHistory = [...(s.statusHistory || []), statusEntry(s.status, f.status, f.statusReason || "")];
  if (f.investAmount) patch.investAmount = Number(f.investAmount);
  if (f.insideInfoAdd) patch.insideInfo = [s.insideInfo, `${todayISO()}: ${f.insideInfoAdd}`].filter(Boolean).join("\n");
  if (f.pricingNotesAdd) patch.pricingNotes = [s.pricingNotes, `${todayISO()}: ${f.pricingNotesAdd}`].filter(Boolean).join("\n");
  if (f.scores && Object.keys(f.scores).length) patch.scores = { ...(s.scores || {}), ...f.scores };
  const known = brandIndex();
  const add = (field, items, map = (x) => x) => { if (items && items.length) patch[field] = [...(s[field] || []), ...items.map(map)]; };
  add("contacts", r.contacts); add("assets", r.assets); add("posm", r.posm); add("products", r.products); add("consumption", r.consumption, (c) => ({ ...c, qty: Number(c.qty) || 0 }));
  add("backbar", r.backbar, (b) => ({ brand: b.brand, company: b.company || (known[(b.brand || "").toLowerCase()] || {}).company || "", category: b.category || (known[(b.brand || "").toLowerCase()] || {}).category || "", facings: Number(b.facings) || 1 }));
  if (r.backbar && r.backbar.length) patch.backbarDate = todayISO();
  if (r.visit && r.visit.notes) {
    const date = isDate(r.visit.date) ? r.visit.date : todayISO(), V = r.visit;
    const doc = { shopId: id, date, notes: V.notes, createdAt: stamp, source: r.source || "voice" };
    if (OUTCOMES.some((o) => o[0] && o[0] === V.outcome)) doc.outcome = V.outcome;
    if (Array.isArray(V.discussed) && V.discussed.length) doc.discussed = V.discussed.map(String);
    if (POTENTIAL.some((o) => o[0] && o[0] === V.potential)) doc.potential = V.potential;
    if (V.competition) doc.competition = String(V.competition);
    if (r.order && (r.order.items || []).length) doc.order = r.order.items.filter((i) => i && i.product);
    await state.db.collection("visits").doc().set(doc);
    if (!s.lastVisit || date > s.lastVisit) patch.lastVisit = date;
  }
  if (r.order && (r.order.items || []).length) addOrder(s, patch, isDate(r.order.date) ? r.order.date : (r.visit && isDate(r.visit.date) ? r.visit.date : todayISO()), r.order.items, r.source || "voice");
  await state.db.doc("shops/" + id).update(patch);
  for (const tk of r.tasks || []) await state.db.collection("tasks").doc().set({ title: tk.title, due: tk.due || "", shopId: id, done: false, createdAt: stamp });
  return id;
}
async function talkSave() {
  const r = state.talk.result; const stamp = new Date().toISOString(); let id = null;
  state.busy = true;
  const ok = await guarded(async () => { id = await applyUpdate(r, stamp); });
  state.busy = false;
  if (ok) { state.talk = null; renderTalk(); openShop(id, { tab: r.visit ? "visits" : "overview" }); toast("Αποθηκεύτηκε ✓"); }
  else renderTalk();
}
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const MIC_ERRORS = {
  "not-allowed": "Ο Jarvis δεν έχει άδεια για το μικρόφωνο. Επέτρεψέ το στις ρυθμίσεις του κινητού ή πάτα το 🎤 στο πληκτρολόγιο.",
  "service-not-allowed": "Το κινητό σου δεν επιτρέπει αναγνώριση φωνής σε εγκατεστημένες εφαρμογές web. Πάτα στο κουτί από κάτω και χρησιμοποίησε το 🎤 του πληκτρολογίου.",
  "audio-capture": "Δεν βρέθηκε μικρόφωνο. Πάτα στο κουτί από κάτω και χρησιμοποίησε το 🎤 του πληκτρολογίου.",
  "network": "Η αναγνώριση φωνής θέλει ίντερνετ. Έλεγξε τη σύνδεση ή χρησιμοποίησε το 🎤 του πληκτρολογίου.",
  "language-not-supported": "Το κινητό δεν αναγνωρίζει αυτή τη γλώσσα εδώ. Άλλαξε γλώσσα φωνής στις Ρυθμίσεις ή χρησιμοποίησε το 🎤 του πληκτρολογίου.",
  "no-speech": "Δεν άκουσα τίποτα. Πάτα το κουμπί και ξεκίνα να μιλάς αμέσως.",
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
  rec.onerror = (e) => { t.error = MIC_ERRORS[e.error] || (e.error === "aborted" ? "" : `Το μικρόφωνο σταμάτησε (${e.error}). Χρησιμοποίησε το 🎤 του πληκτρολογίου.`); };
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
  else if (a === "again") { const t = state.talk, wasAnswer = t.result && t.result.kind === "answer"; if (wasAnswer) { t.history = [...(t.history || []), { q: t.text, a: clip(t.result.answer, 600) }].slice(-3); t.text = ""; } t.result = null; t.applied = ""; renderTalk(); }
  else if (a === "preset") { const ta = document.getElementById("talk-text"); if (ta) ta.value = b.dataset.q; talkSend(); }
  else if (a === "apply") { b.disabled = true; b.textContent = "Αποθήκευση…"; talkApply(); }
  else if (a === "src") { const id = b.dataset.id; if (id && shopById(id)) { state.talk = null; renderTalk(); openShop(id, { tab: b.dataset.tab }); } }
  else if (a === "close") { if (rec && state.talk.listening) rec.stop(); TTS && TTS.cancel(); state.talk = null; renderTalk(); }
  else if (a === "car") openCar();
  else if (a === "speak") speakOnce(state.talk.result && state.talk.result.answer);
  else if (a === "save") { b.disabled = true; talkSave(); }
});
function openTalk() { state.talk = { open: true, text: "" }; renderTalk(); locate().catch(() => {}); }
document.getElementById("fab").addEventListener("click", openTalk);

/* ---------- car mode: hands-free; Jarvis speaks its answers and listens again ---------- */
const carRoot = document.createElement("div"); carRoot.id = "car-root"; document.body.appendChild(carRoot);
const TTS = window.speechSynthesis || null;
let car = null, carRec = null, carLock = null, carTimer = null;
const CAR_YES = /^(ναι|οκ|οκει|ok|okay|ενταξει|σωστα|αποθηκευσε|σωσε|βεβαιως|φυσικα|μαλιστα|yes|yeah|yep|save|παμε|κανε το|ανοιξε|θελω)(?=\s|$)/;
const CAR_NO = /^(οχι|ακυρο|ακυρωσε|ασ το|ασε|μην|no|nope|cancel|αλλαξε|τιποτα)(?=\s|$)/;
const carClean = (raw) => norm(raw).replace(/[.,!;?·«»"':]/g, " ").replace(/\s+/g, " ").trim().replace(/^(hey |hei |ει |ε )?(jarvis|τζαρβις|τζαρβης|ζαρβις|τζαρβι)(?=\s|$) ?/, "").trim();
function carVoice() {
  if (!TTS) return null;
  const L = state.voiceLang.toLowerCase(), v = TTS.getVoices();
  return v.find((x) => x.lang.toLowerCase().replace("_", "-") === L) || v.find((x) => x.lang.toLowerCase().startsWith(L.slice(0, 2))) || null;
}
/* Speaks text in short sentences (long utterances get cut off on some phones), then calls next (default: listen again).
   If the phone blocks speech until a tap (iPhone, when opened from a link), shows a big "tap to hear" instead. */
function carSay(text, next) {
  if (!car) return;
  clearTimeout(carTimer);
  const id = car.sayId = (car.sayId || 0) + 1;
  car.said = text; car.phase = "speaking"; car.next = next || null; renderCar();
  const done = () => { if (!car || car.sayId !== id) return; car.sayId++; clearTimeout(carTimer); (next || carListen)(); };
  if (!TTS || !text) { carTimer = setTimeout(done, Math.min(9000, 1500 + String(text).length * 50)); return; }
  TTS.cancel();
  const parts = String(text).replace(/\s+/g, " ").match(/[^.!;?…]+[.!;?…]*\s*/g) || [String(text)];
  const voice = carVoice(); let started = false;
  const locked = () => { if (!car || car.sayId !== id || started) return; clearTimeout(carTimer); TTS.cancel(); car.phase = "tap"; renderCar(); };
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p.trim()); u.lang = state.voiceLang; if (voice) u.voice = voice; u.rate = 1.03;
    u.onstart = () => { started = true; car && (car.ttsOk = true); };
    if (i === parts.length - 1) { u.onend = () => setTimeout(done, 250); u.onerror = (e) => { if (e.error === "not-allowed") locked(); else setTimeout(done, 250); }; }
    TTS.speak(u);
  });
  if (!car.ttsOk) setTimeout(locked, 1800);
  carTimer = setTimeout(done, 4000 + String(text).length * 110); // backstop if the phone never reports the end
}
function carListen() {
  if (!car) return;
  clearTimeout(carTimer);
  if (!Rec) { car.phase = "type"; renderCar(); return; }
  if (document.hidden) { car.phase = "idle"; renderCar(); return; }
  let finalText = "", interim = "", err = "";
  try { carRec = new Rec(); carRec.lang = state.voiceLang; carRec.continuous = false; carRec.interimResults = true; }
  catch { car.phase = "type"; car.note = MIC_ERRORS["service-not-allowed"]; renderCar(); return; }
  const r = carRec;
  r.onresult = (e) => { interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " "; else interim += e.results[i][0].transcript; } car.heard = (finalText + interim).trim(); const h = document.getElementById("car-heard"); if (h) h.textContent = car.heard; };
  r.onerror = (e) => { err = e.error; };
  r.onend = () => {
    if (carRec === r) carRec = null;
    if (!car || car.phase !== "listening") return;
    const text = (finalText || interim).trim();
    if (text) { car.quiet = 0; carHandle(text); return; }
    if (err === "service-not-allowed" || err === "language-not-supported") { car.phase = "type"; car.note = MIC_ERRORS[err]; renderCar(); return; }
    if (err === "not-allowed" || err === "audio-capture" || err === "network") { car.phase = "idle"; car.note = err === "not-allowed" ? "Πάτα τον κύκλο για να σε ακούσω. Αν σε ρωτήσει, επίτρεψε το μικρόφωνο." : MIC_ERRORS[err]; renderCar(); return; }
    car.quiet = (car.quiet || 0) + 1;
    if (car.quiet < 3) carListen(); else { car.quiet = 0; car.phase = "idle"; renderCar(); }
  };
  car.phase = "listening"; car.heard = ""; car.note = ""; renderCar();
  try { r.start(); } catch { car.phase = "idle"; renderCar(); }
}
function carHandle(raw) {
  if (!car) return;
  const t = carClean(raw);
  car.heard = raw;
  if (!t) { carSay("Ναι; Σε ακούω."); return; }
  const P = car.pending;
  if (P) {
    car.pending = null;
    if (CAR_YES.test(t)) { carConfirm(P); return; }
    if (CAR_NO.test(t)) { carSay(P.kind === "nav" ? "Εντάξει." : "Εντάξει, δεν αποθήκευσα τίποτα."); return; }
  }
  if (/^(τελος|σταματα|εξοδος|κλεισε|βγες|stop|exit|bye|αντιο)( \S+){0,2}$/.test(t)) { carSay("Καλό δρόμο.", closeCar); return; }
  if (/^(ξανα|επαναλαβε|πες (το|τα) ξανα|τι ειπες|repeat)/.test(t)) { carSay(car.lastAnswer || "Δεν έχω πει κάτι ακόμα."); return; }
  if (/(επομεν\S* (σταση|επισκεψη|μαγαζι|πελατ\S*)|ποι\S* ειναι (ο|το|η) επομεν|που πα(με|ω) (μετα|τωρα)|next stop)/.test(t)) { carNext(); return; }
  if (/^(οδηγιες|πλοηγηση|directions|navigate)/.test(t) && car.navShop) { carNav(car.navShop); return; }
  carAsk(raw);
}
function carNext() {
  const R = routeState(), done = visitedOn(todayISO());
  const chosen = R.ids.map(shopById).filter(Boolean);
  const here = state.here && Date.now() - state.here.at < 30 * 60000 ? state.here : null;
  const stops = R.manual ? chosen : orderStops(chosen.filter(hasGeo), here).concat(chosen.filter((s) => !hasGeo(s)));
  const s = stops.find((x) => !done.has(x.id));
  if (!s) { carSay(chosen.length ? "Έκανες όλες τις στάσεις της διαδρομής σου. Μπράβο!" : "Δεν έχεις διαδρομή για σήμερα. Ρώτα με «ποιους να δω σήμερα» ή πάτα «Ξεκίνα τη μέρα μου» στην αρχική."); return; }
  const n = nextActionOf(s), c = mainContact(s), lo = lastOrder(s);
  const say = [`Επόμενη στάση: ${s.name}${s.area ? ", " + s.area : ""}.`, c && c.name ? `Θα δεις ${c.name}.` : "", n && n.text !== "Επίσκεψη" ? `${n.late ? "Εκπρόθεσμο" : "Εκκρεμεί"}: ${n.text}.` : "", lo ? `Τελευταία παραγγελία: ${orderText(lo)}.` : ""].filter(Boolean).join(" ");
  car.navShop = s; car.pending = { kind: "nav", shop: s }; car.lastAnswer = say;
  carSay(say + " Να ανοίξω οδηγίες;");
}
function carNav(s) {
  car.navShop = s;
  let w = null; try { w = window.open(mapsDir(s), "_blank", "noopener"); } catch {}
  if (w === null) carSay("Πάτα το κουμπί Οδηγίες στην οθόνη.", () => { car.phase = "idle"; renderCar(); });
  else { car.phase = "idle"; renderCar(); }
}
async function carConfirm(P) {
  if (P.kind === "nav") { carNav(P.shop); return; }
  car.phase = "thinking"; renderCar();
  try {
    if (P.kind === "update") await applyUpdate(P.result, new Date().toISOString());
    else await applyActions(P.actions);
    carSay(P.kind === "update" ? "Αποθηκεύτηκε." : "Έγινε, τα αποθήκευσα.");
  } catch { carSay("Δεν αποθηκεύτηκε. Έλεγξε τη σύνδεση και πες το ξανά."); }
}
async function carAsk(text) {
  car.phase = "thinking"; car.asked = text; car.navShop = null; renderCar();
  const ctl = car.ctl = new AbortController();
  let r;
  try { r = await state.sample.json(talkPrompt(text, { car: true, history: car.history }), { signal: ctl.signal, cache: false }); if (!r || typeof r !== "object") throw { code: "invalid_json" }; }
  catch (e) { if (car && car.ctl === ctl && !(e && e.code === "cancelled")) carSay(sampleErr(e)); return; }
  if (!car || car.ctl !== ctl) return;
  r.shopId = plainId(r.shopId) || null; if (r.shopId && !shopById(r.shopId)) r.shopId = null;
  if (r.kind === "answer") {
    const ans = r.answer || "Δεν βρήκα απάντηση στα δεδομένα σου.";
    car.history = [...car.history, { q: text, a: clip(ans, 600) }].slice(-4);
    car.lastAnswer = ans;
    const acts = talkActions(r);
    if (acts.length) { car.pending = { kind: "actions", actions: acts }; carSay(`${ans} Προτείνω: ${acts.map(actLabel).join(". ")}. Να τα αποθηκεύσω;`); }
    else carSay(ans);
    return;
  }
  const lines = changeLines(r);
  if (lines.length < 2) { carSay("Δεν βρήκα κάτι να αποθηκεύσω. Πες το όνομα του μαγαζιού και τι έγινε."); return; }
  if (!r.shopId && !r.newShop) { carSay("Δεν κατάλαβα για ποιο μαγαζί μιλάς. Πες το ξανά με το όνομα του μαγαζιού."); return; }
  const who = r.newShop ? `Νέο μαγαζί ${r.newShop.name}` : shopById(r.shopId).name;
  const sum = r.summary || `Θα αποθηκεύσω ${plural(lines.length - 1, "αλλαγή", "αλλαγές")}.`;
  car.pending = { kind: "update", result: r, lines };
  car.lastAnswer = r.summary ? sum : `${who}. ${sum}`;
  carSay(car.lastAnswer + " Να το αποθηκεύσω;");
}
function carStop() { if (!car) return; car.sayId = (car.sayId || 0) + 1; clearTimeout(carTimer); TTS && TTS.cancel(); const r = carRec; carRec = null; try { r && r.abort(); } catch {} }
function openCar(opts = {}) {
  if (car) { if (opts.q) { carStop(); carAsk(opts.q); } return; }
  if (state.talk) { if (rec && state.talk.listening) rec.stop(); state.talk = null; renderTalk(); }
  car = { phase: "idle", history: [], heard: "", said: "", pending: null, quiet: 0, note: "" };
  document.body.classList.add("car-on");
  carWake();
  locate().catch(() => {});
  if (opts.q) { car.heard = opts.q; carAsk(opts.q); }
  else if (opts.fromLink) carListen();
  else carSay(`Είμαι εδώ${state.settings.myName ? ", " + state.settings.myName : ""}. Πες μου.`);
}
function carWake() { try { navigator.wakeLock && navigator.wakeLock.request("screen").then((l) => { carLock = l; }).catch(() => {}); } catch {} }
function closeCar() {
  if (!car) return;
  const c = car; carStop(); car = null; c.ctl && c.ctl.abort();
  try { carLock && carLock.release(); } catch {} carLock = null;
  document.body.classList.remove("car-on"); carRoot.innerHTML = "";
}
document.addEventListener("visibilitychange", () => {
  if (!car) return;
  if (document.hidden) { const p = car.phase; carStop(); if (p !== "thinking") { car.phase = "idle"; renderCar(); } }
  else { carWake(); renderCar(); }
});
const CAR_LABEL = { idle: "Πάτα για να μιλήσεις", listening: "Σε ακούω…", thinking: "Σκέφτομαι…", speaking: "Μιλάω · πάτα για να με διακόψεις", tap: "Πάτα για να ακούσεις την απάντηση", type: "Γράψε ή πάτα το 🎤 του πληκτρολογίου" };
function renderCar() {
  if (!car) { carRoot.innerHTML = ""; return; }
  const ph = car.phase, P = car.pending, keep = document.getElementById("car-text");
  const typed = keep ? keep.value : "";
  carRoot.innerHTML = `<div class="car${P && P.kind !== "nav" ? " has-p" : ""}" role="dialog" aria-label="Λειτουργία αυτοκινήτου">
    <div class="car-top"><span class="car-title">${CAR_ICON}<b>Λειτουργία αυτοκινήτου</b></span><button class="car-x" data-car="close">Τέλος</button></div>
    <div class="car-main">
      ${car.asked && (ph === "thinking" || car.said) ? `<p class="car-asked">«${esc(clip(car.asked, 160))}»</p>` : ""}
      <div class="car-said" aria-live="polite">${ph === "thinking" ? "" : car.said ? esc(car.said) : `Πες π.χ. «Ποια είναι η επόμενη στάση;», «Τι εκκρεμότητες έχω;» ή «Μόλις έφυγα από…»`}</div>
      ${P && P.kind === "update" ? `<ul class="change-list car-lines">${P.lines.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(clip(v, 140))}</span></li>`).join("")}</ul>` : ""}
      ${P && P.kind !== "nav" ? `<div class="car-yn"><button class="btn primary" data-car="yes">Ναι, αποθήκευσε</button><button class="btn" data-car="no">Όχι</button></div>` : ""}
      ${car.navShop ? `<a class="btn car-nav" href="${esc(mapsDir(car.navShop))}" target="_blank" rel="noopener">${ICON.route}<span>Οδηγίες προς ${esc(car.navShop.name)}</span></a>` : ""}
    </div>
    <div class="car-ctl">
      <button class="car-orb ${ph}" data-car="orb" aria-label="${CAR_LABEL[ph]}"><span class="ring"></span><span class="core">${ph === "speaking" || ph === "tap" ? ic('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>') : ICON.mic}</span></button>
      <p class="car-state">${CAR_LABEL[ph]}</p>
      <p class="car-heard" id="car-heard">${ph === "listening" ? esc(car.heard || "") : ""}</p>
      ${car.note ? `<p class="car-note" role="alert">${esc(car.note)}</p>` : ""}
      ${ph === "type" ? `<div class="car-type"><textarea id="car-text" rows="2" placeholder="Πάτα εδώ και μετά το 🎤 του πληκτρολογίου">${esc(typed)}</textarea><button class="btn primary" data-car="send">Στείλε</button></div>` : ""}
      <p class="car-hint">«επόμενη στάση» · «επανάλαβε» · «τέλος»</p>
    </div></div>`;
}
carRoot.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-car]"); if (!b || !car) return;
  const a = b.dataset.car;
  if (a === "close") closeCar();
  else if (a === "orb") {
    if (car.phase === "listening") { try { carRec && carRec.stop(); } catch {} }
    else if (car.phase === "thinking") { car.ctl && car.ctl.abort(); car.ctl = null; car.phase = "idle"; renderCar(); }
    else if (car.phase === "tap") { car.ttsOk = true; carSay(car.said, car.next); }
    else if (car.phase === "type") { const ta = document.getElementById("car-text"); ta && ta.focus(); }
    else { carStop(); car.note = ""; carListen(); }
  }
  else if (a === "yes" || a === "no") { const P = car.pending; car.pending = null; carStop(); car.phase = "thinking"; if (!P) return; if (a === "yes") carConfirm(P); else carSay("Εντάξει, δεν αποθήκευσα τίποτα."); }
  else if (a === "send") { const ta = document.getElementById("car-text"); const v = ta && ta.value.trim(); if (v) { ta.value = ""; carHandle(v); } }
});
/* Read an answer aloud from the normal Talk sheet. */
function speakOnce(text) {
  if (!TTS || !text) return;
  TTS.cancel(); const voice = carVoice();
  (String(text).replace(/\s+/g, " ").match(/[^.!;?…]+[.!;?…]*\s*/g) || [text]).forEach((p) => { const u = new SpeechSynthesisUtterance(p.trim()); u.lang = state.voiceLang; if (voice) u.voice = voice; TTS.speak(u); });
}

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
  } catch (e) { state.reading = { kind, error: e && e.code === "invalid_json" ? "Δεν διάβασα καθαρές ετικέτες σε αυτές τις φωτογραφίες. Δοκίμασε πιο καθαρή και κοντινή φωτογραφία." : sampleErr(e) }; }
  render();
}
function readingPanel(kind) {
  const r = state.reading;
  if (!state.sample || !state.imgLimits || !canEdit()) return "";
  if (!r || r.kind !== kind) return `<button class="btn" data-action="read-photos" data-v="${kind}">${kind === "catalogue" ? "Διάβασε προϊόντα από τις φωτογραφίες" : "Διάβασε ετικέτες από τις φωτογραφίες"}</button>`;
  if (r.busy) return `<p class="thinking" role="status">Διαβάζω τις φωτογραφίες… μπορεί να πάρει ένα λεπτό.</p>`;
  if (r.error) return `<div class="banner">${esc(r.error)}</div><button class="btn" data-action="read-photos" data-v="${kind}">Δοκίμασε ξανά</button>`;
  return `<div class="panel"><div class="inline-form"><h3>Βρέθηκαν ${r.rows.length} ${kind === "catalogue" ? "προϊόντα" : "ετικέτες"}</h3>
    <ul class="change-list">${r.rows.map((x) => `<li><b>${esc(tr(x.category || ""))}</b><span>${esc(x.brand)}${x.product ? " " + esc(x.product) : ""}${x.company ? ` (${esc(x.company)})` : ""}${x.facings > 1 ? " ×" + esc(x.facings) : ""}${x.size ? " " + esc(x.size) : ""}${x.price ? " · " + esc(x.price) : ""}</span></li>`).join("")}</ul>
    <div class="row-actions">${r.rows.length ? `<button class="btn primary" data-action="read-save" data-v="${kind}">Προσθήκη όλων</button>` : ""}<button class="btn" data-action="read-cancel">Απόρριψη</button></div></div></div>`;
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
  store = makeDb(uid, (st) => { state.sync = st; const dot = document.getElementById("sync-dot"); if (dot) { dot.dataset.state = !st.online ? "offline" : st.pending ? "pending" : "ok"; dot.title = !st.online ? "Εκτός σύνδεσης" : st.pending ? "Ανεβαίνουν αλλαγές" : "Συγχρονισμένο"; } });
  state.db = store.db;
  state.assets = makeAssets(uid);
  state.sample = makeSample();
  state.imgLimits = (await state.sample.limits()).images;
  try { state.cal = JSON.parse(localStorage.getItem("jarvis-cal") || "null"); } catch {}
  routeFromHash();
  showWelcome();
  if (state.carPending) { const o = state.carPending; state.carPending = null; openCar(o); }
  const db = state.db;
  db.collection("shops").onSnapshot((snap) => { state.shops = snap.docs.map(clean); state.loaded.shops = true; safeRender(); });
  db.collection("tasks").onSnapshot((snap) => { state.tasks = snap.docs.map(clean); state.loaded.tasks = true; safeRender(); });
  db.collection("visits").orderBy("date", "desc").limit(500).onSnapshot((snap) => { state.visits = snap.docs.map(clean); safeRender(); });
  db.collection("catalogues").onSnapshot((snap) => { state.catalogues = snap.docs.map(clean); safeRender(); });
  db.doc("meta/settings").onSnapshot((d) => { state.settings = d.exists ? d.data() : {}; safeRender(); loadCalendar(); });
  db.doc("meta/watch").onSnapshot((d) => { state.watch = d.exists ? d.data() : {}; safeRender(); });
  await store.start();
  if (!navigator.onLine && !store.hasCache()) { state.noDb = true; render(); }
}
const clean = (doc) => ({ ...doc.data(), id: doc.id });
window.jarvisState = state;
app.addEventListener("open-settings", () => { Object.assign(state, { view: "settings", shopId: null, catId: null, editing: false }); render(); window.scrollTo(0, 0); });
export { startApp };
