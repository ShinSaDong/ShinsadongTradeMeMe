import { handleRank } from "../lib/api.js";
import { fetchMinuteBars } from "../lib/naver.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const S = require("../static/js/scalp-engine.js");
const res = await handleRank(new Request("https://x.dev/api/rank?n=50&by=volume&etf=0"));
const j = await res.json();
console.log("RANK status", res.status, "count", j.count, j.error || "");
for (const s of (j.stocks || []).slice(0, 12)) console.log(s.rank, s.code, s.name, s.type, s.price, s.changeRate, s.volume, s.value);
for (const s of (j.stocks || []).slice(0, 5)) {
  const m = await fetchMinuteBars(s.code);
  for (const tf of [1, 3, 5]) {
    const r = S.analyze(m.bars, { tf });
    if (!r.ok) { console.log(s.name, tf, r.reason); continue; }
    console.log(`== ${s.name} ${tf}m bars=${r.bars.length} last=${r.last.c} vwap=${Math.round(r.vwap)} trend=${r.trend.label} action=${r.action.label}`);
    console.log("   timing:", r.timing);
    if (r.best) console.log("   best:", r.best.name, r.best.finalScore, JSON.stringify(r.best.plan));
    for (const sg of r.signals) console.log("   -", sg.no, sg.name, sg.side, sg.holding, S.hhmm(sg.at), sg.score);
  }
}
