import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readRustPrompt } from './rust-prompt-reader.mjs';

const backend = fileURLToPath(new URL('../../Backend/src-tauri/src/', import.meta.url));
const cloud = `${backend}cloud.rs`;
const prompt = name => readFileSync(`${backend}prompts/${name}.txt`, 'utf8');

describe('prompts Rust usados por los pilotos', () => {
  it('reconstruye la instrucción escrita con sus archivos actuales en el orden real', () => {
    expect(readRustPrompt(cloud, 'SYSTEM_PROMPT')).toBe(`${prompt('personality')}\n\n${prompt('conversation')}`);
  });

  it('reconstruye la instrucción oral y lee el saludo literal completo', () => {
    expect(readRustPrompt(cloud, 'VOICE_SYSTEM_PROMPT')).toBe(`${prompt('personality')}\n\n${prompt('conversation-voice')}`);
    expect(readRustPrompt(cloud, 'VOICE_GREETING_PROMPT')).toContain('respuestas; si menciona a otra persona');
    expect(readRustPrompt(cloud, 'VARIABLE_INEXISTENTE')).toBeNull();
  });
});
