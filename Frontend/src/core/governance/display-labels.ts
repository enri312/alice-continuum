import type { CapabilityEffect, CapabilityPermissionMode, CapabilityRisk } from "./capabilities";
import type { PermissionEffect, PermissionGrantState, PermissionMode, PermissionResourceKind } from "./permissions";

export const riskLabel: Record<CapabilityRisk, string> = {
  none: "Ninguno", low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico",
};

export const effectLabel: Record<CapabilityEffect | PermissionEffect, string> = {
  none: "Ninguno", localRead: "Lectura local", localWrite: "Escritura local", networkSend: "Envío por red",
  processLaunch: "Inicio de procesos", windowMetadataRead: "Lectura de metadatos de ventana",
  credentialPresenceRead: "Consulta de presencia de credenciales", assetRender: "Representación visual",
  cameraObserve: "Observación con cámara", microphoneObserve: "Entrada del micrófono",
  screenObserve: "Observación de pantalla", userNotification: "Notificación al usuario",
  facialLandmarksDerive: "Cálculo de puntos faciales",
};

export const permissionModeLabel: Record<CapabilityPermissionMode | PermissionMode, string> = {
  implicitRead: "Lectura implícita", sessionOptIn: "Autorización por sesión",
  explicitPreview: "Revisión previa", explicitConfirmation: "Confirmación explícita",
  oneShot: "Un solo uso", session: "Durante la sesión",
};

export const grantStateLabel: Record<PermissionGrantState, string> = {
  approved: "Aprobado", consuming: "En uso", completed: "Completado", error: "Error",
  active: "Activo", stopped: "Detenido", revoked: "Revocado", expired: "Vencido",
};

export const resourceKindLabel: Record<PermissionResourceKind, string> = {
  camera: "Cámara", facePipeline: "Análisis facial", microphone: "Micrófono", screen: "Pantalla",
  file: "Archivo", directory: "Carpeta", networkEndpoint: "Dirección de red", process: "Proceso",
  window: "Ventana", memory: "Memoria", other: "Otro",
};
