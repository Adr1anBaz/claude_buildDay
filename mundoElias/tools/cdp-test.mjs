import { spawn } from 'node:child_process';
const CH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url=process.argv[2]; const PORT=9400+Math.floor(Math.random()*400);
const ch=spawn(CH,['--headless=new','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port='+PORT,'--window-size=1200,800','--user-data-dir=/tmp/cdp-prof-'+Date.now(),'--disable-application-cache','--disk-cache-size=1',url],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let targets; for(let i=0;i<40;i++){ try{ targets=await (await fetch('http://127.0.0.1:'+PORT+'/json')).json(); if(targets.find(t=>t.type==='page')) break; }catch{} await sleep(250); }
const page=targets.find(t=>t.type==='page'); const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r); let id=0; const pend={};
ws.onmessage=e=>{ const m=JSON.parse(e.data); if(m.id&&pend[m.id]) pend[m.id](m); else if(m.method==='Runtime.consoleAPICalled'){ const t=m.params.args.map(a=>a.value??a.description).join(' '); if(/ciclo|reach|selfcheck|meshes|obst|wp\]|Error|error/i.test(t)) console.log('  >', t.slice(0,140)); } };
const send=(method,params={})=>new Promise(r=>{ const i=++id; pend[i]=r; ws.send(JSON.stringify({id:i,method,params})); });
const ev=async(expr,await_=true)=>{ const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:await_,returnByValue:true}); return r.result?.exceptionDetails?('EXC '+JSON.stringify(r.result.exceptionDetails.exception?.description)):r.result?.result?.value; };
await send('Runtime.enable');
for(let i=0;i<100;i++){ const ok=await ev(`!!(window.lab&&window.lab.joints.length===6&&!document.getElementById('loading'))`); if(ok===true) break; await sleep(200); }
console.log('meshes ready. pieza parent:', await ev(`lab.pieza.parent.name`));
const ROUTES=process.env.ROUTES?process.env.ROUTES.split(';').map(r=>r.split(',')):[['P1','cajon-1'],['P2','cajon-4'],['P2','cajon-2']];
for(const [o,d] of ROUTES){
  console.log(`== ${o} → ${d}`); const t0=Date.now();
  await ev(`document.getElementById('vel').value='2'; lab.imprimir('${o}','${d}')`);
  await new Promise(r=>setTimeout(r,1200));
  const info=await ev(`(()=>{ const sl=lab.scene.getObjectByName('${d}-slot'); const sp=sl.getWorldPosition(sl.position.clone()); const pp=lab.pieza.getWorldPosition(lab.pieza.position.clone()); return {dx:+(pp.x-sp.x).toFixed(3),dy:+(pp.y-sp.y).toFixed(3),dz:+(pp.z-sp.z).toFixed(3),parent:lab.pieza.parent.name,body:lab.piezaBody.type,sleep:lab.piezaBody.sleepState}; })()`);
  console.log('  banner:', await ev(`document.getElementById('banner').textContent`), '| pieza rel. slot:', JSON.stringify(info), `| q=${await ev('lab.q.map(v=>v.toFixed(0)).join(",")')}`, `| ${((Date.now()-t0)/1000).toFixed(1)}s`);
}
ws.close(); ch.kill(); process.exit(0);
