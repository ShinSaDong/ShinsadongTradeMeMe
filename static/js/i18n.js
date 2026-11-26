/* 언어 도우미: window.TM_LANG ("ko" | "en"), L(한글, English) */
(function (w) {
  var lang = w.TM_LANG || (document.documentElement.lang || "ko").slice(0, 2);
  w.TM_LANG = lang === "en" ? "en" : "ko";
  w.TM_EN = w.TM_LANG === "en";
  w.L = function (ko, en) { return w.TM_EN && en !== undefined ? en : ko; };
  // 사이트 안 링크에 언어 경로 붙이기: TMLink("/market/") → "/en/market/"
  w.TMLink = function (path) { return w.TM_EN && path.charAt(0) === "/" && path.indexOf("/en/") !== 0 ? "/en" + path : path; };
  w.TM_LOCALE = w.TM_EN ? "en-US" : "ko-KR";
  // 상단 KO/EN 을 직접 누르면 선택한 언어를 1년간 기억 (방문 국가 기본값보다 우선)
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest(".lang-switch a[hreflang]") : null;
    if (!a) return;
    document.cookie = "tm_lang=" + a.getAttribute("hreflang") + "; path=/; max-age=31536000; samesite=lax";
  });
})(window);
