import { ConversationHost } from "./pages/conversation/ConversationHost";
import { buildMemoryCatalog } from "../core/memory/memory-catalog";
import {
  learningSnapshot, refreshLearningSources, startLearningSession, subscribeToLearning,
} from "../core/memory/learning-session";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { DashboardHost } from "./pages/dashboard/DashboardHost";
import { supportsConversationBehavior } from "../core/conversation/behavior-settings";
import {
  changeConversationBehavior, conversationSnapshot,
  setConversationDraft, subscribeToConversation,
} from "../core/conversation/conversation-session";
import { Volumen } from "./pages/cognitive/VolumeHost";
import { Flujo } from "./pages/cognitive/EvidenceFlowPage";
import { StateControlsHost } from "./components/cognitive/state-controls/StateControlsHost";
import { Planificador } from "./pages/cognitive/ActionPlannerHost";
import { Memoria } from "./pages/memory/MemoryHost";
import { Actividad } from "./pages/cognitive/ActivityHost";
import { AuditPageHost } from "./pages/cognitive/AuditPageHost";
import { EmbodimentHost } from "./pages/embodiment/EmbodimentHost";
import { GovernanceHost } from "./pages/governance/GovernanceHost";
import { Configuracion } from "./pages/governance/SystemSettingsHost";
import { buildBrainSnapshot } from "../core/cognitive/brain";
import { recordCognitiveEvent as recordEvent } from "../core/cognitive/activity-session";
import {
  memorySessionSnapshot, refreshOwnerProfile, reloadMemoryFromDisk, startMemorySession, subscribeToMemory,
} from "../core/memory/memory-session";
import { observationSnapshot, subscribeToObservation } from "../core/governance/observation-session";
import { NavigationHost } from "./core/navigation/NavigationHost";
import { acceptRoute, appSnapshot, clearAudit, navigate, openAudit, subscribeToApp } from "../core/navigation/app-session";

