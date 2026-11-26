// 방문 국가별 기본 언어
// - 한국(KR) 방문자 → 한국어 페이지 (/...)
// - 그 외 국가 방문자 → 영어 페이지 (/en/...)
// - 방문자가 상단 KO/EN 을 직접 누르면 tm_lang 쿠키에 저장되고, 그때부터는 쿠키를 따름
// - 검색엔진·광고 크롤러는 돌리지 않음 (해외에서 접속하는 구글봇이 한국어 페이지를 못 보는 일 방지)

const BOT_RE = /bot|crawl|spider|slurp|mediapartners|adsbot|google-|bingpreview|yeti|daum|facebookexternalhit|twitterbot|kakaotalk-scrap|telegram|lighthouse|headless|preview/i;

function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

function isPagePath(pathname) {
  if (pathname.startsWith("/api/")) return false;
  const last = pathname.split("/").pop();
  // 확장자가 있는 파일(js, css, 이미지, xml 등)은 제외 — .html 은 페이지로 봄
  return !last.includes(".") || last.endsWith(".html");
}

// 리다이렉트할 주소를 돌려줌 (없으면 null)
export async function geoLangRedirect(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const { pathname } = url;
  if (!isPagePath(pathname)) return null;
  if (url.searchParams.has("nolang")) return null;
  if (BOT_RE.test(request.headers.get("user-agent") || "")) return null;

  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const current = isEn ? "en" : "ko";

  let want = readCookie(request, "tm_lang");
  if (want !== "ko" && want !== "en") {
    const country = request.cf && request.cf.country;
    if (!country || country === "XX" || country === "T1") return null; // 국가를 모르면 그대로
    want = country === "KR" ? "ko" : "en";
  }
  if (want === current) return null;

  const target = new URL(url);
  target.pathname = want === "en" ? "/en" + pathname : pathname.replace(/^\/en(?=\/|$)/, "") || "/";

  // 번역 페이지가 실제로 있을 때만 이동
  const probe = await env.ASSETS.fetch(new Request(target.toString(), { method: "GET" }));
  if (probe.status >= 400) return null;

  return new Response(null, {
    status: 302,
    headers: {
      location: target.pathname + target.search + target.hash,
      "cache-control": "private, no-store",
      vary: "Cookie",
    },
  });
}
