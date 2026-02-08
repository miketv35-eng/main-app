export const CYCLE = ["day", "day", "night", "night", "off", "off", "off", "off"];
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d) };
export const ad = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r };
export const df = (a, b) => Math.round((b - a) / (1000 * 60 * 60 * 24));
export const ws = d => { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0, 0, 0, 0); return r };
export const wl = d => { const s = ws(d), e = ad(s, 6); return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` };
export const cd = (a, t) => { const dif = df(a, t); return Math.floor(dif % 8 + 8) % 8 };
export const stype = (a, t) => { const i = cd(a, t); return CYCLE[i] };
export const bstart = (a, d) => { const i = cd(a, d); return i < 4 ? ad(d, -i) : null };
