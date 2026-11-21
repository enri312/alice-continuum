import assert from 'node:assert/strict';

// Runs inside a fresh page's synthetic IPC fixture. This never requests a device.
function installVoiceFixture() {
  const rawTracks = [];
  const captureRequests = [];
  const previousInvoke = globalThis.__TAURI_INTERNALS__.invoke;
  const exchanges = [];
  globalThis.__dioxusVoiceFixture = { rawTracks, captureRequests, exchanges };
  globalThis.__TAURI_INTERNALS__.invoke = async (command, args) => {
    switch (command) {
      case 'start_local_runtime': return { running: true };
      case 'start_voice_session':
        exchanges.push(command);
        return { sessionId: 'synthetic-voice-session' };
      case 'stop_voice_session':
        exchanges.push(command);
        return null;
      case 'transcribe_voice_turn':
        exchanges.push(command);
        if (!args.input.confirmed || !args.input.audioBase64 || !args.input.mimeType.startsWith('audio/webm')) {
          throw new Error('La toma de prueba debe ser una transcripción confirmada de WebM.');
        }
        return { text: 'Toma de prueba.', noSpeech: false, model: 'Whisper sintético', durationMs: 70,
          ephemeralAudio: true, sentToConversation: false, persisted: false };
      default: return previousInvoke(command, args);
    }
  };
  navigator.mediaDevices.enumerateDevices = async () =>
    [{ kind: 'audioinput', deviceId: 'synthetic-input', label: 'Micrófono sintético' }];
  navigator.mediaDevices.getUserMedia = async constraints => {
    captureRequests.push(constraints.audio);
    const context = new AudioContext({ sampleRate: 48000 });
    await context.resume();
    const oscillator = context.createOscillator();
    const destination = context.createMediaStreamDestination();
    const gain = context.createGain();
    gain.gain.value = .15;
    oscillator.frequency.value = 210;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    const [track] = destination.stream.getTracks();
    const nativeStop = track.stop.bind(track);
    track.stop = () => {
      if (track.readyState === 'ended') return;
      nativeStop();
      oscillator.stop();
      void context.close();
    };
    rawTracks.push(track);
    return destination.stream;
  };
}

export async function assertDioxusVoice({ evaluate, click, until }) {
  await evaluate(`(${installVoiceFixture})()`);
  const existingDraft = (await evaluate('document.querySelector("#alice-message").value')).trim();
  await click('.audio-input-settings summary');
  await click('.audio-input-devices button');
  await until(() => evaluate('document.querySelector(".audio-input-devices select").options.length === 2'), 'Enumeración del micrófono sintético');
  await click('.voice-turn-toggle');
  await click('.voice-turn-actions button');
  await until(() => evaluate('document.querySelector(".voice-turn-panel header i")?.classList.contains("active")'), 'Grabación sintética preparada');
  await until(() => evaluate('document.querySelector(".voice-turn-panel header").textContent.includes("1/60")'), 'Una toma de un segundo');
  await click('.voice-turn-actions button:nth-child(2)');
  await until(() => evaluate('document.querySelector("#alice-voice-input-player")?.src.startsWith("blob:")'), 'Vista previa de audio local');
  assert.equal(await evaluate('__dioxusVoiceFixture.rawTracks[0].readyState'), 'ended', 'El micrófono se cierra antes de revisar el audio');
  assert.equal(await evaluate('__dioxusVoiceFixture.exchanges.length'), 0, 'Parar y revisar conserva el audio local');
  await click('.voice-turn-actions .primary');
  const expectedDraft = [existingDraft, 'Toma de prueba.'].filter(Boolean).join('\n');
  await until(() => evaluate(`document.querySelector("#alice-message").value === ${JSON.stringify(expectedDraft)}`), 'La transcripción se añade al borrador');
  assert.equal(await evaluate('Boolean(document.querySelector("#alice-voice-input-player"))'), false);
  assert.deepEqual(await evaluate('__dioxusVoiceFixture.exchanges'), ['transcribe_voice_turn']);
  assert.equal(await evaluate('__calls.filter(({cmd}) => cmd === "send_cloud_message").length'), 0, 'El dictado todavía no autoriza el envío');
  await evaluate(`Array.from(document.querySelectorAll('.audio-input-settings label')).find(label => label.textContent.includes('Probar señal directa')).querySelector('input').click()`);
  await click('.hands-free-controls button');
  await until(() => evaluate('document.querySelector(".hands-free-controls strong").textContent.includes("Escuchando")'), 'Escucha automática armada');
  assert.equal(await evaluate('__dioxusVoiceFixture.rawTracks[1].readyState'), 'live');
  assert.equal(await evaluate('__dioxusVoiceFixture.captureRequests[0].noiseSuppression'), true);
  assert.equal(await evaluate('__dioxusVoiceFixture.captureRequests[1].noiseSuppression'), false, 'La opción de señal directa llega al micrófono');
  await click('.dashboard-entry');
  await until(() => evaluate('__dioxusVoiceFixture.rawTracks[1].readyState === "ended" && __dioxusVoiceFixture.exchanges.includes("stop_voice_session")'), 'Salir libera la captura y la autorización');
}
