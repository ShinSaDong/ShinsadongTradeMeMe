/* 화면 자동 갱신 주기
 * - 국내 데이터: 장중(평일 09:00~15:30 KST) 1분, 그 외 5분
 * - 바이낸스: 항상 1분 (각 화면에서 별도 처리)
 * 매 분 5초쯤에 갱신해서 막 끝난 1분 봉이 포함되도록 맞춥니다.
 */
(function (root) {
  "use strict";
  const MIN = 60 * 1000;
  function kstNow() {
    const d = new Date(Date.now() + 9 * 3600e3);
    return { dow: d.getUTCDay(), hm: d.getUTCHours() * 100 + d.getUTCMinutes() };
  }
  function isMarketOpen() {
    const { dow, hm } = kstNow();
    return dow >= 1 && dow <= 5 && hm >= 900 && hm <= 1530;
  }
  // 국내 데이터 갱신 주기(ms)
  function krInterval() {
    return isMarketOpen() ? MIN : 5 * MIN;
  }
  // 다음 분 5초까지 남은 시간
  function untilNextMinute() {
    const ms = Date.now() % MIN;
    return (MIN - ms) + 5000;
  }
  // fn 을 1분마다(분 경계에 맞춰) 실행. 화면이 숨겨져 있으면 건너뜀.
  function everyMinute(fn) {
    const tick = () => {
      if (!document.hidden) { try { fn(); } catch (_) {} }
      setTimeout(tick, untilNextMinute());
    };
    setTimeout(tick, untilNextMinute());
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { try { fn(); } catch (_) {} } });
  }
  // 국내 데이터용: 마지막 갱신 후 krInterval() 이 지났는지
  function krDue(lastAt) {
    return !lastAt || Date.now() - lastAt >= krInterval() - 10 * 1000;
  }
  function label() {
    const en = !!root.TM_EN;
    return isMarketOpen() ? (en ? "updating every 1 min (market open)" : "장중 1분 갱신") : (en ? "updating every 5 min (after close)" : "장 마감 후 5분 갱신");
  }
  root.TMRefresh = { isMarketOpen, krInterval, everyMinute, krDue, label };
})(window);
