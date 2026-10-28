// Monte Carlo for docs/specs/BANNERS.md r2 (carved LR rates, Promise on her own banners, debut schedules). Seeded.
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const R=rng(20261021);
const N=200000;
// one Legend-banner pull: returns 'L' | 'S' | null, mutates st.pity
function legendPull(st, lr, ssr){ const u=R(); if(u<lr){st.pity=0;return 'L';} if(u<lr+ssr){st.pity=0;return 'S';} if(st.pity+1>=90){st.pity=0; return R()<lr/(lr+ssr)?'L':'S';} st.pity++; return null; }
function rates(lr,ssr,n=4e6){const st={pity:0};let L=0,S=0;for(let i=0;i<n;i++){const r=legendPull(st,lr,ssr);if(r==='L')L++;else if(r==='S')S++;}return {LR:+(L/n*100).toFixed(3),SSR:+(S/n*100).toFixed(3),total:+((L+S)/n*100).toFixed(3)};}
// schedule: array of [lr, ssr] per pull on her banner; Promise counts these pulls
function pullsTo(sched,promise=300){const out=[];for(let i=0;i<N;i++){const st={pity:0};let k=0;for(;;){k++;if(promise&&k>=promise)break;const [lr,ssr]=sched(k);if(legendPull(st,lr,ssr)==='L')break;}out.push(k);}out.sort((a,b)=>a-b);const q=p=>out[Math.min(N-1,Math.floor(p*N))];return {median:q(.5),p90:q(.9),p99:q(.99),mean:+(out.reduce((a,b)=>a+b,0)/N).toFixed(1)};}
function within(sched,m,promise=300){let c=0;for(let i=0;i<N;i++){const st={pity:0};let got=false;for(let k=1;k<=m;k++){if(promise&&k>=promise){got=true;break;}const [lr,ssr]=sched(k);if(legendPull(st,lr,ssr)==='L'){got=true;break;}}if(got)c++;}return +(c/N*100).toFixed(1);}
const flat=(lr,ssr)=>()=>[lr,ssr];
const debut=(d)=>(k)=>k<=d?[0.007,0.008]:[0.005,0.010];
console.log('rates standard 0+1.5', rates(0,0.015));
console.log('rates carved 0.5+1.0', rates(0.005,0.010));
console.log('rates carved debut 0.7+0.8', rates(0.007,0.008));
console.log('rates carved 0.4+1.1', rates(0.004,0.011));
console.log('LR 0.5 carved, promise 300', pullsTo(flat(0.005,0.010)), [77,154,231,393].map(m=>within(flat(0.005,0.010),m)));
console.log('LR 0.5 carved, no promise', pullsTo(flat(0.005,0.010),0), [77,154,231].map(m=>within(flat(0.005,0.010),m,0)));
console.log('LR 0.4 carved, promise 300', pullsTo(flat(0.004,0.011)), [77,154,231].map(m=>within(flat(0.004,0.011),m)));
console.log('debut all 0.7 carved', pullsTo(flat(0.007,0.008)), [77,154].map(m=>within(flat(0.007,0.008),m)));
for (const bank of [0,40,80]) { const d=bank+19; console.log(`Tenka bank ${bank}: debut pulls ${d}`, 'month1', within(debut(d), bank+77), 'month2', within(debut(d), bank+154), pullsTo(debut(d))); }
// featured premium SSR 1.0 of 1.5, spark 200
function featWithin(m,share=2/3,spark=200){let c=0;for(let i=0;i<N;i++){let pity=0,got=false;for(let k=1;k<=m;k++){if(spark&&k>=spark){got=true;break;}const hit=pity+1>=90||R()<0.015;if(hit){pity=0;if(R()<share){got=true;break;}}else pity++;}if(got)c++;}return +(c/N*100).toFixed(1);}
console.log('featured 1.0/1.5 spark200 within 77/154/231', [77,154,231].map(m=>featWithin(m)));
// patch gifts sensitivity: pulls per 28 days
for (const rel of [0,1,3,10,18]) console.log(`releases/wk ${rel}: pulls/28d`, (76.7 + rel*100*4/120).toFixed(1));
