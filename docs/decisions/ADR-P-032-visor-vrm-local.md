# ADR-P-032 — Visor VRM local y privado

Fecha: 2026-08-07  
Estado: aceptada para implementación

## Contexto

Alice dispone de un avatar propio creado por Enrique en VRoid Studio y guardado en `E:\Proyecto P\Assets\Alice.vrm`. Antes de conectar voz, cámara, expresiones o movimiento corporal es necesario demostrar que la aplicación puede cargarlo, mostrarlo y liberar sus recursos correctamente.

El archivo declara uso del creador, atribución requerida, redistribución prohibida y modificaciones prohibidas. Por ello no debe copiarse a `public/`, `dist/`, instaladores, repositorios ni exportaciones.

## Decisión

- Crear una pantalla `src/Page/Avatar.tsx` y un visor WebGL reutilizable.
- Cargar VRM 1.0 con Three.js, `GLTFLoader` y `VRMLoaderPlugin` de `@pixiv/three-vrm`.
- Exponer solamente el archivo exacto `E:\Proyecto P\Assets\Alice.vrm` mediante el protocolo local de Tauri. No se habilitarán comodines sobre el disco E ni la carpeta personal.
- Obtener la ruta y el estado desde un comando Rust; React no adivina rutas ni examina carpetas.
- Mostrar estados verificables: no disponible, cargando, listo o error. Los contadores procederán del VRM cargado.
- Permitir giro, desplazamiento, zoom y restablecimiento del visor sin modificar el modelo.
- Mantener cámara, micrófono, seguimiento, voz, expresiones dirigidas y Ragdoll desconectados.
- Llamar `vrm.update(delta)` durante el renderizado para actualizar componentes VRM y huesos secundarios incluidos en el archivo.
- Liberar geometrías, materiales, texturas, controles y renderer al desmontar la pantalla.

## Consecuencias

- El avatar permanece local y no forma parte de la distribución de Alice.
- La configuración inicial es deliberadamente específica para este equipo. La selección portable de archivos se abordará después con diálogo y alcance persistente.
- Ver el avatar en pantalla no significa que Alice tenga cuerpo, seguimiento, emociones ni autonomía corporal.
- Ragdoll necesitará un motor físico y un contrato separado; no se simulará con animaciones ficticias.

## Criterios de aceptación

1. Si el archivo no existe, la pantalla informa la ausencia sin inventar un avatar.
2. Si existe, el visor lo carga desde disco local sin red ni copia en `dist/`.
3. La pantalla muestra metadatos básicos y capacidades realmente presentes.
4. El usuario puede inspeccionar el modelo con mouse o touch y restablecer la cámara.
5. Al abandonar la pantalla se cancelan animación y observadores y se liberan recursos gráficos.
6. `Assets/*.vrm` continúa excluido de Git.
