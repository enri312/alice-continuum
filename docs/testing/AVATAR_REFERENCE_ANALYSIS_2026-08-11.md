# Análisis técnico de referencias — `E:\Avatar`

Fecha: 2026-08-11  
Resultado: útil como referencia; activos excluidos de Alice

## Alcance y preservación

La carpeta se inspeccionó en modo lectura. No se editaron, movieron ni copiaron sus archivos.

| Métrica | Resultado real |
|---|---:|
| Archivos | 3.994 |
| Tamaño | 690.502.149 bytes |
| FBX | 55 |
| Unity `.anim` | 17 |
| Controladores Mecanim | 3 |
| Audio WAV | 782 |

La mayor parte corresponde a `UnityChan_v1.4.0.unitypackage`, una extracción de sus assets y `web_prototype`, un experimento Vite/Three.js que vuelve a exponer varios archivos. Las cifras incluyen duplicados entre el paquete extraído y el prototipo.

## Evidencia de animación real

Los clips se analizaron directamente con el `FBXLoader` instalado en el prototipo, sin render simulado:

| Clip | Duración | Pistas |
|---|---:|---:|
| `WAIT00` | 2,917 s | 219 |
| `WALK00_F` | 1,333 s | 231 |
| `WALK00_B` | 4,500 s | 231 |
| `WALK00_L` | 1,333 s | 231 |
| `WALK00_R` | 1,333 s | 231 |
| `RUN00_F` | 0,833 s | 231 |

Las pistas usan nombres `Character1_*` y abarcan cadera, piernas, pies, dedos, tres segmentos de columna, brazos, manos, cuello y cabeza. Alice declara 54 huesos humanoides VRM equivalentes bajo nombres `J_Bip_*`, por lo que el retargeting es técnicamente viable mediante el contrato humanoide.

## Lo que conviene aprender

1. Un estado locomotor mezcla idle, avance, retroceso y laterales a partir de velocidad/dirección.
2. `AnimationMixer` y crossfade evitan saltos al cambiar de clip.
3. El controlador original activa IK de pies en Idle, WalkBack y Locomotion.
4. Movimiento de raíz, animación esquelética y física/collider deben coordinarse, pero conservar responsabilidades separadas.
5. El prototipo carga animaciones en segundo plano y vuelve a idle al terminar una acción puntual.

## Lo que no se incorpora

No se incorporarán los FBX, texturas, voces, modelo, controladores ni código de UnityChan. Bajo la licencia vigente, reutilizar datos del personaje para Alice remite a Unity Companion License, que condiciona el uso a una licencia del motor Unity. Alice no usa ese motor. Esta es una decisión conservadora de ingeniería y cumplimiento, no una opinión legal profesional.

La ruta segura es producir u obtener animaciones con licencia compatible y aplicar las ideas anteriores mediante un retargeter VRM propio.

## Fuentes oficiales

- [Unity-Chan License Terms 3.0](https://unity-chan.com/contents/license_en/)
- [Unity-Chan guideline 3.0](https://unity-chan.com/contents/guideline_en/)
- [Unity Companion License 1.4](https://unity.com/legal/licenses/unity-companion-license)
