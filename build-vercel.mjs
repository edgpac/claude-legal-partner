/**
 * Post-build script: converts Vite/Vinxi's dist/ output into the
 * Vercel Build Output API v3 format (.vercel/output/).
 *
 * Structure created:
 *   .vercel/output/config.json          – route config
 *   .vercel/output/static/              – CDN-served client assets
 *   .vercel/output/functions/render.func/ – Node.js SSR function
 */
import { cpSync, mkdirSync, writeFileSync, rmSync } from "node:fs";

const out = ".vercel/output";

// Clean previous output so stale files don't linger.
rmSync(out, { recursive: true, force: true });

// 1. Static assets → served directly from Vercel's CDN.
mkdirSync(`${out}/static`, { recursive: true });
cpSync("dist/client", `${out}/static`, { recursive: true });

// 2. SSR function → all of dist/server/ copied in.
const fn = `${out}/functions/render.func`;
mkdirSync(fn, { recursive: true });
cpSync("dist/server", fn, { recursive: true });

// Vercel needs package.json with type:module so .js files run as ESM.
writeFileSync(`${fn}/package.json`, JSON.stringify({ type: "module" }));

// Function config: Node.js 20, web-compatible fetch handler.
writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({
    runtime: "nodejs20.x",
    handler: "server.js",
    launcherType: "Nodejs",
    supportsResponseStreaming: true,
  }),
);

// 3. Route config:
//    – immutable assets → CDN with long cache
//    – existing static files → filesystem
//    – everything else → SSR function
writeFileSync(
  `${out}/config.json`,
  JSON.stringify({
    version: 3,
    routes: [
      {
        src: "/assets/(.*)",
        headers: { "cache-control": "public, max-age=31536000, immutable" },
        continue: true,
      },
      { handle: "filesystem" },
      { src: "/(.*)", dest: "/render" },
    ],
  }),
);

console.log("✓ .vercel/output ready");
