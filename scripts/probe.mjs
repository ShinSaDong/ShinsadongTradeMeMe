const H={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36","Referer":"https://finance.naver.com/"};
const d="20261120";
const urls=[
 `https://finance.naver.com/sise/investorDealTrendTime.naver?bizdate=${d}&sosok=01`,
 `https://finance.naver.com/sise/investorDealTrendTime.naver?bizdate=${d}&sosok=02`,
 `https://finance.naver.com/sise/investorDealTrendTime.naver?bizdate=${d}&sosok=03`,
 `https://finance.naver.com/sise/investorDealTrendTime.naver?bizdate=${d}&sosok=04`,
 `https://finance.naver.com/sise/programDealTrendTime.naver?bizdate=${d}&sosok=01`,
 `https://m.stock.naver.com/api/index/KOSPI/integration`,
 `https://m.stock.naver.com/api/index/KOSPI/trend`,
 `https://api.stock.naver.com/chart/domestic/index/KOSPI/minute`,
 `https://api.stock.naver.com/chart/domestic/futures/FUT/minute`,
 `https://m.stock.naver.com/api/index/FUT/basic`,
 `https://m.stock.naver.com/api/futures/FUT/basic`,
 `https://finance.naver.com/sise/sise_index.naver?code=FUT`,
];
for(const u of urls){try{const r=await fetch(u,{headers:H});const b=Buffer.from(await r.arrayBuffer());let t;
 const ct=r.headers.get('content-type')||''; t=/euc-kr/i.test(ct)||u.includes('finance.naver.com')?new TextDecoder('euc-kr').decode(b):b.toString('utf8');
 if(u.includes('finance.naver.com')){t=t.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');const i=t.search(/시간|개인|프로그램|선물/);t=t.slice(Math.max(0,i-200),i+1800);}
 console.log('=====',u,r.status,b.length,ct);console.log(t.slice(0,2000));}catch(e){console.log('=====',u,'ERR',e.message)}}
