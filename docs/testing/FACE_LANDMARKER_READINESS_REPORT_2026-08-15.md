# Informe real de preparación facial mediante webcam

Fecha: 2026-08-15  
Equipo: Acer Nitro AN515-58  
Dispositivo: `ACER HD User Facing`

## Objetivo

Determinar mediante video real si la cámara integrada puede suministrar señal facial útil para un
futuro puente R9, sin atribuirle una capacidad que Alice todavía no posee y sin persistir contenido.

## Runtime verificado

| Componente | Resultado |
|---|---|
| Python | 3.14.6 |
| OpenCV | 5.0.0 |
| MediaPipe | 1.0.0 |
| NumPy | 2.3.5 |
| Backend de cámara | DirectShow |
| Modelo | Face Landmarker float16 v1, 3.758.596 bytes |
| SHA-256 | `64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF` |

La huella del archivo temporal descargado y la copia en `Assets/Models/private/` coincidieron antes de
la prueba.

## Ejecución real

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
python scripts\probe-face-landmarker.py --live --duration-seconds 10 --require-face-ratio 0.75
Remove-Item Env:PYTHONDONTWRITEBYTECODE
```

| Métrica | Valor observado |
|---|---:|
| Duración efectiva | 10,59 s |
| Resolución | 640×480 |
| Fotogramas recibidos | 107 |
| Fotogramas analizados | 53 |
| Frecuencia de análisis | 5,00 FPS |
| Análisis con rostro | 53/53 |
| Proporción de presencia | 1,000 |
| Landmarks por rostro | 478 |
| Canales blendshape | 52 |
| Latencia media | 20,71 ms |
| Latencia p95 | 22,17 ms |
| Fotogramas persistidos | 0 |
| Coordenadas persistidas | 0 |
| Multimedia antes/después | 117 / 117 (`MEDIA_DELTA=0`) |

La salida incluyó valores máximos agregados para parpadeo, dirección ocular, ceja, mandíbula y sonrisa.
No imprimió ni guardó coordenadas individuales. Los avisos de XNNPACK y *feedback tensors* provinieron
del runtime de MediaPipe y no impidieron la inferencia.

## Controles de la sonda

- Sin `--live`, el proceso se niega a abrir la cámara.
- `--check-runtime` valida dependencias, modelo y huella sin capturar video.
- El nombre del dispositivo debe coincidir exactamente.
- La duración está limitada a 30 segundos.
- La ausencia del modelo o una huella distinta bloquean la ejecución.
- `capture.release()` se ejecuta incluso ante error.
- El script no contiene rutas de escritura de medios.

## Conclusión

La cámara integrada ofrece una base real y suficientemente rápida para experimentar con expresión facial
sin comprar ahora Meta Quest Pro. El resultado es preparación diagnóstica, no una integración: el panel
Rostro, `perception.face.landmarks`, el avatar y la memoria permanecen desconectados hasta implementar el
contrato R2/R3/R9 definido en [ADR-P-071](../decisions/ADR-P-071-sonda-facial-webcam-local.md).
