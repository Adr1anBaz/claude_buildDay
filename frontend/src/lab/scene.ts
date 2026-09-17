// WS-2 · Elías — Lab 3D. Construcción de la escena QUIETA (E1/E3): nada se anima aquí,
// solo se arman los objetos con los nombres y posiciones exactas de plan.md §5.7.
// WS-3 (Sebas) rota/traslada estos objetos en tiempo de ejecución; esta función no vuelve a tocarlos.
import {
  AmbientLight,
  BoxGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import type { DrawerId, PrinterId } from '../contracts';
import { numberTexture } from './texture';

// Punto que mira la cámara en el encuadre 3/4 inicial (E4 · resetCamera lo reusa).
export const CAMERA_TARGET = new Vector3(0, 0.9, -1.1);

// ── Sala: piso + paredes (E3 — "nada más") ─────────────────────────────────────
const ROOM = { width: 14, depth: 12, centerZ: -1, wallHeight: 3.6 };

function buildRoom(scene: Scene): void {
  const floorMat = new MeshStandardMaterial({ color: 0x30343c, roughness: 0.9 });
  const floor = new Mesh(new PlaneGeometry(ROOM.width, ROOM.depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, ROOM.centerZ);
  scene.add(floor);

  const wallMat = new MeshStandardMaterial({ color: 0x21242b, roughness: 0.95 });

  const backWall = new Mesh(new PlaneGeometry(ROOM.width, ROOM.wallHeight), wallMat);
  backWall.position.set(0, ROOM.wallHeight / 2, ROOM.centerZ - ROOM.depth / 2);
  scene.add(backWall);

  const sideWallGeo = new PlaneGeometry(ROOM.depth, ROOM.wallHeight);
  const leftWall = new Mesh(sideWallGeo, wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-ROOM.width / 2, ROOM.wallHeight / 2, ROOM.centerZ);
  scene.add(leftWall);

  const rightWall = new Mesh(sideWallGeo, wallMat);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(ROOM.width / 2, ROOM.wallHeight / 2, ROOM.centerZ);
  scene.add(rightWall);
}

// ── Luces: techo + frontal (E3) ────────────────────────────────────────────────
function buildLights(scene: Scene): void {
  scene.add(new AmbientLight(0xffffff, 0.35));

  // Techo: cae desde arriba sobre toda la sala.
  const ceiling = new DirectionalLight(0xffffff, 1.1);
  ceiling.position.set(0, 8, -1);
  ceiling.target.position.set(0, 0, -1);
  scene.add(ceiling, ceiling.target);

  // Frontal: desde el lado de la cámara, para que las caras visibles no queden planas.
  const front = new DirectionalLight(0xfff2e0, 0.7);
  front.position.set(2, 3, 8);
  front.target.position.set(0, 0.8, -1);
  scene.add(front, front.target);
}

// ── Impresoras P1 / P2 ──────────────────────────────────────────────────────────
const PRINTER = {
  footprint: 1.1, // ancho/profundidad del marco
  postSize: 0.07, // grosor de paneles y techo del marco
  frameHeight: 1.3, // alto del marco, desde el zócalo
  baseHeight: 0.1, // zócalo apoyado en el piso
  bedY: 0.62, // altura del CENTRO de la cama
  bedThickness: 0.05,
  bedSize: 0.85,
};

/** Marco abierto al frente (+Z) para que la cama y el número del fondo se vean sin leer nada. */
function buildPrinter(id: PrinterId, x: number, frameColor: number, label: string): Group {
  const group = new Group();
  group.name = id;
  group.position.set(x, 0, 0);

  const frameMat = new MeshStandardMaterial({ color: frameColor, roughness: 0.5, metalness: 0.2 });
  const baseMat = new MeshStandardMaterial({ color: 0x22252c, roughness: 0.7 });
  const bedMat = new MeshStandardMaterial({ color: 0xd7dbe4, roughness: 0.4 });

  const half = PRINTER.footprint / 2;

  const base = new Mesh(new BoxGeometry(PRINTER.footprint, PRINTER.baseHeight, PRINTER.footprint), baseMat);
  base.position.y = PRINTER.baseHeight / 2;
  group.add(base);

  const frameBottomY = PRINTER.baseHeight;
  const frameCenterY = frameBottomY + PRINTER.frameHeight / 2;

  // Panel trasero: aquí va el número grande, visible a través del frente abierto.
  const back = new Mesh(new BoxGeometry(PRINTER.footprint, PRINTER.frameHeight, PRINTER.postSize), frameMat);
  back.position.set(0, frameCenterY, -half + PRINTER.postSize / 2);
  group.add(back);

  const sideGeo = new BoxGeometry(PRINTER.postSize, PRINTER.frameHeight, PRINTER.footprint);
  const left = new Mesh(sideGeo, frameMat);
  left.position.set(-half + PRINTER.postSize / 2, frameCenterY, 0);
  group.add(left);
  const right = new Mesh(sideGeo, frameMat);
  right.position.set(half - PRINTER.postSize / 2, frameCenterY, 0);
  group.add(right);

  const top = new Mesh(new BoxGeometry(PRINTER.footprint, PRINTER.postSize, PRINTER.footprint), frameMat);
  top.position.y = frameBottomY + PRINTER.frameHeight - PRINTER.postSize / 2;
  group.add(top);

  // Número grande (E3): sin leer texto, P1 y P2 ya se distinguen por color + dígito.
  const numberMat = new MeshBasicMaterial({ map: numberTexture(label, '#ffffff'), transparent: true, alphaTest: 0.05 });
  const numberPlate = new Mesh(new PlaneGeometry(0.65, 0.65), numberMat);
  numberPlate.position.set(0, frameCenterY + 0.05, -half + PRINTER.postSize + 0.01);
  group.add(numberPlate);

  // Cama (placa visible) + ancla `P{n}-cama` exactamente en su superficie superior.
  const bed = new Mesh(new BoxGeometry(PRINTER.bedSize, PRINTER.bedThickness, PRINTER.bedSize), bedMat);
  bed.position.y = PRINTER.bedY;
  group.add(bed);

  const bedAnchor = new Object3D();
  bedAnchor.name = `${id}-cama`;
  bedAnchor.position.y = PRINTER.bedY + PRINTER.bedThickness / 2;
  group.add(bedAnchor);

  return group;
}

// ── Brazo robótico central ───────────────────────────────────────────────────────
// Jerarquía y ejes de giro fijados por contrato (§5.7): brazo › brazo-base (Y) › brazo-hombro (Z)
// › brazo-codo (Z) › brazo-pinza › pinza-izq/der. Alcance total ≥ 3.2 (ver ARM abajo).
const ARM = {
  pedestalRadius: 0.32,
  pedestalHeight: 0.5,
  upperLength: 1.5, // brazo-hombro → brazo-codo
  upperThickness: 0.16,
  foreLength: 1.4, // brazo-codo → brazo-pinza
  foreThickness: 0.13,
  wristLength: 0.18,
  fingerLength: 0.24,
  fingerGap: 0.09,
};
// Alcance máximo (radio horizontal, brazo extendido): 1.5 + 1.4 + 0.18 + 0.24 = 3.32 ≥ 3.2 ✓

function buildArm(): Group {
  const root = new Group();
  root.name = 'brazo';
  root.position.set(0, 0, 0);

  const metal = new MeshStandardMaterial({ color: 0x8993a6, roughness: 0.35, metalness: 0.6 });
  const dark = new MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.5, metalness: 0.3 });
  const accent = new MeshStandardMaterial({ color: 0xe0b843, roughness: 0.4, metalness: 0.3 });

  // brazo-base: gira en Y (orientación general del brazo hacia el objetivo).
  const base = new Group();
  base.name = 'brazo-base';
  root.add(base);

  const pedestal = new Mesh(new CylinderGeometry(ARM.pedestalRadius, ARM.pedestalRadius * 1.15, ARM.pedestalHeight, 20), dark);
  pedestal.position.y = ARM.pedestalHeight / 2;
  base.add(pedestal);

  // brazo-hombro: gira en Z. Nace arriba del pedestal.
  const hombro = new Group();
  hombro.name = 'brazo-hombro';
  hombro.position.set(0, ARM.pedestalHeight, 0);
  hombro.rotation.z = MathUtils.degToRad(70); // pose de reposo: recogido hacia arriba
  base.add(hombro);

  const shoulderHub = new Mesh(new SphereGeometry(0.12, 16, 12), dark);
  hombro.add(shoulderHub);

  const upperArm = new Mesh(new BoxGeometry(ARM.upperLength, ARM.upperThickness, ARM.upperThickness), metal);
  upperArm.position.x = ARM.upperLength / 2;
  hombro.add(upperArm);

  // brazo-codo: gira en Z. Nace en la punta del segmento superior.
  const codo = new Group();
  codo.name = 'brazo-codo';
  codo.position.set(ARM.upperLength, 0, 0);
  codo.rotation.z = MathUtils.degToRad(-125); // pose de reposo: antebrazo doblado
  hombro.add(codo);

  const elbowHub = new Mesh(new SphereGeometry(0.1, 16, 12), dark);
  codo.add(elbowHub);

  const foreArm = new Mesh(new BoxGeometry(ARM.foreLength, ARM.foreThickness, ARM.foreThickness), metal);
  foreArm.position.x = ARM.foreLength / 2;
  codo.add(foreArm);

  // brazo-pinza: nace en la punta del antebrazo; agrupa muñeca y dedos.
  const pinza = new Group();
  pinza.name = 'brazo-pinza';
  pinza.position.set(ARM.foreLength, 0, 0);
  codo.add(pinza);

  const wrist = new Mesh(new BoxGeometry(ARM.wristLength, 0.15, 0.15), dark);
  wrist.position.x = ARM.wristLength / 2;
  pinza.add(wrist);

  const fingerGeo = new BoxGeometry(ARM.fingerLength, 0.06, 0.05);
  const pinzaIzq = new Mesh(fingerGeo, accent);
  pinzaIzq.name = 'pinza-izq';
  pinzaIzq.position.set(ARM.wristLength + ARM.fingerLength / 2, 0, ARM.fingerGap / 2);
  pinza.add(pinzaIzq);

  const pinzaDer = new Mesh(fingerGeo, accent);
  pinzaDer.name = 'pinza-der';
  pinzaDer.position.set(ARM.wristLength + ARM.fingerLength / 2, 0, -ARM.fingerGap / 2);
  pinza.add(pinzaDer);

  return root;
}

