export const LoginServiceLoop = () => (
  <div className="login-service-loop" aria-hidden="true">
    <svg
      className="login-service-loop__canvas"
      viewBox="0 0 620 500"
      fill="none"
      focusable="false"
    >
      <defs>
        <filter id="service-card-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dy="10" stdDeviation="12" floodColor="#000" floodOpacity="0.14" />
        </filter>
      </defs>

      <text className="login-service-loop__eyebrow" x="44" y="50">LIVE SERVICE LOOP</text>
      <text className="login-service-loop__title" x="44" y="81">One order. Zero handoffs.</text>

      <path
        className="login-service-loop__route"
        d="M91 383 C162 383 164 310 235 310 S329 223 389 223 S467 142 532 142"
      />
      <circle className="login-service-loop__runner-halo" cx="91" cy="383" r="13" />
      <circle className="login-service-loop__runner" cx="91" cy="383" r="5" />

      <g className="login-service-loop__stage login-service-loop__stage--order">
        <rect className="login-service-loop__card" x="39" y="302" width="104" height="130" rx="22" />
        <rect className="login-service-loop__device" x="65" y="319" width="52" height="82" rx="12" />
        <line className="login-service-loop__ink" x1="76" y1="339" x2="106" y2="339" />
        <line className="login-service-loop__muted" x1="76" y1="352" x2="99" y2="352" />
        <line className="login-service-loop__muted" x1="76" y1="365" x2="103" y2="365" />
        <rect className="login-service-loop__accent-fill" x="75" y="379" width="32" height="10" rx="5" />
        <circle className="login-service-loop__food" cx="112" cy="318" r="9" />
        <text className="login-service-loop__label" x="55" y="417">ORDER</text>
      </g>

      <g className="login-service-loop__stage login-service-loop__stage--ticket">
        <rect className="login-service-loop__card" x="183" y="245" width="104" height="128" rx="22" />
        <path className="login-service-loop__paper" d="M207 266 H263 V341 L257 336 L251 341 L245 336 L239 341 L233 336 L227 341 L221 336 L215 341 L207 336 Z" />
        <line className="login-service-loop__ink" x1="219" y1="292" x2="251" y2="292" />
        <line className="login-service-loop__muted" x1="219" y1="305" x2="245" y2="305" />
        <line className="login-service-loop__muted" x1="219" y1="318" x2="252" y2="318" />
        <circle className="login-service-loop__accent-fill" cx="268" cy="260" r="8" />
        <text className="login-service-loop__label" x="200" y="359">KOT FIRED</text>
      </g>

      <g className="login-service-loop__stage login-service-loop__stage--kitchen">
        <rect className="login-service-loop__card" x="333" y="158" width="112" height="128" rx="22" />
        <path className="login-service-loop__accent-stroke" d="M354 232 H424" />
        <path className="login-service-loop__accent-stroke" d="M363 230 C365 197 413 197 415 230" />
        <circle className="login-service-loop__accent-fill" cx="389" cy="196" r="4" />
        <path className="login-service-loop__steam login-service-loop__steam--one" d="M375 190 C369 180 381 176 375 165" />
        <path className="login-service-loop__steam login-service-loop__steam--two" d="M403 190 C397 180 409 176 403 165" />
        <circle className="login-service-loop__food" cx="431" cy="162" r="8" />
        <text className="login-service-loop__label" x="349" y="270">IN KITCHEN</text>
      </g>

      <g className="login-service-loop__stage login-service-loop__stage--served">
        <rect className="login-service-loop__card" x="477" y="77" width="110" height="128" rx="22" />
        <path className="login-service-loop__accent-stroke" d="M508 119 C508 100 556 100 556 119" />
        <path className="login-service-loop__accent-fill" d="M499 120 H565 L558 167 H506 Z" />
        <path className="login-service-loop__bag-line" d="M518 138 H546 M518 149 H540" />
        <circle className="login-service-loop__food" cx="575" cy="87" r="9" />
        <text className="login-service-loop__label" x="503" y="189">SERVED</text>
      </g>

      <g className="login-service-loop__ticker">
        <circle className="login-service-loop__ticker-dot" cx="47" cy="470" r="4" />
        <text className="login-service-loop__ticker-copy" x="60" y="474">
          TABLE 08  /  3 ITEMS  /  KITCHEN ETA 08:00
        </text>
      </g>
    </svg>
  </div>
);
