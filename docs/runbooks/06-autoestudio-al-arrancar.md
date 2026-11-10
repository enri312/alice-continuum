# Autoestudio de Alice al arrancar

El proceso nativo de Alice programa una sesión de estudio en segundo plano en
cada arranque. El currículo es local, cerrado y con fuentes enlazadas. El enfoque
de historia bíblica es **católico**, según la elección del propietario.

## Alcance permitido

- Matemáticas: aritmética, álgebra, geometría, trigonometría, cálculo, álgebra
  lineal, probabilidad, estadística y lógica.
- Historia bíblica con enfoque católico, distinguiendo relato, doctrina y
  corroboración histórica.
- Psicología de las emociones e inteligencia emocional.
- Empatía, solidaridad y humildad, cada una como área propia.

El currículo inicial contiene 42 lecciones: tres niveles por cada una de las
14 áreas. Cada sesión intenta estudiar una lección de cada área. Avanza por las
que todavía no superó y, cuando termina una secuencia, repasa las anteriores.
Este currículo inicial no equivale a cubrir todas las ramas de las matemáticas.

Las fuentes y sus criterios están en
[Fuentes del autoestudio](../research/SELF_STUDY_SOURCES_2026-11-10.md). El contenido
editable por desarrollo está en `src-tauri/resources/self-study-curriculum.json`.
Cambiar el currículo requiere revisar sus preguntas y recompilar el backend.

## Qué significa aprender aquí

Gemma lee una lección y contesta un ejercicio de opción múltiple. La aplicación
compara la respuesta con una clave que no entrega al modelo. Si la respuesta es
correcta, activa el contenido de esa lección para recuperación en conversación;
si falla, conserva el intento para volver a estudiarlo. Una respuesta correcta
comprueba ese ejercicio, no demuestra dominio general de la materia.

El conocimiento conservado procede del texto curado y su fuente, no de una
explicación inventada por el modelo. Las respuestas de Alice no se convierten en
fuentes de nuevas lecciones. El estudio añade memoria recuperable; no entrena
pesos, instala modelos ni cambia el código por sí mismo.

La sesión usa Gemma local y no requiere servicios de pago ni búsquedas libres
por Internet. Si el motor no está instalado o no puede iniciarse, informa el
problema; no simula aprendizaje con respuestas prefabricadas.

## Arranque y controles

1. Iniciar Alice con el lanzador del proyecto.
2. Entrar en **Memoria** y consultar el panel **Autoestudio**.
3. Revisar la fase, las lecciones estudiadas y sus fuentes. Usar el control de
   activación para pausar el estudio o volver a habilitarlo.
4. Abrir la bóveda `data/obsidian`: la carpeta sincronizada incluye el progreso
   y las lecciones del almacén de autoestudio.

El autoestudio puede iniciar Gemma automáticamente cuando está habilitado.
Tiene prioridad inferior a la conversación y se difiere durante una sesión de
voz o cuando la inferencia está ocupada. El tiempo de reintento es limitado;
si no consigue un turno de estudio, informa un aplazamiento. Detener el motor
impide que la misma sesión de estudio lo reinicie por su cuenta.

La programación ocurre en el arranque nativo. Recargar la interfaz no constituye
otro arranque del backend. Abrir únicamente Vite en el navegador permite ver la
interfaz y sincronizar notas, pero no ejecuta el motor nativo de estudio.

## Persistencia y conversación

`data/memory/self-study-v1.json` conserva los avances, intentos, fechas, fuentes
y huellas de las lecciones. El directorio efectivo respeta `ALICE_DATA_DIR`.
Es un almacén separado de las declaraciones personales, el perfil y los
recuerdos confirmados por el propietario.

Sólo las lecciones activas con el último ejercicio aprobado se ofrecen a la
recuperación conversacional. Se identifican como **AUTOESTUDIO** con su fuente;
no se atribuyen a Carlos ni se presentan como confirmaciones suyas. También se
pueden recuperar en conversación por voz bajo los mismos controles de contexto.

La proyección de Obsidian sigue siendo **Alice → Obsidian**. Editar una copia
generada no enseña un hecho nuevo a Alice. Las fuentes y materias del currículo
no pueden ampliarse mediante instrucciones escritas en la conversación o en
una nota de la bóveda.

El estudio de emociones y valores no atribuye sentimientos a Alice ni la
habilita para diagnosticar o conocer el estado mental de una persona.

## Comprobaciones

Las pruebas automatizadas usan datos aislados para verificar el límite de
materias, avance y repaso, respuestas incorrectas, persistencia, procedencia,
prioridad de conversación y proyección en Obsidian. Una sonda con Gemma real se
ejecuta por separado y debe informar sus resultados sin sustituirlos por los
resultados de los ejercicios sintéticos.
