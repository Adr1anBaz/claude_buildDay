// @ts-nocheck — WS-2 · Elías: gemelo digital (UR3 + Bambu P1/P2), portado tal cual de
// mundoElias/index.html (rama mundoElias, bf91bc1) a módulo del frontend por WS-0 en la integración M2.
// La lógica de escena, IK, física y colisiones es la de Elías sin cambios; lo que cambió está marcado
// en la sección 8 y en `imprimir(origen, destino, opts)` (ritmo del servidor, pieza por job).
// TODO(DT-0-13): tipar este archivo; hoy va sin chequeo de TypeScript para no reescribir el código de Elías.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import URDFLoader from 'urdf-loader';
import * as CANNON from 'cannon-es';

const MARCADO = '<div id="lab-toolbar"><button id="volver" class="btn">← Volver</button></div>\n<button id="reset"  class="btn">Reset cámara</button>\n<div id="loading">CARGANDO URDF UR3 …</div>\n\n<aside id="panel">\n  <h2>Panel B · Operación <span>Pick &amp; Place</span></h2>\n  <div class="sel"><label>Origen</label><select id="origen"><option value="P1">Impresora 1 (P1)</option><option value="P2">Impresora 2 (P2)</option></select></div>\n  <div class="sel"><label>Destino</label><select id="destino"><option value="cajon-1">Caja 1</option><option value="cajon-2">Caja 2</option><option value="cajon-3">Caja 3</option><option value="cajon-4">Caja 4</option></select></div>\n  <div class="sel"><label>Velocidad</label><select id="vel"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></div>\n  <div class="row">\n    <button class="btn primary" id="start">Iniciar simulación</button>\n    <button class="btn danger" id="stop">Stop</button>\n  </div>\n  <div id="banner">EN ESPERA</div>\n  <hr>\n  <h2>Panel A · Jogging <span>UR3</span></h2>\n  <div id="joints"></div>\n  <div class="j"><label>Gripper</label><input type="range" id="grip" min="0" max="100" value="100" step="1"><input type="number" id="grip-n" min="0" max="100" value="100" step="1"></div>\n  <hr>\n  <h2>TCP · FK (T6_0) <span>mm / rad</span></h2>\n  <div class="tcp" id="tcp"></div>\n  <div class="row">\n    <button class="btn" id="home">Homing</button>\n    <label class="chk"><input type="checkbox" id="ax-base"> Base frame</label>\n    <label class="chk"><input type="checkbox" id="ax-tcp"> TCP frame</label>\n    <label class="chk"><input type="checkbox" id="trail" checked> Trayectoria</label>\n    <label class="chk"><input type="checkbox" id="colviz"> Esferas colisión</label>\n  </div>\n  <div id="colstate" class="ok">sin colisión</div>\n  <p class="note">Modelo: ur3.urdf + mallas Collada locales, articulado vía urdf-loader. DH UR3: D1 151.9 · A2 −243.65 · A3 −213.25 · D4 112.35 · D5 85.35 · D6 81.9 mm. Home <code>[0,−90,0,−90,0,0]</code>. Impresoras: Bambu Lab X1C/P1S 389×389×457 mm + AMS.</p>\n</aside>\n<div id="estado"><b>LAB</b> · UR3 (500 mm) · Bambu P1 · P2 · 4 cajas · celda 2×2 m · banco 1.00 m</div>';

export function crearMundo(root, opciones) {
root.innerHTML = MARCADO;
const $ = (id) => root.querySelector('#' + id);
const frameCbs = new Set();


/* ============================== 0. Constantes ============================== */
const TABLE_H = 1.00;
const COLOR = { p1:0x2b6fd6, p2:0xd6742b, bg:0x0a0d12 };
const HOME  = [0,-90,0,-90,0,0];
const JOINT_NAMES = ['Base','Shoulder','Elbow','Wrist 1','Wrist 2','Wrist 3'];
const JOINT_IDS   = ['shoulder_pan','shoulder_lift','elbow','wrist_1','wrist_2','wrist_3'];
const URDF_PKG = '/lab/ur3/models/ur_description/'; const URDF_FILE = URDF_PKG+'urdf/ur3.urdf';
const DH = [
  { a: 0,       d: 0.1519,  alpha:  Math.PI/2 },
  { a:-0.24365, d: 0,       alpha:  0 },
  { a:-0.21325, d: 0,       alpha:  0 },
  { a: 0,       d: 0.11235, alpha:  Math.PI/2 },
  { a: 0,       d: 0.08535, alpha: -Math.PI/2 },
  { a: 0,       d: 0.0819,  alpha:  0 },
];
const ROBOT_POS = new THREE.Vector3(0, TABLE_H, -0.525);
const GRIP_LEN  = 0.135;   // flange → centro de pieza sujetada (m)

/* ============================== 1. FK ============================== */
function dhMatrix(theta,{a,d,alpha}){
  const ct=Math.cos(theta),st=Math.sin(theta),ca=Math.cos(alpha),sa=Math.sin(alpha);
  return new THREE.Matrix4().set(ct,-st*ca,st*sa,a*ct, st,ct*ca,-ct*sa,a*st, 0,sa,ca,d, 0,0,0,1);
}
function fkMatrix(qDeg){ const T=new THREE.Matrix4(); for(let i=0;i<6;i++) T.multiply(dhMatrix(THREE.MathUtils.degToRad(qDeg[i]),DH[i])); return T; }
function forwardKinematics(qDeg){
  const T=fkMatrix(qDeg);
  const pos=new THREE.Vector3().setFromMatrixPosition(T);
  const qt=new THREE.Quaternion().setFromRotationMatrix(T).normalize();
  let angle=2*Math.acos(THREE.MathUtils.clamp(qt.w,-1,1)); const s=Math.sqrt(Math.max(0,1-qt.w*qt.w));
  let axis=s<1e-9?new THREE.Vector3():new THREE.Vector3(qt.x/s,qt.y/s,qt.z/s);
  if(angle>Math.PI){angle=2*Math.PI-angle;axis.negate();}
  const rv=axis.multiplyScalar(angle);
  return { pos:[pos.x*1000,pos.y*1000,pos.z*1000], rotvec:[rv.x,rv.y,rv.z], T };
}

/* ============================== 2. IK numérica (DLS) ==============================
   Objetivo: posición del flange (frame DH base) + eje Z6 alineado con `zAxis`.
   θ6 queda libre (5 residuos). Semilla = postura actual → solución continua.   */
function ikSolve(targetPos, zAxis, q0, {iters=300, lambda=0.05, tol=5e-4, prior=null, wPrior=0.03, priorIters=80}={}){
  const q=q0.slice(); const D2R=Math.PI/180; let wP=wPrior;   // el prior se apaga tras priorIters → convergencia exacta
  const res=q=>{ const T=fkMatrix(q); const p=new THREE.Vector3().setFromMatrixPosition(T);
    const z=new THREE.Vector3().setFromMatrixColumn(T,2); const e=z.clone().sub(zAxis); // diferencia de ejes: distingue paralelo (0) de antiparalelo (2)
    const r=[targetPos.x-p.x,targetPos.y-p.y,targetPos.z-p.z, -e.x*0.25,-e.y*0.25,-e.z*0.25];
    if(prior&&wP>0) for(let j=0;j<6;j++) r.push(wP*(prior[j]-q[j])*D2R);   // prior de postura: elige rama en la fase inicial
    return r; };
  const taskErr=r=>Math.hypot(r[0],r[1],r[2],r[3],r[4],r[5]);
  for(let it=0;it<iters;it++){
    if(it===priorIters) wP=0;
    const r=res(q); const n=taskErr(r); if(n<tol) return {q,ok:true,err:n};
    const J=[]; const h=1e-3;
    for(let j=0;j<6;j++){ const qh=q.slice(); qh[j]+=THREE.MathUtils.radToDeg(h); const rh=res(qh); J.push(r.map((v,i)=>(v-rh[i])/h)); } // ∂r/∂θ_j (rad)
    // Δθ = Jᵀ (J Jᵀ + λ²I)⁻¹ r
    const m=r.length; const A=Array.from({length:m},()=>new Array(m).fill(0));
    for(let i=0;i<m;i++) for(let k=0;k<m;k++){ let s=0; for(let j=0;j<6;j++) s+=J[j][i]*J[j][k]; A[i][k]=s+(i===k?lambda*lambda:0); }
    const y=solve(A,r); if(!y) break;
    for(let j=0;j<6;j++){ let s=0; for(let i=0;i<m;i++) s+=J[j][i]*y[i]; q[j]+=THREE.MathUtils.radToDeg(THREE.MathUtils.clamp(s,-0.2,0.2)); }
  }
  const n=taskErr(res(q)); return {q,ok:n<tol*4,err:n};
}
function solve(A,b){ const n=b.length; const M=A.map((r,i)=>[...r,b[i]]);
  for(let c=0;c<n;c++){ let p=c; for(let r=c+1;r<n;r++) if(Math.abs(M[r][c])>Math.abs(M[p][c])) p=r; [M[c],M[p]]=[M[p],M[c]];
    if(Math.abs(M[c][c])<1e-12) return null; for(let r=0;r<n;r++){ if(r===c) continue; const f=M[r][c]/M[c][c]; for(let k=c;k<=n;k++) M[r][k]-=f*M[c][k]; } }
  return M.map((r,i)=>r[n]/r[i]); }

/* ============================== 3. Escena ============================== */
const scene=new THREE.Scene(); scene.background=new THREE.Color(COLOR.bg);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,0.05,60);
const CAM_POS=new THREE.Vector3(2.5,2.3,2.3), CAM_TGT=new THREE.Vector3(0.0,TABLE_H,-0.35);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
root.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enablePan=false; controls.enableDamping=true; controls.dampingFactor=0.08;
controls.minDistance=0.6; controls.maxDistance=8; controls.maxPolarAngle=Math.PI/2-0.03;
function resetCamera(){ camera.position.copy(CAM_POS); controls.target.copy(CAM_TGT); controls.update(); } resetCamera();

