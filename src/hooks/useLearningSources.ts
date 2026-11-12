import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  parseAutomaticMemorySnapshot, type AutomaticMemorySnapshot, type AutomaticMemoryReview,
  type AutomaticLearningPhase,
} from "../core/memory/automatic-memory";
import { parseSelfStudySnapshot, type SelfStudySnapshot } from "../core/memory/self-study";
import {
  createLearningSource, type LearningSourceState, type LearningSourceController,
  type LearningSourceStatus,
} from "../core/memory/learning-source";

export type LearningSourceViewState = {
  status: LearningSourceStatus | "unavailable";
  updatedAt: number | null;
  error: string;
  eventError: string;
};

const emptyState = <T,>(): LearningSourceState<T> => ({ snapshot: null, status: "loading", updatedAt: null, error: null });
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Read-only status synchronisation and existing owner mutations; no study starts here. */
export function useLearningSources(desktopApp: boolean) {
  const [studyState, setStudyState] = useState<LearningSourceState<SelfStudySnapshot>>(emptyState);
  const [automaticState, setAutomaticState] = useState<LearningSourceState<AutomaticMemorySnapshot>>(emptyState);
  const [studyEventError, setStudyEventError] = useState("");
  const [automaticEventError, setAutomaticEventError] = useState("");
  const [automaticPhase, setAutomaticPhase] = useState<AutomaticLearningPhase>("idle");
  const [automaticProcessError, setAutomaticProcessError] = useState("");
  const studyRef = useRef<LearningSourceController<SelfStudySnapshot> | null>(null);
  const automaticRef = useRef<LearningSourceController<AutomaticMemorySnapshot> | null>(null);

  useEffect(() => {
    setStudyEventError("");
    setAutomaticEventError("");
    setAutomaticProcessError("");
    setAutomaticPhase("idle");
    if (!desktopApp) { setStudyState(emptyState()); setAutomaticState(emptyState()); return; }
    let active = true;
    const unlisten: (() => void)[] = [];
    const study = createLearningSource({
      read: async () => parseSelfStudySnapshot(await invoke("self_study_status")),
      onChange: setStudyState,
    });
    const automatic = createLearningSource({
      read: async () => parseAutomaticMemorySnapshot(await invoke("automatic_memory_status")),
      onChange: setAutomaticState,
    });
    studyRef.current = study;
    automaticRef.current = automatic;
    void listen("self-study-updated", () => study.notifyRefresh())
      .then(off => {
        if (!active) { off(); return; }
        unlisten.push(off);
        study.notifyRefresh();
      })
      .catch(error => { if (active) setStudyEventError(errorText(error)); });
    void listen<{ phase: AutomaticLearningPhase; error?: string | null }>("automatic-memory-updated", event => {
      if (!active) return;
      if (["idle", "evaluating", "error"].includes(event.payload.phase)) setAutomaticPhase(event.payload.phase);
      setAutomaticProcessError(typeof event.payload.error === "string" ? event.payload.error : "");
      automatic.notifyRefresh();
    }).then(off => {
      if (!active) { off(); return; }
      unlisten.push(off);
      automatic.notifyRefresh();
    }).catch(error => { if (active) setAutomaticEventError(errorText(error)); });
    return () => {
      active = false;
      study.dispose();
      automatic.dispose();
      unlisten.forEach(off => off());
      if (studyRef.current === study) studyRef.current = null;
      if (automaticRef.current === automatic) automaticRef.current = null;
    };
  }, [desktopApp]);

  function currentSource<T>(source: LearningSourceController<T> | null): LearningSourceController<T> {
    if (!desktopApp || !source) throw new Error("La fuente nativa de aprendizaje no está disponible.");
    return source;
  }

  async function toggleSelfStudy(enabled: boolean): Promise<void> {
    await currentSource(studyRef.current).runMutation(async () => parseSelfStudySnapshot(
      await invoke("set_self_study_enabled", { input: { enabled } }),
    ));
  }

  async function toggleAutomaticMemory(enabled: boolean): Promise<void> {
    await currentSource(automaticRef.current).runMutation(async () => parseAutomaticMemorySnapshot(
      await invoke("set_automatic_memory_enabled", { input: { enabled } }),
    ));
    setAutomaticPhase("idle");
    setAutomaticProcessError("");
  }

  async function reviewAutomaticMemory(input: AutomaticMemoryReview): Promise<void> {
    await currentSource(automaticRef.current).runMutation(async () => parseAutomaticMemorySnapshot(
      await invoke("review_automatic_memory", { input }),
    ));
  }

  function refreshLearningSources() {
    studyRef.current?.notifyRefresh();
    automaticRef.current?.notifyRefresh();
  }

  const metadata = <T,>(state: LearningSourceState<T>, eventError: string): LearningSourceViewState => ({
    status: desktopApp ? state.status : "unavailable", updatedAt: state.updatedAt,
    error: state.error ?? "", eventError,
  });
  return {
    selfStudy: studyState.snapshot,
    selfStudyError: studyState.error ?? studyEventError,
    selfStudySource: metadata(studyState, studyEventError),
    automaticMemory: automaticState.snapshot,
    automaticPhase,
    automaticError: automaticState.error ?? (automaticProcessError || automaticEventError),
    automaticSource: metadata(automaticState, automaticEventError),
    toggleSelfStudy, toggleAutomaticMemory, reviewAutomaticMemory, refreshLearningSources,
  };
}