export function App() {
  const desktopApp = isTauri();
  const { sessions, finishedIndices, memoryStatus, ownerProfile, ownerProfileError } =
    useSyncExternalStore(subscribeToMemory, memorySessionSnapshot);
  useEffect(startMemorySession, []);
  useEffect(startLearningSession, []);
  const {
    automaticMemory, automaticPhase, automaticSource, selfStudy, selfStudySource, approvedStudyIndices,
  } = useSyncExternalStore(subscribeToLearning, learningSnapshot);

  const {
    cloudStatus, cloudSelection, draft: conversationDraft, showFullHistory,
    behavior: conversationBehavior, pending: cloudPending, messages, retrieval: memoryRetrieval,
  } = useSyncExternalStore(subscribeToConversation, conversationSnapshot);
  const { screen, request: navigationRequest, auditCapability } = useSyncExternalStore(subscribeToApp, appSnapshot);
  const { grant: observationGrant, foregroundContext } = useSyncExternalStore(subscribeToObservation, observationSnapshot);
  const observationEnabled = observationGrant !== null;
  const { conversationalMemories, cognitiveMemories } = useMemo(() => buildMemoryCatalog({
    ownerProfile, sessions, finishedIndices, automaticMemory, selfStudy, approvedStudyIndices,
  }), [ownerProfile, sessions, finishedIndices, automaticMemory, selfStudy, approvedStudyIndices]);
  const ollamaProvider = cloudStatus.providers.find((provider) => provider.id === "ollama");
  const ollamaModel = cloudSelection.provider === "ollama" && cloudSelection.model.trim() ? cloudSelection.model : ollamaProvider?.defaultModel ?? "qwen3.5:4b";
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.text;
  const brainSnapshot = useMemo(() => buildBrainSnapshot({
    lastUserMessage,
    conversationCount: messages.length,
    memories: cognitiveMemories,
    retrievedMemoryCount: memoryRetrieval.count,
    retrievedMemoryTop: memoryRetrieval.top,
    retrievedMemoryIds: memoryRetrieval.ids,
    memoryRetrievalObservation: memoryRetrieval,
    observerEnabled: observationEnabled,
    foregroundContext,
    cloudConfigured: cloudStatus.providers.some((provider) => provider.configured),
    cloudPending,
  }), [cloudPending, cloudStatus.providers, cognitiveMemories, foregroundContext, lastUserMessage, memoryRetrieval, messages.length, observationEnabled]);

  function toggleObservation() {
    if (!desktopApp) return;
    navigate("puentes");
    recordEvent("SECURITY", "PERMISSION_REQUIRED", observationEnabled
      ? "La detención requiere un grant oneShot en el Gateway R2"
      : "La activación requiere un grant de sesión en el Gateway R2");
  }

  function refreshVolumeLearning() {
    refreshLearningSources();
    void refreshOwnerProfile();
    if (memoryStatus === "error") void reloadMemoryFromDisk().catch(() => undefined);
  }

  return <NavigationHost
    screen={screen} request={navigationRequest} onRoute={acceptRoute}
    memories={conversationalMemories.length}
  >
    {screen === "dashboard" && <DashboardHost
      desktopApp={desktopApp}
      assistant={{
        provider: cloudStatus.providers.find(provider => provider.id === cloudSelection.provider)?.label ?? "Sin motor seleccionado",
        memoryCount: conversationalMemories.length,
      }}
      onNavigate={navigate}
    />}
    {screen === "nucleo" && <Volumen snapshot={brainSnapshot} desktopApp={desktopApp} learningReady={!desktopApp || (memoryStatus === "native" && ownerProfile !== null && automaticMemory !== null && selfStudy !== null)} selfStudy={selfStudy} learningActivity={{
      native: desktopApp, selfStudyPhase: selfStudy?.phase ?? null, selfStudyLastError: selfStudy?.lastError ?? null,
      automaticPhase, automaticEnabled: automaticMemory?.enabled ?? null, selfStudySource, automaticSource,
      recordsStatus: memoryStatus === "error" || ownerProfileError ? "error" : memoryStatus === "native" && ownerProfile !== null ? "ready" : "loading",
      recordsError: ownerProfileError || (memoryStatus === "error" ? "No se pudieron leer los recuerdos guardados. Puedes reintentar la lectura." : ""),
    }} onRefreshLearning={refreshVolumeLearning} />}
    {screen === "flujo" && <Flujo snapshot={brainSnapshot} desktopApp={desktopApp} />}
    {screen === "estado" && <StateControlsHost snapshot={brainSnapshot} desktopApp={desktopApp} behavior={{ settings: conversationBehavior, supported: desktopApp && supportsConversationBehavior(cloudSelection.provider), busy: cloudPending, onChange: changeConversationBehavior }} />}
    {screen === "planificador" && <Planificador snapshot={brainSnapshot} desktopApp={desktopApp} />}
    {screen === "identificacion" && <ConversationHost
      desktopApp={desktopApp} draft={conversationDraft} showFullHistory={showFullHistory}
      status={cloudStatus} provider={cloudSelection.provider} model={cloudSelection.model}
      messages={messages} memories={conversationalMemories} cloudPending={cloudPending}
      observationEnabled={observationEnabled} foregroundContext={foregroundContext}
      retrievedMemoryCount={brainSnapshot.retrievedMemoryCount}
      automaticLearning={automaticMemory ? {enabled: automaticMemory.enabled, count: automaticMemory.activeCount, phase: automaticPhase, onOpen: () => navigate("memoria")} : undefined}
      onDraftChange={setConversationDraft} onToggleObservation={toggleObservation} onOpenSettings={() => navigate("configuracion")}
    />}
    {screen === "memoria" && <Memoria desktopApp={desktopApp} />}
    {screen === "actividad" && <Actividad />}
    {screen === "auditoria" && <AuditPageHost desktopApp={desktopApp} capability={auditCapability} onClearCapability={clearAudit} />}
    {screen === "habilidades" && <GovernanceHost key="skills" view="skills" desktopApp={desktopApp} />}
    {screen === "procedimientos" && <GovernanceHost key="procedures" view="procedures" desktopApp={desktopApp} />}
    {screen === "configuracion" && <Configuracion showFullHistory={showFullHistory} desktopApp={desktopApp} status={cloudStatus} provider={cloudSelection.provider} model={cloudSelection.model} />}
    {screen === "puentes" && <GovernanceHost key="registry" view="registry" desktopApp={desktopApp}
      onOpenAudit={openAudit} />}
    {screen === "rostro" && <EmbodimentHost key="face" view="face" desktopApp={desktopApp} />}
    {screen === "cuerpo" && <EmbodimentHost key="body" view="body" desktopApp={desktopApp} />}
    {screen === "avatar" && <EmbodimentHost key="avatar" view="avatar" desktopApp={desktopApp} />}
  </NavigationHost>;
}
