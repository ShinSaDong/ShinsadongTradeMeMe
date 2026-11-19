# ShinsadongTradeMeMe

바이낸스 국내주식 무기한 선물의 **5분 롱/숏 비율**과 국내 장의 **5분 매수·매도 비율**, **개인·외국인·기관 수급**을 나란히 비교하는 투자 참고용 블로그입니다.

- 사이트: https://shinsadongtradememe.com (도메인 연결 후)
- 스택: Hugo(정적 블로그) + Cloudflare Pages(호스팅) + Pages Functions(국내 데이터 프록시)

## 구조

```
content/            블로그 글(마크다운), 소개/개인정보처리방침/연락처, 대시보드 페이지
  posts/            ← 새 글은 여기에 .md 파일로 추가
data/symbols.yaml   대시보드 종목 목록 (국내 코드 ↔ 바이낸스 심볼)
layouts/            Hugo 템플릿 (자체 테마)
static/js/          dashboard.js(화면), analysis.js(5분 집계·비교 계산)
functions/api/      Cloudflare Pages Functions
  kr.js             /api/kr?code=005930&type=minute|investor  (네이버 금융 → JSON)
  binance.js        /api/binance?path=...  (바이낸스 직접 호출 실패 시 예비 프록시)
lib/naver.js        네이버 응답 파싱 (소스 2개씩, 자동 폴백)
```

## 데이터 흐름

| 데이터 | 출처 | 방식 | 갱신 |
|---|---|---|---|
| 바이낸스 가격(5분 봉) | `fapi/v1/klines` | 방문자 브라우저 → 바이낸스 직접 | 5분 |
| 롱/숏 계정 비율 | `futures/data/globalLongShortAccountRatio` | 〃 | 5분 |
| 상위 트레이더 포지션 비율 | `futures/data/topLongShortPositionRatio` | 〃 | 5분 |
| 테이커 매수/매도 | `futures/data/takerlongshortRatio` | 〃 | 5분 |
| 국내 1분 봉 → 5분 매수/매도 추정 | 네이버 금융 분봉 | `/api/kr` (60초 캐시) | 5분 |
| 개인·외국인·기관 순매수 | 네이버 금융 투자자별 매매동향 | `/api/kr` (10분 캐시) | 일별 |

- 바이낸스 API는 CORS(`access-control-allow-origin: *`)를 허용해서 서버 없이 브라우저에서 바로 호출합니다.
- 국내 **매수·매도 비율은 추정치**입니다. 1분 봉 종가가 직전보다 오르면 매수 주도, 내리면 매도 주도로 보고 거래량을 나눕니다(틱 규칙). 증권사 체결강도와 비슷한 개념입니다.
- 바이낸스에 새 국내 종목이 상장되면 `data/symbols.yaml`의 `detect` 키워드로 자동 연결됩니다.

## Cloudflare Workers 배포 (현재 운영)

- 주소: https://shinsadongtradememe.sin8361.workers.dev
- GitHub `main`에 push하면 Cloudflare Workers Builds가 자동으로 `npx wrangler deploy`를 실행합니다.
- `wrangler.jsonc`의 `build.command`가 Hugo(npm `hugo-extended@0.139.4`)로 `public/`을 만들고, `worker/index.js`가 `/api/kr`, `/api/binance`를 처리합니다. 나머지는 정적 파일로 응답합니다.
- 대시보드 Build command는 비워두고, Deploy command는 `npx wrangler deploy`로 둡니다. `HUGO_VERSION` 변수는 필요 없습니다.
- Worker 이름(`wrangler.jsonc`의 `name`)은 대시보드의 Worker 이름 `shinsadongtradememe`와 같아야 합니다.

## GitHub Pages로 먼저 보기 (테스트용)

- 주소: https://shinsadong.github.io/ShinsadongTradeMeMe/
- `.github/workflows/pages.yml`이 main에 push할 때마다, 그리고 평일 장중에는 5분마다 자동으로 빌드·배포합니다.
- GitHub Pages는 서버 함수가 없어서, 국내 데이터는 배포할 때 `scripts/fetch-kr.mjs`가 미리 받아 정적 JSON으로 넣습니다. 그래서 국내 데이터는 **5~15분 정도 늦을 수 있습니다** (GitHub 예약 실행 지연). 바이낸스 데이터는 브라우저에서 실시간으로 받습니다.
- 수동 갱신: GitHub 리포 → Actions → Deploy to GitHub Pages → Run workflow
- Cloudflare로 옮기면 국내 데이터도 `/api/kr` 함수로 실시간 조회됩니다. 옮긴 뒤에는 워크플로를 꺼도 됩니다.

## Cloudflare Pages 배포

1. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git** → 이 리포 선택
2. 빌드 설정
   - Framework preset: **Hugo**
   - Build command: `hugo --minify`
   - Build output directory: `public`
   - 환경 변수: `HUGO_VERSION` = `0.139.4`
3. 배포 후 `xxx.pages.dev`에서 동작 확인
4. **Custom domains**에서 `shinsadongtradememe.com` 추가 (Cloudflare에서 산 도메인이면 DNS·HTTPS 자동)
5. `hugo.toml`의 `baseURL`이 실제 도메인과 같은지 확인

## 글 쓰기

`content/posts/`에 아래 형식으로 파일을 만들고 push하면 1~2분 안에 사이트에 반영됩니다.

```markdown
---
title: "제목"
date: 2026-11-18T20:00:00+09:00
description: "검색 결과에 나올 요약"
tags: ["삼성전자", "수급"]
---

본문...
```

## 애드센스

1. 글이 15~20개 이상 쌓이면 Google AdSense 신청 (소개·개인정보처리방침·연락처 페이지는 이미 있음)
2. 승인 후 `hugo.toml`의 `adsenseClient`에 `ca-pub-...` 입력 → 자동 광고 스크립트가 전 페이지에 삽입
3. 수동 광고 단위를 쓰려면 `[params]`에 `adsenseSlot = "1234567890"` 추가
4. 애드센스가 안내하는 `ads.txt` 내용을 `static/ads.txt`로 저장
5. `hugo.toml`의 `contactEmail`을 실제 이메일로 변경

## 로컬 미리보기

```bash
hugo server            # 블로그만 (http://localhost:1313)
npx wrangler pages dev -- hugo server   # /api/kr 함수까지 함께
```

## 주의

- 네이버 금융 엔드포인트는 비공식이라 형식이 바뀌거나 막힐 수 있습니다. 파서는 필드명을 느슨하게 찾고 소스 2개를 순서대로 시도합니다. 장기적으로는 한국투자증권 Open API 등 공식 데이터로 바꾸는 것을 권장합니다(수익형 사이트에서 네이버 데이터를 재가공해 게시하는 것은 네이버 이용약관 검토가 필요합니다).
- 바이낸스 국내주식 선물은 한국 거주자는 거래할 수 없는 상품이며, 이 사이트는 공개 시장 데이터를 참고 지표로만 보여줍니다.
- 모든 내용은 투자 참고용이며 투자 권유가 아닙니다.
