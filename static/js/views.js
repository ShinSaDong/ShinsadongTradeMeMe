/* 방문자·조회수 표시
   - 메뉴 끝 [data-visits]: 사이트 전체 방문자 (브라우저당 하루 1번 셈)
   - 블로그 글 [data-views="/posts/slug/"]: 글 조회수 (브라우저 탭 세션당 글마다 1번 셈, 한·영 합산)
   - 숫자는 소문자 k 단위: 999 → 999, 1234 → 1.2k, 12345 → 12k */
(function () {
  var s = document.currentScript;
  if (s && s.getAttribute("data-mode") === "static") return; // GitHub Pages 에는 서버가 없음

  function fmt(n) {
    n = +n || 0;
    if (n < 1000) return String(n);
    if (n < 10000) return (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k";
    if (n < 1e6) return Math.floor(n / 1000) + "k";
    return (Math.floor(n / 1e5) / 10).toFixed(1).replace(/\.0$/, "") + "m";
  }
  function store(kind, key, val) {
    try { var st = kind === "l" ? localStorage : sessionStorage; if (val === undefined) return st.getItem(key); st.setItem(key, val); } catch (e) { return null; }
  }
  function key(p) { return p.replace(/^\/en(?=\/)/, ""); }
  function paint(d) {
    if (!d) return;
    document.querySelectorAll("[data-visits]").forEach(function (el) {
      el.querySelector(".n").textContent = fmt(d.total);
      el.title = (window.L ? L("누적 방문자 ", "Total visitors ") : "") + (+d.total || 0).toLocaleString();
      el.hidden = false;
    });
    document.querySelectorAll("[data-views]").forEach(function (el) {
      var n = (d.views || {})[key(el.getAttribute("data-views"))];
      if (n === undefined) return;
      el.querySelector(".n").textContent = fmt(n);
      el.title = (window.L ? L("조회수 ", "Views ") : "") + n.toLocaleString();
      el.hidden = false;
    });
  }

  function run() {
    var today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    var visit = store("l", "tm_visit") !== today;
    var single = document.querySelector("[data-views][data-self]");
    var path = single ? key(single.getAttribute("data-views")) : "";
    var seen = path && store("s", "tm_view:" + path);
    var list = [].map.call(document.querySelectorAll("[data-views]"), function (el) { return key(el.getAttribute("data-views")); });

    var req;
    if (visit || (path && !seen)) {
      req = fetch("/api/hit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: seen ? "" : path, visit: visit }) })
        .then(function (r) { if (!r.ok) throw 0; if (visit) store("l", "tm_visit", today); if (path) store("s", "tm_view:" + path, "1"); return r.json(); });
      // 목록 페이지 등 다른 글 숫자가 더 필요하면 한 번 더 조회
      if (list.length > (path ? 1 : 0)) req = req.then(function (d) { return fetch("/api/views?p=" + encodeURIComponent(list.join(","))).then(function (r) { return r.json(); }).then(function (v) { v.views[path] = d.views[path] || v.views[path]; return v; }); });
    } else {
      req = fetch("/api/views?p=" + encodeURIComponent(list.join(","))).then(function (r) { if (!r.ok) throw 0; return r.json(); });
    }
    req.then(paint).catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
