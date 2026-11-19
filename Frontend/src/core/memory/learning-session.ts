import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  parseAutomaticMemorySnapshot, type AutomaticLearningPhase, type AutomaticMemoryReview, type AutomaticMemorySnapshot,
} from "./automatic-memory";
import { createLearningSource, type LearningSourceController, type LearningSourceState, type LearningSourceStatus } from "./learning-source";
import { parseSelfStudySnapshot, studyIsAvailable, type SelfStudySnapshot } from "./self-study";

export type LearningSourceViewState = {
  status: LearningSourceStatus | "unavailable";
  updatedAt: number | null;
  error: string;
  eventError: string;
};

type SourceState<T> = LearningSourceState<T> & { eventError: string };
type Snapshot = {
  study: SourceState<SelfStudySnapshot>;
  approvedStudyIndices: number[];
  automatic: SourceState<AutomaticMemorySnapshot>;
  automaticPhase: AutomaticLearningPhase;
  automaticProcessError: string;
};
type Source = "study" | "automatic";
type Projection = {
  study?: Partial<Snapshot["study"]>;
  approvedStudyIndices?: number[];
  automatic?: Partial<Snapshot["automatic"]>;
  automaticPhase?: AutomaticLearningPhase;
  automaticProcessError?: string;
};
type Action =
  | { type: "received"; source: Source; snapshot: SelfStudySnapshot | AutomaticMemorySnapshot; updatedAt: number }
  | { type: "readFailed" | "listenerFailed"; source: Source; error: string }
  | { type: "automaticSignal"; phase: AutomaticLearningPhase | null; error: string };

const emptySource = <T>(): SourceState<T> => ({ snapshot: null, status: "loading", updatedAt: null, error: null, eventError: "" });
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const desktopApp = isTauri();
const listeners = new Set<() => void>();
let current: Snapshot = {
  study: emptySource(), approvedStudyIndices: [], automatic: emptySource(), automaticPhase: "idle", automaticProcessError: "",
};
let exposed = view(current);
let update: ((raw: string) => string) | undefined;
let studyController: LearningSourceController<SelfStudySnapshot> | undefined;
let automaticController: LearningSourceController<AutomaticMemorySnapshot> | undefined;
let signalSequence = 0;

function view(state: Snapshot) {
  const metadata = <T>(source: SourceState<T>): LearningSourceViewState => ({
    status: desktopApp ? source.status : "unavailable",
    updatedAt: source.updatedAt,
    error: source.error ?? "",
    eventError: source.eventError,
  });
  return {
    selfStudy: state.study.snapshot,
    approvedStudyIndices: state.approvedStudyIndices,
    selfStudyError: state.study.error ?? state.study.eventError,
    selfStudySource: metadata(state.study),
    automaticMemory: state.automatic.snapshot,
    automaticPhase: state.automaticPhase,
    automaticError: state.automatic.error ?? (state.automaticProcessError || state.automatic.eventError),
    automaticSource: metadata(state.automatic),
  };
}

function publish({ study, automatic, ...fields }: Projection) {
  current = {
    ...current, ...fields,
    study: study ? { ...current.study, ...study } : current.study,
    automatic: automatic ? { ...current.automatic, ...automatic } : current.automatic,
  };
  exposed = view(current);
  for (const listener of listeners) listener();
}

function dispatch(action: Action, provisional: Projection) {
  // Keep the existing recovery screens usable during a failed WASM download.
  publish(update ? JSON.parse(update(JSON.stringify(action))) as Projection : provisional);
}

export function connectLearningSession(apply: (raw: string) => string) {
  if (update) return;
  const projection = JSON.parse(apply(JSON.stringify({ type: "initialize", session: current }))) as Projection;
  update = apply;
  publish(projection);
}

