# Datos locales de Alice

El iniciador configura `ALICE_DATA_DIR` con esta carpeta. Alice crea aquí:

- `memory/`: recuerdos, respaldos, exportaciones, adjuntos e índices.
- `cloud/`: auditoría técnica de llamadas a proveedores, sin claves.

El contenido generado dentro de `data/` está excluido de Git. Este archivo sí se
conserva para explicar la estructura cuando el proyecto se comparte.

No guardar claves de API, contraseñas ni otros secretos como recuerdos.
