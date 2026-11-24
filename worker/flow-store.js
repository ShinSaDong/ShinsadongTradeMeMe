// 1분 수급 스냅샷 저장소 (Durable Object, SQLite)
// 무료 요금제에서 쓸 수 있는 SQLite 기반 Durable Object 하나에 모든 스냅샷을 저장합니다.
import { DurableObject } from "cloudflare:workers";
import { generateVapid, sendPush } from "../lib/webpush.js";
import AlertEngine from "../static/js/alert-engine.js";
import Flow from "../static/js/flow-engine.js";

const PUSH_SUBJECT = "https://shinsadongtradememe.com";
const MAX_SUBS = 300;

export class FlowStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS snap (
      day TEXT NOT NULL,
      slot TEXT NOT NULL,
      ts INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (day, slot)
    )`);
    // 달력용: 지난 거래일의 일별 요약(네이버 일별 투자자 매매). 한 번 받으면 다시 안 받음
    // 웹 푸시: 서버 키(VAPID)와 구독 기기 목록
    this.sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS push_sub (
      id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
      cfg TEXT NOT NULL, state TEXT, created INTEGER NOT NULL
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS daily (
      day TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )`);
  }

  // 같은 날·같은 1분 슬롯은 마지막 값으로 덮어씀
  add(snap) {
    this.sql.exec("INSERT OR REPLACE INTO snap (day, slot, ts, data) VALUES (?, ?, ?, ?)",
      snap.bizdate, snap.slot, snap.ts, JSON.stringify(snap));
    // 60일 넘은 데이터 정리
    const cutoff = new Date(Date.now() - 60 * 86400e3 + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
    this.sql.exec("DELETE FROM snap WHERE day < ?", cutoff);
    return true;
  }

  day(day) {
    return this.sql.exec("SELECT data FROM snap WHERE day = ? ORDER BY slot", day).toArray().map((r) => JSON.parse(r.data));
  }

  // ym("YYYYMM") 달의 날짜별 마지막 스냅샷
  monthLast(ym) {
    return this.sql.exec(
      `SELECT s.data FROM snap s JOIN (SELECT day, MAX(slot) AS m FROM snap WHERE day LIKE ? GROUP BY day) t
       ON s.day = t.day AND s.slot = t.m`, ym + "%").toArray().map((r) => JSON.parse(r.data));
  }

  getDaily(ym) {
    const out = {};
    for (const r of this.sql.exec("SELECT day, data FROM daily WHERE day LIKE ?", ym + "%").toArray()) out[r.day] = JSON.parse(r.data);
    return out;
  }

  putDaily(rows) {
    for (const [day, data] of rows) this.sql.exec("INSERT OR REPLACE INTO daily (day, data) VALUES (?, ?)", day, JSON.stringify(data));
    return true;
  }

  // ---------- 웹 푸시 ----------
  async vapid() {
    const row = this.sql.exec("SELECT v FROM kv WHERE k = 'vapid'").toArray()[0];
    if (row) return JSON.parse(row.v);
    const v = await generateVapid();
    this.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('vapid', ?)", JSON.stringify(v));
    return v;
  }
  async vapidPublic() { return (await this.vapid()).publicKey; }

  async subId(endpoint) {
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)));
    return [...h.slice(0, 12)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }

  async subUpsert(sub, cfg) {
    const id = await this.subId(sub.endpoint);
    const exists = this.sql.exec("SELECT id FROM push_sub WHERE id = ?", id).toArray().length > 0;
    if (!exists) {
      const n = this.sql.exec("SELECT COUNT(*) AS n FROM push_sub").toArray()[0].n;
      if (n >= MAX_SUBS) return { ok: false, error: "구독 기기 수가 가득 찼습니다" };
    }
    this.sql.exec(`INSERT INTO push_sub (id, endpoint, p256dh, auth, cfg, state, created) VALUES (?, ?, ?, ?, ?, NULL, ?)
      ON CONFLICT(id) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, cfg = excluded.cfg`,
      id, sub.endpoint, sub.keys.p256dh, sub.keys.auth, JSON.stringify(cfg || {}), Date.now());
    return { ok: true };
  }

  async subConfig(endpoint, cfg) {
    const id = await this.subId(endpoint);
    this.sql.exec("UPDATE push_sub SET cfg = ? WHERE id = ?", JSON.stringify(cfg || {}), id);
    return { ok: this.sql.exec("SELECT id FROM push_sub WHERE id = ?", id).toArray().length > 0 };
  }

  async subRemove(endpoint) {
    this.sql.exec("DELETE FROM push_sub WHERE id = ?", await this.subId(endpoint));
    return { ok: true };
  }

  async subTest(endpoint) {
    const id = await this.subId(endpoint);
    const row = this.sql.exec("SELECT * FROM push_sub WHERE id = ?", id).toArray()[0];
    if (!row) return { ok: false, error: "이 기기는 구독되어 있지 않습니다" };
    let en = false;
    try { en = JSON.parse(row.cfg || "{}").lang === "en"; } catch {}
    const msg = en
      ? { title: "ShinsadongTradeMeMe test alert", body: "Push notifications are working.", url: "/en/", tag: "test" }
      : { title: "ShinsadongTradeMeMe 테스트 알림", body: "푸시 알림이 정상적으로 도착했습니다.", url: "/", tag: "test" };
    const status = await sendPush(row, msg, await this.vapid(), PUSH_SUBJECT);
    if (status === 404 || status === 410) this.sql.exec("DELETE FROM push_sub WHERE id = ?", id);
    return { ok: status >= 200 && status < 300, status };
  }

  // 크론에서 스냅샷 저장 직후 호출: 구독 기기마다 조건을 확인해 알림 전송
  async runAlerts(snap) {
    const subs = this.sql.exec("SELECT * FROM push_sub").toArray();
    if (!subs.length) return { sent: 0 };
    const hist = this.sql.exec("SELECT data FROM snap WHERE day = ? AND ts >= ? AND ts < ? ORDER BY ts", snap.bizdate, snap.ts - 20 * 60e3, snap.ts - 1000)
      .toArray().map((r) => AlertEngine.pointOf(JSON.parse(r.data)));
    const vapid = await this.vapid();
    let sent = 0;
    for (const s of subs) {
      let cfg = {}, state = null;
      try { cfg = JSON.parse(s.cfg || "{}"); state = s.state ? JSON.parse(s.state) : null; } catch (_) {}
      const r = AlertEngine.evaluate({ snap, hist, state, cfg, now: snap.ts, Flow });
      let gone = false;
      for (const e of r.events.slice(0, 5)) {
        try {
          const st = await sendPush(s, { title: e.title, body: e.body, url: e.url, tag: e.key }, vapid, PUSH_SUBJECT);
          if (st === 404 || st === 410) { gone = true; break; }
          if (st < 300) sent++;
        } catch (_) {}
      }
      if (gone) this.sql.exec("DELETE FROM push_sub WHERE id = ?", s.id);
      else this.sql.exec("UPDATE push_sub SET state = ? WHERE id = ?", JSON.stringify(r.state), s.id);
    }
    return { sent };
  }

  days(limit = 20) {
    return this.sql.exec("SELECT day, COUNT(*) AS n FROM snap GROUP BY day ORDER BY day DESC LIMIT ?", limit).toArray();
  }
}
