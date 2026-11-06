// Explicitly publish only these existing synthetic QA samples, never a private directory.
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
const output = new URL("scripts/testing/.fixtures/", root);
const source = new URL("local/artifacts/conversation-session-2026-11-04/", root);
const metadata = JSON.parse(await readFile(new URL("fixture-meta.json", source), "utf8"));
const expected = ["Hola, Alice. Quiero mejorar tu forma de conversar.", "Me refiero a ti, Alice, a tus respuestas.", "Detén la conversación, Alice."];
if (!metadata.ready || metadata.timings?.length !== expected.length
    || metadata.timings.some((entry,index)=>entry.text !== expected[index])) {
  throw Error("Sólo se pueden preparar las tres frases sintéticas conocidas del piloto.");
}
await mkdir(output, {recursive:true});
for (const name of ["fixture-meta.json", "fixture-0.wav", "fixture-1.wav", "fixture-2.wav"]) {
  await copyFile(new URL(name, source), new URL(name, output));
}
await copyFile(new URL("local/artifacts/voice-noise-2026-11-04/synthetic-speech.wav", root), new URL("synthetic-speech.wav", output));
console.log(`Fixtures sintéticas de QA preparadas en ${fileURLToPath(output)}. No incluye datos canónicos ni abre el micrófono.`);
