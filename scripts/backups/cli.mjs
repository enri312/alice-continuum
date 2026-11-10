import { spawn } from 'node:child_process';
import path from 'node:path';
import { createSnapshot, listSnapshots, restoreSnapshot, settings, verifySnapshot } from './snapshot.mjs';
import { superviseSession } from './session.mjs';
import { exists } from './files.mjs';

async function main() {
  const [command = 'status', ...args] = process.argv.slice(2);
  const options = {};
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--force') { options.force = true; continue; }
    const key = { '--project-root': 'projectRoot', '--data-root': 'dataRoot', '--destination': 'destination', '--snapshot': 'snapshot', '--target': 'target' }[args[index]];
    const value = args[++index];
    if (!key || !value || value.startsWith('--')) throw new Error('Opcion desconocida o incompleta.');
    options[key] = value;
  }
  if (command === 'verify') {
    const manifest = await verifySnapshot(options.snapshot ?? '');
    console.log(`Respaldo verificado: ${manifest.files.length} archivos y Git ${manifest.git.head}.`);
  } else if (command === 'restore') {
    const restored = await restoreSnapshot(options.snapshot ?? '', options.target ?? '');
    console.log(`Restauracion verificada en ${restored.target}: ${restored.files} archivos. No se ha iniciado Alice ni aplicado credenciales.`);
  } else if (command === 'create') {
    const result = await createSnapshot(options);
    console.log(`${result.changed ? 'Respaldo creado y verificado' : 'Sin cambios; respaldo verificado'}: ${result.snapshot}`);
  } else if (command === 'status' || command === 'list') {
    const config = await settings(options);
    const snapshots = await listSnapshots(config.destination);
    console.log(`Destino privado: ${config.destination}\nIntervalo: ${config.intervalMinutes} minutos\nVersiones completas: ${snapshots.length}`);
    if (command === 'list') for (const snapshot of snapshots) console.log(snapshot);
    else if (snapshots.length) {
      const manifest = await verifySnapshot(snapshots[0]);
      console.log(`Ultima copia verificada: ${manifest.createdAt}\n${snapshots[0]}\n${manifest.files.length} archivos + historial Git.`);
    } else console.log('Todavia no hay una copia completa en este destino.');
  } else if (command === 'run') {
    const config = await settings(options);
    if (await exists(path.join(config.projectRoot, '.alice-restore-incomplete'))) throw new Error('Esta carpeta contiene una restauracion incompleta; restaura en un destino nuevo.');
    console.log(`[Respaldo] Destino: ${config.destination}. Cada ${config.intervalMinutes} minutos, al iniciar y al cerrar normalmente.`);
    process.exitCode = await superviseSession({
      backup: () => createSnapshot(options), intervalMs: config.intervalMinutes * 60_000,
      launch: () => new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [path.join(config.projectRoot, 'node_modules/@tauri-apps/cli/tauri.js'), 'dev'], {
          cwd: config.projectRoot, env: { ...process.env, ALICE_DATA_DIR: config.dataRoot }, stdio: 'inherit', windowsHide: true,
        });
        // Ctrl+C reaches the console group on Windows. Keep this supervisor alive
        // until the child's close event so a normal exit can finish its backup.
        const interrupt = () => { if (process.platform !== 'win32') child.kill('SIGINT'); };
        process.on('SIGINT', interrupt);
        child.once('error', reject);
        child.once('close', (code) => { process.removeListener('SIGINT', interrupt); resolve(code ?? 1); });
      }),
    });
  } else throw new Error('Uso: npm run backup -- create|status|list|verify --snapshot RUTA|restore --snapshot RUTA --target NUEVA_CARPETA');
}

main().catch(error => { console.error(`[Respaldo] ERROR: ${error.message}`); process.exitCode = 1; });
