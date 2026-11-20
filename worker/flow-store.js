// 5분 수급 스냅샷 저장소 (Durable Object, SQLite)
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
  }

  // 같은 날·같은 5분 슬롯은 마지막 값으로 덮어씀
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

  days(limit = 20) {
    return this.sql.exec("SELECT day, COUNT(*) AS n FROM snap GROUP BY day ORDER BY day DESC LIMIT ?", limit).toArray();
  }
}
