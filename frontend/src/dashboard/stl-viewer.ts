// WS-1 · Daniela — Visor STL (tarea D2 de plan.md §7).
// Renderer de Three.js propio e independiente del lab (WS-2). No mide, no slicea,
// no sube el archivo al servidor: se lee en el navegador con FileReader/ArrayBuffer.
import {
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface StlViewer {
  /** Carga y muestra un archivo .stl leído del navegador (nunca se sube al servidor). */
  showFile(file: File): void;
  /** Vuelve al estado vacío (sin pieza). */
  clear(): void;
  /** Debe llamarse si el contenedor cambia de tamaño (p. ej. layout responsive). */
  resize(): void;
}

export function mountStlViewer(container: HTMLElement): StlViewer {
  container.classList.add('stl-viewer');

  const canvasHost = document.createElement('div');
  canvasHost.className = 'stl-viewer__canvas';

  const placeholder = document.createElement('div');
  placeholder.className = 'stl-viewer__overlay stl-viewer__overlay--placeholder';
  placeholder.textContent = 'Adjunta un archivo .stl para ver la pieza aquí.';

  const errorOverlay = document.createElement('div');
  errorOverlay.className = 'stl-viewer__overlay stl-viewer__overlay--error';
  errorOverlay.hidden = true;

  const fileTag = document.createElement('div');
  fileTag.className = 'stl-viewer__filetag';
  fileTag.hidden = true;

  container.append(canvasHost, placeholder, errorOverlay, fileTag);

  // El renderer se crea perezosamente: si nunca se adjunta un archivo, no hace falta WebGL.
  let renderer: WebGLRenderer | null = null;
  let scene: Scene | null = null;
  let camera: PerspectiveCamera | null = null;
  let controls: OrbitControls | null = null;
  let mesh: Mesh | null = null;

  function ensureRenderer(): { renderer: WebGLRenderer; scene: Scene; camera: PerspectiveCamera; controls: OrbitControls } {
    if (renderer && scene && camera && controls) {
      return { renderer, scene, camera, controls };
    }
    scene = new Scene();
    scene.background = new Color(0x14161c);

    camera = new PerspectiveCamera(45, 1, 0.1, 10000);

    renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasHost.appendChild(renderer.domElement);

    scene.add(new HemisphereLight(0xffffff, 0x20242c, 1.15));
    const dir = new DirectionalLight(0xffffff, 1.35);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const dir2 = new DirectionalLight(0xffffff, 0.5);
    dir2.position.set(-6, -4, -8);
    scene.add(dir2);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    renderer.setAnimationLoop(() => {
      controls?.update();
      if (renderer && scene && camera) renderer.render(scene, camera);
    });

    doResize();
    return { renderer, scene, camera, controls };
  }

  function doResize(): void {
    if (!renderer || !camera) return;
    const w = canvasHost.clientWidth || container.clientWidth || 1;
    const h = canvasHost.clientHeight || container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frameMesh(obj: Mesh): void {
    if (!camera || !controls) return;
    const box = new Box3().setFromObject(obj);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    camera.near = Math.max(maxDim / 100, 0.01);
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    const distance = maxDim * 1.6;
    camera.position.set(center.x + distance * 0.75, center.y + distance * 0.65, center.z + distance * 0.75);
    controls.target.copy(center);
    camera.lookAt(center);
    controls.update();
  }

  function setPlaceholder(visible: boolean): void {
    placeholder.hidden = !visible;
  }

  function showError(fileName: string): void {
    canvasHost.hidden = true;
    setPlaceholder(false);
    fileTag.hidden = true;
    errorOverlay.hidden = false;
    errorOverlay.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = fileName;
    const msg = document.createElement('span');
    msg.textContent = 'no se pudo mostrar';
    errorOverlay.append(strong, msg);
  }

  function clearMesh(): void {
    if (mesh && scene) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshStandardMaterial).dispose();
      mesh = null;
    }
  }

  function showFile(file: File): void {
    errorOverlay.hidden = true;
    if (!/\.stl$/i.test(file.name)) {
      showError(file.name);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => showError(file.name);
    reader.onload = () => {
      try {
        const buffer = reader.result;
        if (!(buffer instanceof ArrayBuffer)) throw new Error('lectura vacía');

        const { scene: sc } = ensureRenderer();
        canvasHost.hidden = false;
        setPlaceholder(false);

        const loader = new STLLoader();
        const geometry = loader.parse(buffer);
        geometry.computeVertexNormals();
        geometry.center();

        clearMesh();
        const material = new MeshStandardMaterial({ color: 0x8fb4ff, metalness: 0.15, roughness: 0.55 });
        mesh = new Mesh(geometry, material);
        sc.add(mesh);

        frameMesh(mesh);
        doResize();

        fileTag.hidden = false;
        fileTag.textContent = file.name;
      } catch (err) {
        console.error('[dashboard] no se pudo interpretar el STL', err);
        showError(file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function clear(): void {
    clearMesh();
    canvasHost.hidden = true;
    errorOverlay.hidden = true;
    fileTag.hidden = true;
    setPlaceholder(true);
  }

  clear();

  // Nadie fuera de este módulo llama a resize(): el visor se cuida solo ante cambios de tamaño.
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => doResize());
    ro.observe(container);
  } else {
    window.addEventListener('resize', doResize);
  }

  return { showFile, clear, resize: doResize };
}
