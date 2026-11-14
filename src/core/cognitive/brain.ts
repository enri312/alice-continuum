import { createPlannedAffectChannels } from "./affect";
import type { AffectChannel } from "./affect";
import { buildCognitiveMemoryNodes } from "../memory/cognitive-memory";
import type { CognitiveMemoryInput, CognitiveMemoryNode } from "../memory/cognitive-memory";
import { prepareMemoryRetrieval, projectMemoryRetrieval, type MemoryRetrievalObservation, type RetrievedMemoryView } from "../memory/retrieval-observation";

export type BrainGroup = "input" | "memory" | "output";

export type BrainNode = {
  id: string;
  label: string;
  value: string;
  detail: string;
  group: BrainGroup;
  x: number;
  y: number;
};

export type BrainFlowNode = {
  id: string;
  label: string;
  value: string;
  detail: string;
  group: BrainGroup;
  activation: number;
  availability: "ready" | "planned";
  x: number;
  y: number;
};

export type InternalStateMetric = {
  id: string;
  label: string;
  value: number;
  detail: string;
  availability: "ready" | "planned";
};

export type BehaviorControl = InternalStateMetric & {
  locked: boolean;
};

export type BrainSnapshot = {
  hasActivity: boolean;
  neuralDensity: number;
  persistentNeuralDensity: number;
  currentNeuralActivity: number;
  persistentMemoryCount: number;
  retrievedMemoryCount: number;
  retrievedMemoryTop: string;
  retrievedMemory: RetrievedMemoryView;
  focus: string;
  focusStatus: string;
  focusDetail: string;
  nodes: BrainNode[];
  flowNodes: BrainFlowNode[];
  stateMetrics: InternalStateMetric[];
  behaviorControls: BehaviorControl[];
  affectChannels: AffectChannel[];
  memoryNodes: CognitiveMemoryNode[];
};

type BrainInputs = {
  lastUserMessage?: string;
  conversationCount: number;
  memories: CognitiveMemoryInput[];
  retrievedMemoryCount: number;
  retrievedMemoryTop: string;
  retrievedMemoryIds: string[];
  memoryRetrievalObservation?: MemoryRetrievalObservation;
  observerEnabled: boolean;
  foregroundContext: { windowTitle: string; processName: string } | null;
  cloudConfigured: boolean;
  cloudPending: boolean;
};

