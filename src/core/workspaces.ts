export type Workspace = "cognitive" | "body" | "governance";

export type Screen =
  | "conversacion"
  | "nucleo"
  | "identificacion"
  | "memoria"
  | "actividad"
  | "rostro"
  | "cuerpo"
  | "avatar"
  | "puentes"
  | "auditoria"
  | "habilidades"
  | "configuracion";

export const workspaceScreens: Record<Workspace, readonly Screen[]> = {
  cognitive: ["conversacion", "nucleo", "identificacion", "memoria", "actividad"],
  body: ["rostro", "cuerpo", "avatar"],
  governance: ["puentes", "auditoria", "habilidades", "configuracion"],
};

export function workspaceForScreen(screen: Screen): Workspace {
  if (workspaceScreens.body.includes(screen)) return "body";
  if (workspaceScreens.governance.includes(screen)) return "governance";
  return "cognitive";
}
