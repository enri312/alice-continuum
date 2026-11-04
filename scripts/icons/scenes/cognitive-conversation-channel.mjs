// Conversation, locally filtered voice and optional visual context.
// This illustration never represents a live microphone/camera indicator.
export function conversationChannelScene(a, b, { plinth, fastener }) {
  return `${plinth(a,b,158)}
  <g data-detail="conversation-channel-chassis" filter="url(#shadow)">
    <path d="M22 140V48l16-17h124l16 17v92l-14 15H37Z" fill="url(#dark-metal)" stroke="#a9bdce" stroke-width="1"/>
    <path d="M30 135V52l13-13h114l13 13v83l-10 11H40Z" fill="#040d18" stroke="#546e85" stroke-width=".65"/>
    <path d="M44 35h109M26 59v66m148-66v66M42 151h116" fill="none" stroke="#a3bacb" stroke-width=".4"/>
    ${fastener(33,46,a,1.5)}${fastener(167,46,b,1.5)}${fastener(34,140,b,1.3)}${fastener(166,140,a,1.3)}
  </g>
  <g data-detail="optional-visual-context" data-activation="separate-session">
    <path d="M117 39h44l9 8v33l-6 6h-47l-6-6V45Z" fill="url(#metal)" stroke="#a9bdce" stroke-width=".9"/>
    <path d="M120 45h40l4 4v26l-4 4h-40Z" fill="#0b1729" stroke="${b}" stroke-width=".8"/>
    <path d="M139 86v5m-8 0h16" fill="none" stroke="#9eacc5" stroke-width="1.1"/>
    <g data-detail="camera-context-lens">
      <circle cx="153" cy="58" r="9" fill="#020912" stroke="#bbcbd7" stroke-width=".9"/>
      <circle cx="153" cy="58" r="5.7" fill="url(#glass)" stroke="${b}" stroke-width="1.2"/>
      <circle cx="153" cy="58" r="2.1" fill="#bdb0ee"/>
      <path d="m150 53 3-1" stroke="#f2efff" stroke-width=".6" stroke-linecap="round"/>
    </g>
  </g>
  <g data-detail="conversation-turns">
    <g data-detail="text-message-input">
      <path d="M49 50h86l12 11v44l-11 11H91l-20 15v-15H49l-10-11V61Z" fill="url(#metal)" stroke="#c3dbe6" stroke-width="1"/>
      <path d="M52 57h79l9 8v36l-8 8H88l-10 8v-8H52l-6-7V64Z" fill="#092333" stroke="${a}" stroke-width="1.7"/>
      <path d="M105 70h24m-24 9h19m-19 9h13" stroke="#afd5e5" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M53 53h75m-85 13v31" fill="none" stroke="#ecf6ff" stroke-width=".45" opacity=".7"/>
    </g>
    <g data-detail="owner-voice-microphone" data-activation="started-session">
      <rect x="68" y="64" width="20" height="34" rx="10" fill="url(#metal)" stroke="#d9edf3" stroke-width="1.2"/>
      <rect x="72" y="68" width="12" height="26" rx="6" fill="#124354" stroke="${a}" stroke-width=".8"/>
      ${[73,78,83,88].map(y=>`<path d="M75 ${y}h6" stroke="#b9f5ff" stroke-width="1" stroke-linecap="round"/>`).join('')}
      <path d="M61 85v7a17 17 0 0 0 34 0v-7M78 109v8m-9 0h18" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/>
    </g>
    <g data-detail="conversational-voice-output" data-transmission="session-or-manual">
      <path d="M108 99h50l13 12v25l-10 9h-13v12l-18-12h-22l-10-10v-26Z" fill="url(#metal)" stroke="#c7bbef" stroke-width="1"/>
      <path d="M111 106h43l10 9v17l-7 6h-15v7l-11-7h-20l-6-6v-20Z" fill="#1a1b38" stroke="${b}" stroke-width="1.4"/>
      <g data-detail="speech-waveform" stroke="#d8cbff" stroke-width="2.2" stroke-linecap="round">
        <path d="M114 119v7m8-14v21m8-17v13m8-20v27m8-20v13m8-10v7"/>
      </g>
      <path d="M113 102h36m-47 13v14" fill="none" stroke="#e9e0ff" stroke-width=".45"/>
    </g>
  </g>
  <g data-detail="local-noise-filter" data-processing="local-before-transcription">
    <path d="M43 129h45l9 8v12l-7 6H43l-7-7v-12Z" fill="url(#dark-metal)" stroke="#abcbd8" stroke-width=".8"/>
    <path data-detail="background-noise-input" d="m42 142 3-4 3 8 3-6 3 2" fill="none" stroke="#78909f" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <g data-detail="noise-filter-fins" stroke="${a}" stroke-width="1.5" stroke-linecap="round">
      <path d="M60 135v14m6-11v8m6-11v14"/>
    </g>
    <path data-detail="filtered-voice-signal" d="M79 142h3l2-4 3 8 2-4h3" fill="none" stroke="#b2f6ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M44 132h40" fill="none" stroke="#b2c8d4" stroke-width=".4"/>
  </g>`;
}
