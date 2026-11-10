# Autoestudio por arranque: implementación y comprobación

Fecha: 10 de noviembre de 2026. Proyecto aplicado: `D:\Alice Continuum`.

El backend programa un ciclo en cada arranque nativo. El currículo inicial tiene
42 lecciones y 14 áreas: nueve de matemáticas, historia bíblica católica,
psicología e inteligencia emocional, empatía, solidaridad y humildad. Cada ciclo
intenta una lección por área; avanza por las pendientes y después repasa.

El modelo recibe la lección y un ejercicio con opciones reordenadas. La clave
permanece en la aplicación. Solo una respuesta válida y correcta activa la
lección para recuperación conversacional. Los hechos guardados proceden del
currículo y su fuente, no de una explicación generada por Gemma.

## Resultados

| Comprobación | Resultado |
|---|---|
| Frontend Vitest | 627 aprobadas; 2 sondas opcionales omitidas |
| Sincronización Obsidian, Node | 15 aprobadas en la revisión estructural posterior |
| Backend Rust, biblioteca completa | 352 aprobadas; 30 sondas opcionales omitidas |
| Compilación frontend | Aprobada; conserva aviso de tamaño de paquetes |
| Compilación nativa | Aprobada |
| Rustfmt y Clippy con advertencias como errores | Aprobados |
| Sonda real de autoestudio con Gemma | 14 áreas intentadas; 10 ejercicios aprobados; 4 no aprobados |

La sonda real utilizó exclusivamente un directorio temporal aislado y el modelo
local instalado. Verificó las 14 áreas, persistencia recargable y ausencia de
`records.json` en su almacén. Detuvo el motor que había iniciado y retiró sus
datos temporales al terminar. Esos resultados no se trasladaron al avance
personal de Alice ni se presentan como lecciones ya estudiadas en el proyecto.

La prueba real se ejecuta explícitamente con:

```powershell
$env:ALICE_SELF_STUDY_LIVE = '1'
cargo test --manifest-path src-tauri/Cargo.toml --lib self_study:: --offline -- --include-ignored --test-threads=1 --nocapture
Remove-Item Env:\ALICE_SELF_STUDY_LIVE
```

Las pruebas sintéticas cubren el límite de materias y fuentes, los tres niveles,
avance y repaso sin duplicados, errores de respuesta, aislamiento de los demás
recuerdos, pausa sin iniciar el modelo, prioridad de conversación, cancelación
y plazo de inferencia. Las comprobaciones de Obsidian también preservan notas
manuales y detectan conflictos y rutas fuera de la bóveda.

## Estado entregado

Se dejó habilitado el autoestudio para el próximo arranque, con un almacén
inicial vacío. No se precargaron aprobaciones ficticias. El progreso se consulta
en Memoria y en `Alice (sincronizado)/Autoestudio/Progreso del curriculo.md`.
La sincronización final conservó las huellas de los ocho archivos personales
comprobados: tres almacenes y cinco notas Markdown existentes.

Los archivos modificados cuentan con respaldo privado en
`local/backups/self-study-20261110-073940-020429/`. La revisión visual de Obsidian
y Tauri, y una conversación real con voz, no forman parte de esta aceptación
automatizada. El aprendizaje descrito añade memoria recuperable y práctica;
no reentrena los pesos ni prueba dominio general de las materias.

La revisión estructural posterior conserva los comportamientos y separa contratos,
reglas, persistencia y adaptación a Gemma. Volvió a comprobar las suites locales;
la sonda real descrita arriba corresponde a la implementación anterior y no se
repitió para esa separación. Ver [informe de estructura](COGNITIVE_STRUCTURE_REPORT_2026-11-10.md).

[Procedimiento y controles](../runbooks/06-autoestudio-al-arrancar.md) ·
[Fuentes](../research/SELF_STUDY_SOURCES_2026-11-10.md).
