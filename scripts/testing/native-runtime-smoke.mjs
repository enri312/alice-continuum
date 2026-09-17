// Runs the explicitly ignored real native lifecycle test; keeps only metadata.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
function snapshot(dir) {
  return fs.readdirSync(dir).sort().flatMap(name => {
    const p = path.join(dir, name), s = fs.lstatSync(p);
    if (s.isSymbolicLink()) throw Error('Refusing linked data');
    return s.isDirectory() ? snapshot(p) : [[path.relative(root, p), crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]];
  });
}
const before = snapshot(path.join(root, 'data'));
const cargo = spawn('cargo', ['test', '--lib', 'local_inference::tests::live_owned_start_inference_stop', '--', '--ignored', '--exact', '--nocapture'],
  { cwd: path.join(root, 'src-tauri'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
cargo.stdout.on('data', c => { output += c; process.stdout.write(c); });
cargo.stderr.on('data', c => { output += c; process.stderr.write(c); });
const code = await new Promise((resolve, reject) => { cargo.on('error', reject); cargo.on('exit', resolve); });
const unchanged = JSON.stringify(before) === JSON.stringify(snapshot(path.join(root, 'data')));
const report = { date: new Date().toISOString(), exitCode: code, canonicalDataUnchanged: unchanged, files: before.length, output };
fs.mkdirSync(path.join(root, 'artifacts/gemma-evaluation'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/gemma-evaluation/native-runtime-smoke.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ exitCode: code, canonicalDataUnchanged: unchanged, files: before.length }));
if (code !== 0 || !unchanged) process.exitCode = 1;
