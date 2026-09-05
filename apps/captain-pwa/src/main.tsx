import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";
import { ErrorBoundary } from "./shell/error-boundary.tsx";
import { applyBranding, getStoredBranding } from "./lib/branding.ts";

// Bundled: the Box has no internet, and the cloud stops depending on Google Fonts too.
// Latin subset only — the other subsets (cyrillic, greek, vietnamese, latin-ext)
// aren't used and were bloating the CSS bundle 82 KB -> 1.1 MB.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";

// Owner branding paints on the first frame from the local copy; app.tsx
// refreshes it from the API once signed in.
applyBranding(getStoredBranding());

// Injected at runtime — an absolute href in index.html makes Bun's HTML
// bundler try to resolve it as a build-time asset and fail.
for (const [rel, href] of [
  ["manifest", "/manifest.webmanifest"],
  ["icon", "/icon.png"],
  ["apple-touch-icon", "/icon.png"],
] as const) {
  if (document.querySelector(`link[rel="${rel}"]`)) continue;
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  document.head.appendChild(link);
}

// Chrome fires this once, early — stash it so the login screen can offer a
// native one-tap install instead of the "Add to Home Screen" menu dance.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__ODR_INSTALL = e as Event & { prompt: () => Promise<unknown> };
  window.dispatchEvent(new Event("odr:installable"));
});

// Server-supplied runtime config (diner origin for the table QRs). Awaited
// before first paint so nothing downstream has to deal with it arriving late.
// The production build inlines it into index.html; only dev has to fetch.
window.__ODR ??= await fetch("/config.json")
  .then((r) => r.json() as Promise<{ dinerOrigin?: string; offline?: boolean }>)
  .catch(() => ({}));

const el = document.getElementById("root");
if (!el) throw new Error("#root not found");

createRoot(el).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
