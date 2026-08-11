# Animaciones privadas de Alice

Los archivos binarios de animación se guardan bajo `private/` y quedan excluidos de Git. El repositorio conserva únicamente esta política y la evidencia técnica necesaria para reproducir el proceso.

## Registro local

| ID | Fuente | Clip | Formato | SHA-256 | Tratamiento |
|---|---|---|---|---|---|
| `mixamo.walk.forward.in-place.v1` | Adobe Mixamo | `Walking` | FBX sin piel | `CC11ED5114B232D9E61A6A35A7F310D29C1646D5688C8300D3008574F63D488B` | Uso dentro de Alice; no redistribuir como activo independiente |
| `mixamo.walk.backward.in-place.v1` | Adobe Mixamo | `Walking Backwards` | FBX sin piel | `14984AD4FD14A4D98876DA7C2D35EDB83C47D030D3B690ED936D7DF28BD4167E` | Uso dentro de Alice; no redistribuir como activo independiente |
| `mixamo.strafe.left.in-place.v1` | Adobe Mixamo | `Left Strafe Walking` | FBX sin piel | `20261FE03A5A597E7AA18C227D72EDD92E11C93286ABE4500C74CC513EBD98ED` | Uso dentro de Alice; no redistribuir como activo independiente |
| `mixamo.strafe.right.in-place.v1` | Adobe Mixamo | `Right Strafe Walking` | FBX sin piel | `680E15042086BFF01B59125C83A0D650A4F6A82AE697B03E765C2DA668A64A63` | Uso dentro de Alice; no redistribuir como activo independiente |
| `mixamo.jump.in-place.v1` | Adobe Mixamo | `Jump` | FBX sin piel | `F13A31803ABB384C88524D19EE398384FECDB2C974D55A8BDB9BED3E6AB0EF63` | Uso dentro de Alice; no redistribuir como activo independiente |
| `mixamo.idle.breathing.v1` | Adobe Mixamo | `Breathing Idle` | FBX sin piel | `97627D8CC0DA4C078BB31C02470389DCD42EF4DD7335EE60E4FCDEFEDA862842` | Uso dentro de Alice; no redistribuir como activo independiente |
| `mixamo.idle.sitting.v1` | Adobe Mixamo | `Sitting Idle` | FBX sin piel | `0E7DD4B9A82EEB745F82D25443D53959335ADED1316EBC2B04D54DCA8FBCB49B` | Uso dentro de Alice; no redistribuir como activo independiente |
| `mixamo.idle.standing.v1` | Adobe Mixamo | `Idle` | FBX sin piel | `01349EA06F0B55961E415732A18AD2EB2A1810E5C00BF20635359320AAB3D288` | Uso dentro de Alice; no redistribuir como activo independiente |

Rutas privadas esperadas: `Assets/Animations/private/mixamo/*.fbx`.

Antes de incorporar un clip nuevo se debe registrar fuente, licencia, fecha, opciones de exportación y SHA-256. Retargeting, conversión o reproducción no convierten automáticamente el activo en propiedad del proyecto.
