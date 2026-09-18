# Gemelo digital web — celda de manufactura (UR3 + 2 impresoras 3D)

Prompt de contexto para retomar/delegar. Rol: Ingeniero de Robótica + Frontend 3D senior (Three.js, DH, WebXR).

## Qué es
Lab con 2 impresoras (P1, P2), 1 UR3 con gripper de dos dedos, 4 cajones (cajon-1..4), zona de recolección humana.
Dos niveles de producto:
- **Vista de Daniela**: visor estático solo lectura. Órbita + zoom, nada se anima, sin chat/STL.
- **Consola de Sebas**: FK/IK, jogging con sliders, Pick&Place, waypoints. Simulador completo.
- Abierto: si la consola de Sebas es tercera pantalla que comparte escena o amplía la de Daniela. Arquitectura (escena compartida) soporta ambos.

## Estado actual — `index.html` (ES modules, three@0.160 vía importmap jsdelivr; requiere servidor http)
- **Fase A ✅** escena: 8 objetos nombrados (`P1`, `P2`, `brazo`, `cajon-1..4`, `pieza`), cámara 3/4 + OrbitControls sin pan, Volver (stub) / Reset, celda 2×2 m, `area-recoleccion` verde sin mesa.
- **Fase B ✅** Panel A jogging: 6 sliders, FK DH en vivo (mm / rotation vector rad), Homing, gripper, AxesHelper base/TCP, trayectoria TCP (línea).
- **Física ✅** cannon-es: gravedad para la pieza (cae a la caja al soltar a 7 cm), estáticos del entorno. **Colisiones ✅** esferas por eslabón (links URDF) vs OBB del entorno + banco; pre-chequeo de MoveJ/MoveL, parada de seguridad, toggle de esferas. **IK analítica ✅** cerrada UR (8 sol.) × 4 yaws, selección sin colisión/codo arriba/mín. distancia. **MoveL ✅** cartesiano con IK por paso. Planificador desde Home: gira base con brazo vertical y despliega; fallback a otras soluciones. Impresoras sin puerta (retirada, práctica de automatización). Banco 1.60×1.60, cajas rectas en el borde frontal (x −0.34…0.14, z≈−0.195). 8/8 rutas OK.
- **Repo equipo**: https://github.com/Adr1anBaz/claude_buildDay.git · rama `mundoElias` con carpeta `mundoElias/` (prototipo standalone). Integración como módulo TS en `frontend/src/lab/` (contrato `mountLab`, §5.7) pendiente; regla de propiedad `/ws-merge` solo acepta `frontend/src/lab/`.
- **Fase C+D-lite ✅** Panel B: origen P1/P2, destino caja 1-4, velocidad 0.5/1/2×, Stop, banner de fases. `imprimir(origen,destino)`: IK numérica DLS (posición + eje Z herramienta hacia abajo, θ6 libre, multi-semilla) → waypoints Home/pre-pick/pick/retract/Home/pre-place/place/Home con MoveJ cúbico. Pieza por `attach()`. LED + texto flotante por impresora. Verificado por CDP: 12/12 objetivos IK <0.5 mm; ciclos P1→1, P2→4, P2→2, P2→3 OK.
- **Fase E ✅** brazo = `ur3/models/ur_description/urdf/ur3.urdf` (URDF clásico, mallas Collada locales) cargado con `urdf-loader@0.12.3`. Montado dentro de `brazo` (frame DH) con `robot.rotation.z=π` (base_link clásico tiene X hacia atrás). `tcp` colgado de `robot.links.tool0`. Selfcheck tool0 vs FK DH: 0.000 mm / 0.00°. Gripper paralelo procedural estilo Robotiq Hand-E. `ur3/index.html` = visor standalone aportado por el usuario.
- **Impresoras**: Bambu Lab X1C/P1S procedural a medidas reales 389×389×457 mm + AMS 368×283×203 mm (puerta abierta 105° hacia el robot, cama 256×256, pantalla, AMS con 4 bobinas). No hay CAD oficial de Bambu redistribuible; se modeló por dimensiones.
- **Banco único 1.00 m** (`banco`, 1.60×1.10 m). Robot en (0, 1.0, -0.525). Impresoras cuerpo x=0.47 (cama 0.43 del eje), z=-0.740 / -0.310, frente hacia -X. Cajas: fila recta oblicua (yaw -35°) centrada a 0.35 m del robot hacia frente-izquierda; caja 1 a la izquierda vista desde el operador. Sin humano ni mesa en zona verde.
- **Restricción de layout**: con alcance 500 mm, 4 cajas en fila (0.62 m) solo caben centradas frente al robot a ≤0.35 m; por eso la fila va oblicua para alejarse de las impresoras. Más separación robot↔impresoras = IK falla.
- Debug URL: `?q=0,-90,0,-90,0,0` `&cam=x,y,z,tx,ty,tz` `&axes=1` `&auto=P1,cajon-2&vel=2`.
- API global `window.lab` = { scene, camera, joints, tcp, gripper, pieza, q, setQ, setGripper, forwardKinematics, ikSolve, ikFor, imprimir, DH, HOME }.
- Test E2E: `node tools/cdp-test.mjs http://localhost:8080/index.html`; captura: `node tools/cdp-view.mjs URL out.png` (Chrome headless + DevTools Protocol; `--screenshot`/virtual-time se cuelgan con urdf-loader).

