// 방문자·조회수 시작값 (Cloudflare Web Analytics 2026-11-27 07:52 기준, 지난 30일)
// - 사이트 카운터를 만들기 전 기록을 한 번만 더해 넣음
// - version 이 바뀌면 values 를 한 번 더 "더함" → 나중에 보정할 때는 version 을 새로 바꾸고 차이값만 넣을 것
export const HIT_SEED = {
  version: "cf-web-analytics-2026-11-27",
  values: {
    __visits: 2130,                                   // 전체 방문 2.13k
    "/posts/2026-11-18-binance-long-short-guide/": 70,
    "/posts/2026-11-20-scalping-patterns/": 50,
    "/posts/2026-11-23-update-notes/": 50,
  },
};
