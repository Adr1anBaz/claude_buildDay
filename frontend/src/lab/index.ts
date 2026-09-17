// WS-2 · Elías — Lab 3D. Tareas E1-E4 en plan.md §7.
// STUB de WS-0: escena vacía con los nombres de §5.7 ausentes a propósito (getObject avisa claro).
// Reemplázalo, pero CONSERVA la firma y devuelve un LabHandle completo.
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { Deps, LabHandle, Unsubscribe } from '../contracts';

export function mountLab(root: HTMLElement, deps: Deps): LabHandle {
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(4, 3, 5);
  camera.lookAt(0, 0, 0);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);

  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'position:absolute;top:12px;left:12px;right:12px;display:flex;gap:8px';
  const volver = document.createElement('button');
  volver.textContent = 'Volver';
  volver.addEventListener('click', () => deps.showView('dashboard'));
  toolbar.appendChild(volver);
  root.appendChild(toolbar);

  const frameCbs = new Set<(dt: number) => void>();
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    for (const cb of [...frameCbs]) cb(dt);
    renderer.render(scene, camera);
  });

  function resize(): void {
    const w = root.clientWidth || innerWidth;
    const h = root.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    scene,
    toolbar,
    getObject(name: string) {
      const obj = scene.getObjectByName(name);
      if (!obj) throw new Error(`[lab] no existe el objeto "${name}" (stub de WS-0: falta la escena de Elías, tarea E1)`);
      return obj;
    },
    onFrame(cb): Unsubscribe {
      frameCbs.add(cb);
      return () => frameCbs.delete(cb);
    },
    resetCamera() {
      camera.position.set(4, 3, 5);
      camera.lookAt(0, 0, 0);
    },
    resize,
  };
}