scene.add(new THREE.HemisphereLight(0xdfe7f5,0x1a1d22,0.55));
const sun=new THREE.DirectionalLight(0xffffff,1.6); sun.position.set(1.6,4.2,1.2); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0005; Object.assign(sun.shadow.camera,{left:-2.5,right:2.5,top:2.5,bottom:-2.5,near:0.5,far:10}); scene.add(sun);
const fill=new THREE.PointLight(0xdfe7f5,12,10,1.6); fill.position.set(-1.2,2.4,2.2); scene.add(fill);
const spot=new THREE.SpotLight(0xffffff,25,8,0.6,0.5,1.5); spot.position.set(0.3,3.2,-0.4); spot.target.position.set(0.1,1,-0.5); scene.add(spot,spot.target);

const M={
  floor:new THREE.MeshStandardMaterial({color:0x15191f,roughness:0.9}),
  wall:new THREE.MeshStandardMaterial({color:0x12161b,roughness:1}),
  bench:new THREE.MeshStandardMaterial({color:0x8a8f96,roughness:0.55,metalness:0.1}),
  benchEdge:new THREE.MeshStandardMaterial({color:0x2c3138,roughness:0.6,metalness:0.3}),
  leg:new THREE.MeshStandardMaterial({color:0x23272e,roughness:0.5,metalness:0.5}),
  bin:new THREE.MeshStandardMaterial({color:0x2f6fbf,roughness:0.6}),
  pieza:new THREE.MeshStandardMaterial({color:0x3ecf8e,roughness:0.5}),
  green:new THREE.MeshStandardMaterial({color:0x1d6a45,roughness:0.9}),
  human:new THREE.MeshStandardMaterial({color:0x6b7380,roughness:0.8}),
  ledOff:new THREE.MeshStandardMaterial({color:0x40454d,roughness:0.4}),
  ledOn:new THREE.MeshStandardMaterial({color:0x3ecf8e,emissive:0x3ecf8e,emissiveIntensity:1.2}),
  ledBusy:new THREE.MeshStandardMaterial({color:0x2b6fd6,emissive:0x2b6fd6,emissiveIntensity:1.0}),
  grip:new THREE.MeshStandardMaterial({color:0x2a2e34,roughness:0.45,metalness:0.6}),
  gripAlu:new THREE.MeshStandardMaterial({color:0xb8bec8,roughness:0.35,metalness:0.7}),
};
function makeLabel(text,{color='#e6eaf0',w=0.12,h=0.12,font=140,weight=600}={}){
  const c=document.createElement('canvas'); c.width=512; c.height=512; const g=c.getContext('2d');
  g.fillStyle=color; g.font=`${weight} ${font*2}px "IBM Plex Mono", monospace`; g.textAlign='center'; g.textBaseline='middle'; g.fillText(text,256,272);
  const tex=new THREE.CanvasTexture(c); tex.anisotropy=8; tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
}
function box(w,h,d,mat,{x=0,y=0,z=0,shadow=true,obs=null,phys=false}={}){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=shadow; m.receiveShadow=true;
  if(obs) m.userData.obstacle=obs; if(phys) m.userData.phys=true; return m; }

const lab=new THREE.Group(); lab.name='lab'; scene.add(lab);
/* Sala */
const floor=new THREE.Mesh(new THREE.PlaneGeometry(7,7),M.floor); floor.rotation.x=-Math.PI/2; floor.receiveShadow=true; floor.name='piso'; lab.add(floor);
lab.add(Object.assign(box(7,2.8,0.05,M.wall,{y:1.4,z:-3.2,shadow:false}),{name:'pared-fondo'}));
lab.add(Object.assign(box(0.05,2.8,7,M.wall,{x:-3.2,y:1.4,shadow:false}),{name:'pared-izq'}));
const grid=new THREE.GridHelper(7,14,0x1c222b,0x1c222b); grid.position.y=0.001; lab.add(grid);
const cell=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.0,2.5)),new THREE.LineBasicMaterial({color:0x8a93a0}));
cell.rotation.x=-Math.PI/2; cell.position.set(0.05,0.003,-0.55); cell.name='celda'; lab.add(cell);
const cellTag=makeLabel('CELDA 2.0 × 2.5 m',{color:'#8a93a0',w:0.8,h:0.1,font:60}); cellTag.rotation.x=-Math.PI/2; cellTag.position.set(0.62,0.004,0.62); lab.add(cellTag);

/* Banco único 1.00 m: robot + impresoras + cajas */
function makeBench(name,cx,cz,w,d){
  const g=new THREE.Group(); g.name=name; const top=0.04;
  g.add(box(w,top,d,M.bench,{x:cx,y:TABLE_H-top/2,z:cz,phys:true}));
  g.add(box(w+0.01,0.02,d+0.01,M.benchEdge,{x:cx,y:TABLE_H-top-0.01,z:cz}));
  for(const sx of [-1,1]) for(const sz of [-1,1]) g.add(box(0.05,TABLE_H-top-0.02,0.05,M.leg,{x:cx+sx*(w/2-0.06),y:(TABLE_H-top-0.02)/2,z:cz+sz*(d/2-0.06)}));
  for(const sz of [-1,1]) g.add(box(w-0.12,0.03,0.03,M.leg,{x:cx,y:0.12,z:cz+sz*(d/2-0.06)}));
  return g;
}
const BENCH={cx:0.05,cz:-0.88,w:1.60,d:1.60};              // x -0.75..0.85 · z -1.68..-0.08 (borde frontal en z=-0.08)
lab.add(makeBench('banco',BENCH.cx,BENCH.cz,BENCH.w,BENCH.d));

