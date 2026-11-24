/* 언어 도우미: window.TM_LANG ("ko" | "en"), L(한글, English) */
(function (w) {
  var lang = w.TM_LANG || (document.documentElement.lang || "ko").slice(0, 2);
  w.TM_LANG = lang === "en" ? "en" : "ko";
  w.TM_EN = w.TM_LANG === "en";
  w.L = function (ko, en) { return w.TM_EN && en !== undefined ? en : ko; };
  // 사이트 안 링크에 언어 경로 붙이기: TMLink("/market/") → "/en/market/"
  w.TMLink = function (path) { return w.TM_EN && path.charAt(0) === "/" && path.indexOf("/en/") !== 0 ? "/en" + path : path; };
  w.TM_LOCALE = w.TM_EN ? "en-US" : "ko-KR";
})(window);
