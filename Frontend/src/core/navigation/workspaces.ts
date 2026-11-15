export type Workspace = "cognitive" | "body" | "governance";

export type Screen =
  | "nucleo"
  | "flujo"
  | "estado"
  | "planificador"
  | "identificacion"
  | "memoria"
  | "actividad"
  | "rostro"
  | "cuerpo"
  | "avatar"
  | "puentes"
  | "auditoria"
  | "habilidades"
  | "procedimientos"
  | "configuracion";

export const workspaceScreens: Record<Workspace, readonly Screen[]> = {
  cognitive: ["identificacion", "nucleo", "flujo", "estado", "planificador", "memoria", "actividad"],
  body: ["rostro", "cuerpo", "avatar"],
  governance: ["puentes", "auditoria", "habilidades", "procedimientos", "configuracion"],
};

export function workspaceForScreen(screen: Screen): Workspace {
  if (workspaceScreens.body.includes(screen)) return "body";
  if (workspaceScreens.governance.includes(screen)) return "governance";
  return "cognitive";
}
