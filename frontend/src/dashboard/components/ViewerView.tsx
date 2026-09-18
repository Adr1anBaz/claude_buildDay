// WS-1 · Daniela — Visualizador 3D del .stl (§4). Solo explorar el modelo: sin medir, sin slicing.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type { BufferGeometry, PerspectiveCamera } from 'three';
import { ROUTES } from '../config';
import { useLab } from '../state/LabProvider';
import { IconRefresh } from './Icons';

/** Encuadra la pieza completa. Se vuelve a correr si cambia la geometría o se pide restablecer. */
function FitCamera({ geometry, signal }: { geometry: BufferGeometry; signal: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as { target?: { set(x: number, y: number, z: number): void }; update?(): void } | null;

  useEffect(() => {
    geometry.computeBoundingSphere();
    const r = geometry.boundingSphere?.radius ?? 1;
    const fov = (camera.fov * Math.PI) / 180;
    const dist = (r / Math.sin(fov / 2)) * 1.35;
    camera.position.set(dist * 0.62, dist * 0.48, dist * 0.62);
    camera.near = Math.max(dist / 500, 0.01);
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0, 0);
    controls?.target?.set(0, 0, 0);
    controls?.update?.();
  }, [geometry, signal, camera, controls]);

  return null;
}

export function ViewerView() {
  const { file } = useLab();
  const navigate = useNavigate();
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);

  // Carga y parseo del archivo. Un .stl ilegible NO deja la interfaz cargando para siempre.
  useEffect(() => {
    if (!file) {
      setGeometry(null);
      setError(null);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setError(null);

    file
      .arrayBuffer()
      .then((buf) => {
        const geo = new STLLoader().parse(buf);
        if (!geo.getAttribute('position') || geo.getAttribute('position').count === 0) {
          throw new Error('geometría vacía');
        }
        geo.center();
        geo.computeVertexNormals();
        if (cancelado) {
          geo.dispose();
          return;
        }
        setGeometry(geo);
      })
      .catch((err: unknown) => {
        console.warn('[visor] no se pudo interpretar el STL', err);
        // Mensaje textual exigido en §4.
        if (!cancelado) {
          setError(`${file.name} no se pudo mostrar.`);
          setGeometry(null);
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [file]);

  // Libera la malla anterior cuando llega una nueva (o al salir de la vista).
  useEffect(() => () => geometry?.dispose(), [geometry]);

  return (
    <section className="viewer">
      <div className="viewer__head">
        <div>
          <p className="eyebrow">Pieza</p>
          <h2 className="viewer__name">{file?.name ?? 'Sin archivo'}</h2>
        </div>
        <div className="viewer__actions">
          <button className="btn" onClick={() => setFitSignal((n) => n + 1)} disabled={!geometry}>
            <IconRefresh size={16} />
            Restablecer vista
          </button>
          <button className="btn" onClick={() => navigate(ROUTES.chat)}>Volver a la conversación</button>
        </div>
      </div>

      <div className="viewer__stage">
        {!file && <p className="viewer__msg">Adjunta un archivo .stl para verlo aquí.</p>}
        {loading && <p className="viewer__msg">Cargando la pieza…</p>}
        {error && (
          <div className="viewer__error" role="alert">
            <p>{error}</p>
            <span>Revisa que el archivo sea un STL válido (binario o ASCII).</span>
          </div>
        )}

        {geometry && !error && (
          <Canvas
            dpr={[1, 2]}
            camera={{ fov: 45, position: [2, 1.5, 2] }}
            gl={{ antialias: true }}
            style={{ background: 'transparent' }}
          >
            <hemisphereLight args={['#ffffff', '#dfe5ea', 0.85]} />
            <ambientLight intensity={0.35} />
            <directionalLight position={[4, 6, 4]} intensity={1.1} />
            <directionalLight position={[-5, 2, -3]} intensity={0.35} />
            <mesh geometry={geometry}>
              <meshStandardMaterial color="#c9d3db" metalness={0.12} roughness={0.55} />
            </mesh>
            <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
            <FitCamera geometry={geometry} signal={fitSignal} />
          </Canvas>
        )}
      </div>

      <p className="viewer__foot">Arrastra para rotar · rueda para acercar · clic derecho para desplazar</p>
    </section>
  );
}
