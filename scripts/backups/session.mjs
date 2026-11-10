// The launcher owns this lifecycle; importing the module or running tests/builds
// does not start timers or touch the owner's data.
export async function superviseSession({ backup, launch, intervalMs, log = console.log }) {
  let pending;
  let closed = false;
  const checkpoint = (reason) => {
    if (pending) return pending;
    pending = (async () => {
      try {
        const result = await backup();
        log(`[Respaldo: ${reason}] ${result.changed ? 'Copia verificada' : 'Sin cambios; copia verificada'}: ${result.snapshot}`);
      } catch (error) {
        log(`[Respaldo: ${reason}] ERROR: ${error.message}. Alice puede continuar; revisa el respaldo.`);
      } finally { pending = undefined; }
    })();
    return pending;
  };
  await checkpoint('inicio');
  const timer = setInterval(() => { if (!closed) void checkpoint('periodico'); }, intervalMs);
  try { return await launch(); }
  finally {
    closed = true;
    clearInterval(timer);
    await pending;
    await checkpoint('cierre');
  }
}
