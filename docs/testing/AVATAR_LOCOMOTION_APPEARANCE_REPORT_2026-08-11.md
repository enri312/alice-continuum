# Informe de locomoción retargeteada y acabado visual — 2026-08-11

Estado: incremento local verificado en la aplicación Tauri real

## Alcance

- Retargeting de nueve clips privados Mixamo para `idle`, avance, carrera, retroceso, laterales, giros izquierdo/derecho y salto.
- Mezcla direccional y etiquetas explícitas para giro izquierdo y derecho.
- Telemetría visible de animación, velocidad, pie apoyado, corrección horizontal y corrección de suelo.
- Consolidación de la corrección horizontal en el movimiento raíz al cambiar o liberar el apoyo.
- IK posicional de dos huesos sobre muslo y pantorrilla, conservando la orientación mundial animada del pie.
- Acabado techwear local sobre materiales MToon de ropa, sin modificar piel, ojos, cabello o el archivo VRM.
- Sombras suaves, anisotropía limitada y luz de relleno cálida para separar capas oscuras.

## Calibración desde activos reales

Se inspeccionaron las pistas `mixamorigHips.position` y el recorrido de ambos pies en cada FBX. Los clips activos son esencialmente *in place*: no existe desplazamiento raíz acumulado que deba sumarse al movimiento de la escena. La longitud de paso relativa a la altura de cadera mostró perfiles diferentes para marcha, retroceso, laterales y carrera. Por eso cada acción usa ahora su propia frecuencia base en lugar de una velocidad de reproducción común.

Los clips `Left Turn.fbx` y `Right Turn.fbx` duran 1,167 s, contienen 53 pistas y acumulan aproximadamente +90° y −90° en la cadera. El retargeter elimina sólo ese giro raíz acumulado y conserva inclinación y balance corporal. La orientación global continúa gobernada por el stick derecho; una secuencia real de cuarenta capturas a intervalos de 250 ms confirmó giro progresivo y retorno sin salto al repetir el clip.

Durante el ensayo Tauri de diez segundos se observaron aproximadamente:

- marcha: 0,46–0,49 m/s;
- carrera: 1,20–1,24 m/s;
- retroceso: 0,51–0,52 m/s;
- lateral: 0,44–0,49 m/s;
- reposo: 0,00 m/s, pie libre y corrección horizontal 0,0 cm;
- corrección vertical observada: aproximadamente 0,0–2,0 cm.

## Ropa y preservación

El VRM contiene materiales diferenciables para chaqueta exterior, prenda interior, arnés, prenda base, zapatos y corbata. La aplicación aplica una paleta azul grafito con bordes cian moderados sólo a nombres terminados en `_CLOTH`. El acabado se produce durante la carga y no reescribe el modelo privado.

`Assets/Alice.vrm` conservó 18.631.596 bytes y SHA-256 `39E7815A3E34D179D431B81421A38F6B1AE2A4DFB4EC48DB336DBDBDCC51EB3B`.

## IK de apoyo

El solver CCD limitado opera después de la mezcla de animación y de la corrección raíz. Orienta la cadena muslo → pantorrilla hacia el punto mundial del pie apoyado, limita cada corrección angular y restaura la orientación mundial previa del zapato.

La primera ejecución real descubrió anclajes laterales fuera del alcance de la pierna, con picos de 17,0–33,9 cm. Esa versión no fue aceptada. El contacto se corrigió para consolidar y renovar cualquier anclaje cuya distancia horizontal supere 7,5 cm. En la repetición completa:

- error IK observado: 0,0–1,9 cm;
- reposo: IK libre y error 0,0 cm;
- giros: error observado de 0,1–0,9 cm;
- no se observaron rodillas invertidas, torsiones o saltos en cuarenta capturas separadas por 250 ms.

## Verificación

- 21 archivos de pruebas TypeScript aprobados.
- 133 pruebas TypeScript aprobadas.
- 143 pruebas Rust aprobadas y 7 pruebas vivas ignoradas por requerir hardware o datos canónicos explícitos.
- `cargo clippy --all-targets -- -D warnings` aprobado.
- build TypeScript/Vite aprobado.
- carga real de `Alice.vrm` aprobada dentro de Tauri.
- secuencia real de diez segundos observada y capturada tras reiniciar el ejecutable.
- piel, ojos y cabello excluidos por pruebas del clasificador de materiales.

## Límite pendiente

El IK actual trabaja contra un plano de suelo constante y sólo durante control manual o diagnóstico. No consulta geometría, pendientes, escalones, colisiones ni navegación; tampoco sustituye locomoción física o movimiento raíz. El canal cognitivo `output.avatar.body` continúa desconectado.