/* Impresoras Bambu Lab (X1C/P1S: 389×389×457 mm; AMS 368×283×203 mm). Frente hacia -X (robot). */
function makeBambu(name,num,accent,cx,cz,doorSide=-1){   // doorSide: lado (±Z) de las bisagras
  const W=0.389,D=0.389,H=0.457; const g=new THREE.Group(); g.name=name; g.position.set(cx,TABLE_H,cz);
  const acc=new THREE.MeshStandardMaterial({color:accent,roughness:0.5});
  const body=new THREE.MeshStandardMaterial({color:0x2b2d31,roughness:0.55,metalness:0.2});
  const dark=new THREE.MeshStandardMaterial({color:0x1a1c20,roughness:0.5,metalness:0.3});
  const glass=new THREE.MeshPhysicalMaterial({color:0x8fa4b8,transparent:true,opacity:0.22,roughness:0.05,metalness:0,side:THREE.DoubleSide});
  const alu=new THREE.MeshStandardMaterial({color:0x9a9fa8,roughness:0.35,metalness:0.6});
  const t=0.012, base=0.06;
  // base + panel de control frontal
  g.add(box(D,base,W,dark,{y:base/2,obs:`${name} base`}));
  // estructura: 4 columnas, marco superior, paneles laterales/trasero (frontal abierto = puerta)
  for(const sx of [-1,1]) for(const sz of [-1,1]) g.add(box(0.03,H-base,0.03,body,{x:sx*(D/2-0.015),y:base+(H-base)/2,z:sz*(W/2-0.015)}));
  g.add(box(D,t,W,body,{y:H-t/2,obs:`${name} techo`}));
  g.add(box(D-0.06,H-base-0.05,t,body,{y:base+(H-base)/2,z:-W/2+t/2,obs:`${name} lateral`}));  // lateral -z
  g.add(box(D-0.06,H-base-0.05,t,body,{y:base+(H-base)/2,z: W/2-t/2,obs:`${name} lateral`}));  // lateral +z
  g.add(box(t,H-base-0.05,W-0.06,body,{x:D/2-t/2,y:base+(H-base)/2,obs:`${name} trasera`}));   // trasero (+x)
  // tapa superior de vidrio
  const lid=new THREE.Mesh(new THREE.BoxGeometry(D-0.09,0.006,W-0.09),glass); lid.position.y=H+0.003; lid.userData.obstacle=`${name} tapa`; g.add(lid);
  // Puerta frontal RETIRADA (X1C la lleva desmontable): en celdas automatizadas se quita para que el brazo acceda.
  // Quedan las bisagras como testigo. Sin puerta no hay obstáculo en el pasillo ni entre impresoras.
  for(const hy of [0.10,0.30]) g.add(box(0.015,0.03,0.012,body,{x:-D/2-0.004,y:base+hy,z:doorSide*(W/2-0.01)}));
  // pantalla táctil 5" en la base (inclinada)
  const scr=box(0.006,0.075,0.12,dark,{x:-D/2-0.003,y:base+0.03,z:W/2-0.09}); scr.rotation.z=-0.35; g.add(scr);
  const scrGlow=makeLabel('BAMBU',{color:'#3ecf8e',w:0.09,h:0.03,font:50}); scrGlow.rotation.y=-Math.PI/2; scrGlow.rotation.z=0; scrGlow.position.set(-D/2-0.007,base+0.032,W/2-0.09); g.add(scrGlow);
  // tira LED interior
  g.add(box(D-0.08,0.008,0.01,new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xd8e6ff,emissiveIntensity:1.5}),{y:H-0.03,z:W/2-0.03}));
  // cama 256×256 calefactada + placa texturizada
  const bedY=0.07; const bedH=0.012;   // cama en posición baja (fin de impresión)
  g.add(box(0.256,bedH,0.256,alu,{y:bedY-bedH/2,x:-0.04,obs:`${name} cama`,phys:true}));
  g.add(box(0.256,0.002,0.256,new THREE.MeshStandardMaterial({color:0x1b1e24,roughness:0.6,metalness:0.4}),{y:bedY+0.001,x:-0.04}));
  g.add(box(0.06,bedY-base-bedH,0.06,dark,{y:base+(bedY-base-bedH)/2,x:0.06}));         // eje Z
  // CoreXY: dos varillas de carbono + cabezal
  for(const sz of [-1,1]) { const rod=new THREE.Mesh(new THREE.CylinderGeometry(0.004,0.004,D-0.08,12),dark); rod.rotation.z=Math.PI/2; rod.position.set(0,H-0.07,sz*0.05); g.add(rod); }
  g.add(box(0.06,0.07,0.07,body,{x:0.02,y:H-0.09}));
  g.add(box(0.012,0.02,0.012,alu,{x:0.02,y:H-0.135}));                                     // boquilla
  // AMS sobre la tapa (368×283×203)
  const ams=new THREE.Group(); ams.name=`${name}-ams`; ams.position.set(0.02,H+0.006,0); g.add(ams);
  const amsBody=new THREE.MeshStandardMaterial({color:0xd7d9dc,roughness:0.5});
  ams.add(box(0.283,0.203,0.368,amsBody,{y:0.1015,obs:`${name} AMS`,shadow:false})).visible=false; ams.add(box(0.283,0.12,0.368,amsBody,{y:0.06}));
  ams.add(box(0.283,0.083,0.368,new THREE.MeshPhysicalMaterial({color:0xc8ced8,transparent:true,opacity:0.35,roughness:0.1}),{y:0.12+0.0415,shadow:false}));
  const spoolCols=[accent,0xe6eaf0,0x3ecf8e,0x2b2d31];
  spoolCols.forEach((c,i)=>{ const s=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.095,0.06,32),new THREE.MeshStandardMaterial({color:c,roughness:0.6})); s.rotation.x=Math.PI/2; s.position.set(0,0.10,-0.135+i*0.09); ams.add(s); });
  // rótulos grandes: trasera (+x, cara visible desde cámara) y placa frontal superior
  const plate=box(0.006,0.14,0.14,acc,{x:D/2+0.003,y:H-0.16});  g.add(plate);
  const tagBack=makeLabel(num,{w:0.12,h:0.12,font:220}); tagBack.rotation.y=Math.PI/2; tagBack.position.set(D/2+0.008,H-0.16,0); g.add(tagBack);
  const tagFront=makeLabel(num,{color:'#'+accent.toString(16).padStart(6,'0'),w:0.09,h:0.09,font:220}); tagFront.rotation.y=-Math.PI/2; tagFront.position.set(-D/2-0.02,H-0.06,0.0); g.add(tagFront);
  const brand=makeLabel('BAMBU LAB',{color:'#9aa3ad',w:0.26,h:0.04,font:52,weight:500}); brand.rotation.y=Math.PI/2; brand.position.set(D/2+0.008,base+0.06,0); g.add(brand);
  const tagSide=makeLabel(num,{w:0.16,h:0.16,font:220}); tagSide.position.set(0,H*0.55,W/2+0.008); g.add(tagSide);
  // baliza LED de estado + texto flotante
  const led=new THREE.Mesh(new THREE.SphereGeometry(0.014,16,12),M.ledOff); led.name=`${name}-led`; led.position.set(-D/2+0.02,H+0.02,-W/2+0.02); g.add(led);
  const status=makeLabel('EN ESPERA',{color:'#8a93a0',w:0.30,h:0.05,font:60}); status.name=`${name}-status`; status.position.set(-D/2,H+0.27,0); status.rotation.y=-Math.PI/4; g.add(status);
  // anclaje de pieza sobre la cama
  const slot=new THREE.Object3D(); slot.name=`${name}-slot`; slot.position.set(-0.04,bedY+0.02,0); g.add(slot);
  return g;
}
const PX=0.47;   // cuerpo; cama en PX-0.04 → 0.43 m del eje del robot (alcance UR3 500 mm)
lab.add(makeBambu('P1','1',COLOR.p1,PX,-0.745,-1));   // puerta plegada hacia −Z (exterior)
lab.add(makeBambu('P2','2',COLOR.p2,PX,-0.315,-1));   // puerta plegada hacia −Z (entre impresoras, hueco 4 cm); cuerpo z −0.51…−0.12

/* Cajas abiertas (bins): fila recta paralela al borde frontal del banco, pegadas al borde.
   Centro de fila desplazado a x=−0.10 para dejar hueco con P2; todas a ≤0.48 m del eje del robot. */
