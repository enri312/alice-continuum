# ADR-P-060 — Telemetría motora aislada y detalle superficial no cromático

Fecha: 2026-08-11  
Estado: aceptada para el visor privado

## Contexto

La FSM corporal ya mueve el avatar, pero el Núcleo no podía acreditar esas ejecuciones. Al mismo tiempo, el propietario pidió más detalle en la ropa sin agregar ni alterar colores y confirmó que el VRM es de su propiedad y uso privado.

## Decisión

- Registrar solamente cambios de estado, nunca fotogramas ni valores continuos del mando.
- Usar `source=avatar`, capacidad fija `avatar.vrm.render`, siete operaciones cerradas y tres procedencias cerradas.
- Mantener `subjectDigest`, duración y decisión en `null`; no guardar sticks, poses, coordenadas, contenido o nombres de archivos privados.
- Añadir `Motor manual` al snapshot R3 v2, sin enlace a contexto, planificador o salida.
- Limitar el ensayo local a diez segundos y detenerlo automáticamente.
- Mejorar la ropa únicamente mediante anisotropía, mipmaps, filtrado, `alphaToCoverage` y una intensificación moderada del mapa normal ya incluido.
- Aplicar el detalle una sola vez por material y verificar por prueba que color base, sombra, rim y emisión no cambian.
- No modificar el archivo `Assets/Alice.vrm` ni los FBX privados.

## Consecuencias

La interfaz muestra actividad corporal verdadera sin afirmar libre albedrío, aprendizaje o decisión cognitiva. El acabado gana definición a distancia y relieve bajo luz conservando la paleta existente. Un futuro puente `output.avatar.body` necesitará su propia capacidad, autorización, objetivo y evaluación de resultado.
