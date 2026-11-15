// Budget math and rule-based suggestions.
import { cat, EXPENSE_CATS, REVIEW, merchantKey } from "./categories.js";

export const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoDate(new Date());
export const monthOf = (iso) => iso.slice(0, 7);
export const thisMonth = () => monthOf(todayIso());

export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export const daysInMonth = (month) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

const MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const MONTHS_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];
export const monthName = (month) => {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const monthShort = (month) => MONTHS_SHORT[Number(month.slice(5, 7)) - 1];

const fmt0 = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const zl = (n, exact = false) => `${(exact ? fmt2 : fmt0).format(n ?? 0)} zł`;
export const pct = (n) => `${Math.round((n ?? 0) * 100)}%`;

/** Everything about one month. Savings transfers are counted apart from spending. */
export function monthStats(txs, month) {
  const list = txs.filter((t) => monthOf(t.date) === month);
  let income = 0;
  let spent = 0;
  let saved = 0;
  const byCat = {};
  const days = Array(daysInMonth(month)).fill(0);
  let review = 0;
  for (const t of list) {
    if (t.amount > 0) {
      income += t.amount;
      continue;
    }
    const a = -t.amount;
    if (t.category === "oszczednosci") {
      saved += a;
      continue;
    }
    spent += a;
    const c = t.status === "review" ? REVIEW : t.category;
    if (t.status === "review") review++;
    byCat[c] = (byCat[c] ?? 0) + a;
    const d = Number(t.date.slice(8, 10));
    if (d >= 1 && d <= days.length) days[d - 1] += a;
  }
  const left = income - spent - saved;
  return {
    month,
    list,
    income,
    spent,
    saved,
    left,
    savingsRate: income > 0 ? (saved + Math.max(0, left)) / income : 0,
    byCat,
    days,
    review,
  };
}

export function lastMonths(month, n) {
  return Array.from({ length: n }, (_, i) => shiftMonth(month, i - n + 1));
}

/** Average monthly spend per category over the given months that have any data. */
export function averages(txs, months) {
  const stats = months.map((m) => monthStats(txs, m)).filter((s) => s.list.length > 0);
  const avg = { spent: 0, income: 0, byCat: {}, count: stats.length };
  if (!stats.length) return avg;
  for (const s of stats) {
    avg.spent += s.spent / stats.length;
    avg.income += s.income / stats.length;
    for (const [c, v] of Object.entries(s.byCat)) avg.byCat[c] = (avg.byCat[c] ?? 0) + v / stats.length;
  }
  return avg;
}

/** Recurring merchants paid in at least 2 of the last 3 months with similar amounts. */
export function recurring(txs, month) {
  const months = lastMonths(month, 3);
  const map = {};
  for (const t of txs) {
    if (t.amount >= 0 || !months.includes(monthOf(t.date))) continue;
    const k = merchantKey(t.merchant);
    if (!k) continue;
    (map[k] ??= { name: t.merchant, months: new Set(), amounts: [], category: t.category }).months.add(monthOf(t.date));
    map[k].amounts.push(-t.amount);
  }
  return Object.values(map)
    .filter((r) => r.months.size >= 2)
    .map((r) => ({ ...r, monthly: r.amounts.reduce((a, b) => a + b, 0) / r.months.size }))
    .sort((a, b) => b.monthly - a.monthly);
}

export function topMerchants(list, n = 6) {
  const map = {};
  for (const t of list) {
    if (t.amount >= 0 || t.category === "oszczednosci") continue;
    const k = merchantKey(t.merchant) || t.merchant;
    (map[k] ??= { name: t.merchant, sum: 0, count: 0 }).sum += -t.amount;
    map[k].count++;
  }
  return Object.values(map).sort((a, b) => b.sum - a.sum).slice(0, n);
}

/** Months needed to pay off debts with avalanche (highest rate first). */
export function debtPlan(debts, extra = 0) {
  const ds = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d, left: d.balance, rate: Number(d.rate) || 0, monthly: Number(d.monthly) || 0 }))
    .sort((a, b) => b.rate - a.rate);
  if (!ds.length) return null;
  let month = 0;
  let interest = 0;
  const order = [];
  while (ds.some((d) => d.left > 0.01) && month < 600) {
    month++;
    let pool = extra;
    for (const d of ds) {
      if (d.left <= 0) continue;
      const i = (d.left * d.rate) / 100 / 12;
      interest += i;
      d.left += i;
      const pay = Math.min(d.left, d.monthly);
      d.left -= pay;
      if (d.left <= 0.01) pool += d.monthly - pay;
    }
    // Snowball freed money + extra into the highest-rate debt.
    for (const d of ds) {
      if (d.left <= 0.01 || pool <= 0) continue;
      const pay = Math.min(d.left, pool);
      d.left -= pay;
      pool -= pay;
    }
    for (const d of ds) if (d.left <= 0.01 && !order.find((o) => o.name === d.name)) order.push({ name: d.name, month });
  }
  return { months: month, interest, order, stuck: month >= 600 };
}

