import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRerankReport, resolveRerankPython } from './r8-report.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pythonExecutable = process.env.ALICE_TEST_PYTHON ?? path.join(root,
  process.platform === 'win32' ? 'runtime/venv/Scripts/python.exe' : 'runtime/venv-linux/bin/python');
const options = { pythonExecutable };
const fixture = () => ({ schemaVersion: 1, rankings: [
  { lexical: [1, 0], reranked: [2, 0, 1] }, { lexical: [], reranked: [1, 2, 0] },
  { lexical: [2], reranked: [3, 1, 0] }, { lexical: [0, 1, 2], reranked: [3, 2, 1] },
], totalRerankLatencyMs: 10, sourcePreserved: true });

describe('informe R8 bajo demanda', () => {
  it('rechaza rutas relativas o Python ausente antes de la inferencia', () => {
    expect(() => resolveRerankPython({ pythonExecutable: 'python' })).toThrow(/absoluta/);
    expect(() => createRerankReport(fixture(), { pythonExecutable: path.join(root, 'runtime/no-python.exe') })).toThrow(/Falta Python/);
  });

  describe.skipIf(!fs.existsSync(pythonExecutable))('proceso Python real con datos ficticios', () => {
    it('mantiene el contrato, las fracciones y el redondeo del informe anterior', () => {
      expect(createRerankReport(fixture(), options)).toEqual({
        realConfirmedProfileRecords: 4, lexicalTop1: 0.25, lexicalTop3: 0.5,
        gemmaRerankTop1: 0.5, gemmaRerankTop3: 0.75, totalRerankLatencyMs: 10,
        meanRerankLatencyMs: 3, sourcePreserved: true, indexPersisted: false,
      });
    });

    it('no convierte una preservación declarada falsa en una comprobación positiva', () => {
      const request = { schemaVersion: 1, rankings: [{ lexical: [], reranked: [0] }],
        totalRerankLatencyMs: 0, sourcePreserved: false };
      expect(createRerankReport(request, options)).toMatchObject({ lexicalTop1: 0, gemmaRerankTop3: 1,
        sourcePreserved: false, meanRerankLatencyMs: 0 });
    });

    it('rechaza datos inválidos sin filtrar contenido ni recurrir al analizador anterior', () => {
      const request = fixture(); request.rankings[3].reranked = [3, 3, 0];
      expect(() => createRerankReport(request, options)).toThrow(/no pudo generar/);
      expect(() => createRerankReport({ ...fixture(), privateText: 'NEVER_ECHO_THIS' }, options)).toThrow(/no pudo generar/);
      expect(() => createRerankReport({ ...fixture(), privateText: 'x'.repeat(1024 * 1024) }, options)).toThrow(/1 MiB/);
      expect(() => createRerankReport(fixture(), { ...options, timeoutMs: 0 })).toThrow(/Tiempo/);
    });

    it('limita el tiempo y comunica fallos del ejecutable', () => {
      expect(() => createRerankReport(fixture(), { ...options, timeoutMs: 1 })).toThrow(/tiempo/);
      expect(() => createRerankReport(fixture(), { pythonExecutable: process.execPath })).toThrow(/no pudo generar/);
    });

    it('CLI usa sólo el archivo elegido, conserva sus bytes y rechaza claves duplicadas', () => {
      const artifacts = path.join(root, 'runtime/artifacts'); fs.mkdirSync(artifacts, { recursive: true });
      const folder = fs.mkdtempSync(path.join(artifacts, 'r8-report-test-'));
      const input = path.join(folder, 'rankings.json');
      const run = () => spawnSync(process.execPath, [path.join(root, 'scripts/testing/r8-report.mjs'), '--input', input],
        { env: { ...process.env, ALICE_PYTHON_BIN: pythonExecutable }, timeout: 10000, encoding: 'utf8', windowsHide: true });
      try {
        const original = JSON.stringify(fixture()); fs.writeFileSync(input, original);
        const passed = run(); expect(passed.status).toBe(0);
        expect(JSON.parse(passed.stdout)).toEqual(createRerankReport(fixture(), options));
        expect(fs.readFileSync(input, 'utf8')).toBe(original);
        expect(fs.readdirSync(folder)).toEqual(['rankings.json']);
        for (const invalid of [original.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'),
          '{"secret":"NEVER_ECHO_THIS"}', 'x'.repeat(1024 * 1024 + 1)]) {
          fs.writeFileSync(input, invalid);
          const failed = run(); expect(failed.status).toBe(1); expect(failed.stdout).toBe('');
          expect(failed.stderr).not.toContain('NEVER_ECHO_THIS');
          expect(fs.readFileSync(input, 'utf8')).toBe(invalid);
        }
      } finally {
        expect(path.dirname(path.resolve(folder))).toBe(artifacts);
        fs.rmSync(folder, { recursive: true, force: true });
      }
    }, 15000);
  });
});
