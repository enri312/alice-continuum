import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { parsePermissionGatewayStatus } from "../../../core/governance/permissions";
import { startSerializedPolling } from "../../../core/shared/polling";
import { recordCognitiveEvent as recordEvent } from "../../../core/cognitive/activity-session";

type ForegroundContext = { windowTitle: string; processName: string };

export function useLegacyObservation(desktopApp: boolean, navigate: (screen: "puentes") => void) {
  const [observationEnabled, setObservationEnabled] = useState(false);
  const [foregroundContext, setForegroundContext] = useState<ForegroundContext | null>(null);

  useEffect(() => {
    if (!desktopApp || !observationEnabled) return;
    return startSerializedPolling({
      intervalMs: 2_000,
      read: async () => {
        const [context, rawGateway] = await Promise.all([
          invoke<ForegroundContext | null>("get_foreground_context"),
          invoke<unknown>("permission_gateway_status"),
        ]);
        const gateway = parsePermissionGatewayStatus(rawGateway);
        const active = gateway.grants.some((grant) => grant.capabilityId === "context.foreground.control" && grant.mode === "session" && grant.state === "active");
        return { context, active };
      },
      onValue: ({ context, active }) => {
        setObservationEnabled(active);
        setForegroundContext(active ? context : null);
      },
      onError: () => {
        setObservationEnabled(false);
        setForegroundContext(null);
      },
    });
  }, [desktopApp, observationEnabled]);

  async function toggleObservation() {
    if (!desktopApp) return;
    navigate("puentes");
    recordEvent("SECURITY", "PERMISSION_REQUIRED", observationEnabled
      ? "La detención requiere un grant oneShot en el Gateway R2"
      : "La activación requiere un grant de sesión en el Gateway R2");
  }

  return { observationEnabled, foregroundContext, setObservationEnabled, toggleObservation };
}