const BIN_D=0.22, BIN_W=0.14, BIN_H=0.10;
const BIN_Z=BENCH.cz+BENCH.d/2-BIN_D/2-0.005;                 // borde frontal (z≈−0.195)
const BIN_X=[-0.34,-0.18,-0.02,0.14];                        // caja 1 a la izquierda vista desde el operador
for(let i=0;i<4;i++){
  const g=new THREE.Group(); g.name=`cajon-${i+1}`; g.position.set(BIN_X[i],TABLE_H,BIN_Z);
  const w=BIN_W,d=BIN_D,h=BIN_H,t=0.006, ob=`caja ${i+1}`;
  g.add(box(w,t,d,M.bin,{y:t/2,phys:true}));
  g.add(box(t,h,d,M.bin,{x:-w/2+t/2,y:h/2,obs:ob,phys:true})); g.add(box(t,h,d,M.bin,{x:w/2-t/2,y:h/2,obs:ob,phys:true}));
  g.add(box(w,h,t,M.bin,{y:h/2,z:-d/2+t/2,obs:ob,phys:true}));
  g.add(box(w,h*0.5,t,M.bin,{y:h*0.25,z:d/2-t/2,obs:ob,phys:true}));      // frente bajo: acceso del humano
  const tag=makeLabel(String(i+1),{w:0.045,h:0.045,font:220}); tag.position.set(0,h*0.25,d/2+0.002); g.add(tag);
  const slot=new THREE.Object3D(); slot.name=`cajon-${i+1}-slot`; slot.position.set(0,0.026,0); g.add(slot);
  lab.add(g);
}

/* Zona de recolección humana — sin mesa, frente al borde de las cajas */
const zone=new THREE.Mesh(new THREE.PlaneGeometry(1.3,0.7),M.green); zone.rotation.x=-Math.PI/2; zone.position.set(-0.10,0.004,BENCH.cz+BENCH.d/2+0.38); zone.receiveShadow=true; zone.name='area-recoleccion'; lab.add(zone);
const zoneTag=makeLabel('ZONA DE RECOLECCIÓN',{color:'#8fd8b4',w:0.8,h:0.08,font:50}); zoneTag.rotation.x=-Math.PI/2; zoneTag.position.set(-0.10,0.006,BENCH.cz+BENCH.d/2+0.62); lab.add(zoneTag);

/* Pieza */
const pieza=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.04,0.04),M.pieza); pieza.name='pieza'; pieza.visible=false; pieza.castShadow=true; lab.add(pieza);

/* ============================== 3b. Física (cannon-es): gravedad para la pieza, estáticos del entorno ============================== */
const world=new CANNON.World({ gravity:new CANNON.Vec3(0,-9.82,0) });
world.broadphase=new CANNON.SAPBroadphase(world); world.allowSleep=true;
const matStatic=new CANNON.Material('static'), matPieza=new CANNON.Material('pieza');
world.addContactMaterial(new CANNON.ContactMaterial(matStatic,matPieza,{ friction:0.6, restitution:0.05 }));
world.addBody(new CANNON.Body({ mass:0, material:matStatic, shape:new CANNON.Plane(), quaternion:new CANNON.Quaternion().setFromEuler(-Math.PI/2,0,0) }));  // piso
function addStaticFromMesh(m){ scene.updateMatrixWorld(true); const g=m.geometry.parameters; const p=new THREE.Vector3(), qq=new THREE.Quaternion(), sc=new THREE.Vector3();
  m.matrixWorld.decompose(p,qq,sc); const b=new CANNON.Body({ mass:0, material:matStatic, shape:new CANNON.Box(new CANNON.Vec3(g.width*sc.x/2,g.height*sc.y/2,g.depth*sc.z/2)) });
  b.position.set(p.x,p.y,p.z); b.quaternion.set(qq.x,qq.y,qq.z,qq.w); world.addBody(b); return b; }
lab.traverse(o=>{ if(o.isMesh&&o.userData.phys) addStaticFromMesh(o); });
const piezaBody=new CANNON.Body({ mass:0.05, material:matPieza, shape:new CANNON.Box(new CANNON.Vec3(0.02,0.02,0.02)), linearDamping:0.05, angularDamping:0.2, sleepSpeedLimit:0.05 });
piezaBody.position.set(0,-1,0); world.addBody(piezaBody);
let piezaHeld=false;
/** Coloca la pieza (malla + cuerpo) en una posición de mundo, en reposo, dinámica. */
function piezaSpawn(worldPos){ lab.attach(pieza); pieza.position.copy(worldPos); pieza.quaternion.identity(); pieza.visible=true; piezaHeld=false;
  piezaBody.type=CANNON.Body.DYNAMIC; piezaBody.position.set(worldPos.x,worldPos.y,worldPos.z); piezaBody.quaternion.set(0,0,0,1); piezaBody.velocity.setZero(); piezaBody.angularVelocity.setZero(); piezaBody.wakeUp(); }
/** Pieza sujetada: la malla sigue al TCP, el cuerpo se vuelve cinemático y copia la pose (sin gravedad). */
function piezaGrab(){ tcp.attach(pieza); piezaHeld=true; piezaBody.type=CANNON.Body.KINEMATIC; piezaBody.velocity.setZero(); piezaBody.angularVelocity.setZero(); }
/** Pieza liberada: vuelve al mundo y cae por gravedad desde donde esté. */
function piezaRelease(){ lab.attach(pieza); piezaHeld=false; const p=pieza.position, r=pieza.quaternion;
  piezaBody.position.set(p.x,p.y,p.z); piezaBody.quaternion.set(r.x,r.y,r.z,r.w); piezaBody.type=CANNON.Body.DYNAMIC; piezaBody.velocity.setZero(); piezaBody.angularVelocity.setZero(); piezaBody.wakeUp(); }
function physicsStep(dt){ world.step(1/120, Math.min(dt,0.05), 4);
  if(piezaHeld){ const p=new THREE.Vector3(), r=new THREE.Quaternion(); pieza.getWorldPosition(p); pieza.getWorldQuaternion(r); piezaBody.position.set(p.x,p.y,p.z); piezaBody.quaternion.set(r.x,r.y,r.z,r.w); }
  else if(pieza.visible){ pieza.position.copy(piezaBody.position); pieza.quaternion.copy(piezaBody.quaternion); } }

/* ============================== 4. Brazo UR3 — URDF (urdf-loader) dentro del frame DH ==============================
   `brazo` = frame DH base (Z arriba). El URDF clásico (ur3.urdf) tiene base_link con X hacia atrás respecto al
   frame interno UR → se monta con Rz(π). El URDF resuelve la transformación de cada articulación; FK/IK se
   calculan con la tabla DH y se validan contra tool0 (selfcheck). */
const brazo=new THREE.Group(); brazo.name='brazo'; brazo.position.copy(ROBOT_POS); brazo.rotation.x=-Math.PI/2; lab.add(brazo);
const JOINT_URDF=['shoulder_pan_joint','shoulder_lift_joint','elbow_joint','wrist_1_joint','wrist_2_joint','wrist_3_joint'];
let robot=null; const joints=[];
const tcp=new THREE.Group(); tcp.name='tcp';           // = tool0 (T6_0)
async function loadMeshes(){
  const l=new URDFLoader(); l.packages={ ur_description: URDF_PKG };
  robot=await new Promise((res,rej)=>l.load(URDF_FILE,res,undefined,rej));
  robot.name='ur3-urdf'; robot.rotation.z=Math.PI;
  robot.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material){ o.material.roughness=0.45; o.material.metalness=0.25; } } });
  JOINT_URDF.forEach((n,i)=>{ const j=robot.joints[n]; j.ignoreLimits=true; joints.push(j); });
  (robot.links.tool0||robot.frames.tool0).add(tcp);
  brazo.add(robot); applyJoints(); buildObstacles();
}

