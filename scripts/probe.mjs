const H={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36","Referer":"https://m.stock.naver.com/"};
const urls=[
 "https://m.stock.naver.com/api/index/FUT/integration",
 "https://m.stock.naver.com/api/index/KOSDAQ/integration",
 "https://m.stock.naver.com/api/index/KOSPI/basic",
 "https://m.stock.naver.com/api/index/KPI200/basic",
 "https://m.stock.naver.com/api/index/FUT/trend",
 "https://m.stock.naver.com/api/index/KOSPI/investor",
 "https://m.stock.naver.com/api/index/KOSPI/dealTrend",
 "https://m.stock.naver.com/api/index/KOSPI/program",
 "https://m.stock.naver.com/api/marketindex/exchange/FX_USDKRW",
];
for(const u of urls){try{const r=await fetch(u,{headers:H});const t=await r.text();
 let s=t; try{const j=JSON.parse(t); if(j.enrollStocks) delete j.enrollStocks; if(j.imageCharts) delete j.imageCharts; s=JSON.stringify(j);}catch{}
 console.log('=====',u,r.status);console.log(s.slice(0,1800));}catch(e){console.log('=====',u,'ERR',e.message)}}