const NEED = new Set(EXPENSE_CATS.filter((c) => c.kind === "need").map((c) => c.id));
const WANT = new Set(EXPENSE_CATS.filter((c) => c.kind === "want").map((c) => c.id));

/** Rule-based suggestions for the month. Each: {level: warn|tip|good, title, text, saving?}. */
export function suggestions(txs, meta, month) {
  const profile = meta?.profile ?? {};
  const s = monthStats(txs, month);
  const prev = averages(txs, lastMonths(shiftMonth(month, -1), 3));
  const out = [];
  const isCurrent = month === thisMonth();
  const dayNow = isCurrent ? new Date().getDate() : daysInMonth(month);
  const dim = daysInMonth(month);
  const progress = dayNow / dim;
  const income = s.income || Number(profile.salary) || 0;

  if (!s.list.length) {
    out.push({ level: "tip", title: "Brak danych w tym miesiącu", text: "Wrzuć screeny z historii płatności, a porady pojawią się same." });
    return out;
  }

  if (s.review > 0)
    out.push({ level: "warn", title: `${s.review} transakcji czeka na kategorię`, text: "Przypisz je w zakładce Transakcje — apka zapamięta sklep na przyszłość." });

  // Pace: projected spend vs income.
  if (income > 0 && isCurrent && dayNow >= 5) {
    const projected = (s.spent / dayNow) * dim;
    if (projected > income - s.saved) {
      out.push({
        level: "warn",
        title: "W tym tempie zabraknie pieniędzy",
        text: `Przy obecnym tempie wydasz ok. ${zl(projected)} w tym miesiącu, a wpływy to ${zl(income)}. Żeby się zmieścić, wydawaj do ${zl(Math.max(0, (income - s.saved - s.spent) / Math.max(1, dim - dayNow)))} dziennie do końca miesiąca.`,
      });
    }
  }

  // Category limits.
  for (const [c, limit] of Object.entries(profile.limits ?? {})) {
    if (!limit) continue;
    const used = s.byCat[c] ?? 0;
    if (used > limit)
      out.push({ level: "warn", title: `Przekroczony limit: ${cat(c).name}`, text: `Wydane ${zl(used)} z ${zl(limit)} (o ${zl(used - limit)} za dużo).` , saving: used - limit });
    else if (isCurrent && used > limit * Math.min(1, progress + 0.15) && used > limit * 0.6)
      out.push({ level: "tip", title: `Uważaj na: ${cat(c).name}`, text: `Wykorzystane ${pct(used / limit)} limitu, a minęło ${pct(progress)} miesiąca.` });
  }

  // Growth vs the previous 3 months.
  if (prev.count > 0) {
    const scale = isCurrent ? 1 / Math.max(progress, 0.2) : 1;
    const growth = Object.entries(s.byCat)
      .filter(([c]) => c !== REVIEW)
      .map(([c, v]) => ({ c, now: v * scale, avg: prev.byCat[c] ?? 0 }))
      .filter((g) => g.avg > 50 && g.now > g.avg * 1.25 && g.now - g.avg > 80)
      .sort((a, b) => b.now - b.avg - (a.now - a.avg));
    for (const g of growth.slice(0, 3))
      out.push({
        level: "tip",
        title: `Rosną wydatki: ${cat(g.c).name}`,
        text: `${isCurrent ? "Prognoza na ten miesiąc" : "W tym miesiącu"}: ${zl(g.now)}, średnio wcześniej ${zl(g.avg)} (+${pct(g.now / g.avg - 1)}).`,
        saving: g.now - g.avg,
      });
  }

  // 50/30/20.
  if (income > 0) {
    let need = 0;
    let want = 0;
    for (const [c, v] of Object.entries(s.byCat)) {
      if (NEED.has(c) || c === "dlugi") need += v;
      else if (WANT.has(c)) want += v;
    }
    const scale = isCurrent ? 1 / Math.max(progress, 0.2) : 1;
    const wantShare = (want * scale) / income;
    if (wantShare > 0.3)
      out.push({
        level: "tip",
        title: "Za dużo na przyjemności (zasada 50/30/20)",
        text: `Restauracje, zakupy, rozrywka, subskrypcje i podróże to ok. ${pct(wantShare)} dochodu — zalecane do 30%. Zejście do 30% to ok. ${zl(want * scale - income * 0.3)} miesięcznie więcej na oszczędności.`,
        saving: want * scale - income * 0.3,
      });
    const rate = (s.saved + Math.max(0, income - s.spent * scale - s.saved)) / income;
    if (!isCurrent || progress > 0.8) {
      if (rate >= 0.2) out.push({ level: "good", title: `Odkładasz ${pct(rate)} dochodu`, text: "To więcej niż zalecane 20%. Tak trzymaj!" });
      else out.push({ level: "tip", title: `Odkładasz ${pct(Math.max(0, rate))} dochodu`, text: `Cel to min. 20% (${zl(income * 0.2)} miesięcznie). Ustaw stały przelew na oszczędności zaraz po wypłacie.` });
    }
  }

  // Eating out.
  const eat = s.list.filter((t) => t.category === "restauracje" && t.amount < 0);
  if (eat.length >= 8) {
    const sum = eat.reduce((a, t) => a - t.amount, 0);
    out.push({ level: "tip", title: `${eat.length}× jedzenie na mieście/dostawa`, text: `Razem ${zl(sum)}. Połowa mniej zamówień to ok. ${zl(sum / 2)} w kieszeni co miesiąc.`, saving: sum / 2 });
  }

  // Small purchases add up.
  const small = s.list.filter((t) => t.amount < 0 && -t.amount < 30 && ["spozywcze", "restauracje"].includes(t.category));
  if (small.length >= 15) {
    const sum = small.reduce((a, t) => a - t.amount, 0);
    out.push({ level: "tip", title: `${small.length} drobnych zakupów poniżej 30 zł`, text: `Łącznie ${zl(sum)}. Drobne zakupy „po drodze” (np. Żabka, kawa) szybko się sumują — większe zakupy raz w tygodniu wychodzą taniej.` });
  }

  // Subscriptions.
  const subs = recurring(txs, month).filter((r) => r.category === "subskrypcje");
  if (subs.length) {
    const total = subs.reduce((a, r) => a + r.monthly, 0);
    out.push({
      level: "tip",
      title: `Subskrypcje: ${zl(total)} miesięcznie`,
      text: `${subs.map((r) => `${r.name} (${zl(r.monthly)})`).join(", ")}. Sprawdź, z których faktycznie korzystasz — to ${zl(total * 12)} rocznie.`,
    });
  }

  // Emergency fund.
  const avgSpend = prev.count ? prev.spent : s.spent;
  const fund = Number(profile.emergencyFund) || 0;
  if (avgSpend > 0 && fund < avgSpend * 3)
    out.push({
      level: "tip",
      title: "Poduszka finansowa",
      text: `Masz ${zl(fund)}, a bezpiecznie to 3 miesiące wydatków (${zl(avgSpend * 3)}). Zbuduj ją przed nadpłatą tanich długów i inwestowaniem.`,
    });

  // Debts.
  const debts = (profile.debts ?? []).filter((d) => d.balance > 0);
  if (debts.length) {
    const top = [...debts].sort((a, b) => (b.rate || 0) - (a.rate || 0))[0];
    const plan = debtPlan(debts);
    out.push({
      level: top.rate >= 10 ? "warn" : "tip",
      title: `Długi: ${zl(debts.reduce((a, d) => a + Number(d.balance), 0))}`,
      text: plan?.stuck
        ? "Obecne raty nie pokrywają odsetek — dług rośnie. Zwiększ ratę albo porozmawiaj z bankiem o konsolidacji."
        : `Przy obecnych ratach spłata zajmie ok. ${plan.months} mies. (odsetki ~${zl(plan.interest)}). Każdą nadwyżkę kieruj najpierw na „${top.name}” (${top.rate || 0}% — najdroższy).`,
    });
  }

  // Goals.
  for (const g of profile.goals ?? []) {
    const left = (Number(g.target) || 0) - (Number(g.saved) || 0);
    if (left <= 0) {
      out.push({ level: "good", title: `Cel osiągnięty: ${g.name}`, text: "Gratulacje! Ustaw kolejny cel." });
      continue;
    }
    if (g.deadline) {
      const months = Math.max(1, monthsBetween(thisMonth(), monthOf(g.deadline)));
      const need = left / months;
      out.push({
        level: income && need > income * 0.3 ? "warn" : "tip",
        title: `Cel „${g.name}”: odkładaj ${zl(need)}/mies.`,
        text: `Brakuje ${zl(left)}, zostało ${months} mies. do ${g.deadline}.`,
      });
    }
  }

  const order = { warn: 0, tip: 1, good: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level] || (b.saving ?? 0) - (a.saving ?? 0));
}

