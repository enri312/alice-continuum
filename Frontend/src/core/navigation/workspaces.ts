export type Workspace = "cognitive" | "body" | "governance";

export type NavigationRequest = { id: number; screen: Screen };

export type Screen =
  | "dashboard"
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
  governance: ["puentes", "auditoria", "procedimientos", "habilidades", "configuracion"],
};

const routes = new Set<string>(["dashboard", ...Object.values(workspaceScreens).flat()]);

export function isScreen(value: unknown): value is Screen {
  return typeof value === "string" && routes.has(value);
}

export function initialScreen(params: URLSearchParams, avatarDiagnostic: boolean): Screen {
  const screen = params.get("screen");
  if (screen === "puentes") {
    const bridge = params.get("bridgeView");
    if (bridge === "face") return "rostro";
    if (bridge === "body") return "cuerpo";
  }
  return isScreen(screen) ? screen : avatarDiagnostic ? "avatar" : "dashboard";
}

export function workspaceForScreen(screen: Screen): Workspace {
  if (workspaceScreens.body.includes(screen)) return "body";
  if (workspaceScreens.governance.includes(screen)) return "governance";
  return "cognitive";
}
