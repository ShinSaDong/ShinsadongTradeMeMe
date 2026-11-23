// Cloudflare Workers 진입점
// - /api/kr, /api/binance, /api/rank, /api/flow 는 서버 코드로 처리
// - 나머지는 Hugo 가 만든 public/ 정적 파일(ASSETS)로 응답
// - 크론(1분마다): 장 시간이면 시장 수급 스냅샷을 FlowStore 에 저장 (1분마다 저장)
import { handleKr, handleBinance, handleRank, handleFlow, handleMonth, handlePush } from "../lib/api.js";
import { fetchSnapshot, inFlowWindow } from "../lib/flow.js";
import { kstDateStr } from "../lib/naver.js";
export { FlowStore } from "./flow-store.js";

const flowStore = (env) => (env.FLOW ? env.FLOW.get(env.FLOW.idFromName("main")) : null);

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" || request.method === "HEAD") {
      if (pathname === "/api/kr") return handleKr(request, (p) => ctx.waitUntil(p));
      if (pathname === "/api/binance") return handleBinance(request);
      if (pathname === "/api/rank") return handleRank(request, (p) => ctx.waitUntil(p));
      if (pathname === "/api/flow") return handleFlow(request, flowStore(env), (p) => ctx.waitUntil(p));
      if (pathname === "/api/month") return handleMonth(request, flowStore(env), (p) => ctx.waitUntil(p));
    }
    if (pathname.startsWith("/api/push/")) return handlePush(request, flowStore(env));
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    const now = event.scheduledTime || Date.now();
    if (!inFlowWindow(now)) return;
    const snap = await fetchSnapshot(fetch, now);
    // 휴장일에는 네이버가 직전 거래일 값을 주므로 오늘 날짜가 아니면 저장하지 않음
    if (snap.bizdate !== kstDateStr(now) || !Object.keys(snap.markets).length) return;
    const store = flowStore(env);
    if (store) {
      await store.add(snap);
      // 장중(평일 09:00~15:30)에는 구독 기기로 웹 푸시 알림
      const k = new Date(now + 9 * 3600e3);
      const hm = k.getUTCHours() * 100 + k.getUTCMinutes();
      if (hm >= 900 && hm <= 1530) await store.runAlerts(snap).catch(() => {});
    }
  },
};