export function subscribeToLearning(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const learningSnapshot = () => exposed;

function receive<Id extends Source>(source: Id, state: LearningSourceState<NonNullable<Snapshot[Id]["snapshot"]>>, fallback?: () => Projection) {
  if (state.status === "ready" && state.snapshot && state.updatedAt !== null) {
    dispatch({ type: "received", source, snapshot: state.snapshot, updatedAt: state.updatedAt },
      { [source]: state, ...(!update && fallback?.()) });
  } else if (state.status === "error" && state.error !== null) {
    dispatch({ type: "readFailed", source, error: state.error }, { [source]: { status: "error", error: state.error } });
  }
}

function automaticSignal(phase: AutomaticLearningPhase | null, error: string) {
  dispatch({ type: "automaticSignal", phase, error }, {
    automaticPhase: phase ?? current.automaticPhase, automaticProcessError: error,
  });
}

function subscribeToSources() {
  let active = true;
  const unlisten: UnlistenFn[] = [];
  const study = createLearningSource({
    read: async () => parseSelfStudySnapshot(await invoke("self_study_status")),
    onChange: state => receive("study", state, () => ({
      approvedStudyIndices: state.snapshot?.records.flatMap((record, index) => studyIsAvailable(record) ? [index] : []) ?? [],
    })),
  });
  const automatic = createLearningSource({
    read: async () => parseAutomaticMemorySnapshot(await invoke("automatic_memory_status")),
    onChange: state => receive("automatic", state),
  });
  studyController = study;
  automaticController = automatic;

  function subscribe(source: Source, event: string, refresh: () => void, accept?: (payload: unknown) => void) {
    void listen<unknown>(event, ({ payload }) => {
      if (!active) return;
      accept?.(payload);
      refresh();
    }).then(off => {
      if (!active) { off(); return; }
      unlisten.push(off);
      refresh();
    }).catch(cause => {
      if (!active) return;
      const error = errorText(cause);
      dispatch({ type: "listenerFailed", source, error }, { [source]: { eventError: error } });
    });
  }

  subscribe("study", "self-study-updated", study.notifyRefresh);
  subscribe("automatic", "automatic-memory-updated", automatic.notifyRefresh, payload => {
    if (!payload || typeof payload !== "object") return;
    const { phase, error } = payload as { phase?: unknown; error?: unknown };
    const accepted = phase === "idle" || phase === "evaluating" || phase === "error" ? phase : null;
    signalSequence += 1;
    automaticSignal(accepted, typeof error === "string" ? error : "");
  });

  return () => {
    active = false;
    study.dispose();
    automatic.dispose();
    unlisten.forEach(off => off());
    if (studyController === study) studyController = undefined;
    if (automaticController === automatic) automaticController = undefined;
  };
}

export function startLearningSession() {
  if (!desktopApp) return;
  let disposed = false;
  let stop: (() => void) | undefined;
  // Strict Mode's probe is disposed before native subscriptions are made.
  queueMicrotask(() => {
    if (!disposed) stop = subscribeToSources();
  });
  return () => {
    disposed = true;
    stop?.();
  };
}

function requiredSource<T>(controller: LearningSourceController<T> | undefined) {
  if (!controller) throw new Error("La fuente nativa de aprendizaje no está disponible.");
  return controller;
}

export async function toggleSelfStudy(enabled: boolean) {
  await requiredSource(studyController).runMutation(async () => parseSelfStudySnapshot(
    await invoke("set_self_study_enabled", { input: { enabled } }),
  ));
}

export async function toggleAutomaticMemory(enabled: boolean) {
  const controller = requiredSource(automaticController);
  const previousSignal = signalSequence;
  await controller.runMutation(async () => parseAutomaticMemorySnapshot(
    await invoke("set_automatic_memory_enabled", { input: { enabled } }),
  ));
  if (controller === automaticController && previousSignal === signalSequence) automaticSignal("idle", "");
}

export async function reviewAutomaticLearning(input: AutomaticMemoryReview) {
  await requiredSource(automaticController).runMutation(async () => parseAutomaticMemorySnapshot(
    await invoke("review_automatic_memory", { input }),
  ));
}

export function refreshLearningSources() {
  studyController?.notifyRefresh();
  automaticController?.notifyRefresh();
}
