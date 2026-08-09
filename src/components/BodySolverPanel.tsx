const deviceNodes = [
  { code: "HUB", label: "Sensor hub", detail: "No configurado" },
  { code: "IMU", label: "IMU array", detail: "0 dispositivos" },
  { code: "DRV", label: "Tracker driver", detail: "No instalado" },
  { code: "POS", label: "Tracker poses", detail: "0 activas" },
  { code: "PKT", label: "Packet stream", detail: "Sin transporte" },
];

const solverMetrics = [
  ["IK ITER", "—"], ["CONSTRAINT ERR", "—"], ["PREDICTION", "—"],
  ["FOOT SLIP", "—"], ["CENTER OF MASS", "SIN DATOS"], ["BOUNCE PHASE", "—"],
  ["LOAD L / R", "— / —"], ["GROUND REACTION", "—"], ["PELVIS VERTICAL", "—"],
  ["ANG. MOMENTUM", "—"], ["KINETIC ENERGY", "—"], ["MUSCLE TORQUE", "—"],
  ["RAGDOLL ERROR", "—"], ["GYRO PEAK", "—"], ["RECOVERY", "—"],
];

function ReferenceBody({ output = false }: { output?: boolean }) {
  return <svg viewBox="0 0 300 300" role="img" aria-label={output ? "Silueta corporal de referencia sin movimiento" : "Esqueleto humanoide de referencia sin datos de sensores"}>
    <defs>
      <linearGradient id={output ? "body-output-gradient" : "body-input-gradient"} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor={output ? "#ccfbf1" : "#94a3b8"} stopOpacity={output ? ".72" : ".35"} />
        <stop offset="1" stopColor={output ? "#0f766e" : "#164e63"} stopOpacity=".2" />
      </linearGradient>
      <filter id={output ? "body-output-glow" : "body-input-glow"} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g className="body-reference-grid"><path d="M20 260h260M35 240h230M55 220h190"/><path d="M150 22v248M48 260l102-55 102 55"/></g>
    {output ? <g className="body-output-mesh" fill="url(#body-output-gradient)" stroke="#5eead4" filter="url(#body-output-glow)">
      <circle cx="150" cy="49" r="21"/><path d="M126 76 105 143l24 28 3 88h23l7-85 7 85h23l-4-88 24-28-38-67Z"/><path d="m126 80-32 22-36 49 16 10 43-44 19-21m38-16 32 22 36 49-16 10-43-44-19-21"/>
    </g> : <g className="body-input-rig" fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#body-input-glow)">
      <circle cx="150" cy="48" r="19"/><path d="M150 68v91m0-74-48 27-36 43m84-70 48 27 36 43m-84 4-28 48-8 54m36-102 28 48 8 54"/>
      <path d="m125 99 25 10 25-10m-53 108 28 8 28-8"/>
      <g className="body-input-joints"><circle cx="150" cy="68" r="4"/><circle cx="150" cy="109" r="4"/><circle cx="150" cy="159" r="5"/><circle cx="102" cy="112" r="4"/><circle cx="66" cy="155" r="4"/><circle cx="198" cy="112" r="4"/><circle cx="234" cy="155" r="4"/><circle cx="122" cy="207" r="4"/><circle cx="114" cy="261" r="4"/><circle cx="178" cy="207" r="4"/><circle cx="186" cy="261" r="4"/></g>
    </g>}
    <g className="body-axis"><path d="M31 268h35"/><path d="M31 268v-35"/><path d="M31 268l-16 13"/></g>
  </svg>;
}

