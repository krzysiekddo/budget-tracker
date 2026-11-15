import { auth, googleProvider, onAuthStateChanged, signInWithPopup, signOut } from "./firebase.js";
import * as store from "./store.js";
import { CATEGORIES, EXPENSE_CATS, INCOME_CATS, REVIEW, cat, classify, merchantKey } from "./categories.js";
import {
  monthStats, lastMonths, shiftMonth, thisMonth, todayIso, monthName, monthShort, monthOf, daysInMonth, zl, pct,
  suggestions, summaryForAi, topMerchants, debtPlan, averages, monthsBetween,
} from "./insights.js";
import { donut, monthBars, dailyBars } from "./charts.js";

const root = document.getElementById("root");

const S = {
  user: undefined, // undefined = checking, null = signed out
  data: { loading: true, meta: null, txs: [], pending: false, error: null },
  view: "home",
  month: thisMonth(),
  filter: { cat: "all", q: "" },
  imp: { files: [], rows: null, busy: false, error: null },
  onboard: null,
  modal: null,
  toast: null,
  advice: { busy: false, error: null },
  serverProblem: null,
};
let unsub = null;

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const uid = () => S.user?.uid;
const meta = () => S.data.meta ?? {};
const profile = () => meta().profile ?? {};
const learned = () => meta().learned ?? {};
const rid = () => Math.random().toString(36).slice(2, 10);

function toast(msg, kind = "") {
  S.toast = { msg, kind };
  render();
  clearTimeout(toast.t);
  toast.t = setTimeout(() => {
    S.toast = null;
    render();
  }, 3200);
}

function run(promise, okMsg) {
  return Promise.resolve(promise)
    .then(() => okMsg && toast(okMsg))
    .catch((e) => {
      console.error(e);
      toast(store.describeError(e), "error");
    });
}

function catOptions(selected, { income = null, review = true } = {}) {
  const cats = income === null ? CATEGORIES : income ? INCOME_CATS : EXPENSE_CATS;
  return (
    (review ? `<option value="${REVIEW}" ${selected === REVIEW ? "selected" : ""}>❓ Do sprawdzenia</option>` : "") +
    cats.map((c) => `<option value="${c.id}" ${selected === c.id ? "selected" : ""}>${c.icon} ${esc(c.name)}</option>`).join("")
  );
}

const icon = {
  home: `<svg viewBox="0 0 24 24"><path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/></svg>`,
  list: `<svg viewBox="0 0 24 24"><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
  goal: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/></svg>`,
  bulb: `<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>`,
  left: `<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>`,
  right: `<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>`,
  gear: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>`,
  x: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>`,
};

// ---------- auth & data ----------
onAuthStateChanged(auth, (user) => {
  S.user = user;
  unsub?.();
  unsub = null;
  if (user) {
    S.data = { loading: true, meta: null, txs: [], pending: false, error: null };
    let restored = false;
    unsub = store.subscribe(user.uid, (d) => {
      S.data = d;
      if (!restored && !d.loading) {
        restored = true;
        restoreImport();
      }
      render();
    });
    store.checkServer(user.uid).then(
      () => (S.serverProblem = null),
      (e) => {
        S.serverProblem = store.describeError(e);
        render();
      },
    );
  }
  render();
});

const LOGIN_ERRORS = {
  "auth/popup-blocked": "Przeglądarka zablokowała okno logowania. Zezwól na wyskakujące okna dla tej strony i spróbuj ponownie.",
  "auth/unauthorized-domain": "Ta domena nie jest dodana w Firebase: Authentication > Settings > Authorized domains.",
  "auth/network-request-failed": "Brak połączenia. Sprawdź internet i spróbuj ponownie.",
};

async function login() {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (e) {
    const code = e?.code ?? "";
    console.error(e);
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    toast(LOGIN_ERRORS[code] ?? `Nie udało się zalogować (${code || e?.message}).`, "error");
  }
}

// ---------- render ----------
function render() {
  // Keep typed values and focus across re-renders.
  const keep = {};
  root.querySelectorAll("input[id], select[id], textarea[id]").forEach((el) => {
    if (el.type === "file") return;
    keep[el.id] = el.type === "checkbox" ? el.checked : el.value;
  });
  const active = document.activeElement?.id;
  const sel = active && document.activeElement.selectionStart != null ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
  const scroll = window.scrollY;

  root.innerHTML = page();

  for (const [id, v] of Object.entries(keep)) {
    const el = document.getElementById(id);
    if (!el || el.dataset.fresh != null) continue;
    if (el.type === "checkbox") el.checked = v;
    else el.value = v;
  }
  if (active) {
    const el = document.getElementById(active);
    if (el) {
      el.focus({ preventScroll: true });
      if (sel && el.setSelectionRange) try { el.setSelectionRange(...sel); } catch {}
    }
  }
  window.scrollTo(0, scroll);
}

function page() {
  if (S.user === undefined) return `<div class="center-screen"><p class="pulse muted">Ładowanie…</p></div>`;
  if (!S.user) return loginPage();
  if (S.data.loading) return `<div class="center-screen"><p class="pulse muted">Wczytuję budżet…</p></div>`;
  if (S.data.error && !S.data.meta) return errorPage(S.data.error);
  if (!profile().onboarded) return onboardingPage() + toastHtml();
  return `<div class="app">
    ${header()}
    <main class="content">${S.serverProblem ? `<div class="banner error-banner">${esc(S.serverProblem)}</div>` : ""}${viewHtml()}</main>
    ${tabbar()}
    ${modalHtml()}
    ${toastHtml()}
  </div>`;
}

function toastHtml() {
  return S.toast ? `<div class="toast ${S.toast.kind}">${esc(S.toast.msg)}</div>` : "";
}

function loginPage() {
  return `<div class="center-screen login">
    <div class="brand">Budżet</div>
    <h1>Wiesz, gdzie znikają pieniądze.</h1>
    <p class="muted">Wrzucasz screeny z historii płatności, apka sama rozpoznaje wydatki i dzieli je na kategorie. Ty widzisz budżet, cele i podpowiedzi, na czym oszczędzić.</p>
    <button class="primary" data-action="login">Zaloguj się przez Google</button>
  </div>${toastHtml()}`;
}

function errorPage(msg) {
  return `<div class="center-screen"><div class="brand">Budżet</div><p class="error">${esc(msg)}</p>
    <button class="secondary" data-action="reload">Odśwież</button><button class="link" data-action="logout">Wyloguj</button></div>`;
}

function header() {
  const p = S.data.pending;
  return `<header class="topbar">
    <div class="topbar-inner">
      <div class="brand">Budżet</div>
      <div class="month-switch">
        <button class="icon-btn sm" data-action="month" data-d="-1" aria-label="Poprzedni miesiąc">${icon.left}</button>
        <span class="month-label">${esc(monthName(S.month))}</span>
        <button class="icon-btn sm" data-action="month" data-d="1" aria-label="Następny miesiąc" ${S.month >= thisMonth() ? "disabled" : ""}>${icon.right}</button>
      </div>
      <button class="icon-btn" data-action="settings" aria-label="Ustawienia">
        ${icon.gear}<span class="sync-dot ${p ? "pending" : ""}" title="${p ? "Zapisuję…" : "Zapisane"}"></span>
      </button>
    </div>
  </header>`;
}

function tabbar() {
  const review = S.data.txs.filter((t) => t.status === "review").length;
  const tab = (v, ic, label, badge = 0) =>
    `<button class="tab ${S.view === v ? "active" : ""}" data-action="view" data-v="${v}">${ic}<span>${label}</span>${badge ? `<i class="badge">${badge}</i>` : ""}</button>`;
  return `<nav class="tabbar">
    ${tab("home", icon.home, "Pulpit")}
    ${tab("tx", icon.list, "Transakcje", review)}
    <button class="tab tab-add ${S.view === "add" ? "active" : ""}" data-action="view" data-v="add" aria-label="Dodaj"><span class="plus">${icon.plus}</span></button>
    ${tab("goals", icon.goal, "Cele")}
    ${tab("tips", icon.bulb, "Porady")}
  </nav>`;
}

