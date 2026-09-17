import type { SkillLifecycleAction, SkillStatus } from "./skills";

export type WorkshopLifecycleAction = {
  action: SkillLifecycleAction;
  label: string;
  tone: "primary" | "warning" | "danger";
};

export function lifecycleActionsForStatus(status: SkillStatus): WorkshopLifecycleAction[] {
  switch (status) {
    case "draft":
      return [{ action: "submitReview", label: "Enviar a revisión", tone: "primary" }];
    case "inReview":
      return [{ action: "approve", label: "Aprobar habilidad", tone: "primary" }];
    case "approved":
      return [
        { action: "disable", label: "Desactivar", tone: "warning" },
        { action: "retire", label: "Retirar definitivamente", tone: "danger" },
      ];
    case "disabled":
      return [
        { action: "restore", label: "Restaurar aprobación", tone: "primary" },
        { action: "retire", label: "Retirar definitivamente", tone: "danger" },
      ];
    case "retired":
      return [];
  }
}

export function lifecycleActionDescription(action: SkillLifecycleAction): string {
  return {
    submitReview: "Congela el borrador como una revisión inmutable y lo deja pendiente de aprobación.",
    approve: "Marca la revisión como aprobada, pero R4 mantiene la ejecución deshabilitada.",
    disable: "Impide que la habilidad aprobada pueda considerarse utilizable.",
    restore: "Devuelve la revisión desactivada al estado aprobado, todavía sin ejecución.",
    retire: "Cierra definitivamente esta línea de revisiones; no puede restaurarse.",
  }[action];
}
