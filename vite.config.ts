// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this.
    server: { entry: "server" },

    // SPA mode.
    //
    // Without this, `npm run build` emits only client assets into .output/public and
    // NO HTML AT ALL — every page is rendered on demand by the nitro server, so a
    // deployment that only serves .output/public 404s on every route. That is fine
    // for the Lovable/cloudflare target, which runs the server, but the backend image
    // (docker/Dockerfile) serves static files from Python and has no Node runtime.
    //
    // This app is a client-rendered SPA wearing an SSR shell: it declares no server
    // functions and no route loaders (no `createServerFn`, no `loader()`), and all data
    // arrives client-side over react-query from the FastAPI API. So there is nothing
    // that needs a server at request time, and one prerendered shell is sufficient —
    // the router hydrates it and renders the real route client-side.
    //
    // `outputPath` names the shell, and the build writes it to `<outputPath>.html`
    // (prerender.js: `isSpaShell` -> `htmlPath = cleanPagePath + ".html"`). It must
    // therefore NOT end in `.html`, or the artifact would be `index.html.html`.
    // The upstream default is `/_shell`, which is what we keep; backend/core/frontend.py
    // serves that file as the catch-all for client-side routes.
    //
    // Not overridden here: `nitro.preset`. The prerender pass boots the built server
    // through a generated shim that imports a Cloudflare-style
    // `export default { fetch(request, env, ctx) }` entry
    // (@lovable.dev/vite-tanstack-config prerenderShimSource), which is the
    // `cloudflare-module` shape — the `node-server` preset would export a Node listener
    // instead and the shell would never render. The shim is installed whenever
    // prerendering is enabled, sandbox or not, so this works in a plain `npm run build`
    // and inside Docker.
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/_shell",
      },
    },
  },

  // Disable Nitro's own prerender to avoid double-prerendering and 404s
  // (the Nitro prerender runs before the SPA shell is ready, causing 404s)
  nitro: {
    prerender: false,
  },
});
