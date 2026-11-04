# Modelos locales

Esta carpeta documenta modelos necesarios para diagnósticos locales. Los binarios viven en
`local/assets/Models/private/`, quedan excluidos de Git y deben verificarse antes de abrir un sensor.

## Face Landmarker

| Campo | Valor |
|---|---|
| Archivo local | `private/face_landmarker_float16_v1.task` |
| Fuente oficial | `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task` |
| SHA-256 esperado | `64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF` |
| Tamaño verificado | `3.758.596 bytes` |
| Uso actual | Sonda facial local y explícita; no forma parte del runtime de Alice |

Antes de una futura distribución pública se deberán revisar por separado los términos aplicables al
modelo. La ausencia o una huella distinta bloquean la sonda.
