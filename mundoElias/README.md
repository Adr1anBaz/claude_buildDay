# mundoElias — Gemelo digital 3D de la celda (UR3 + Bambu Lab P1/P2 + 4 cajas)

Visor web autocontenido (Three.js 0.160 vía importmap CDN, ES modules). Frontend independiente del Vite del equipo;
se sirve con cualquier servidor estático. Necesita internet para los CDN (three, urdf-loader, cannon-es, fuente).

## Correr

```bash
cd mundoElias
python3 -m http.server 8080      # o: npx serve .
# → http://localhost:8080/
```

## Qué hay

- `index.html` — todo el visor: escena, UR3 desde URDF (`ur3/`), impresoras Bambu X1C a medidas reales, banco 1.60×1.60 m a 1.00 m,
  cajas en el borde frontal, física (cannon-es: la pieza cae a la caja al soltarla), control de colisiones del brazo
  (esferas por eslabón vs. entorno; pre-chequeo de trayectorias y parada de seguridad), IK analítica UR (8 soluciones),
  MoveJ/MoveL, Pick & Place `imprimir(P1|P2, cajon-1..4)` con panel de operación y panel de jogging con FK en vivo.
- `ur3/` — URDF clásico + mallas Collada del UR3 (ur_description) y visor standalone original.
- `tools/cdp-test.mjs` — test E2E (Chrome headless + DevTools Protocol): `node tools/cdp-test.mjs http://localhost:8080/index.html`.
  Rutas: `ROUTES="P1,cajon-2;P2,cajon-3" node tools/cdp-test.mjs …`. `tools/cdp-view.mjs URL out.png` captura pantalla.
- `CONTEXT.md` — historia, decisiones, restricciones (alcance UR3 500 mm) y roadmap.

## VR (WebXR)

Botón **ENTER VR** abajo al centro (aparece "VR NOT SUPPORTED" si el navegador no tiene WebXR). El usuario aparece de pie en la
zona de recolección mirando al banco. Mandos: stick izq = caminar · stick der = girar 45° · gatillo der = Iniciar ciclo ·
grip der = Stop · gatillo izq = siguiente caja · grip izq = cambiar impresora. Tablero de estado 3D sobre el banco.

- Probar en PC sin casco: extensión "Immersive Web Emulator" (Chrome/Edge).
- Meta Quest: WebXR exige https o localhost. Con cable: `adb reverse tcp:8080 tcp:8080` y abrir `http://localhost:8080/` en el
  navegador del Quest. Sin cable: servir por https (p. ej. `npx local-ssl-proxy --source 8443 --target 8080`) o un túnel.

## Nombres de objetos (scene.getObjectByName)

`P1`, `P2`, `P1-slot`, `P2-slot`, `P1-led`, `P2-led`, `brazo`, `tcp`, `gripper`, `finger-L`, `finger-R`,
`cajon-1..4`, `cajon-N-slot`, `pieza`, `banco`, `area-recoleccion`. API global `window.lab` (ver `index.html` §7).

## Parámetros de URL

`?q=0,-90,0,-90,0,0` postura · `&cam=x,y,z,tx,ty,tz` cámara · `&axes=1` ejes · `&auto=P1,cajon-2&vel=2` ciclo automático.

## Estado

Ciclos verificados P1→1, P2→2, P2→4 (colisión-free, pieza reposa en la caja). Pendiente: integrar como módulo TS en
`frontend/src/lab/` (contrato `mountLab(root, deps): LabHandle`, nombres §5.7) — este directorio es el prototipo funcional.
