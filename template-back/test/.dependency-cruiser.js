/**
 * ================================================================
 *  Dependency Cruiser - Architecture Enforcement Rules
 * ================================================================
 *
 * 1. Layers (inside `src/`): domain <- application <- infrastructure <- presentation.
 *    - domain          may depend on: domain
 *    - application     may depend on: application, domain
 *    - infrastructure  may depend on: infrastructure, application, domain, and the engine
 *                      registry/contract (src/engines/index.ts, src/engines/sdk.ts)
 *    - presentation    may depend on: everything
 *
 * 2. Engines (src/engines/<id>/): written by other developers, so they are walled in.
 *    - an engine may import only its own files and the SDK (src/engines/sdk.ts)
 *    - nothing outside src/engines may import an engine's own files; the rest of the app
 *      sees engines only through src/engines/index.ts (the list) and src/engines/sdk.ts
 *    npm packages and Node built-ins are policed by ESLint (see eslint.config.mjs), not here.
 *
 * Any violation fails the architecture check.
 */

module.exports = {
  forbidden: [
    {
      name: "domain-no-external",
      comment: "domain can only depend on domain",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        pathNot: "^src/domain"
      }
    },
    {
      name: "application-layer",
      comment: "application can only depend on application or domain",
      severity: "error",
      from: { path: "^src/application" },
      to: {
        pathNot: "^src/(application|domain)"
      }
    },
    {
      name: "infrastructure-layer",
      comment: "infrastructure can only depend on infra, application, domain (plus the engine list and SDK)",
      severity: "error",
      from: { path: "^src/infrastructure" },
      to: {
        pathNot: "^src/(infrastructure|application|domain)|^src/engines/(index|sdk)\.ts$"
      }
    },
    {
      name: "engine-stays-in-its-folder",
      comment: "an engine may import only its own files and the SDK (src/engines/sdk.ts)",
      severity: "error",
      from: { path: "^src/engines/([^/]+)/" },
      to: {
        path: "^src",
        pathNot: ["^src/engines/$1/", "^src/engines/sdk\.ts$"]
      }
    },
    {
      name: "nothing-imports-engine-internals",
      comment: "outside src/engines only index.ts and sdk.ts may be imported - never an engine's own files",
      severity: "error",
      from: { pathNot: "^src/engines/" },
      to: {
        path: "^src/engines/[^/]+/"
      }
    }
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.json"
    },
    doNotFollow: {
      path: "node_modules"
    },
    includeOnly: "^src"
  }
};