/* Gripper paralelo 2 dedos (estilo Robotiq Hand-E) en tool0 */
const gripper=new THREE.Group(); gripper.name='gripper'; tcp.add(gripper);
const gBody=new THREE.Mesh(new THREE.CylinderGeometry(0.0375,0.0375,0.05,32),M.grip); gBody.rotation.x=Math.PI/2; gBody.position.z=0.025; gBody.castShadow=true; gripper.add(gBody);
gripper.add(box(0.075,0.03,0.03,M.gripAlu,{z:0.065}));
const fL=box(0.010,0.022,0.06,M.grip,{z:0.105}); fL.name='finger-L'; gripper.add(fL);
const fR=box(0.010,0.022,0.06,M.grip,{z:0.105}); fR.name='finger-R'; gripper.add(fR);
const GRIP_MAX=0.05; let gripPct=100;
function setGripper(pct){ gripPct=pct; const gap=GRIP_MAX*pct/100+0.04; fL.position.x=-gap/2; fR.position.x=gap/2; }
setGripper(100);
const axesBase=new THREE.AxesHelper(0.15); axesBase.visible=false; brazo.add(axesBase);
const axesTcp=new THREE.AxesHelper(0.08); axesTcp.visible=false; tcp.add(axesTcp);

/* ============================== 4b. Control de colisiones del UR3 ==============================
   Robot ≈ esferas muestreadas a lo largo de los eslabones (posiciones reales de los links URDF) + gripper.
   Entorno = cajas orientadas (OBB) marcadas con userData.obstacle + tablero del banco (plano).
   Se usa en tiempo real (jogging y movimiento) y como pre-chequeo de trayectorias antes de ejecutar. */
const obstacles=[];
function buildObstacles(){ obstacles.length=0; scene.updateMatrixWorld(true);
  lab.traverse(o=>{ if(o.isMesh&&o.userData.obstacle){ const g=o.geometry.parameters; const sc=new THREE.Vector3(); o.matrixWorld.decompose(new THREE.Vector3(),new THREE.Quaternion(),sc);
    obstacles.push({ name:o.userData.obstacle, inv:o.matrixWorld.clone().invert(), half:new THREE.Vector3(g.width*sc.x/2,g.height*sc.y/2,g.depth*sc.z/2), mesh:o }); } }); }
const LINK_CHAIN=[['shoulder_link',0.055],['upper_arm_link',0.048],['forearm_link',0.042],['wrist_1_link',0.036],['wrist_2_link',0.036],['wrist_3_link',0.036],['tool0',0.04]];
const SPHERE_STEP=0.03;
/** Esferas {c:Vector3 mundo, r} para la configuración actual del URDF (ya aplicada). */
function robotSpheres(){ const out=[]; if(!robot) return out; robot.updateMatrixWorld(true);
  const pts=LINK_CHAIN.map(([n,r])=>({ p:new THREE.Vector3().setFromMatrixPosition(robot.links[n].matrixWorld), r }));
  const tip=new THREE.Vector3(0,0,GRIP_LEN-0.025).applyMatrix4(tcp.matrixWorld); pts.push({ p:tip, r:0.016 });   // punta de dedos (la pieza sujetada no es obstáculo)
  for(let i=1;i<pts.length;i++){ const a=pts[i-1].p,b=pts[i].p; const L=a.distanceTo(b); const n=Math.max(1,Math.ceil(L/SPHERE_STEP));
    for(let k=(i===1?0:1);k<=n;k++){ const t=k/n; out.push({ c:new THREE.Vector3().lerpVectors(a,b,t), r:pts[i-1].r+(pts[i].r-pts[i-1].r)*t, link:i }); } }
  return out; }
const _l=new THREE.Vector3();
function sphereHitsOBB(sph,ob){ _l.copy(sph.c).applyMatrix4(ob.inv); const dx=Math.max(Math.abs(_l.x)-ob.half.x,0), dy=Math.max(Math.abs(_l.y)-ob.half.y,0), dz=Math.max(Math.abs(_l.z)-ob.half.z,0); return dx*dx+dy*dy+dz*dz < sph.r*sph.r; }
/** Colisión de la configuración actual (ya aplicada al URDF). Devuelve nombre del obstáculo o null. */
let lastHitInfo=null;
function collisionNow(){ const sp=robotSpheres();
  for(const s of sp){ if(s.link>=2 && s.c.y-s.r < TABLE_H-0.002){ lastHitInfo={link:s.link,c:s.c}; return 'banco'; } for(const ob of obstacles){ if(sphereHitsOBB(s,ob)){ lastHitInfo={link:s.link,c:s.c}; return ob.name; } } }
  return null; }
const LINK_LABEL=['','hombro','brazo','antebrazo','muñeca1','muñeca2','muñeca3','gripper'];
function hitDesc(){ if(!lastHitInfo) return ''; const c=lastHitInfo.c; return ` (${LINK_LABEL[lastHitInfo.link]} @ ${c.x.toFixed(2)},${(c.y-TABLE_H).toFixed(2)},${c.z.toFixed(2)})`; }
/** Colisión para una configuración arbitraria (aplica y restaura). */
function collisionAt(qDeg){ if(!robot) return null; const cur=q.slice(); for(let i=0;i<6;i++) joints[i].setJointValue(THREE.MathUtils.degToRad(qDeg[i])); robot.updateMatrixWorld(true);
  const hit=collisionNow(); for(let i=0;i<6;i++) joints[i].setJointValue(THREE.MathUtils.degToRad(cur[i])); robot.updateMatrixWorld(true); return hit; }
/** Pre-chequeo de un MoveJ: muestrea la interpolación. Devuelve {hit, t} o null. */
function pathCollision(from,to,steps=40){ for(let k=0;k<=steps;k++){ const t=k/steps; const qq=from.map((v,i)=>v+(to[i]-v)*t); const hit=collisionAt(qq); if(hit) return { hit, t }; } return null; }
/* Visualización de esferas + estado */
const colGroup=new THREE.Group(); colGroup.name='colision-debug'; colGroup.visible=false; scene.add(colGroup);
const colMatOk=new THREE.MeshBasicMaterial({ color:0x3ecf8e, wireframe:true, transparent:true, opacity:0.35 }), colMatHit=new THREE.MeshBasicMaterial({ color:0xe05a4f, wireframe:true });
const colGeo=new THREE.SphereGeometry(1,10,8);
let lastCollision=null;
function collisionUpdate(){ const hit=collisionNow(); if(hit!==lastCollision){ lastCollision=hit; const el=$('colstate'); el.textContent=hit?`COLISIÓN · ${hit}`:'sin colisión'; el.className=hit?'err':'ok';
    for(const ob of obstacles){ if(ob.mesh.material.emissive) ob.mesh.material.emissive.setHex(0x000000); } }
  if(colGroup.visible){ const sp=robotSpheres(); while(colGroup.children.length<sp.length) colGroup.add(new THREE.Mesh(colGeo,colMatOk)); colGroup.children.forEach((m,i)=>{ if(i<sp.length){ m.visible=true; m.position.copy(sp[i].c); m.scale.setScalar(sp[i].r); m.material=hit?colMatHit:colMatOk; } else m.visible=false; }); }
  return hit; }

/* Trayectoria del TCP */
const TRAIL_MAX=600; const trailPos=new Float32Array(TRAIL_MAX*3); let trailN=0;
const trailGeo=new THREE.BufferGeometry(); trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3)); trailGeo.setDrawRange(0,0);
const trail=new THREE.Line(trailGeo,new THREE.LineBasicMaterial({color:0x3ecf8e})); trail.frustumCulled=false; scene.add(trail);
function trailPush(){ if(!trail.visible) return; const w=new THREE.Vector3(); tcp.getWorldPosition(w);
  if(trailN>0){ const i=(trailN-1)*3; if(Math.hypot(w.x-trailPos[i],w.y-trailPos[i+1],w.z-trailPos[i+2])<0.003) return; }
  if(trailN>=TRAIL_MAX){ trailPos.copyWithin(0,3); trailN=TRAIL_MAX-1; }
  trailPos.set([w.x,w.y,w.z],trailN*3); trailN++; trailGeo.attributes.position.needsUpdate=true; trailGeo.setDrawRange(0,trailN); }
function trailClear(){ trailN=0; trailGeo.setDrawRange(0,0); }