export function monthsBetween(a, b) {
  const [y1, m1] = a.split("-").map(Number);
  const [y2, m2] = b.split("-").map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Aggregated, anonymous summary for the AI advisor (no merchant-level card data). */
export function summaryForAi(txs, meta, month) {
  const profile = meta?.profile ?? {};
  const months = lastMonths(month, 4);
  return {
    miesiac: month,
    dochod_deklarowany: Number(profile.salary) || null,
    poduszka_finansowa: Number(profile.emergencyFund) || 0,
    cel_oszczedzania_miesiecznie: Number(profile.monthlySavings) || null,
    cele: (profile.goals ?? []).map((g) => ({ nazwa: g.name, cel: g.target, odlozone: g.saved, termin: g.deadline })),
    dlugi: (profile.debts ?? []).map((d) => ({ nazwa: d.name, saldo: d.balance, oprocentowanie: d.rate, rata: d.monthly })),
    limity: Object.fromEntries(Object.entries(profile.limits ?? {}).map(([c, v]) => [cat(c).name, v])),
    miesiace: months.map((m) => {
      const s = monthStats(txs, m);
      return {
        miesiac: m,
        wplywy: Math.round(s.income),
        wydatki: Math.round(s.spent),
        odlozone: Math.round(s.saved),
        kategorie: Object.fromEntries(Object.entries(s.byCat).map(([c, v]) => [cat(c).name, Math.round(v)])),
      };
    }),
    najwieksi_odbiorcy_w_miesiacu: topMerchants(monthStats(txs, month).list, 8).map((m) => ({ nazwa: m.name, suma: Math.round(m.sum), razy: m.count })),
    stale_platnosci: recurring(txs, month).slice(0, 10).map((r) => ({ nazwa: r.name, miesiecznie: Math.round(r.monthly) })),
    dzien_miesiaca: month === thisMonth() ? new Date().getDate() : daysInMonth(month),
  };
}