function viewHtml() {
  switch (S.view) {
    case "tx": return txView();
    case "add": return addView();
    case "goals": return goalsView();
    case "tips": return tipsView();
    default: return homeView();
  }
}

// ---------- home ----------
function homeView() {
  const s = monthStats(S.data.txs, S.month);
  const p = profile();
  const isCurrent = S.month === thisMonth();
  const day = isCurrent ? new Date().getDate() : daysInMonth(S.month);
  const dim = daysInMonth(S.month);
  const income = s.income;
  const left = s.left;
  const daysLeft = isCurrent ? dim - day + 1 : 0;
  const perDay = isCurrent && daysLeft > 0 ? Math.max(0, left / daysLeft) : 0;
  const used = income > 0 ? Math.min(1, (s.spent + s.saved) / income) : 0;
  const review = S.data.txs.filter((t) => t.status === "review");

  const cats = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]);
  const donutItems = cats.map(([c, v]) => ({ label: cat(c).name, value: v, color: cat(c).color }));

  const needSalary = isCurrent && !s.list.some((t) => t.category === "wynagrodzenie") && (!p.payday || new Date().getDate() >= Number(p.payday));

  const months = lastMonths(S.month, 6).map((m) => {
    const st = monthStats(S.data.txs, m);
    return { label: monthShort(m), income: st.income, spent: st.spent + st.saved, current: m === S.month };
  });
  const tips = suggestions(S.data.txs, meta(), S.month).filter((t) => t.level !== "good").slice(0, 2);

  if (!S.data.txs.length) {
    return `<section class="page">
      <div class="card hero-empty">
        <h2>Zacznij od screena</h2>
        <p class="muted">Zrób zrzut ekranu historii płatności w aplikacji banku i wrzuć go tutaj. Możesz też dodać wypłatę.</p>
        <div class="row-btns">
          <button class="primary" data-action="view" data-v="add">${icon.camera} Wrzuć screeny</button>
          <button class="secondary" data-action="salary">Dodaj wypłatę</button>
        </div>
      </div>
    </section>`;
  }

  return `<section class="page">
    ${review.length ? `<button class="banner warn-banner" data-action="review">❓ <b>${review.length}</b> ${review.length === 1 ? "transakcja czeka" : "transakcji czeka"} na kategorię <span>Przypisz →</span></button>` : ""}
    ${needSalary ? `<button class="banner" data-action="salary">💰 Nie ma jeszcze wypłaty za ${esc(monthName(S.month))}. <span>Dodaj →</span></button>` : ""}

    <div class="card hero">
      <div class="hero-top">
        <div>
          ${income > 0
            ? `<p class="label">${left >= 0 ? "Zostało w tym miesiącu" : "Na minusie"}</p><p class="big ${left < 0 ? "neg" : ""}">${zl(left)}</p>`
            : `<p class="label">Wydane w tym miesiącu</p><p class="big">${zl(s.spent)}</p>`}
        </div>
        ${isCurrent && income > 0 ? `<div class="per-day"><p class="label">na dzień</p><p class="mid">${zl(perDay)}</p><p class="small muted">${daysLeft} dni do końca</p></div>` : ""}
      </div>
      <div class="meter"><span style="width:${used * 100}%" class="${used > 0.9 ? "hot" : ""}"></span></div>
      <div class="stats">
        <div><p class="label">Wpływy</p><p class="stat-value pos">${zl(income)}</p></div>
        <div><p class="label">Wydatki</p><p class="stat-value">${zl(s.spent)}</p></div>
        <div><p class="label">Odłożone</p><p class="stat-value">${zl(s.saved)}</p></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Na co wydajesz</h3><span class="muted small">${s.list.filter((t) => t.amount < 0).length} płatności</span></div>
      ${cats.length ? `<div class="donut-wrap">${donut(donutItems, { center: zl(s.spent), sub: "wydatki" })}</div>
      <ul class="cat-list">${cats.map(([c, v]) => catRow(c, v, s.spent)).join("")}</ul>` : `<p class="muted">Brak wydatków w tym miesiącu.</p>`}
    </div>

    <div class="card">
      <div class="card-head"><h3>Dzień po dniu</h3>${income > 0 ? `<span class="muted small">- - - budżet na dzień ${zl((income - s.saved) / dim)}</span>` : ""}</div>
      ${dailyBars(s.days, { allowed: income > 0 ? (income - s.saved) / dim : 0, today: isCurrent ? day : 0 })}
    </div>

    <div class="card">
      <div class="card-head"><h3>Ostatnie 6 miesięcy</h3><span class="legend"><i class="dot inc"></i>wpływy <i class="dot sp"></i>wydatki</span></div>
      ${monthBars(months)}
    </div>

    ${topMerchantsCard(s)}

    ${tips.length ? `<div class="card">
      <div class="card-head"><h3>Podpowiedzi</h3><button class="link" data-action="view" data-v="tips">Wszystkie →</button></div>
      ${tips.map(tipHtml).join("")}
    </div>` : ""}
  </section>`;
}

function catRow(c, v, total) {
  const k = cat(c);
  const limit = profile().limits?.[c];
  const share = total ? v / total : 0;
  const lim = limit ? Math.min(1, v / limit) : null;
  return `<li><button class="cat-row" data-action="filter-cat" data-c="${c}">
    <span class="cat-ico" style="--c:${k.color}">${k.icon}</span>
    <span class="cat-main">
      <span class="cat-top"><span class="cat-name">${esc(k.name)}</span><span class="cat-val">${zl(v)}</span></span>
      <span class="cat-bar"><span style="width:${(lim ?? share) * 100}%;background:${limit && v > limit ? "var(--error)" : k.color}"></span></span>
      <span class="cat-sub muted small">${pct(share)} wydatków${limit ? ` · limit ${zl(limit)}${v > limit ? ` · <b class="error">+${zl(v - limit)}</b>` : ` · zostało ${zl(limit - v)}`}` : ""}</span>
    </span></button></li>`;
}

function topMerchantsCard(s) {
  const top = topMerchants(s.list, 5);
  if (!top.length) return "";
  return `<div class="card"><div class="card-head"><h3>Gdzie najwięcej</h3></div>
    <ul class="merchants">${top.map((m) => `<li><span>${esc(m.name)} <span class="muted small">×${m.count}</span></span><b>${zl(m.sum)}</b></li>`).join("")}</ul></div>`;
}

function tipHtml(t) {
  return `<div class="tip tip-${t.level}"><span class="tip-ico">${t.level === "warn" ? "⚠️" : t.level === "good" ? "✅" : "💡"}</span>
    <div><p class="tip-title">${esc(t.title)}</p><p class="small muted">${esc(t.text)}</p></div></div>`;
}

