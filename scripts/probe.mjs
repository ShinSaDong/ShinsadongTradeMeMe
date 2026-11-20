import { fetchSnapshot, fetchIndexMinute } from "../lib/flow.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const F = require("../static/js/flow-engine.js");
const snap = await fetchSnapshot();
console.log("SNAP", JSON.stringify(snap));
const minutes = {};
for (const [c, k] of [["KOSPI","index"],["KOSDAQ","index"],["FUT","futures"]]) {
  minutes[c] = await fetchIndexMinute(c, k);
  const b = minutes[c].bars; const f = t => new Date(t+9*3600e3).toISOString().slice(11,16);
  console.log("MIN", c, minutes[c].date, b.length, b.length && f(b[0].ts), b.length && f(b.at(-1).ts), b.length && b.at(-1).c);
}
// 실제 마지막 값을 끝점으로 하는 가짜 시계열(0에서 선형 증가)로 엔진 동작 확인
const snaps = [];
for (let i = 1; i <= 12; i++) {
  const s = JSON.parse(JSON.stringify(snap)); s.slot = String(1400 + (i - 1) * 5 + (i > 12 ? 40 : 0)).padStart(4, "0");
  if (+s.slot.slice(2) >= 60) s.slot = String(+s.slot.slice(0,2)+1).padStart(2,"0") + String(+s.slot.slice(2)-60).padStart(2,"0");
  for (const m of Object.values(s.markets)) { if (m.deal) for (const k of ["ind","frg","ins"]) m.deal[k] = m.deal[k] * i / 12; if (m.prog) for (const k of ["arb","nonArb","total"]) m.prog[k] = m.prog[k] * i / 12; }
  snaps.push(s);
}
const r = F.analyzeFlow({ date: snap.bizdate, snaps, minutes });
console.log("OVERALL", r.overall, "KOSPI", r.markets.KOSPI.mood.label, r.markets.KOSPI.mood.score, "KOSDAQ", r.markets.KOSDAQ.mood.label, r.markets.KOSDAQ.mood.score);
for (const s of r.markets.KOSPI.story) console.log("STORY", s);