/* ============================== 5. Estado + UI ============================== */
const q=[...HOME];
function applyJoints(){ if(!robot) return; for(let i=0;i<6;i++) joints[i].setJointValue(THREE.MathUtils.degToRad(q[i])); robot.updateMatrixWorld(true); }
const jointsEl=$('joints'); const sliders=[],numbers=[];
JOINT_NAMES.forEach((n,i)=>{ const row=document.createElement('div'); row.className='j';
  row.innerHTML=`<label title="${JOINT_IDS[i]}_joint">${n}</label><input type="range" min="-360" max="360" step="0.5" value="${q[i]}"><input type="number" min="-360" max="360" step="0.5" value="${q[i]}">`;
  const [r,nm]=row.querySelectorAll('input'); sliders.push(r); numbers.push(nm);
  r.addEventListener('input',()=>{ if(running) return; q[i]=+r.value; nm.value=r.value; update(); });
  nm.addEventListener('change',()=>{ if(running) return; q[i]=THREE.MathUtils.clamp(+nm.value,-360,360); nm.value=q[i]; r.value=q[i]; update(); });
  jointsEl.appendChild(row); });
const tcpEl=$('tcp');
tcpEl.innerHTML=[['X','mm'],['Y','mm'],['Z','mm'],['Rx','rad'],['Ry','rad'],['Rz','rad']].map(([k,u])=>`<div><small>${k} · ${u}</small><b id="tcp-${k}">–</b></div>`).join('');
function update(){ applyJoints(); const {pos,rotvec}=forwardKinematics(q);
  ['X','Y','Z'].forEach((k,i)=>$('tcp-'+k).textContent=pos[i].toFixed(1));
  ['Rx','Ry','Rz'].forEach((k,i)=>$('tcp-'+k).textContent=rotvec[i].toFixed(3)); }
function setQ(arr,ui=true){ for(let i=0;i<6;i++){ q[i]=arr[i]; if(ui){ sliders[i].value=arr[i].toFixed(1); numbers[i].value=arr[i].toFixed(1); } } update(); }
$('home').onclick=()=>{ if(!running) setQ(HOME); };
$('ax-base').onchange=e=>axesBase.visible=e.target.checked;
$('ax-tcp').onchange=e=>axesTcp.visible=e.target.checked;
$('trail').onchange=e=>{ trail.visible=e.target.checked; trailClear(); };
$('colviz').onchange=e=>{ colGroup.visible=e.target.checked; };
const gripR=$('grip'),gripN=$('grip-n');
gripR.oninput=()=>{ gripN.value=gripR.value; setGripper(+gripR.value); }; gripN.onchange=()=>{ gripR.value=gripN.value; setGripper(+gripN.value); };
$('reset').onclick=resetCamera;
$('volver').onclick=()=>opciones.onVolver();
setQ(HOME);


/* ============================== 6. Pick & Place ============================== */
const banner=$('banner');
function setBanner(t,cls=''){ banner.textContent=t; banner.className=cls; console.log('[ciclo]',t); }
let running=false, abort=false, lastMoveError=null;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ease=t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;   // cúbica suave (MoveJ)
let velForzada=null;
function speed(){ return velForzada ?? +$('vel').value; }
async function moveJ(target, baseMs){
  const from=q.slice(); const ms=baseMs/speed(); const t0=performance.now();
  const pc=pathCollision(from,target); if(pc){ lastMoveError=`Trayectoria bloqueada: colisión con ${pc.hit}${hitDesc()} t=${pc.t.toFixed(2)}`; return false; }
  return new Promise(res=>{ const step=()=>{ if(abort) return res(false); const t=Math.min(1,(performance.now()-t0)/ms); const k=ease(t);
    setQ(from.map((v,i)=>v+(target[i]-v)*k),true); trailPush(); const hit=collisionUpdate(); if(hit){ lastMoveError=`Parada de seguridad: colisión con ${hit}`; return res(false); }
    if(t<1) requestAnimationFrame(step); else res(true); }; step(); });
}
window.debugPath=(a,b)=>{ const r=pathCollision(a,b); return r?{...r,desc:hitDesc()}:null; };
/** MoveJ planificado desde/hacia Home: gira la base con el brazo vertical (Home) y luego despliega.
    Si el tramo bloquea, prueba las demás soluciones IK (cands). `sol` = resultado de ikFor. */
async function moveFromHome(sol, ms){
  for(const cand of (sol.cands||[sol.q])){ const turn=[cand[0],...HOME.slice(1)];
    if(pathCollision(HOME,turn)||pathCollision(turn,cand)) continue;
    if(!await moveJ(turn,Math.round(ms*0.45))) return false; if(!await moveJ(cand,Math.round(ms*0.7))) return false; sol.q=cand; return true; }
  lastMoveError=lastMoveError||'Sin trayectoria libre desde Home'; return false;
}
async function moveToHome(ms){ const turn=[q[0],...HOME.slice(1)];
  if(!pathCollision(q,turn)&&!pathCollision(turn,HOME)){ if(!await moveJ(turn,Math.round(ms*0.7))) return false; return moveJ(HOME,Math.round(ms*0.45)); }
  return moveJ(HOME,ms); }
/** Posición actual (mundo) del centro de pieza bajo el gripper */
function pieceCenterNow(){ tcp.updateWorldMatrix(true,false); return new THREE.Vector3(0,0,GRIP_LEN).applyMatrix4(tcp.matrixWorld); }
/** MoveL: línea recta cartesiana del centro de pieza hasta targetPos (herramienta hacia abajo), IK por paso.
    Pre-chequeo: IK alcanzable + sin colisión en 30 muestras. */
async function moveL(targetPos, baseMs){
  const p0=pieceCenterNow(); const ms=baseMs/speed();
  let qs=q.slice(); for(let k=1;k<=30;k++){ const pos=new THREE.Vector3().lerpVectors(p0,targetPos,k/30); const r=ikFor(pos,qs);
    if(!r.ok){ lastMoveError=`MoveL: ${r.reason||'fuera de alcance'}`; return false; }
    const jump=Math.max(...r.q.map((v,i)=>Math.abs(v-qs[i]))); if(jump>40){ lastMoveError=`MoveL: salto articular ${jump.toFixed(0)}° (singularidad)`; return false; }
    const hit=collisionAt(r.q); if(hit){ lastMoveError=`MoveL bloqueado: colisión con ${hit}${hitDesc()}`; return false; } qs=r.q; }
  const t0=performance.now();
  return new Promise(res=>{ const step=()=>{ if(abort) return res(false); const t=Math.min(1,(performance.now()-t0)/ms);
    const pos=new THREE.Vector3().lerpVectors(p0,targetPos,ease(t)); const r=ikFor(pos,q,{checkCol:false}); setQ(r.q,true); trailPush();
    const hit=collisionUpdate(); if(hit){ lastMoveError=`Parada de seguridad: colisión con ${hit}`; return res(false); }
    if(t<1) requestAnimationFrame(step); else res(true); }; step(); });
}
async function gripTo(pct,ms=500){ const from=gripPct; const t0=performance.now(); const d=ms/speed();
  return new Promise(res=>{ const step=()=>{ if(abort) return res(false); const t=Math.min(1,(performance.now()-t0)/d); setGripper(from+(pct-from)*ease(t)); if(t<1) requestAnimationFrame(step); else res(true); }; step(); }); }