// ---------- transactions ----------
function txView() {
  const all = S.data.txs;
  const reviewAll = all.filter((t) => t.status === "review").sort((a, b) => b.date.localeCompare(a.date));
  const f = S.filter;
  let list = all.filter((t) => monthOf(t.date) === S.month);
  if (f.cat === REVIEW) list = reviewAll;
  else if (f.cat !== "all") list = list.filter((t) => (t.status === "review" ? REVIEW : t.category) === f.cat);
  if (f.q) {
    const q = f.q.toLowerCase();
    list = list.filter((t) => `${t.merchant} ${t.description ?? ""}`.toLowerCase().includes(q));
  }
  list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? 0) - (a.createdAt ?? 0));

  const groups = {};
  for (const t of list) (groups[t.date] ??= []).push(t);
  const sum = list.reduce((a, t) => a + t.amount, 0);

  return `<section class="page">
    <div class="page-head"><h2>Transakcje</h2><button class="secondary sm" data-action="manual">+ Dodaj ręcznie</button></div>
    <div class="filters">
      <input id="q" class="input" type="search" placeholder="Szukaj sklepu…" value="${esc(f.q)}" data-input="q" />
      <select id="fcat" class="input" data-change="fcat">
        <option value="all" ${f.cat === "all" ? "selected" : ""}>Wszystkie kategorie</option>
        <option value="${REVIEW}" ${f.cat === REVIEW ? "selected" : ""}>❓ Do sprawdzenia (${reviewAll.length})</option>
        ${CATEGORIES.map((c) => `<option value="${c.id}" ${f.cat === c.id ? "selected" : ""}>${c.icon} ${esc(c.name)}</option>`).join("")}
      </select>
    </div>
    ${f.cat === REVIEW ? reviewList(reviewAll) : `
    <p class="small muted">${list.length} transakcji · razem <b class="${sum < 0 ? "" : "pos"}">${zl(sum, true)}</b>${f.cat === "all" ? ` · ${esc(monthName(S.month))}` : ""}</p>
    ${list.length ? Object.entries(groups).map(([d, ts]) => `
      <div class="day-group"><p class="day-label">${dayLabel(d)}</p>
        <ul class="tx-list">${ts.map(txRow).join("")}</ul></div>`).join("") : `<div class="card"><p class="muted">Brak transakcji.</p></div>`}`}
  </section>`;
}