// ── Cajones (fila al fondo, z = -2.5) ────────────────────────────────────────────
const DRAWER = { width: 0.8, height: 0.6, depth: 0.8, bodyColor: 0x6b4a34 };

function buildDrawer(id: DrawerId, x: number): Group {
  const group = new Group();
  group.name = id;
  group.position.set(x, 0, -2.5);

  const bodyMat = new MeshStandardMaterial({ color: DRAWER.bodyColor, roughness: 0.8 });
  const body = new Mesh(new BoxGeometry(DRAWER.width, DRAWER.height, DRAWER.depth), bodyMat);
  body.position.y = DRAWER.height / 2;
  group.add(body);

  const handleMat = new MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.4, metalness: 0.6 });
  const handle = new Mesh(new BoxGeometry(0.3, 0.04, 0.04), handleMat);
  handle.position.set(0, DRAWER.height * 0.55, DRAWER.depth / 2 + 0.03);
  group.add(handle);

  // Número grande en la puerta (E3): se lee el cajón sin acercarse.
  const label = id.slice('cajon-'.length); // 'cajon-3' → '3'
  const numberMat = new MeshBasicMaterial({ map: numberTexture(label, '#f3ede2'), transparent: true, alphaTest: 0.05 });
  const numberPlate = new Mesh(new PlaneGeometry(0.4, 0.4), numberMat);
  numberPlate.position.set(0, DRAWER.height * 0.62, DRAWER.depth / 2 + 0.011);
  group.add(numberPlate);

  // Ancla `cajon-N-ancla`: donde queda la pieza guardada, apoyada sobre la tapa.
  const anchor = new Object3D();
  anchor.name = `${id}-ancla`;
  anchor.position.y = DRAWER.height + 0.001;
  group.add(anchor);

  return group;
}

// ── Pieza: plantilla invisible que WS-3 clona por job ───────────────────────────
function buildPieza(scene: Scene): void {
  const mat = new MeshStandardMaterial({ color: 0x36c2a8, roughness: 0.4 });
  const pieza = new Mesh(new BoxGeometry(0.16, 0.16, 0.16), mat);
  pieza.name = 'pieza';
  pieza.visible = false;
  scene.add(pieza);
}

/** Arma toda la escena quieta (sala, luces, impresoras, brazo, cajones y la plantilla `pieza`). */
export function buildScene(scene: Scene): void {
  buildRoom(scene);
  buildLights(scene);

  scene.add(buildPrinter('P1', -2, 0x2f6fed, '1'));
  scene.add(buildPrinter('P2', 2, 0xe0653a, '2'));

  scene.add(buildArm());

  scene.add(buildDrawer('cajon-1', -1.5));
  scene.add(buildDrawer('cajon-2', -0.5));
  scene.add(buildDrawer('cajon-3', 0.5));
  scene.add(buildDrawer('cajon-4', 1.5));

  buildPieza(scene);
}
