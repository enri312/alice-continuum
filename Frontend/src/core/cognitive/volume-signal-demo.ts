// Presentation only: functional stations for the opt-in demonstration.
// These points and routes never enter the persisted memory or R3 graph.
export const illustrativeSignalNodes = [
  { id: "permission", label: "Permisos", x: -.4, y: -.34, z: .08 },
  { id: "perception", label: "Entrada", x: -.58, y: .03, z: .04 },
  { id: "memory", label: "Memoria", x: -.18, y: -.12, z: .23 },
  { id: "language", label: "Modelo", x: -.3, y: .35, z: -.1 },
  { id: "workspace", label: "Contexto", x: .22, y: .02, z: .18 },
  { id: "output", label: "Salida", x: .58, y: .24, z: -.05 },
] as const;

export const illustrativeSignalRoutes = [
  { id: "permission-perception", from: "permission", to: "perception", label: "Permisos → Entrada" },
  { id: "perception-workspace", from: "perception", to: "workspace", label: "Entrada → Contexto" },
  { id: "memory-workspace", from: "memory", to: "workspace", label: "Memoria → Contexto" },
  { id: "language-workspace", from: "language", to: "workspace", label: "Modelo → Contexto" },
  { id: "workspace-output", from: "workspace", to: "output", label: "Contexto → Salida" },
] as const;
