# Diseño de voz original para Alice — R9.2

Fecha: 2026-09-12  
Estado: alternativa futura no disponible en el plan gratuito del propietario; no se
creó un modelo, no se subió audio y no se hizo una llamada a Fish Audio.

## Decisión de dirección

La primera candidata pública se descartó después de la audición del propietario.
Voice Design de Fish Audio sería una vía futura para una voz sintética original
definida por texto, pero el propietario confirmó que su plan gratuito no la
incluye. La referencia pública de Fish indica que este flujo parte de una
descripción y exige confirmar que no imita a una persona real identificable.

Esto mantiene la voz como activo de presentación propio de Alice, separado del
VRM, la memoria, el audio del propietario y cualquier clonación.

## Prompt de diseño reservado

Se conserva este texto como una dirección artística futura. No se debe intentar
ejecutarlo ni solicitar un plan de pago para Alice:

> Original young-adult female voice speaking neutral Latin American Spanish. Clear
> and natural articulation, soft luminous timbre with a calm centered presence.
> Intelligent, composed, warm and technically precise; friendly without sounding
> like an advertisement, a telephone assistant, a child, or an anime parody.
> Medium-slow pace, subtle expressiveness, low-to-medium energy, no whispery,
> breathy, seductive, dramatic, regional, or robotic delivery. Designed for a
> futuristic personal assistant character with an elegant dark techwear aesthetic.
> Do not imitate any real person, celebrity, fictional character, existing voice,
> or copyrighted performance.

El prompt describe cualidades de presentación, no una identidad humana. La mención
de la estética sólo guía el carácter; no se sube ni se envía la imagen del VRM.

## Ruta gratuita vigente

R9.2 seleccionará una voz ya pública y disponible en la biblioteca gratuita de
Fish. La búsqueda debe aplicar estos filtros, en este orden:

1. idioma: español / Latin American;
2. género de presentación: femenino;
3. edad: joven o mediana (sin inferir una edad real);
4. estilo: conversacional o narración, nunca publicidad;
5. tono: nítido, suave, tranquilo, medido y amigable;
6. excluir Anime, personaje, sensual, soploso, energético, dramático, locutor y
   cualquier perfil que nombre una franquicia o persona.

Los metadatos del catálogo son aproximados y a veces contradictorios. Por eso se
abre la ficha pública, se escucha su muestra y se descarta sin generar audio si no
suena natural. Sólo se consideran hasta tres opciones por ronda para evitar una
elección por cansancio.

## Audición y criterio de descarte

Para cada voz pública de una ronda, reproducir sólo estas frases no privadas:

1. «Hola, Carlos. Estoy lista para acompañarte con lo que necesites.»
2. «Podemos revisar el resultado paso a paso y conservar sólo la información que
   decidas confirmar.»
3. «Entiendo. Podemos tomarnos un momento y continuar cuando te resulte cómodo.»

La voz se descarta si suena infantil, publicitaria, excesivamente anime, robótica,
susurrada, sensual, regionalmente marcada o distante. Si resulta adecuada, Carlos
elige un único perfil y anota su `reference_id` sólo en la configuración local
prevista por R9.2.

## Límites y confirmaciones

- No usar audio de Carlos ni de otra persona.
- No elegir voces que nombren o imiten personas reales, celebridades o personajes.
- No solicitar una suscripción ni crear un modelo para esta fase gratuita.
- La primera síntesis posterior conserva los límites R9.1: texto visible, una
  solicitud, máximo 500 caracteres, MP3 temporal y descarte tras escuchar.
- Voice Design queda reservado para una revisión futura si el plan del propietario
  cambia; no bloquea la voz pública gratuita de Alice.

## Fuentes oficiales

- [Voice Design de Fish Audio](https://fish.audio/es/blog/voice-design/?articleLocale=en)
- [Referencia de creación de modelos](https://docs.fish.audio/api-reference/endpoint/model/create-model)
- [Contrato TTS](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech)
