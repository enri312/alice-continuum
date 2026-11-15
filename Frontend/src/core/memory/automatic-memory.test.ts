import { describe, expect, it } from "vitest";
import { automaticMemoryForConversation, parseAutomaticMemorySnapshot, type AutomaticMemorySnapshot } from "./automatic-memory";
import { retrieveMemories } from "./memory-retrieval";
import { buildCognitiveMemoryNodes } from "./cognitive-memory";
import { buildCognitiveVolumeGraph } from "../cognitive/cognitive-volume";
import { buildCloudPayload } from "../conversation/cloud-payload";

const record = {
  id:"4d5d2b38-9ea2-4b8b-a711-5a0fc6cdaee7", evidence:"Prefiero ejemplos de astronomía para estudiar programación.",
  content:"Prefiero ejemplos de astronomía para estudiar programación.", memoryType:"preference" as const,
  importance:3, reason:"stablePreference" as const, sourceExchangeId:"c920fb1d-cb31-49b5-9359-4fbeb4b861a2",
  sourceSha256:`sha256:${"a".repeat(64)}`, createdAt:"2026-11-03T12:00:00Z",updatedAt:"2026-11-03T12:00:00Z",
  active:true, ownerCorrected:false, revisions:[],
};
const snapshot: AutomaticMemorySnapshot = {schemaVersion:1,enabled:true,records:[record],lastOutcome:"saved",activeCount:1};

describe("memoria automática y su recorrido hasta RAG y volumen", () => {
  it("recupera una selección literal sin llamarla conocimiento confirmado por el propietario", () => {
    const memories = automaticMemoryForConversation(parseAutomaticMemorySnapshot(snapshot));
    const matches = retrieveMemories("astronomía programación",memories,3);
    expect(matches.map(m => m.memory.id)).toEqual([record.id]);
    const payload = buildCloudPayload({draft:"Explícame programación con mis preferencias",includeMemory:true,memories:matches.map(m=>m.memory),includeHistory:false,recentHistory:[],includeWindow:false,observationEnabled:false,foregroundContext:null});
    expect(payload).toContain(record.evidence);
    expect(payload).toContain("SELECCIÓN AUTOMÁTICA · SIN REVISIÓN MANUAL");
    expect(payload).not.toContain("HECHO ENSEÑADO Y CONFIRMADO");
    const graph=buildCognitiveVolumeGraph(buildCognitiveMemoryNodes(memories,[record.id]),null);
    expect(graph.persistentNodeCount).toBe(1);
    expect(graph.nodes[0].memory).toMatchObject({id:record.id,status:"learned",retrieved:true,conversationExchangeId:record.sourceExchangeId});
  });
  it("retirar conserva el registro y su nodo, pero lo excluye de recuperación", () => {
    const memories=automaticMemoryForConversation({...snapshot,activeCount:0,records:[{...record,active:false}]});
    expect(retrieveMemories("astronomía programación",memories,3)).toEqual([]);
    const [node]=buildCognitiveMemoryNodes(memories,[record.id]);
    expect(node).toMatchObject({archived:true,retrieved:false});
    expect(memories[0].summary).toBe(record.content);
  });
  it("vincula dos selecciones del mismo intercambio sin inventar una asociación semántica", () => {
    const second={...record,id:"4d5d2b38-9ea2-4b8b-a711-5a0fc6cdaee8",content:"Me gustan los ejemplos cortos."};
    const memories=automaticMemoryForConversation({...snapshot,activeCount:2,records:[record,second]});
    const graph=buildCognitiveVolumeGraph(buildCognitiveMemoryNodes(memories),null);
    expect(graph.persistentNodeCount).toBe(2);
    expect(graph.persistentAssociationCount).toBe(0);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({kind:"coLearning",signal:0,evidenceCount:1});
    const unrelated=automaticMemoryForConversation({...snapshot,activeCount:2,records:[record,{...second,sourceExchangeId:second.id}]});
    expect(buildCognitiveVolumeGraph(buildCognitiveMemoryNodes(unrelated),null).edges).toEqual([]);
  });
  it("la corrección usa el texto vigente y conserva la cita original como procedencia", () => {
    const corrected={...record,ownerCorrected:true,content:"Prefiero ejemplos de música.",revisions:[record.content]};
    const parsed=parseAutomaticMemorySnapshot({...snapshot,records:[corrected]});
    const memory=automaticMemoryForConversation(parsed)[0];
    expect(memory.summary).toBe(corrected.content);
    expect(buildCognitiveMemoryNodes([memory])[0].status).toBe("confirmed");
    expect(parsed.records[0].evidence).toBe(record.evidence);
  });
  it("rechaza registros duplicados y conteos incoherentes antes de proyectarlos", () => {
    expect(()=>parseAutomaticMemorySnapshot({...snapshot,records:[record,record],activeCount:2})).toThrow();
    expect(()=>parseAutomaticMemorySnapshot({...snapshot,activeCount:0})).toThrow();
    expect(()=>parseAutomaticMemorySnapshot({...snapshot,records:[{...record,importance:99}]})).toThrow();
  });
});
