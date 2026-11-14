// Read the literal prompt declarations used by the Rust backend. This is for
// evaluation tools only; unsupported Rust expressions fail instead of guessing.
import fs from 'node:fs';
import path from 'node:path';

export function readRustPrompt(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  const declaration = source.match(new RegExp(`const ${name}: &str = ((?:"(?:[^"\\\\]|\\\\.)*"|[^";])*);`));
  if (!declaration) return null;
  const expression = declaration[1].trim();
  const concat = expression.match(/^concat!\(([\s\S]*)\)$/);
  const body = concat ? concat[1] : expression;
  const tokenPattern = /include_str!\("((?:[^"\\]|\\.)*)"\)|"(?:[^"\\]|\\.)*"/g;
  let result = '';
  let offset = 0;
  let count = 0;
  for (const match of body.matchAll(tokenPattern)) {
    if (!/^[\s,]*$/.test(body.slice(offset, match.index))) throw new Error(`Expresión de ${name} no admitida en ${file}`);
    result += match[1] === undefined
      ? JSON.parse(match[0])
      : fs.readFileSync(path.resolve(path.dirname(file), JSON.parse(`"${match[1]}"`)), 'utf8');
    offset = match.index + match[0].length;
    count++;
  }
  if (!count || !/^[\s,]*$/.test(body.slice(offset))) throw new Error(`Expresión de ${name} no admitida en ${file}`);
  return result;
}