export function BodySolverPanel() {
  return <div className="body-diagnostic">
    <header className="body-diagnostic-header">
      <div><span>[BODY]</span><strong>MOTION PIPELINE DIAGNOSTIC // LOCAL PROCESS</strong></div>
      <p><i />PIPELINE DESCONECTADO</p>
    </header>

    <dl className="body-summary">
      <div><dt>PRESET</dt><dd>NINGUNO</dd></div><div><dt>TRACKERS</dt><dd>0 / 0</dd></div><div><dt>SOLVER</dt><dd>OFF</dd></div><div><dt>INPUT RATE</dt><dd>0 HZ</dd></div><div><dt>OUTPUT</dt><dd>BLOCKED</dd></div>
    </dl>

    <div className="body-toolbar" aria-label="Etapas reservadas del solver corporal">
      <button type="button" disabled>RAW</button><button type="button" disabled>ONE EURO</button><button type="button" disabled>FABRIK + 2-BONE</button><button type="button" disabled>SOLVER</button><button type="button" disabled>SPRING</button><button type="button" disabled>RETARGET</button>
      <span>SCENARIO · NONE</span><span>INTENT · UNMODELED</span>
    </div>

    <div className="body-solver-layout">
      <section className="body-device-panel" aria-labelledby="body-devices-title">
        <div className="body-panel-title"><span id="body-devices-title">[00] TRACKER DEVICE ARRAY</span><small>SIMULATED DEVICE / REQUIRED</small></div>
        <div className="body-device-root"><span>ALICE_SENSOR_HUB</span><small>SIN TRANSPORTE</small></div>
        <div className="body-device-tree">{deviceNodes.map((node) => <div key={node.code}><i>{node.code}</i><span><strong>{node.label}</strong><small>{node.detail}</small></span><em /></div>)}</div>
        <dl className="body-device-metrics"><div><dt>Parsed nodes</dt><dd>0 / 0</dd></div><div><dt>Transport latency</dt><dd>—</dd></div><div><dt>Packet loss</dt><dd>—</dd></div><div><dt>Signal RSSI</dt><dd>—</dd></div><div><dt>MCU temperature</dt><dd>—</dd></div></dl>
      </section>

      <section className="body-viewport input" aria-labelledby="body-input-title">
        <div className="body-panel-title"><span id="body-input-title">[01] GENERIC MOCAP INPUT</span><small>SOURCE · NONE</small></div>
        <div className="body-canvas"><p>GENERIC PARAMETRIC HUMAN<br/>NO CAMERA / NO BIOMETRICS</p><ReferenceBody /><strong>SKELETON INPUT · WAITING</strong></div>
      </section>

      <section className="body-solver-panel" aria-labelledby="body-solver-title">
        <div className="body-panel-title"><span id="body-solver-title">[02] SENSOR FUSION / IK SOLVER</span><small>0 HZ FIXED STEP</small></div>
        <div className="body-solver-stages"><span>RAW</span><span>FILTER</span><span>IK</span><span>SPRING</span><span>RETARGET</span></div>
        <dl>{solverMetrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>

      <section className="body-viewport output" aria-labelledby="body-output-title">
        <div className="body-panel-title"><span id="body-output-title">[03] ALICE BODY OUTPUT</span><small>RETARGET · INACTIVE</small></div>
        <div className="body-canvas"><p>PRIVATE VRM HUMANOID<br/>RIG DATA NOT CONNECTED</p><ReferenceBody output /><strong>FOOT LOCK · — &nbsp; COM · —</strong></div>
      </section>
    </div>

    <section className="body-event-stream" aria-labelledby="body-events-title">
      <div className="body-panel-title"><span id="body-events-title">[04] MOTION EVENT STREAM</span><small>0 LOCAL RECORDS</small></div>
      <div><span>SEQ</span><span>LEVEL</span><span>MODE</span><span>FRAME</span><span>PAYLOAD</span></div>
      <p><strong>000</strong>SIN EVENTOS CORPORALES · ninguna cámara, IMU o pose está siendo procesada</p>
    </section>
    <div className="console-prompt"><strong>ALICE_BODY@LOCAL_PROCESS:~$</strong><span>sin sensores · sin solver · sin retarget · salida bloqueada</span></div>
  </div>;
}
