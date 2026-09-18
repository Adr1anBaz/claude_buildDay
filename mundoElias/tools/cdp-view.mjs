import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; const [url,out]=process.argv.slice(2);
const ch=spawn(CH,['--headless=new','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9335','--window-size=1400,900','--user-data-dir=/tmp/cdp-prof3',url],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let targets; for(let i=0;i<40;i++){ try{ targets=await (await fetch('http://127.0.0.1:9335/json')).json(); if(targets.find(t=>t.type==='page')) break; }catch{} await sleep(250); }
const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pend={}; ws.onmessage=e=>{ const m=JSON.parse(e.data); if(m.id&&pend[m.id]) pend[m.id](m); };
const send=(method,params={})=>new Promise(r=>{ const i=++id; pend[i]=r; ws.send(JSON.stringify({id:i,method,params})); });
const ev=(expr,a=true)=>send('Runtime.evaluate',{expression:expr,awaitPromise:a,returnByValue:true}).then(r=>r.result?.result?.value);
await ev(`new Promise(r=>{ const t=setInterval(()=>{ if(!document.getElementById('loading')){clearInterval(t);r(1);} },100); })`); await sleep(1500);
const s=await send('Page.captureScreenshot',{format:'png'}); writeFileSync(out,Buffer.from(s.result.data,'base64'));
ws.close(); ch.kill(); process.exit(0);