/** Punto mundo → frame DH del robot */
function toRobot(worldPos){ brazo.updateWorldMatrix(true,false); return brazo.worldToLocal(worldPos.clone()); }
// IK analítica UR (convención DH estándar UR, misma que ur_kinematics/ur_kin.cpp). Ángulos en rad.
const UR3={d1:0.1519,a2:-0.24365,a3:-0.21325,d4:0.11235,d5:0.08535,d6:0.0819};
const ZT=1e-8, PI=Math.PI, TAU=2*PI;
const sign=x=>x<0?-1:1;
function dh_(t,a,d,al){const c=Math.cos(t),s=Math.sin(t),ca=Math.cos(al),sa=Math.sin(al);return [[c,-s*ca,s*sa,a*c],[s,c*ca,-c*sa,a*s],[0,sa,ca,d],[0,0,0,1]];}
function mul_(X,Y){const R=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];for(let i=0;i<4;i++)for(let j=0;j<4;j++){let v=0;for(let k=0;k<4;k++)v+=X[i][k]*Y[k][j];R[i][j]=v;}return R;}
function fk_(q,P=UR3){const A=[[0,P.d1,PI/2],[P.a2,0,0],[P.a3,0,0],[0,P.d4,PI/2],[0,P.d5,-PI/2],[0,P.d6,0]];let T=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];for(let i=0;i<6;i++)T=mul(T,dh(q[i],...A[i]));return T;}
/** IK analítica cerrada del UR (ur_kinematics). T: 4x4 por filas (frame 6 en base DH). Hasta 8 soluciones (rad). */
function ikAnalytic(T,P=UR3,q6des=0){
  const [[T00,T01,T02,T03],[T10,T11,T12,T13],[T20,T21,T22,T23]]=T; const {d1,a2,a3,d4,d5,d6}=P; const sols=[];
  // θ1
  const A=d6*T12-T13, B=d6*T02-T03, R=A*A+B*B; const q1=[];
  if(Math.abs(A)<ZT){ q1.push(Math.abs(d4-Math.abs(B))<ZT? sign(B)*PI/2 : sign(B)*Math.asin(d4/Math.abs(B))+0, ...[]) ; }
  if(q1.length===0){ if(Math.abs(B)<ZT){ const div=-sign(d4)*sign(A); q1.push(Math.asin(div)+0); q1.push(PI-Math.asin(div)); }
    else if(d4*d4>R){ return []; } else { const arccos=Math.acos(d4/Math.sqrt(R)), arctan=Math.atan2(-B,A); q1.push(arctan+arccos, arctan-arccos); } }
  for(let t1 of q1){ t1=((t1%TAU)+TAU)%TAU; const c1=Math.cos(t1), s1=Math.sin(t1);
    // θ5
    const numer=T03*s1-T13*c1-d4; let div=numer/d6; if(Math.abs(Math.abs(div)-1)<ZT) div=sign(div); if(Math.abs(div)>1) continue;
    const ac=Math.acos(div); for(const t5 of [ac, TAU-ac]){ const c5=Math.cos(t5), s5=Math.sin(t5);
      // θ6
      let t6; if(Math.abs(s5)<ZT) t6=q6des; else t6=Math.atan2(sign(s5)*-(T01*s1-T11*c1), sign(s5)*(T00*s1-T10*c1)); t6=((t6%TAU)+TAU)%TAU;
      const c6=Math.cos(t6), s6=Math.sin(t6);
      // θ2, θ3, θ4 (planar)
      const x04x=-s5*(T02*c1+T12*s1)-c5*(s6*(T01*c1+T11*s1)-c6*(T00*c1+T10*s1));
      const x04y=c5*(T20*c6-T21*s6)-T22*s5;
      const p13x=d5*(s6*(T00*c1+T10*s1)+c6*(T01*c1+T11*s1))-d6*(T02*c1+T12*s1)+T03*c1+T13*s1;
      const p13y=T23-d1-d6*T22+d5*(T21*c6+T20*s6);
      let c3=(p13x*p13x+p13y*p13y-a2*a2-a3*a3)/(2*a2*a3); if(Math.abs(Math.abs(c3)-1)<ZT) c3=sign(c3); else if(Math.abs(c3)>1) continue;
      const ac3=Math.acos(c3); const denom=a2*a2+a3*a3+2*a2*a3*c3; const s3=Math.sin(ac3); const Aa=a2+a3*c3, Bb=a3*s3;
      const cand=[[ac3, Math.atan2((Aa*p13y-Bb*p13x)/denom,(Aa*p13x+Bb*p13y)/denom)],[TAU-ac3, Math.atan2((Aa*p13y+Bb*p13x)/denom,(Aa*p13x-Bb*p13y)/denom)]];
      for(const [t3,t2r] of cand){ const t2=((t2r%TAU)+TAU)%TAU; const c23=Math.cos(t2+t3), s23=Math.sin(t2+t3);
        let t4=Math.atan2(c23*x04y-s23*x04x, x04x*c23+x04y*s23); t4=((t4%TAU)+TAU)%TAU;
        sols.push([t1,t2,t3,t4,t5,t6]); } } }
  return sols;
}

/** Desenrolla v (grados) al múltiplo de 360 más cercano a ref. */
const unwrapNear=(v,ref)=>v-360*Math.round((v-ref)/360);
const norm180=v=>((v%360)+540)%360-180;
const IK_W=[1,1,1,0.5,0.5,0.3];
/** IK para poner el CENTRO DE PIEZA (offset GRIP_LEN bajo el flange) en worldPos con la herramienta hacia abajo.
    Analítica (8 soluciones) × 4 yaws de pinza (θ6 libre). Selección: sin colisión (si checkCol), codo arriba,
    hombro no invertido, mínima distancia articular ponderada a la semilla. Salida desenrollada cerca de la semilla. */
function ikFor(worldPos, seed, {checkCol=true}={}){
  const p=toRobot(worldPos); p.z+=GRIP_LEN; const z=[0,0,-1];
  let best=null, bestAny=null; const cands=[];
  for(const yawDeg of [0,90,180,270]){ const yaw=THREE.MathUtils.degToRad(yawDeg); const x=[Math.cos(yaw),Math.sin(yaw),0]; const y=[z[1]*x[2]-z[2]*x[1], z[2]*x[0]-z[0]*x[2], z[0]*x[1]-z[1]*x[0]];
    const T=[[x[0],y[0],z[0],p.x],[x[1],y[1],z[1],p.y],[x[2],y[2],z[2],p.z],[0,0,0,1]];
    for(const sr of ikAnalytic(T)){ const q=sr.map((v,i)=>unwrapNear(THREE.MathUtils.radToDeg(v),seed[i]));
      let cost=0; for(let i=0;i<6;i++) cost+=IK_W[i]*Math.abs(q[i]-seed[i]);
      if(norm180(q[2])>0) cost+=400;        // codo abajo
      if(norm180(q[1])>0) cost+=400;        // hombro invertido (brazo por debajo de la base)
      if(Math.abs(norm180(q[4]))<25) cost+=300;   // cerca de singularidad de muñeca
      const c={q,cost}; if(!bestAny||cost<bestAny.cost) bestAny=c;
      if(checkCol){ if(collisionAt(q)) continue; }
      cands.push(c); if(!best||cost<best.cost) best=c; } }
  cands.sort((a,b)=>a.cost-b.cost);
  if(best) return {q:best.q,ok:true,err:0,cost:best.cost,cands:cands.map(c=>c.q)};
  return bestAny?{q:bestAny.q,ok:false,err:0,cost:bestAny.cost,reason:'colisión en todas las soluciones'}:{q:seed.slice(),ok:false,err:1,reason:'fuera de alcance'};
}
const setLed=(name,mat)=>{ scene.getObjectByName(`${name}-led`).material=mat; };
function setStatus(name,text,color){ const old=scene.getObjectByName(`${name}-status`); const n=makeLabel(text,{color,w:0.30,h:0.05,font:60}); n.name=old.name; n.position.copy(old.position); n.rotation.copy(old.rotation); old.parent.add(n); old.parent.remove(old); }

