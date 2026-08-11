# ADR-P-058 — Locomoción retargeteada sólo con activos compatibles

Fecha: 2026-08-11  
Estado: aceptada para la evolución del BODY SOLVER

## Contexto

La marcha procedural confirmó el rig de Alice, pero no ofrece apoyo de pies ni transiciones de calidad final. La carpeta externa `E:\Avatar` contiene UnityChan 1.4.0, clips FBX, controladores Mecanim y un prototipo Three.js útil como referencia arquitectónica.

La licencia vigente de UnityChan indica que reutilizar sus datos para un personaje distinto queda sujeto a Unity Companion License. Esta última limita el uso a contenido creado o distribuido en conexión con una licencia válida del motor Unity. Alice está construida con Tauri, React y Three.js.

## Decisión

- No copiar modelos, voces, texturas, animaciones ni código de UnityChan al repositorio o al runtime de Alice.
- Sí estudiar patrones generales no protegibles: máquina de estados, clips direccionales, `AnimationMixer`, crossfade, separación de root motion e IK de pies.
- Obtener o producir clips de idle, avance, retroceso, lateral, giro y carrera con licencia explícitamente compatible con Alice y su distribución futura.
- Retargetear por huesos humanoides VRM, no por coincidencia frágil de nombres de nodos.
- Mantener movimiento de raíz, animación, colisión/terreno e intención cognitiva como capas separadas.
- Incorporar cada activo futuro con procedencia, licencia, digest y prueba visual documentados.

## Consecuencias

- `E:\Avatar` permanece intacta y externa; no forma parte de Git.
- La marcha procedural actual sigue siendo un diagnóstico reversible.
- El siguiente prototipo corporal será un reproductor/retargeter gobernado, no una copia del prototipo UnityChan.

## Fuentes de licencia verificadas

- [Unity-Chan License Terms 3.0](https://unity-chan.com/contents/license_en/)
- [Unity-Chan guideline 3.0](https://unity-chan.com/contents/guideline_en/)
- [Unity Companion License 1.4](https://unity.com/legal/licenses/unity-companion-license)
