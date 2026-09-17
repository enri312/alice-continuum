# R8.4 — Integración y cierre del volumen cognitivo

Fecha: 2026-09-11  
Resultado: aprobado.

## Alcance entregado

- El volumen consume referencias y aristas reconstruidas por el backend R8.
- Una arista persistente se dibuja sólo cuando el propietario la confirmó y las dos
  fuentes continúan vigentes.
- Al seleccionar un nodo relacionado, el inspector abre las dos citas originales,
  su versión y sus posiciones UTF-8. No usa respuestas históricas del modelo.
- La interfaz distingue grafo vacío, normal, fuente cambiada y error. Un error no
  transforma recuerdos locales en estructura ficticia ni los modifica.
- La respuesta conversacional ya no debe prometer que recuerda, guarda o aprende
  antes de la confirmación visible del propietario.

## Evidencia automatizada

- Frontend: 461 pruebas aprobadas y 2 sondas omitidas; build de producción aprobado.
- Rust: 284 pruebas aprobadas y 22 sondas físicas ignoradas por defecto.
- `cargo fmt --check`: aprobado.
- `cargo clippy --all-targets -- -D warnings`: aprobado con Rust 1.98.
- La sonda canónica reconstruyó 3 nodos, 0 aristas y 0 índices persistentes.
- 42 archivos privados antes y después; 0 modificados y 0 agregados.

La sonda dejó de exigir dos episodios artificiales. Cuando la memoria real no ofrece
dos episodios elegibles, valida reconstrucción, privacidad y ausencia de conexiones,
pero omite correctamente la propuesta de relación.

## Privacidad y límites

`data/memory/records.json` continúa ignorado por Git. El único archivo versionado
bajo `data/` es su README operativo. La búsqueda de patrones de credenciales no halló
secretos; dos coincidencias iniciales resultaron ser el nombre CSS
`task-desktop-only`.

R8 no activa modelos de forma autónoma, no observa pantalla o micrófono, no controla
el avatar, no crea relaciones automáticas y no convierte similitud en verdad.
