// WS-2 · Elías — Lab 3D. Tareas E1-E4 en plan.md §7.
// Escena QUIETA: nada se anima aquí salvo la cámara. WS-3 (Sebas) mueve estos objetos por su cuenta.
import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Deps, LabHandle, Unsubscribe } from '../contracts';
import { buildScene, CAMERA_TARGET } from './scene';

// Encuadre 3/4 inicial: caben P1, P2, el brazo y los 4 cajones en un solo frame (E1/E4).
const CAMERA_START = { x: 6, y: 4.8, z: 7.2 };

export function mountLab(root: HTMLElement, deps: Deps): LabHandle {
  const scene = new Scene();
  scene.background = new Color(0x14161c);
  buildScene(scene);

  const camera = new PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(CAMERA_START.x, CAMERA_START.y, CAMERA_START.z);
  camera.lookAt(CAMERA_TARGET);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  // OrbitControls (E4): arrastrar orbita, rueda hace zoom. Sin paneo (sin WASD/pointer lock).
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(CAMERA_TARGET);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 16;
  // No bajar de la altura del piso (y=0): límite calculado a partir del objetivo y el zoom mínimo,
  // dejando un pequeño colchón (floorBuffer) para no rasar la cámara contra el suelo.
  const floorBuffer = 0.2;
  const cosLimit = (floorBuffer - CAMERA_TARGET.y) / controls.minDistance;
  controls.maxPolarAngle = Math.acos(Math.max(-1, Math.min(1, cosLimit)));
  controls.update();

  // Toolbar (E2): Volver arriba-izq., Reset cámara arriba-der. Sebas agrega aquí "Simular".
  const toolbar = document.createElement('div');
  toolbar.style.cssText =
    'position:absolute;top:12px;left:12px;right:12px;display:flex;align-items:center;gap:8px;pointer-events:none';

  const buttonStyle =
    'pointer-events:auto;padding:8px 16px;border-radius:8px;border:1px solid #3a4050;' +
    'background:#1c2028;color:#e6e8ee;font-size:14px';

  const volver = document.createElement('button');
  volver.textContent = '← Volver';
  volver.style.cssText = buttonStyle;
  volver.addEventListener('click', () => deps.showView('dashboard'));
  toolbar.appendChild(volver);

  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'Reset cámara';
  resetBtn.style.cssText = `${buttonStyle};margin-left:auto`;
  resetBtn.addEventListener('click', resetCamera);
  toolbar.appendChild(resetBtn);

  root.appendChild(toolbar);

  const frameCbs = new Set<(dt: number) => void>();
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    controls.update();
    for (const cb of [...frameCbs]) cb(dt);
    renderer.render(scene, camera);
  });

  function resize(): void {
    // El contenedor puede tener tamaño 0 mientras la vista está oculta; usamos la ventana de respaldo.
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  function resetCamera(): void {
    camera.position.set(CAMERA_START.x, CAMERA_START.y, CAMERA_START.z);
    controls.target.copy(CAMERA_TARGET);
    camera.lookAt(CAMERA_TARGET);
    controls.update();
  }

  return {
    scene,
    toolbar,
    getObject(name: string) {
      const obj = scene.getObjectByName(name);
      if (!obj) throw new Error(`[lab] no existe el objeto "${name}" en la escena del laboratorio`);
      return obj;
    },
    onFrame(cb): Unsubscribe {
      frameCbs.add(cb);
      return () => frameCbs.delete(cb);
    },
    resetCamera,
    resize,
  };
}
