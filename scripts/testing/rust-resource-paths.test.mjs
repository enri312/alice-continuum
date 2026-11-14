import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
function rustSources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return rustSources(file);
    return entry.isFile() && file.endsWith('.rs') ? [file] : [];
  });
}

describe('rutas de recursos compilados por Rust', () => {
  it('resuelve recursos literales incluso en módulos de otras plataformas', () => {
    const sources = [path.join(root, 'Backend/src-tauri/src'), path.join(root, 'crates/state-controls/src')].flatMap(rustSources);
    const missing = [];
    let references = 0;
    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/include_(?:str|bytes)!\(\s*"([^"\\]+)"\s*\)/g)) {
        references++;
        if (!existsSync(path.resolve(path.dirname(file), match[1]))) missing.push(`${path.relative(root, file)}: ${match[1]}`);
      }
    }
    expect(references).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });
});