// Traduce únicamente estados comprobables de Alice al mapa del Núcleo.
export function buildBrainSnapshot(inputs: BrainInputs): BrainSnapshot {
  const observation = inputs.memoryRetrievalObservation ?? prepareMemoryRetrieval(inputs.retrievedMemoryIds.flatMap(id => {
    const memory = inputs.memories.find(item => item.id === id);
    return memory ? [{ memory }] : [];
  }), null, inputs.retrievedMemoryCount > 0);
  const retrievedMemory = projectMemoryRetrieval(observation, inputs.memories);
  if (inputs.memoryRetrievalObservation) inputs = { ...inputs,
    retrievedMemoryCount: retrievedMemory.count,
    retrievedMemoryTop: retrievedMemory.top?.text ?? "",
    retrievedMemoryIds: retrievedMemory.ids,
  };
  const memoryNodes = buildCognitiveMemoryNodes(inputs.memories, inputs.retrievedMemoryIds);
  const memoryCount = memoryNodes.length;
  const focus = inputs.lastUserMessage?.trim() || (inputs.retrievedMemoryCount ? `Memoria relacionada: ${inputs.retrievedMemoryTop}` : "Lista para conversar");
  const shortFocus = focus.length > 54 ? `${focus.slice(0, 51)}…` : focus;
  const hasWindow = Boolean(inputs.observerEnabled && inputs.foregroundContext);
  const hasConversation = inputs.conversationCount > 0;
  const hasMemory = memoryCount > 0;
  const hasRetrievedMemory = inputs.retrievedMemoryCount > 0;
  const hasActivity = Boolean(inputs.lastUserMessage || hasConversation || hasMemory || hasRetrievedMemory || hasWindow || inputs.cloudPending);
  const memoryActivation = hasRetrievedMemory ? Math.min(.96, .56 + inputs.retrievedMemoryCount * .12) : hasMemory ? Math.min(.72, .2 + memoryCount * .06) : 0;
  const responseActivation = hasConversation ? Math.min(.94, .48 + inputs.conversationCount * .035) : 0;
  // La densidad duradera depende solo de memoria local. Una interacción actual
  // añade un pulso pequeño, pero disponer de una IA de nube no hace crecer la red.
  // La estructura crece lentamente: unos pocos recuerdos no deben parecer una
  // red madura. La curva se aproxima a 86% solo con cientos o miles de registros.
  const persistentDensity = hasMemory ? Math.min(.86, .015 + .845 * memoryCount / (memoryCount + 180)) : 0;
  const activityPulse = inputs.cloudPending ? .055 : inputs.lastUserMessage ? .035 : hasWindow ? .025 : hasConversation ? .02 : 0;
  const recallPulse = hasRetrievedMemory ? Math.min(.09, inputs.retrievedMemoryCount * .025) : 0;
  const currentNeuralActivity = hasActivity ? Math.min(.18, activityPulse + recallPulse) : 0;
  const neuralDensity = hasActivity ? Math.min(.96, persistentDensity + currentNeuralActivity) : 0;

  const trustScore = retrievedMemory.top?.scoreKind === "lexical" && retrievedMemory.top.score != null
    ? (retrievedMemory.top.score > 1 ? Math.min(1, retrievedMemory.top.score / 10) : Math.max(0, Math.min(1, retrievedMemory.top.score)))
    : 0;
  const socialActivation = hasConversation ? Math.min(0.85, 0.35 + inputs.conversationCount * 0.05) : 0;
  const curiosityActivation = inputs.lastUserMessage ? 0.45 : hasWindow ? 0.25 : 0;
  const surpriseActivation = inputs.lastUserMessage ? (inputs.retrievedMemoryCount === 0 ? 0.75 : Math.max(0.08, 0.50 - inputs.retrievedMemoryCount * 0.08)) : 0;
  const frustrationActivation = retrievedMemory.phase === "failed" ? 0.60 : 0;

  return {
    hasActivity,
    neuralDensity,
    persistentNeuralDensity: persistentDensity,
    currentNeuralActivity,
    persistentMemoryCount: memoryCount,
    retrievedMemoryCount: inputs.retrievedMemoryCount,
    retrievedMemoryTop: inputs.retrievedMemoryTop,
    retrievedMemory,
    focus: shortFocus,
    focusStatus: inputs.cloudPending ? "consultando la nube" : inputs.retrievedMemoryCount ? "recuperando memoria" : inputs.lastUserMessage ? "conversación activa" : "en espera",
    focusDetail: inputs.retrievedMemoryCount ? `La búsqueda local encontró ${inputs.retrievedMemoryCount} recuerdos relacionados. Principal: ${inputs.retrievedMemoryTop}.` : inputs.lastUserMessage ? `Último mensaje autorizado de Carlos Nuñez: ${focus}` : "Alice espera una pregunta; ya no hace falta iniciar una misión.",
    nodes: [
      { id: "chat", label: "Entrada", value: inputs.lastUserMessage ? "mensaje recibido" : "disponible", detail: inputs.lastUserMessage ? `Entrada local más reciente: ${focus}` : "El canal de conversación está disponible.", group: "input", x: 12, y: 31 },
      { id: "window", label: "Ventana", value: inputs.observerEnabled ? inputs.foregroundContext?.processName ?? "esperando" : "apagada", detail: hasWindow ? `Contexto visible: ${inputs.foregroundContext?.windowTitle}` : "La observación de ventana no aporta datos a la nube salvo autorización expresa.", group: "input", x: 17, y: 68 },
      { id: "cloud", label: "Proveedor", value: inputs.cloudConfigured ? "disponible" : "sin clave", detail: inputs.cloudConfigured ? "Hay al menos un proveedor configurado en el proceso nativo; cada envío requiere revisión." : "No se encontró una credencial de proveedor. No puede realizarse ninguna llamada.", group: "input", x: 34, y: 18 },
      { id: "memory", label: "Memoria", value: hasRetrievedMemory ? `${inputs.retrievedMemoryCount} recuperados` : `${memoryCount} recuerdos`, detail: hasRetrievedMemory ? `Recuperación local activa. Coincidencia principal: ${inputs.retrievedMemoryTop}.` : memoryCount ? "Los recuerdos son locales y solo salen si se seleccionan en la revisión." : "Aún no hay recuerdos locales.", group: "memory", x: 34, y: 77 },
      { id: "workspace", label: "Contexto", value: inputs.cloudPending ? "en uso" : "local", detail: "El contexto se compone en el equipo y se muestra antes de enviarse.", group: "memory", x: 62, y: 50 },
      { id: "reply", label: "Respuesta", value: inputs.cloudPending ? "esperando" : `${inputs.conversationCount} mensajes`, detail: inputs.cloudPending ? "Existe una solicitud autorizada en curso." : "Las respuestas se muestran en Conversación y no ejecutan acciones.", group: "output", x: 78, y: 25 },
      { id: "retention", label: "Retención", value: "store: false", detail: "Alice solicita no persistir estado de respuesta, sin prometer que el proveedor carece de registros operativos.", group: "output", x: 86, y: 59 },
      { id: "actions", label: "Acciones", value: "bloqueadas", detail: "El modelo solo puede responder texto; no tiene herramientas ni permisos para modificar Windows.", group: "output", x: 75, y: 79 },
    ],
    flowNodes: [
      { id: "flow-input", label: "Entrada", value: inputs.lastUserMessage ? "mensaje" : "sin datos", detail: inputs.lastUserMessage ? `Mensaje recibido: ${focus}` : "Todavía no se registró ninguna entrada.", group: "input", activation: inputs.lastUserMessage ? .88 : 0, availability: "ready", x: 7, y: 49 },
      { id: "flow-language", label: "Lenguaje", value: inputs.cloudConfigured ? "proveedor listo" : "sin proveedor", detail: inputs.cloudConfigured ? "El proveedor de lenguaje está configurado, pero solo se activa con un envío autorizado." : "Se necesita configurar una API para procesar lenguaje en la nube.", group: "input", activation: inputs.cloudPending ? .94 : hasConversation ? .54 : 0, availability: "ready", x: 25, y: 20 },
      { id: "flow-memory", label: "Memoria", value: hasRetrievedMemory ? `${inputs.retrievedMemoryCount} recuperados` : `${memoryCount} recuerdos`, detail: hasRetrievedMemory ? `Se encontraron recuerdos relacionados; el principal es “${inputs.retrievedMemoryTop}”. Aún requieren autorización para salir.` : hasMemory ? "Memoria local disponible para una consulta autorizada." : "No hay recuerdos guardados.", group: "memory", activation: memoryActivation, availability: "ready", x: 25, y: 78 },
      { id: "flow-social", label: "Social", value: hasConversation ? "conversación" : "sin interacción", detail: hasConversation ? "Hay contexto de conversación disponible." : "Aún no hubo una interacción para evaluar.", group: "input", activation: hasConversation ? .61 : 0, availability: "ready", x: 45, y: 34 },
      { id: "flow-self", label: "Modelo propio", value: "planificado", detail: "Alice todavía no posee un modelo propio persistente. Este módulo queda reservado para una fase futura.", group: "memory", activation: 0, availability: "planned", x: 64, y: 18 },
      { id: "flow-affect", label: "Afecto", value: "planificado", detail: "No existe todavía un sistema emocional. Alice no debe representar emociones como estados reales.", group: "memory", activation: 0, availability: "planned", x: 45, y: 68 },
      { id: "flow-inhibition", label: "Inhibición", value: hasActivity ? "límites activos" : "en espera", detail: "Representa las restricciones: sin herramientas autónomas, revisión previa y acciones bloqueadas.", group: "output", activation: hasActivity ? .58 : 0, availability: "ready", x: 64, y: 82 },
      { id: "flow-workspace", label: "Contexto", value: inputs.cloudPending ? "en uso" : "local", detail: "Espacio temporal donde se prepara el contexto autorizado de una solicitud.", group: "memory", activation: inputs.cloudPending ? .91 : inputs.lastUserMessage ? .42 : 0, availability: "ready", x: 79, y: 50 },
      { id: "flow-response", label: "Respuesta", value: hasConversation ? `${inputs.conversationCount} mensajes` : "sin salida", detail: hasConversation ? "Hay mensajes en la conversación actual." : "Alice todavía no generó ninguna respuesta.", group: "output", activation: responseActivation, availability: "ready", x: 94, y: 23 },
      { id: "flow-face", label: "Rostro", value: "futuro", detail: "Salida facial reservada para una etapa posterior con avatar.", group: "output", activation: 0, availability: "planned", x: 94, y: 50 },
      { id: "flow-body", label: "Cuerpo manual", value: "repertorio local", detail: "El visor dispone de una máquina corporal manual y diagnóstica. El puente de decisiones output.avatar.body continúa desconectado.", group: "output", activation: 0, availability: "ready", x: 94, y: 78 },
    ],
    stateMetrics: [
      { id: "state-curiosity", label: "Curiosidad", value: curiosityActivation, detail: curiosityActivation > 0 ? "Estímulo de entrada perceptual derivado de la interacción reciente del usuario." : "Canal perceptual en espera; sin estímulo de entrada reciente.", availability: "ready" },
      { id: "state-social", label: "Comodidad social", value: socialActivation, detail: socialActivation > 0 ? `Canal conversacional activo con ${inputs.conversationCount} mensajes en la sesión.` : "Sin interacción conversacional en curso.", availability: "ready" },
      { id: "state-frustration", label: "Frustración", value: frustrationActivation, detail: frustrationActivation > 0 ? "Fallo técnico registrado en la última operación." : "Operación nominal: 0 errores detectados en la sesión.", availability: "ready" },
      { id: "state-inhibition", label: "Inhibición", value: hasActivity ? .58 : 0, detail: hasActivity ? "Límites de seguridad activos: verificación de permisos R2 en cada operación." : "Límites en reposo: sin solicitudes pendientes.", availability: "ready" },
      { id: "state-trust", label: "Confianza", value: trustScore, detail: trustScore > 0 ? `Relevancia técnica del contexto de memoria (${trustScore.toFixed(3)}). Puntuación matemática, no emoción.` : "Sin memoria recuperada en la consulta actual para ponderar relevancia.", availability: "ready" },
      { id: "state-fatigue", label: "Fatiga", value: 0, detail: "Carga operativa de la sesión: en reposo inicial. Medida técnica de eventos procesados.", availability: "ready" },
      { id: "state-surprise", label: "Sorpresa", value: surpriseActivation, detail: surpriseActivation > 0 ? (inputs.retrievedMemoryCount === 0 ? "Novedad estadística alta: sin antecedentes en memoria para esta entrada." : `Novedad contextualizada con ${inputs.retrievedMemoryCount} recuerdos existentes.`) : "Sin consulta activa para evaluar novedad estadística.", availability: "ready" },
      { id: "state-memory", label: "Actividad de memoria", value: memoryActivation, detail: hasRetrievedMemory ? `${inputs.retrievedMemoryCount} recuerdos recuperados localmente; principal: ${inputs.retrievedMemoryTop}.` : hasMemory ? `${memoryCount} recuerdos locales registrados en la estructura persistente.` : "No existen recuerdos locales.", availability: "ready" },
    ],
    behaviorControls: [
      { id: "control-autonomy", label: "Autonomía", value: 0, detail: "Bloqueada: el modelo no recibe herramientas ni capacidad de actuar por sí mismo.", availability: "ready", locked: true },
      { id: "control-creativity", label: "Creatividad", value: 0, detail: "Control planificado; todavía no está conectado a los parámetros de los proveedores.", availability: "planned", locked: true },
      { id: "control-empathy", label: "Estilo empático", value: 0, detail: "Control planificado para el estilo de respuesta; no representará una emoción real.", availability: "planned", locked: true },
      { id: "control-inhibition", label: "Inhibición", value: hasActivity ? .58 : 0, detail: "Indicador de las restricciones aplicadas, no un control editable en esta fase.", availability: "ready", locked: true },
      { id: "control-stability", label: "Estabilidad de estilo", value: 0, detail: "Control planificado para mantener coherencia de tono y conducta.", availability: "planned", locked: true },
      { id: "control-memory", label: "Influencia de memoria", value: 0, detail: "Permanece en cero hasta que el usuario seleccione recuerdos durante la revisión de un envío.", availability: "ready", locked: true },
      { id: "control-anticipation", label: "Anticipación", value: 0, detail: "Control planificado para preparar transiciones de respuesta; no predice el futuro ni acciones del usuario.", availability: "planned", locked: true },
      { id: "control-speed", label: "Velocidad de estilo", value: 0, detail: "Control planificado para el ritmo expresivo de futuras salidas; no modifica todavía el procesamiento.", availability: "planned", locked: true },
    ],
    affectChannels: createPlannedAffectChannels(),
    memoryNodes,
  };
}
