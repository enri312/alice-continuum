# Informe real — Catálogo Markdown de Obsidian

La bóveda privada `data/memory/notes` se consulta en modo de solo lectura. El catálogo enumera sólo
archivos `.md`, ignora `.obsidian`, presenta ruta relativa, tamaño y SHA-256 y no persiste ni
interpreta contenido. La prueba Rust comprobó que las fuentes quedan byte a byte intactas.

Resultado: 179 pruebas Rust aprobadas, 13 sondas explícitas omitidas, `clippy` sin advertencias y
250 pruebas TypeScript con build de producción aprobados. Ninguna nota se convirtió en recuerdo.