## Jerarquía del brazo (frames DH)
`brazo` (rotation.x=-π/2 → DH Z arriba) > `joint-base`[Rz θ1] > `frame-1`[T(a,0,d)·Rx α] > `joint-shoulder` > … > `joint-wrist3` > `frame-6` > `tcp` (=T6_0) > `gripper`. Mallas URDF colgadas de cada `joint-i` con offset Tz(d_i) (link_i = joint-i·Tz(d_i)). Equivalencia URDF↔DH verificada algebraicamente y por selfcheck (0.000 mm).

## Tabla DH UR3 (m)
| i | joint | a | d | α |
|---|---|---|---|---|
|1|shoulder_pan|0|0.1519|+π/2|
|2|shoulder_lift|-0.24365|0|0|
|3|elbow|-0.21325|0|0|
|4|wrist_1|0|0.11235|+π/2|
|5|wrist_2|0|0.08535|-π/2|
|6|wrist_3|0|0.0819|0|
A_i = Rz(θ)·Tz(d)·Tx(a)·Rx(α); T6_0 = A1…A6. Verificado: q=0 → (-456.9, -194.3, 66.6) mm (coincide con UR3 real).

## Layout (m, Three: Y arriba; robot en x=0,z=-0.4; frente robot = +x)
- P1 (0.30, 1.0, -0.70) azul #2b6fd6 · P2 (0.30, 1.0, -0.40) naranja #d6742b
- cajon-1..4 x = -0.39, -0.26, -0.13, 0.00; z = -0.10
- recolección: franja verde z≈0.75, repisa 1 m de alto
- Alcance UR3 = 500 mm (datasheet). Base Ø128 mm. Todo el clúster dentro de ~0.5 m. Validar formalmente con IK (Fase D).
- Nodos de anclaje para pieza: `P1-slot`, `P2-slot`, `cajon-N-slot`. LEDs `P1-led`, `P2-led` (gris = sin pieza).

## Decisiones
- UMD no ES modules: CSP de Claude Artifacts (solo jsdelivr/cdnjs/tailwind/jquery/Google Fonts). No aplica en Vite/npm.
- `renderer.setAnimationLoop` desde el día 1 → WebXR barato (Fase F).
- Geometría procedural; urdf-loader + mallas reales en Fase E (requiere salir del sandbox).
- Paleta: fondo #0a0d12, texto #e6eaf0, tenue #5d6673, IBM Plex Mono.
- "Volver" = stub `console.log`, pendiente routing del dashboard de Daniela.

## Roadmap
| Fase | Contenido | Estado |
|---|---|---|
| A | Escena estática | ✅ |
| B | FK + sliders | ✅ |
| C | Pick&Place `imprimir(origen,destino)` MoveJ; falta MoveL y grabador de waypoints | ✅ parcial |
| D | IK numérica DLS hecha; IK analítica 8 soluciones pendiente | ✅ parcial |
| E | Mallas oficiales UR3 (hecho); falta urdf-loader formal / Bambu CAD real | ✅ parcial |
| F | VR WebXR: VRButton, rig en zona de recolección, mandos (locomoción, iniciar/stop, selección), tablero 3D | ✅ |

## Espec pendiente (consola completa)
Panel B: selector origen (P1/P2), destino (cajón 1-4), Iniciar Simulación, velocidad 0.5/1/2×, parada de emergencia, banner de estado ("Aproximando…", "Sujetando pieza…", "Trasladando…", "Ciclo Terminado"). Baliza verde/azul/gris + texto "LISTA PARA PICK"/"EN ESPERA". Trayectoria TCP con línea. Grabador de waypoints → JSON. IK: θ1, θ5, θ6 cerradas; θ2/θ3/θ4 planar 2R + ley de cosenos; selección por distancia articular ponderada.

## Cómo probar
`python3 -m http.server 8080` → http://localhost:8080/ (ES modules exigen http, no file://). Headless (solo frame estático):
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1400,900 --virtual-time-budget=8000 --enable-logging=stderr --screenshot=/tmp/lab.png "file://$PWD/index.html" 2>&1 | grep CONSOLE
```
