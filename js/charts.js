// Small hand-made SVG charts.
import { zl } from "./insights.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Donut: items [{label, value, color}] */
export function donut(items, { size = 200, thickness = 26, center = "", sub = "" } = {}) {
  const total = items.reduce((a, i) => a + i.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const gap = items.length > 1 ? 2 : 0;
  const arcs = total
    ? items
        .map((i) => {
          const len = (i.value / total) * c;
          const dash = Math.max(0, len - gap);
          const el = `<circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="${i.color}" stroke-width="${thickness}"
            stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}"><title>${esc(i.label)}: ${zl(i.value)}</title></circle>`;
          offset += len;
          return el;
        })
        .join("")
    : `<circle r="${r}" cx="${size / 2}" cy="${size / 2}" fill="none" stroke="var(--soft)" stroke-width="${thickness}"/>`;
  return `<svg class="donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="Wydatki według kategorii">
    <g transform="rotate(-90 ${size / 2} ${size / 2})">${arcs}</g>
    <text x="50%" y="47%" text-anchor="middle" class="donut-main">${esc(center)}</text>
    <text x="50%" y="60%" text-anchor="middle" class="donut-sub">${esc(sub)}</text>
  </svg>`;
}

/** Grouped bars per month: [{label, income, spent}] */
export function monthBars(rows, { height = 170 } = {}) {
  const w = 100 / rows.length;
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.spent]));
  const bars = rows
    .map((r, i) => {
      const hi = (r.income / max) * (height - 24);
      const hs = (r.spent / max) * (height - 24);
      const x = i * w;
      return `<g>
        <rect x="${x + w * 0.18}%" y="${height - 20 - hi}" width="${w * 0.3}%" height="${hi}" rx="3" class="bar-income"><title>${esc(r.label)} — wpływy ${zl(r.income)}</title></rect>
        <rect x="${x + w * 0.52}%" y="${height - 20 - hs}" width="${w * 0.3}%" height="${hs}" rx="3" class="bar-spent ${r.current ? "current" : ""}"><title>${esc(r.label)} — wydatki ${zl(r.spent)}</title></rect>
        <text x="${x + w / 2}%" y="${height - 4}" text-anchor="middle" class="axis">${esc(r.label)}</text>
      </g>`;
    })
    .join("");
  return `<svg class="bars" width="100%" height="${height}" role="img" aria-label="Wpływy i wydatki w kolejnych miesiącach">
    <line x1="0" x2="100%" y1="${height - 20}" y2="${height - 20}" class="baseline"/>${bars}</svg>`;
}

/** Daily spend bars with an optional "allowed per day" line. */
export function dailyBars(days, { height = 120, allowed = 0, today = 0 } = {}) {
  const n = days.length;
  const max = Math.max(1, allowed * 1.2, ...days);
  const w = 100 / n;
  const bars = days
    .map((v, i) => {
      const h = (v / max) * (height - 18);
      const cls = today && i + 1 > today ? "future" : allowed && v > allowed ? "over" : "";
      return `<rect x="${i * w + w * 0.15}%" y="${height - 16 - h}" width="${w * 0.7}%" height="${Math.max(h, v ? 2 : 0)}" rx="2" class="bar-day ${cls}"><title>${i + 1}. dzień: ${zl(v)}</title></rect>`;
    })
    .join("");
  const ticks = [1, 8, 15, 22, n].map((d) => `<text x="${(d - 0.5) * w}%" y="${height - 3}" text-anchor="middle" class="axis">${d}</text>`).join("");
  const line = allowed
    ? `<line x1="0" x2="100%" y1="${height - 16 - (allowed / max) * (height - 18)}" y2="${height - 16 - (allowed / max) * (height - 18)}" class="allowed"><title>Na dzień: ${zl(allowed)}</title></line>`
    : "";
  return `<svg class="bars" width="100%" height="${height}" role="img" aria-label="Wydatki dzień po dniu">${bars}${line}${ticks}</svg>`;
}