async function imprimir(origenId, destinoId, opts={}){
  if(running) return; running=true; abort=false; trailClear(); lastMoveError=null; velForzada=opts.velocidad ?? null;
  try{ await cargado; }catch{ running=false; velForzada=null; return; }
  guardarPiezaAnterior();
  $('start').disabled=true;
  const slotO=scene.getObjectByName(`${origenId}-slot`), slotD=scene.getObjectByName(`${destinoId}-slot`);
  try{
    // 0. ciclo de impresión (abreviado) → pieza lista
    setBanner(`${origenId}: imprimiendo…`,'run'); setLed(origenId,M.ledBusy); setStatus(origenId,'IMPRIMIENDO','#5aa0ff');
    await sleep(opts.msImpresion ?? 900/speed()); if(abort) throw 0;
    { const p=new THREE.Vector3(); slotO.getWorldPosition(p); piezaSpawn(p); } await sleep(150); if(abort) throw 0;
    setLed(origenId,M.ledOn); setStatus(origenId,'LISTA PARA PICK','#3ecf8e');
    // 1. waypoints por IK (semilla encadenada → soluciones continuas)
    const pO=pieza.getWorldPosition(new THREE.Vector3()); const pD=new THREE.Vector3(); slotD.getWorldPosition(pD);
    const up=new THREE.Vector3(0,0.08,0);
    const pVia=pO.clone().add(new THREE.Vector3(-0.36,0.08,0));   // delante del frente de la impresora, a la altura de pre-pick (validado sin colisión)
    const via=ikFor(pVia,HOME); if(!via.ok) throw `IK vía ${origenId}: ${via.reason}`;
    const s1=ikFor(pO.clone().add(up),via.q); if(!s1.ok) throw `IK pre-pick ${origenId}: ${s1.reason}`;
    const s2=ikFor(pO,s1.q);                 if(!s2.ok) throw `IK pick ${origenId}: ${s2.reason}`;
    const s3=ikFor(pD.clone().add(up),HOME); if(!s3.ok) throw `IK pre-place ${destinoId}: ${s3.reason}`;
    const s4=ikFor(pD.clone().add(new THREE.Vector3(0,0.07,0)),s3.q); if(!s4.ok) throw `IK place ${destinoId}: ${s4.reason}`;   // suelta a 7 cm: cae por gravedad
    // 2. secuencia
    setBanner('Aproximando…','run'); await gripTo(100,300);
    if(!await moveJ(HOME,900)){ // recuperación: subir recto y reintentar
      lastMoveError=null; const pc=pieceCenterNow(); if(!await moveL(pc.add(new THREE.Vector3(0,0.12,0)),600)) throw 0; if(!await moveJ(HOME,900)) throw 0; }
    if(!await moveFromHome(via,1400)) throw 0;
    if(!await moveL(pO.clone().add(up),1100)) throw 0;          // MoveL: entra recto en la impresora
    if(!await moveL(pO,700)) throw 0;                            // MoveL: baja a la pieza
    setBanner('Sujetando pieza…','run'); if(!await gripTo(15,500)) throw 0; piezaGrab(); console.log('[wp]',JSON.stringify({via:via.q.map(Math.round),s1:s1.q.map(Math.round),s2:s2.q.map(Math.round),s3:s3.q.map(Math.round),s4:s4.q.map(Math.round)})); setLed(origenId,M.ledOff); setStatus(origenId,'EN ESPERA','#8a93a0');
    setBanner('Retrayendo…','run'); if(!await moveL(pO.clone().add(up),700)) throw 0; if(!await moveL(pVia,1100)) throw 0;   // MoveL: sube y sale recto
    console.log('[wp] via-return',JSON.stringify(q.map(Math.round)),'via.q',JSON.stringify(via.q.map(Math.round)));
    if(!await moveJ(via.q,600)) throw 0;                          // reconfiguración a la rama validada (mismo punto)
    setBanner('Trasladando…','run'); if(!await moveToHome(1200)) throw 0; if(!await moveFromHome(s3,1600)) throw 0;
    setBanner('Depositando…','run'); if(!await moveL(pD.clone().add(new THREE.Vector3(0,0.07,0)),700)) throw 0; piezaRelease(); if(!await gripTo(100,500)) throw 0; await sleep(400/speed());
    if(!await moveL(pD.clone().add(up),600)) throw 0; if(!await moveToHome(1400)) throw 0;
    setBanner(`Ciclo terminado · pieza en ${destinoId.replace('cajon-','caja ')}`,'ok');
  }catch(e){ if(piezaHeld) piezaRelease(); if(e===0){ setBanner(lastMoveError||'PARADA DE EMERGENCIA','err'); } else { setBanner(String(e),'err'); console.warn(e); }
    setLed(origenId,M.ledOff); setStatus(origenId,'EN ESPERA','#8a93a0'); }
  running=false; velForzada=null; $('start').disabled=false;
}
$('start').onclick=()=>opciones.onIniciar($('origen').value,$('destino').value);
$('stop').onclick=()=>{ abort=true; lastMoveError=null; };

/* ============================== 7. Arranque ============================== */
const api={scene,camera,renderer,controls,joints,tcp,gripper,pieza,piezaBody,world,q,setQ,setGripper,forwardKinematics,ikSolve,ikAnalytic,ikFor,imprimir,moveJ,moveL,collisionAt,pathCollision,robotSpheres,obstacles,DH,HOME,ROBOT_POS,BENCH};
const cargado=loadMeshes().then(()=>{ $('loading').remove(); console.log('[meshes] UR3 cargado');
  // selfcheck FK vs grafo + alcance de todos los objetivos
  scene.updateMatrixWorld(true); const w=new THREE.Vector3(); tcp.getWorldPosition(w); const l=brazo.worldToLocal(w.clone()).multiplyScalar(1000); const {pos:fk,T}=forwardKinematics(q);
  const zW=new THREE.Vector3(0,0,1).transformDirection(tcp.matrixWorld); const zDH=new THREE.Vector3().setFromMatrixColumn(T,2).transformDirection(brazo.matrixWorld);
  console.log(`[FK selfcheck] pos err=${Math.hypot(l.x-fk[0],l.y-fk[1],l.z-fk[2]).toFixed(3)} mm · eje Z err=${THREE.MathUtils.radToDeg(zW.angleTo(zDH)).toFixed(2)}° · tool0=${l.toArray().map(v=>v.toFixed(1))} dh=${fk.map(v=>v.toFixed(1))}`);
  console.log(`[obstáculos] ${obstacles.length} OBB · home colisión=${collisionAt(HOME)}`);
  for(const id of ['P1','P2','cajon-1','cajon-2','cajon-3','cajon-4']){ const p=new THREE.Vector3(); scene.getObjectByName(`${id}-slot`).getWorldPosition(p);
    const isP=id.startsWith('P'); const r=ikFor(p.clone().add(new THREE.Vector3(0,isP?0:0.07,0)),HOME); const r2=ikFor(p.clone().add(new THREE.Vector3(0,0.08,0)),HOME); console.log(`[reach] ${id} ${isP?'pick':'place'}=${r.ok?'OK':'FAIL'}(${(r.err*1000).toFixed(1)}mm) col=${collisionAt(r.q)} · pre=${r2.ok?'OK':'FAIL'}(${(r2.err*1000).toFixed(1)}mm) col=${collisionAt(r2.q)}`); }
}); cargado.catch(e=>{ $('loading').textContent='ERROR CARGANDO MALLAS — ver consola'; console.error(e); });
function resize(){ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); }
const clock=new THREE.Clock();
renderer.setAnimationLoop(()=>{ const dt=clock.getDelta(); physicsStep(dt); for(const cb of frameCbs) cb(dt); if(robot&&!running) collisionUpdate(); controls.update();
  // WS-0: con la vista del lab oculta no se dibuja (el brazo, la física y la IK siguen corriendo).
  if(!root.hidden) renderer.render(scene,camera); });

/* ============================== 8. Integración con la plataforma (WS-0) ============================== */
/** D-16: cada job deja su pieza en el cajón; la `pieza` viva se reutiliza para el siguiente. */
const guardadas=[];
function guardarPiezaAnterior(){ if(!pieza.visible||piezaHeld) return;
  const copia=pieza.clone(); copia.name='pieza-guardada'; copia.material=M.pieza; lab.add(copia); guardadas.push(copia);
  pieza.visible=false; piezaBody.type=CANNON.Body.STATIC; piezaBody.position.set(0,-1,0); }
/** Reiniciar (D-11): corta la coreografía, vacía cajones y deja el brazo en Home. */
async function reset(){ abort=true; while(running) await sleep(30); abort=false; lastMoveError=null;
  for(const g of guardadas) lab.remove(g); guardadas.length=0;
  if(piezaHeld) piezaRelease(); pieza.visible=false; piezaBody.type=CANNON.Body.STATIC; piezaBody.position.set(0,-1,0);
  for(const id of ['P1','P2']){ setLed(id,M.ledOff); setStatus(id,'EN ESPERA','#8a93a0'); }
  setGripper(100); setQ(HOME); trailClear(); setBanner('EN ESPERA'); }
function onFrame(cb){ frameCbs.add(cb); return ()=>frameCbs.delete(cb); }
return { ...api, toolbar:$('lab-toolbar'), resetCamera, resize, onFrame, reset, cargado, ocupado:()=>running };
}
