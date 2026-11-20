const H={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36","Referer":"https://m.stock.naver.com/"};
const urls=[
 "https://m.stock.naver.com/api/stocks/quantTop/KOSPI?page=1&pageSize=5",
 "https://m.stock.naver.com/api/stocks/quantTop/KOSDAQ?page=1&pageSize=5",
 "https://m.stock.naver.com/api/stocks/marketValue/KOSPI?page=1&pageSize=3",
 "https://m.stock.naver.com/api/stocks/priceTop/KOSPI?page=1&pageSize=3",
 "https://m.stock.naver.com/api/stocks/up/KOSPI?page=1&pageSize=3",
 "https://m.stock.naver.com/api/stocks/searchTop/KOSPI?page=1&pageSize=3",
 "https://finance.naver.com/sise/sise_quant.naver?sosok=0",
 "https://m.stock.naver.com/api/stock/005930/basic",
];
for(const u of urls){try{const r=await fetch(u,{headers:H});const b=Buffer.from(await r.arrayBuffer());let t=b.toString('utf8');if(u.includes('finance.naver.com/sise')){t=new TextDecoder('euc-kr').decode(b);const i=t.indexOf('type_2');t=t.slice(i,i+2500);}console.log('=====',u,r.status,b.length);console.log(t.slice(0,2500));}catch(e){console.log('=====',u,'ERR',e.message)}}
