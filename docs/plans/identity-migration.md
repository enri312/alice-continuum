# Plan de migración — Alice Cognitive Core

Estado: migración local completa; publicación privada pendiente  
Fecha: 2026-08-08

## Origen y destino

| Elemento | Origen | Destino |
|---|---|---|
| Proyecto actual | `E:\Proyecto P` | `E:\Alice Cognitive Core` |
| Datos privados | `E:\Proyecto P\data` | `E:\Alice Cognitive Core\data` |
| Avatar privado | `E:\Proyecto P\Assets` | `E:\Alice Cognitive Core\Assets` |
| Repositorio histórico | `E:\Alice` | No se modifica |
| GitHub histórico | `enri312/Alice` | No se modifica |
| GitHub nuevo | No existe | `enri312/alice-cognitive-core`, privado |

## Secuencia

1. Confirmar que el destino no existe y el origen está limpio.
2. Auditar exclusiones de datos, avatar y credenciales.
3. Cambiar identificadores internos con compatibilidad para el almacenamiento web anterior.
4. Ejecutar formato, pruebas, `clippy` y compilaciones.
5. Registrar la migración técnica en Git.
6. Clonar localmente el historial hacia la nueva carpeta.
7. Copiar `data/` y `Assets/` con rutas literales, sin borrar el origen.
8. Comparar inventario, tamaños y SHA-256 de los archivos privados.
9. Instalar dependencias regenerables en el destino y repetir pruebas esenciales.
10. Crear el repositorio GitHub con visibilidad privada, configurar `origin` y publicar.
11. Confirmar visibilidad, rama y commit remoto.
12. Abrir la nueva carpeta en Codex antes de continuar R1.

## Recuperación

Ante cualquier fallo se mantiene `E:\Proyecto P` intacto y sin remoto. La nueva carpeta puede considerarse una copia incompleta hasta repetir las verificaciones. Ninguna fuente se borra automáticamente.
