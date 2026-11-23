// 1분 수급 스냅샷 저장소 (Durable Object, SQLite)
// 무료 요금제에서 쓸 수 있는 SQLite 기반 Durable Object 하나에 모든 스냅샷을 저장합니다.
import { DurableObject } from "cloudflare:workers";

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

  days(limit = 20) {
    return this.sql.exec("SELECT day, COUNT(*) AS n FROM snap GROUP BY day ORDER BY day DESC LIMIT ?", limit).toArray();
  }
}