function dayLabel(iso) {
  const d = new Date(iso + "T12:00:00");
  const today = todayIso();
  const y = new Date(Date.now() - 864e5);
  const yIso = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (iso === today) return "Dzisiaj";
  if (iso === yIso) return "Wczoraj";
  return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

function txRow(t) {
  const c = t.status === "review" ? cat(REVIEW) : cat(t.category);
  return `<li><button class="tx" data-action="edit-tx" data-id="${t.id}">
    <span class="cat-ico" style="--c:${c.color}">${c.icon}</span>
    <span class="tx-main"><span class="tx-name">${esc(t.merchant)}</span><span class="small muted">${esc(c.name)}${t.description ? ` · ${esc(t.description)}` : ""}</span></span>
    <span class="tx-amt ${t.amount > 0 ? "pos" : ""}">${t.amount > 0 ? "+" : ""}${zl(t.amount, true)}</span>
  </button></li>`;
}

function reviewList(list) {
  if (!list.length) return `<div class="card center"><p>✅ Wszystko przypisane.</p></div>`;
  return `<p class="small muted">Wybierz kategorię — apka zapamięta sklep i następnym razem przypisze go sama.</p>
  ${list.map((t) => `<div class="card review-card">
    <div class="review-top"><div><p class="tx-name">${esc(t.merchant)}</p><p class="small muted">${dayLabel(t.date)}${t.description ? ` · ${esc(t.description)}` : ""}</p></div>
    <b class="${t.amount > 0 ? "pos" : ""}">${t.amount > 0 ? "+" : ""}${zl(t.amount, true)}</b></div>
    <div class="cat-chips">${(t.amount > 0 ? INCOME_CATS : EXPENSE_CATS).map((c) => `<button class="cchip ${t.category === c.id ? "sel" : ""}" data-action="assign" data-id="${t.id}" data-c="${c.id}">${c.icon} ${esc(c.name)}</button>`).join("")}</div>
    <label class="check small"><input type="checkbox" id="rem-${t.id}" checked /> Zapamiętaj dla „${esc(merchantKey(t.merchant) || t.merchant)}”</label>
  </div>`).join("")}`;
}

// ---------- add / import ----------
function addView() {
  const imp = S.imp;
  if (imp.rows) return importReview();
  return `<section class="page">
    <h2>Dodaj</h2>
    <label class="drop ${imp.files.length ? "has" : ""}" id="drop">
      <input type="file" accept="image/*" multiple hidden data-change="files" />
      ${imp.files.length
        ? `<div class="thumbs">${imp.files.map((f, i) => `<span class="thumb"><img src="${f.preview}" alt="" /><button class="thumb-x" data-action="rm-file" data-i="${i}" aria-label="Usuń">${icon.x}</button></span>`).join("")}</div>
           <span class="muted small">Dotknij, żeby dodać kolejne · ${imp.files.length}/10</span>`
        : `<span class="drop-ico">${icon.camera}</span><b>Wrzuć screeny z historii płatności</b><span class="muted small">Możesz zaznaczyć kilka naraz albo wkleić (Ctrl+V). Nakładające się screeny nie zdublują transakcji.</span>`}
    </label>
    ${imp.error ? `<p class="error small">${esc(imp.error)}</p>` : ""}
    ${imp.busy ? `<p class="small muted">Nie zamykaj apki, zwykle trwa to kilka–kilkanaście sekund.</p>` : ""}
    ${imp.files.length ? `<button class="primary wide" data-action="recognize" ${imp.busy ? "disabled" : ""}>${imp.busy ? `<span class="spinner"></span> Czytam screeny… ${imp.done}/${imp.files.length} · ${Math.round((Date.now() - imp.started) / 1000)} s` : `${icon.sparkle} Rozpoznaj transakcje`}</button>` : ""}

    <div class="card">
      <div class="card-head"><h3>💰 Wypłata</h3></div>
      <p class="small muted">Dodawaj wypłatę co miesiąc — od niej liczy się budżet.</p>
      <div class="form-grid">
        <label>Kwota netto<input id="sal-amt" class="input" inputmode="decimal" placeholder="${esc(profile().salary || "np. 6500")}" /></label>
        <label>Data<input id="sal-date" class="input" type="date" value="${todayIso()}" /></label>
        <label class="span2">Opis<input id="sal-name" class="input" value="Wypłata" /></label>
      </div>
      <button class="primary wide" data-action="add-salary">Dodaj wypłatę</button>
    </div>

    <div class="card">
      <div class="card-head"><h3>✍️ Ręcznie</h3></div>
      <button class="secondary wide" data-action="manual">Dodaj wydatek lub wpływ</button>
    </div>
  </section>`;
}

function importReview() {
  const rows = S.imp.rows;
  const chosen = rows.filter((r) => r.include);
  const toReview = chosen.filter((r) => r.category === REVIEW || r.status === "review").length;
  return `<section class="page">
    <div class="page-head"><h2>Sprawdź i zapisz</h2><button class="link" data-action="imp-cancel">Anuluj</button></div>
    ${S.imp.error ? `<p class="error small">${esc(S.imp.error)}</p>` : ""}
    <p class="small muted">Rozpoznano ${rows.length} transakcji. Możesz poprawić dane przed zapisem. ${rows.some((r) => r.dup) ? "Wyszarzone są już w apce (duplikaty)." : ""}</p>
    <ul class="imp-list">${rows.map((r, i) => `
      <li class="imp ${r.include ? "" : "off"} ${r.status === "review" ? "needs" : ""}">
        <label class="imp-check"><input type="checkbox" id="imp-in-${r.key}" data-imp="${i}" data-f="include" ${r.include ? "checked" : ""} data-fresh /></label>
        <div class="imp-body">
          <div class="imp-line">
            <input id="imp-m-${r.key}" class="input imp-merchant" value="${esc(r.merchant)}" data-imp="${i}" data-f="merchant" />
            <input id="imp-a-${r.key}" class="input imp-amt ${r.amount > 0 ? "pos" : ""}" inputmode="decimal" value="${String(r.amount).replace(".", ",")}" data-imp="${i}" data-f="amount" />
          </div>
          <div class="imp-line">
            <input id="imp-d-${r.key}" class="input imp-date" type="date" value="${r.date}" data-imp="${i}" data-f="date" />
            <select id="imp-c-${r.key}" class="input imp-cat" data-imp="${i}" data-f="category" data-fresh>${catOptions(r.status === "review" ? REVIEW : r.category, { income: r.amount > 0 })}</select>
          </div>
          <div class="imp-tags">
            ${r.dup ? `<span class="tag">duplikat</span>` : ""}
            ${r.status === "review" ? `<span class="tag warn">do sprawdzenia</span>` : `<span class="tag ok">${r.via === "learned" ? "zapamiętane" : r.via === "rule" ? "rozpoznane" : r.via === "manual" ? "ręcznie" : "AI"}</span>`}
            ${r.description ? `<span class="muted small">${esc(r.description)}</span>` : ""}
          </div>
        </div>
      </li>`).join("")}</ul>
    <div class="sticky-actions">
      <button class="primary wide" data-action="imp-save" ${chosen.length ? "" : "disabled"}>Zapisz ${chosen.length} ${chosen.length === 1 ? "transakcję" : "transakcji"}${toReview ? ` (${toReview} do sprawdzenia)` : ""}</button>
    </div>
  </section>`;
}

const IMPORT_KEY = "budzet.import";

async function recognize() {
  const imp = S.imp;
  imp.busy = true;
  imp.error = null;
  imp.done = 0;
  imp.started = Date.now();
  render();
  // Keep the phone screen on while the AI reads the screenshots.
  let lock = null;
  try {
    lock = await navigator.wakeLock?.request("screen");
  } catch {}
  const tick = setInterval(render, 1000);
  const failed = [];
  let found = [];
  try {
    const { readScreenshots } = await import("./ai.js");
    const today = todayIso();
    // One request per screenshot, up to 3 at a time: much faster than one big request.
    const queue = imp.files.map((f, i) => ({ f, i }));
    const worker = async () => {
      while (queue.length) {
        const { f, i } = queue.shift();
        try {
          found.push(...(await readScreenshots([f], today)));
        } catch (e) {
          console.error(e);
          failed.push({ i, e });
        }
        imp.done++;
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    // Overlapping screenshots show the same transactions: keep each one once.
    const unique = [];
    for (const t of found) if (!unique.some((u) => sameTx(u, t))) unique.push(t);
    found = unique;
    if (failed.length === imp.files.length) throw failed[0].e;
    if (failed.length) imp.error = `Nie udało się odczytać ${failed.length} z ${imp.files.length} screenów (${failed.map((x) => x.i + 1).join(", ")}). Możesz je wrzucić jeszcze raz.`;
    if (!found.length) {
      imp.error ??= "Nie znalazłem żadnych transakcji na tych screenach. Upewnij się, że widać listę płatności z kwotami.";
    } else {
      const L = learned();
      imp.rows = found
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((t) => {
          const c = classify(t, L);
          const dup = isDuplicate(t);
          return { ...t, ...c, key: rid(), dup, include: !dup };
        });
      imp.files = [];
      persistImport();
    }
  } catch (e) {
    console.error(e);
    imp.error = "Rozpoznawanie nie zadziałało: " + store.describeError(e);
  }
  clearInterval(tick);
  lock?.release?.().catch(() => {});
  imp.busy = false;
  render();
}

/** The review list survives a reload (e.g. iOS closing the app in the background). */
function persistImport() {
  try {
    if (S.imp.rows) localStorage.setItem(IMPORT_KEY, JSON.stringify({ uid: uid(), rows: S.imp.rows, at: Date.now() }));
    else localStorage.removeItem(IMPORT_KEY);
  } catch {}
}
function restoreImport() {
  try {
    const saved = JSON.parse(localStorage.getItem(IMPORT_KEY) ?? "null");
    if (saved?.uid === uid() && saved.rows?.length && Date.now() - saved.at < 3 * 864e5) {
      S.imp.rows = saved.rows;
      S.view = "add";
    }
  } catch {}
}

/** Same day, same amount and a matching merchant ("BOLT.EU" = "Bolt"). */
function sameTx(a, b) {
  if (a.date !== b.date || Math.abs(a.amount - b.amount) > 0.005) return false;
  const ka = merchantKey(a.merchant).replace(/[^a-z0-9 ]/g, "");
  const kb = merchantKey(b.merchant).replace(/[^a-z0-9 ]/g, "");
  if (!ka || !kb) return true;
  const fa = ka.split(" ")[0];
  const fb = kb.split(" ")[0];
  return ka === kb || ka.includes(kb) || kb.includes(ka) || fa === fb || fa.startsWith(fb) || fb.startsWith(fa);
}

function isDuplicate(t) {
  return S.data.txs.some((x) => sameTx(x, t));
}

async function saveImport() {
  const rows = S.imp.rows.filter((r) => r.include);
  const now = Date.now();
  const txs = rows.map((r, i) => ({
    date: r.date,
    merchant: r.merchant.trim() || "Nieznany",
    description: r.description || "",
    amount: r.amount,
    category: r.category === REVIEW ? REVIEW : r.category,
    status: r.category === REVIEW || r.status === "review" ? "review" : "ok",
    source: "screen",
    createdAt: now + i,
  }));
  // Categories chosen by hand in this review are remembered for the merchant.
  const learnNow = rows.filter((r) => r.via === "manual" && r.category !== REVIEW);
  S.imp = { files: [], rows: null, busy: false, error: null };
  persistImport();
  S.view = txs.some((t) => t.status === "review") ? "tx" : "home";
  if (S.view === "tx") S.filter = { cat: REVIEW, q: "" };
  const months = new Set(txs.map((t) => monthOf(t.date)));
  if (months.size === 1) S.month = [...months][0];
  render();
  await run(
    (async () => {
      await store.saveTxs(uid(), txs);
      for (const r of learnNow) await store.learn(uid(), merchantKey(r.merchant), r.category);
    })(),
    `Zapisano ${txs.length} transakcji`,
  );
}

async function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith("image/"));
  if (!files.length) return;
  const { fileToBase64Jpeg } = await import("./ai.js");
  for (const f of files) {
    if (S.imp.files.length >= 10) break;
    try {
      S.imp.files.push(await fileToBase64Jpeg(f));
    } catch (e) {
      console.error(e);
    }
  }
  S.imp.error = null;
  S.view = "add";
  render();
}

// ---------- goals ----------
function goalsView() {
  const p = profile();
  const goals = p.goals ?? [];
  const debts = p.debts ?? [];
  const plan = debts.length ? debtPlan(debts) : null;
  const avg = averages(S.data.txs, lastMonths(shiftMonth(thisMonth(), -1), 3));
  const avgSpend = avg.count ? avg.spent : monthStats(S.data.txs, S.month).spent;
  const fund = Number(p.emergencyFund) || 0;

  return `<section class="page">
    <div class="page-head"><h2>Cele oszczędzania</h2><button class="secondary sm" data-action="goal-edit">+ Nowy cel</button></div>
    ${goals.length ? goals.map((g) => {
      const prog = g.target ? Math.min(1, (g.saved || 0) / g.target) : 0;
      const left = Math.max(0, (g.target || 0) - (g.saved || 0));
      const months = g.deadline ? Math.max(1, monthsBetween(thisMonth(), monthOf(g.deadline))) : null;
      return `<div class="card goal">
        <div class="card-head"><h3>${esc(g.name)}</h3><button class="link" data-action="goal-edit" data-id="${g.id}">Edytuj</button></div>
        <p class="goal-nums"><b class="stat-value">${zl(g.saved || 0)}</b> <span class="muted">z ${zl(g.target)}</span></p>
        <div class="meter good"><span style="width:${prog * 100}%"></span></div>
        <p class="small muted">${left ? `Brakuje ${zl(left)}${months ? ` · odkładaj ${zl(left / months)}/mies. do ${esc(g.deadline)}` : ""}` : "🎉 Cel osiągnięty!"}</p>
        <div class="row-btns"><button class="secondary sm" data-action="goal-add" data-id="${g.id}">+ Wpłać</button></div>
      </div>`;
    }).join("") : `<div class="card"><p class="muted">Nie masz jeszcze celu. Na co zbierasz? Wakacje, auto, wkład własny?</p></div>`}

    <div class="card">
      <div class="card-head"><h3>🛟 Poduszka finansowa</h3><button class="link" data-action="fund-edit">Zmień</button></div>
      <p class="goal-nums"><b class="stat-value">${zl(fund)}</b> <span class="muted">${avgSpend ? `z zalecanych ${zl(avgSpend * 3)}` : ""}</span></p>
      ${avgSpend ? `<div class="meter good"><span style="width:${Math.min(1, fund / (avgSpend * 3)) * 100}%"></span></div>
      <p class="small muted">3 miesiące Twoich średnich wydatków (${zl(avgSpend)}/mies.).</p>` : ""}
    </div>

    <div class="page-head"><h2>Zadłużenie</h2><button class="secondary sm" data-action="debt-edit">+ Dodaj dług</button></div>
    ${debts.length ? `${debts.map((d) => `<div class="card">
        <div class="card-head"><h3>${esc(d.name)}</h3><button class="link" data-action="debt-edit" data-id="${d.id}">Edytuj</button></div>
        <div class="stats three">
          <div><p class="label">Do spłaty</p><p class="stat-value">${zl(d.balance)}</p></div>
          <div><p class="label">Oprocentowanie</p><p class="stat-value">${d.rate || 0}%</p></div>
          <div><p class="label">Rata</p><p class="stat-value">${zl(d.monthly)}</p></div>
        </div>
      </div>`).join("")}
      <div class="card">
        <h3>Plan spłaty</h3>
        ${plan?.stuck ? `<p class="error small">Raty nie pokrywają odsetek — dług rośnie. Zwiększ ratę.</p>` : `
        <p class="small">Przy obecnych ratach: <b>${plan.months} mies.</b> (do ${esc(monthName(shiftMonth(thisMonth(), plan.months)))}), odsetki ok. <b>${zl(plan.interest)}</b>.</p>
        <label class="small">Nadpłata miesięcznie<input id="extra" class="input" inputmode="decimal" placeholder="np. 300" data-input="extra" value="${esc(S.extra ?? "")}" /></label>
        ${(() => {
          const e = num(S.extra);
          if (!e) return `<p class="small muted">Wpisz kwotę, żeby zobaczyć, ile zyskasz. Nadpłacaj najpierw najdroższy dług (najwyższe %).</p>`;
          const p2 = debtPlan(debts, e);
          return `<p class="small">Z nadpłatą ${zl(e)}: <b>${p2.months} mies.</b> — szybciej o ${plan.months - p2.months} mies., oszczędzasz <b>${zl(plan.interest - p2.interest)}</b> na odsetkach.</p>`;
        })()}`}
      </div>` : `<div class="card"><p class="muted">Brak długów 👍 Jeśli masz kredyt, raty albo debet — dodaj je, a apka policzy plan spłaty.</p></div>`}

    <div class="page-head"><h2>Limity kategorii</h2><button class="secondary sm" data-action="limits-suggest">Zaproponuj</button></div>
    <div class="card">
      <p class="small muted">Miesięczny limit na kategorię. Puste pole = bez limitu.</p>
      <div class="limits">${EXPENSE_CATS.filter((c) => !["oszczednosci"].includes(c.id)).map((c) => `
        <label class="limit-row"><span>${c.icon} ${esc(c.name)}${avg.byCat[c.id] ? `<span class="muted small"> · śr. ${zl(avg.byCat[c.id])}</span>` : ""}</span>
        <input id="lim-${c.id}" class="input" inputmode="decimal" placeholder="—" value="${p.limits?.[c.id] ?? ""}" /></label>`).join("")}</div>
      <button class="primary wide" data-action="limits-save">Zapisz limity</button>
    </div>
  </section>`;
}

// ---------- tips ----------
function tipsView() {
  const tips = suggestions(S.data.txs, meta(), S.month);
  const adv = meta().advice;
  return `<section class="page">
    <h2>Porady</h2>
    <div class="card ai-card">
      <div class="card-head"><h3>${icon.sparkle} Analiza AI</h3>${adv?.at ? `<span class="small muted">${new Date(adv.at).toLocaleDateString("pl-PL")}</span>` : ""}</div>
      ${adv?.text ? `<div class="md">${markdown(adv.text)}</div>` : `<p class="small muted">AI przejrzy Twoje wydatki z ostatnich miesięcy, cele i długi, i podpowie, gdzie konkretnie przyciąć.</p>`}
      ${S.advice.error ? `<p class="error small">${esc(S.advice.error)}</p>` : ""}
      <button class="primary wide" data-action="advice" ${S.advice.busy ? "disabled" : ""}>${S.advice.busy ? `<span class="spinner"></span> Analizuję…` : adv?.text ? "Odśwież analizę" : "Przeanalizuj mój budżet"}</button>
    </div>
    <h3>Na podstawie ${esc(monthName(S.month))}</h3>
    ${tips.map(tipHtml).join("")}
  </section>`;
}

function markdown(md) {
  const lines = esc(md).split("\n");
  let html = "";
  let inList = false;
  for (const raw of lines) {
    const l = raw.trim();
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
    if (/^[-*•]\s+/.test(l) || /^\d+\.\s+/.test(l)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(l.replace(/^([-*•]|\d+\.)\s+/, ""))}</li>`;
      continue;
    }
    if (inList) {
      html += "</ul>";
      inList = false;
    }
    if (/^#{1,4}\s+/.test(l)) html += `<h4>${inline(l.replace(/^#+\s+/, ""))}</h4>`;
    else if (l) html += `<p>${inline(l)}</p>`;
  }
  return html + (inList ? "</ul>" : "");
}

async function askAdvice() {
  S.advice = { busy: true, error: null };
  render();
  try {
    const { adviceFromSummary } = await import("./ai.js");
    const text = await adviceFromSummary(summaryForAi(S.data.txs, meta(), S.month));
    await store.saveMeta(uid(), { advice: { text, at: Date.now(), month: S.month } });
    S.advice = { busy: false, error: null };
  } catch (e) {
    console.error(e);
    S.advice = { busy: false, error: store.describeError(e) };
  }
  render();
}

// ---------- onboarding ----------
function onboardingPage() {
  const o = (S.onboard ??= { step: 0, goals: [], debts: [], hasDebts: null });
  const p = profile();
  const steps = ["Dochód", "Oszczędności", "Cele", "Zadłużenie"];
  const dots = `<div class="steps">${steps.map((s, i) => `<span class="${i <= o.step ? "on" : ""}">${s}</span>`).join("")}</div>`;
  let body = "";
  if (o.step === 0)
    body = `<h1>Cześć ${esc(S.user.displayName?.split(" ")[0] ?? "")}! Ustawmy budżet.</h1>
      <p class="muted">Kilka pytań, żeby porady miały sens. Wszystko zmienisz później.</p>
      <label>Ile średnio zarabiasz na rękę miesięcznie?<input id="ob-salary" class="input" inputmode="decimal" placeholder="np. 6500" value="${esc(p.salary ?? "")}" /></label>
      <label>Którego dnia miesiąca przychodzi wypłata?<input id="ob-payday" class="input" inputmode="numeric" placeholder="np. 10" value="${esc(p.payday ?? "")}" /></label>`;
  if (o.step === 1)
    body = `<h1>Oszczędności</h1>
      <label>Ile masz teraz odłożone na czarną godzinę?<input id="ob-fund" class="input" inputmode="decimal" placeholder="np. 5000" value="${esc(p.emergencyFund ?? "")}" /></label>
      <label>Ile chcesz odkładać co miesiąc?<input id="ob-monthly" class="input" inputmode="decimal" placeholder="np. 1000" value="${esc(p.monthlySavings ?? "")}" /></label>
      <p class="small muted">Dobra zasada: min. 20% dochodu${num(document.getElementById("ob-salary")?.value) || p.salary ? ` (u Ciebie ok. ${zl((num(p.salary) || 0) * 0.2)})` : ""}.</p>`;
  if (o.step === 2)
    body = `<h1>Na co zbierasz?</h1>
      <p class="muted">Dodaj cele oszczędzania — apka policzy, ile odkładać miesięcznie.</p>
      ${o.goals.map((g, i) => `<div class="pill-row"><span>🎯 ${esc(g.name)} — ${zl(g.target)}${g.deadline ? ` do ${esc(g.deadline)}` : ""}</span><button class="icon-btn sm" data-action="ob-rm-goal" data-i="${i}">${icon.x}</button></div>`).join("")}
      <div class="form-grid">
        <label class="span2">Nazwa celu<input id="ob-g-name" class="input" placeholder="np. Wakacje w Grecji" /></label>
        <label>Kwota<input id="ob-g-target" class="input" inputmode="decimal" placeholder="np. 8000" /></label>
        <label>Do kiedy<input id="ob-g-deadline" class="input" type="month" /></label>
        <label class="span2">Już odłożone<input id="ob-g-saved" class="input" inputmode="decimal" placeholder="0" /></label>
      </div>
      <button class="secondary" data-action="ob-add-goal">+ Dodaj cel</button>`;
  if (o.step === 3)
    body = `<h1>Masz jakieś długi?</h1>
      <p class="muted">Kredyt, raty 0%, karta kredytowa, debet, pożyczka od kogoś…</p>
      <div class="row-btns">
        <button class="${o.hasDebts === false ? "primary" : "secondary"}" data-action="ob-debts" data-v="0">Nie mam</button>
        <button class="${o.hasDebts === true ? "primary" : "secondary"}" data-action="ob-debts" data-v="1">Tak, mam</button>
      </div>
      ${o.hasDebts ? `
      ${o.debts.map((d, i) => `<div class="pill-row"><span>📉 ${esc(d.name)} — ${zl(d.balance)}, ${d.rate || 0}%, rata ${zl(d.monthly)}</span><button class="icon-btn sm" data-action="ob-rm-debt" data-i="${i}">${icon.x}</button></div>`).join("")}
      <div class="form-grid">
        <label class="span2">Nazwa<input id="ob-d-name" class="input" placeholder="np. Kredyt na auto" /></label>
        <label>Ile zostało do spłaty<input id="ob-d-balance" class="input" inputmode="decimal" placeholder="np. 24000" /></label>
        <label>Oprocentowanie %<input id="ob-d-rate" class="input" inputmode="decimal" placeholder="np. 9.5" /></label>
        <label class="span2">Miesięczna rata<input id="ob-d-monthly" class="input" inputmode="decimal" placeholder="np. 850" /></label>
      </div>
      <button class="secondary" data-action="ob-add-debt">+ Dodaj dług</button>` : ""}`;
  return `<div class="center-screen onboard">
    <div class="brand">Budżet</div>${dots}
    ${body}
    <div class="row-btns end">
      ${o.step > 0 ? `<button class="link" data-action="ob-back">Wstecz</button>` : ""}
      <button class="primary" data-action="ob-next">${o.step === 3 ? "Gotowe" : "Dalej"}</button>
    </div>
  </div>`;
}

function readGoalForm(prefix) {
  const name = document.getElementById(`${prefix}-name`)?.value.trim();
  const target = num(document.getElementById(`${prefix}-target`)?.value);
  if (!name || !target) return null;
  const dl = document.getElementById(`${prefix}-deadline`)?.value;
  return { id: rid(), name, target, saved: num(document.getElementById(`${prefix}-saved`)?.value), deadline: dl ? (dl.length === 7 ? dl + "-01" : dl) : "" };
}
function readDebtForm(prefix) {
  const name = document.getElementById(`${prefix}-name`)?.value.trim();
  const balance = num(document.getElementById(`${prefix}-balance`)?.value);
  if (!name || !balance) return null;
  return { id: rid(), name, balance, rate: num(document.getElementById(`${prefix}-rate`)?.value), monthly: num(document.getElementById(`${prefix}-monthly`)?.value) };
}
function clearInputs(prefix) {
  root.querySelectorAll(`[id^="${prefix}-"]`).forEach((el) => (el.value = ""));
}

async function onboardNext() {
  const o = S.onboard;
  const p = { ...profile() };
  if (o.step === 0) {
    const salary = num(document.getElementById("ob-salary").value);
    if (!salary) return toast("Wpisz przybliżony dochód — bez niego porady nie mają sensu.", "error");
    p.salary = salary;
    p.payday = Math.min(31, Math.max(1, Math.round(num(document.getElementById("ob-payday").value)))) || null;
  }
  if (o.step === 1) {
    p.emergencyFund = num(document.getElementById("ob-fund").value);
    p.monthlySavings = num(document.getElementById("ob-monthly").value);
  }
  if (o.step === 2) {
    const g = readGoalForm("ob-g");
    if (g) o.goals.push(g);
    p.goals = [...(p.goals ?? []).filter((x) => !o.goals.find((y) => y.id === x.id)), ...o.goals];
  }
  if (o.step === 3) {
    if (o.hasDebts === null) return toast("Zaznacz, czy masz długi.", "error");
    if (o.hasDebts) {
      const d = readDebtForm("ob-d");
      if (d) o.debts.push(d);
    }
    p.debts = o.hasDebts ? o.debts : [];
    p.onboarded = true;
  }
  await run(store.saveMeta(uid(), { profile: p }));
  if (o.step < 3) o.step++;
  else S.onboard = null;
  render();
}

// ---------- modals ----------
function modalHtml() {
  const m = S.modal;
  if (!m) return "";
  let inner = "";
  if (m.type === "tx") {
    const t = m.tx;
    const isNew = !t.id;
    const income = t.amount > 0 || m.kind === "in";
    inner = `<h3>${isNew ? "Nowa transakcja" : "Transakcja"}</h3>
      ${isNew ? `<div class="seg"><button class="${!income ? "on" : ""}" data-action="tx-kind" data-v="out">Wydatek</button><button class="${income ? "on" : ""}" data-action="tx-kind" data-v="in">Wpływ</button></div>` : ""}
      <div class="form-grid">
        <label class="span2">Sklep / odbiorca<input id="m-merchant" class="input" value="${esc(t.merchant ?? "")}" /></label>
        <label>Kwota (zł)<input id="m-amount" class="input" inputmode="decimal" value="${t.amount ? String(Math.abs(t.amount)).replace(".", ",") : ""}" /></label>
        <label>Data<input id="m-date" class="input" type="date" value="${t.date ?? todayIso()}" /></label>
        <label class="span2">Kategoria<select id="m-cat" class="input" data-fresh>${catOptions(t.status === "review" ? REVIEW : t.category ?? (income ? "wplywy" : REVIEW), { income })}</select></label>
        <label class="span2">Opis<input id="m-desc" class="input" value="${esc(t.description ?? "")}" /></label>
      </div>
      <label class="check small"><input type="checkbox" id="m-remember" ${isNew ? "" : "checked"} data-fresh /> Zapamiętaj kategorię dla tego sklepu</label>
      <div class="row-btns end">
        ${!isNew ? `<button class="link danger-link" data-action="tx-del">Usuń</button>` : ""}
        <button class="secondary" data-action="close">Anuluj</button>
        <button class="primary" data-action="tx-save">Zapisz</button>
      </div>`;
  }
  if (m.type === "goal") {
    const g = m.goal ?? {};
    inner = `<h3>${g.id ? "Edytuj cel" : "Nowy cel"}</h3>
      <div class="form-grid">
        <label class="span2">Nazwa<input id="g-name" class="input" value="${esc(g.name ?? "")}" placeholder="np. Nowy laptop" /></label>
        <label>Kwota<input id="g-target" class="input" inputmode="decimal" value="${g.target ?? ""}" /></label>
        <label>Do kiedy<input id="g-deadline" class="input" type="month" value="${(g.deadline ?? "").slice(0, 7)}" /></label>
        <label class="span2">Już odłożone<input id="g-saved" class="input" inputmode="decimal" value="${g.saved ?? ""}" /></label>
      </div>
      <div class="row-btns end">
        ${g.id ? `<button class="link danger-link" data-action="goal-del">Usuń</button>` : ""}
        <button class="secondary" data-action="close">Anuluj</button><button class="primary" data-action="goal-save">Zapisz</button>
      </div>`;
  }
  if (m.type === "goal-add") {
    inner = `<h3>Wpłata na „${esc(m.goal.name)}”</h3>
      <label>Kwota<input id="ga-amount" class="input" inputmode="decimal" autofocus /></label>
      <label class="check small"><input type="checkbox" id="ga-tx" checked data-fresh /> Zapisz też jako przelew na oszczędności w tym miesiącu</label>
      <div class="row-btns end"><button class="secondary" data-action="close">Anuluj</button><button class="primary" data-action="goal-add-save">Dodaj</button></div>`;
  }
  if (m.type === "debt") {
    const d = m.debt ?? {};
    inner = `<h3>${d.id ? "Edytuj dług" : "Nowy dług"}</h3>
      <div class="form-grid">
        <label class="span2">Nazwa<input id="d-name" class="input" value="${esc(d.name ?? "")}" placeholder="np. Karta kredytowa" /></label>
        <label>Do spłaty<input id="d-balance" class="input" inputmode="decimal" value="${d.balance ?? ""}" /></label>
        <label>Oprocentowanie %<input id="d-rate" class="input" inputmode="decimal" value="${d.rate ?? ""}" /></label>
        <label class="span2">Miesięczna rata<input id="d-monthly" class="input" inputmode="decimal" value="${d.monthly ?? ""}" /></label>
      </div>
      <div class="row-btns end">
        ${d.id ? `<button class="link danger-link" data-action="debt-del">Usuń</button>` : ""}
        <button class="secondary" data-action="close">Anuluj</button><button class="primary" data-action="debt-save">Zapisz</button>
      </div>`;
  }
  if (m.type === "fund") {
    inner = `<h3>Poduszka finansowa</h3>
      <label>Ile masz odłożone na czarną godzinę?<input id="f-amount" class="input" inputmode="decimal" value="${profile().emergencyFund ?? ""}" /></label>
      <div class="row-btns end"><button class="secondary" data-action="close">Anuluj</button><button class="primary" data-action="fund-save">Zapisz</button></div>`;
  }
  if (m.type === "settings") {
    const p = profile();
    inner = `<h3>Ustawienia</h3>
      <p class="small muted">Zalogowano jako ${esc(S.user.email)}</p>
      <div class="form-grid">
        <label>Dochód netto / mies.<input id="s-salary" class="input" inputmode="decimal" value="${p.salary ?? ""}" /></label>
        <label>Dzień wypłaty<input id="s-payday" class="input" inputmode="numeric" value="${p.payday ?? ""}" /></label>
        <label class="span2">Cel odkładania / mies.<input id="s-monthly" class="input" inputmode="decimal" value="${p.monthlySavings ?? ""}" /></label>
      </div>
      <div class="row-btns end"><button class="primary" data-action="settings-save">Zapisz</button></div>
      <hr />
      <div class="settings-links">
        <button class="link" data-action="forget-rules">Zapomnij nauczone sklepy (${Object.keys(learned()).length})</button>
        <button class="link" data-action="logout">Wyloguj się</button>
        <button class="link danger-link" data-action="wipe">Usuń wszystkie moje dane</button>
      </div>
      <div class="row-btns end"><button class="secondary" data-action="close">Zamknij</button></div>`;
  }
  return `<div class="modal-back" data-action="close-back"><div class="modal" role="dialog" aria-modal="true">${inner}</div></div>`;
}

function openTx(t) {
  S.modal = { type: "tx", tx: { ...t }, kind: t.amount > 0 ? "in" : "out" };
  render();
}

async function saveTxModal() {
  const m = S.modal;
  const t = m.tx;
  const amountAbs = Math.abs(num(document.getElementById("m-amount").value));
  if (!amountAbs) return toast("Wpisz kwotę.", "error");
  const income = t.id ? t.amount > 0 : m.kind === "in";
  const category = document.getElementById("m-cat").value;
  const merchant = document.getElementById("m-merchant").value.trim() || (income ? "Wpływ" : "Wydatek");
  const tx = {
    id: t.id,
    date: document.getElementById("m-date").value || todayIso(),
    merchant,
    description: document.getElementById("m-desc").value.trim(),
    amount: income ? amountAbs : -amountAbs,
    category,
    status: category === REVIEW ? "review" : "ok",
    source: t.source ?? "manual",
    createdAt: t.createdAt ?? Date.now(),
  };
  const remember = document.getElementById("m-remember").checked && category !== REVIEW;
  S.modal = null;
  render();
  await run(
    (async () => {
      await store.saveTx(uid(), tx);
      if (remember) await rememberAndApply(merchant, category);
    })(),
    "Zapisano",
  );
}

/** Learns merchant→category and fixes other unchecked transactions from that merchant. */
async function rememberAndApply(merchant, category) {
  const key = merchantKey(merchant);
  if (!key) return;
  await store.learn(uid(), key, category);
  const isIncome = cat(category).kind === "income";
  const others = S.data.txs.filter((x) => x.status === "review" && merchantKey(x.merchant) === key && (x.amount > 0) === isIncome);
  if (others.length) await store.patchTxs(uid(), others.map((x) => ({ id: x.id, patch: { category, status: "ok" } })));
}

function updateProfile(fn, msg) {
  const p = structuredClone(profile());
  fn(p);
  return run(store.saveMeta(uid(), { profile: p }), msg);
}

// ---------- events ----------
root.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "close-back" && e.target !== el) return;
  const d = el.dataset;
  switch (a) {
    case "login": return login();
    case "logout": S.modal = null; return signOut(auth);
    case "reload": return location.reload();
    case "view":
      S.view = d.v;
      if (d.v === "tx" && S.filter.cat === REVIEW && !S.data.txs.some((t) => t.status === "review")) S.filter.cat = "all";
      window.scrollTo(0, 0);
      return render();
    case "month": {
      const next = shiftMonth(S.month, Number(d.d));
      if (next <= thisMonth()) S.month = next;
      return render();
    }
    case "review":
      S.view = "tx";
      S.filter = { cat: REVIEW, q: "" };
      window.scrollTo(0, 0);
      return render();
    case "filter-cat":
      S.view = "tx";
      S.filter = { cat: d.c, q: "" };
      window.scrollTo(0, 0);
      return render();
    case "salary":
      S.view = "add";
      render();
      return document.getElementById("sal-amt")?.focus();
    case "settings": S.modal = { type: "settings" }; return render();
    case "close": case "close-back": S.modal = null; return render();
    case "manual": return openTx({ amount: 0, date: todayIso(), category: REVIEW, status: "review" });
    case "edit-tx": return openTx(S.data.txs.find((t) => t.id === d.id));
    case "tx-kind": S.modal.kind = d.v; S.modal.tx.category = d.v === "in" ? "wplywy" : REVIEW; return render();
    case "tx-save": return saveTxModal();
    case "tx-del": {
      if (!confirm("Usunąć tę transakcję?")) return;
      const id = S.modal.tx.id;
      S.modal = null;
      render();
      return run(store.deleteTx(uid(), id), "Usunięto");
    }
    case "assign": {
      const t = S.data.txs.find((x) => x.id === d.id);
      const remember = document.getElementById(`rem-${d.id}`)?.checked;
      return run(
        (async () => {
          await store.patchTx(uid(), t.id, { category: d.c, status: "ok" });
          if (remember) await rememberAndApply(t.merchant, d.c);
        })(),
        `${cat(d.c).icon} ${cat(d.c).name}`,
      );
    }
    case "rm-file": e.preventDefault(); S.imp.files.splice(Number(d.i), 1); return render();
    case "recognize": return recognize();
    case "imp-cancel": S.imp = { files: [], rows: null, busy: false, error: null }; persistImport(); return render();
    case "imp-save": return saveImport();
    case "add-salary": {
      const amount = num(document.getElementById("sal-amt").value);
      if (!amount) return toast("Wpisz kwotę wypłaty.", "error");
      const tx = { date: document.getElementById("sal-date").value || todayIso(), merchant: document.getElementById("sal-name").value.trim() || "Wypłata", description: "", amount: Math.abs(amount), category: "wynagrodzenie", status: "ok", source: "salary", createdAt: Date.now() };
      document.getElementById("sal-amt").value = "";
      S.month = monthOf(tx.date);
      S.view = "home";
      render();
      return run(store.saveTx(uid(), tx), `Dodano wypłatę ${zl(tx.amount)}`);
    }
    case "advice": return askAdvice();
    case "goal-edit": S.modal = { type: "goal", goal: (profile().goals ?? []).find((g) => g.id === d.id) }; return render();
    case "goal-save": {
      const g = readGoalForm("g");
      if (!g) return toast("Podaj nazwę i kwotę celu.", "error");
      const old = S.modal.goal;
      if (old?.id) g.id = old.id;
      S.modal = null;
      return updateProfile((p) => {
        p.goals = old?.id ? (p.goals ?? []).map((x) => (x.id === old.id ? g : x)) : [...(p.goals ?? []), g];
      }, "Zapisano cel");
    }
    case "goal-del": {
      const id = S.modal.goal.id;
      if (!confirm("Usunąć ten cel?")) return;
      S.modal = null;
      return updateProfile((p) => (p.goals = (p.goals ?? []).filter((x) => x.id !== id)), "Usunięto cel");
    }
    case "goal-add": S.modal = { type: "goal-add", goal: (profile().goals ?? []).find((g) => g.id === d.id) }; return render();
    case "goal-add-save": {
      const amount = num(document.getElementById("ga-amount").value);
      if (!amount) return toast("Wpisz kwotę.", "error");
      const asTx = document.getElementById("ga-tx").checked;
      const g = S.modal.goal;
      S.modal = null;
      await updateProfile((p) => {
        p.goals = (p.goals ?? []).map((x) => (x.id === g.id ? { ...x, saved: (Number(x.saved) || 0) + amount } : x));
      }, `+${zl(amount)} na „${g.name}”`);
      if (asTx) await run(store.saveTx(uid(), { date: todayIso(), merchant: `Cel: ${g.name}`, description: "", amount: -Math.abs(amount), category: "oszczednosci", status: "ok", source: "manual", createdAt: Date.now() }));
      return;
    }
    case "debt-edit": S.modal = { type: "debt", debt: (profile().debts ?? []).find((x) => x.id === d.id) }; return render();
    case "debt-save": {
      const debt = readDebtForm("d");
      if (!debt) return toast("Podaj nazwę i kwotę do spłaty.", "error");
      const old = S.modal.debt;
      if (old?.id) debt.id = old.id;
      S.modal = null;
      return updateProfile((p) => {
        p.debts = old?.id ? (p.debts ?? []).map((x) => (x.id === old.id ? debt : x)) : [...(p.debts ?? []), debt];
      }, "Zapisano dług");
    }
    case "debt-del": {
      const id = S.modal.debt.id;
      if (!confirm("Usunąć ten dług?")) return;
      S.modal = null;
      return updateProfile((p) => (p.debts = (p.debts ?? []).filter((x) => x.id !== id)), "Usunięto");
    }
    case "fund-edit": S.modal = { type: "fund" }; return render();
    case "fund-save": {
      const v = num(document.getElementById("f-amount").value);
      S.modal = null;
      return updateProfile((p) => (p.emergencyFund = v), "Zapisano");
    }
    case "limits-save": {
      const limits = {};
      for (const c of EXPENSE_CATS) {
        const v = num(document.getElementById(`lim-${c.id}`)?.value);
        if (v > 0) limits[c.id] = v;
      }
      return updateProfile((p) => (p.limits = limits), "Zapisano limity");
    }
    case "limits-suggest": {
      const avg = averages(S.data.txs, lastMonths(shiftMonth(thisMonth(), -1), 3));
      const src = avg.count ? avg.byCat : monthStats(S.data.txs, S.month).byCat;
      if (!Object.keys(src).length) return toast("Najpierw dodaj trochę wydatków.", "error");
      for (const c of EXPENSE_CATS) {
        const el = document.getElementById(`lim-${c.id}`);
        if (!el || !src[c.id]) continue;
        const want = cat(c.id).kind === "want" ? 0.85 : 0.95;
        el.value = Math.max(50, Math.round((src[c.id] * want) / 50) * 50);
      }
      return toast("Zaproponowano limity trochę poniżej średniej — popraw i zapisz.");
    }
    case "settings-save": {
      const salary = num(document.getElementById("s-salary").value);
      const payday = Math.round(num(document.getElementById("s-payday").value)) || null;
      const monthly = num(document.getElementById("s-monthly").value);
      S.modal = null;
      return updateProfile((p) => Object.assign(p, { salary, payday, monthlySavings: monthly }), "Zapisano");
    }
    case "forget-rules":
      if (!confirm("Zapomnieć wszystkie zapamiętane przypisania sklepów do kategorii?")) return;
      return run(store.saveMeta(uid(), { learned: {} }), "Wyczyszczono");
    case "wipe":
      if (!confirm("Na pewno usunąć wszystkie transakcje, cele i ustawienia? Tego nie da się cofnąć.")) return;
      S.modal = null;
      S.onboard = null;
      return run(store.deleteAll(uid(), S.data.txs), "Usunięto wszystkie dane");
    // onboarding
    case "ob-next": return onboardNext();
    case "ob-back": S.onboard.step--; return render();
    case "ob-add-goal": {
      const g = readGoalForm("ob-g");
      if (!g) return toast("Podaj nazwę i kwotę celu.", "error");
      S.onboard.goals.push(g);
      clearInputs("ob-g");
      return render();
    }
    case "ob-rm-goal": S.onboard.goals.splice(Number(d.i), 1); return render();
    case "ob-debts": S.onboard.hasDebts = d.v === "1"; return render();
    case "ob-add-debt": {
      const debt = readDebtForm("ob-d");
      if (!debt) return toast("Podaj nazwę i kwotę do spłaty.", "error");
      S.onboard.debts.push(debt);
      clearInputs("ob-d");
      return render();
    }
    case "ob-rm-debt": S.onboard.debts.splice(Number(d.i), 1); return render();
  }
});

root.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.input === "q") {
    S.filter.q = el.value;
    render();
  } else if (el.dataset.input === "extra") {
    S.extra = el.value;
    render();
  } else if (el.dataset.imp != null && el.dataset.f !== "include" && el.dataset.f !== "category") {
    const r = S.imp.rows[Number(el.dataset.imp)];
    if (el.dataset.f === "amount") {
      const wasIncome = r.amount > 0;
      r.amount = num(el.value);
      if (wasIncome !== r.amount > 0) render();
    } else r[el.dataset.f] = el.value;
    persistImport();
  }
});

root.addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.change === "files") return addFiles(el.files);
  if (el.dataset.change === "fcat") {
    S.filter.cat = el.value;
    return render();
  }
  if (el.dataset.imp != null) {
    const r = S.imp.rows[Number(el.dataset.imp)];
    if (el.dataset.f === "include") r.include = el.checked;
    if (el.dataset.f === "category") {
      r.category = el.value;
      r.status = el.value === REVIEW ? "review" : "ok";
      r.via = "manual";
    }
    persistImport();
    render();
  }
});

// Paste screenshots from the clipboard anywhere in the app.
document.addEventListener("paste", (e) => {
  if (!S.user || !profile().onboarded) return;
  const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
  if (files.length) {
    e.preventDefault();
    addFiles(files);
  }
});

// Drag & drop onto the drop zone.
document.addEventListener("dragover", (e) => {
  if (e.target.closest?.("#drop")) e.preventDefault();
});
document.addEventListener("drop", (e) => {
  if (!e.target.closest?.("#drop")) return;
  e.preventDefault();
  addFiles(e.dataTransfer.files);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && S.modal) {
    S.modal = null;
    render();
  }
});

render();
