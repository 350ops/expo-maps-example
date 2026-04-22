import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const sessionId = 'ad439a';
const endpoint = 'http://127.0.0.1:7825/ingest/1c14628a-ee81-4ac8-be5c-b6737b231826';
const runId = `pre-fix-${Date.now()}`;

const sendLog = (hypothesisId, location, message, data) =>
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': sessionId,
    },
    body: JSON.stringify({
      sessionId,
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});

const rootRequire = createRequire(path.resolve(process.cwd(), 'package.json'));
const expoMapsPkgJsonPath = rootRequire.resolve('expo-maps/package.json');
const expoMapsDir = path.dirname(expoMapsPkgJsonPath);
const expoMapsRequire = createRequire(path.join(expoMapsDir, 'package.json'));
const expoMapsTsconfigPath = path.join(expoMapsDir, 'tsconfig.json');
const expoMapsTsconfigRaw = fs.readFileSync(expoMapsTsconfigPath, 'utf8');
const expoMapsTsconfig = JSON.parse(expoMapsTsconfigRaw.replace(/^\s*\/\/.*\n/, ''));
const extendsValue = expoMapsTsconfig.extends;

let rootResolved = null;
let rootResolveError = null;
try {
  rootResolved = rootRequire.resolve('expo-module-scripts/tsconfig.base');
} catch (error) {
  rootResolveError = String(error?.message ?? error);
}
const extendsNoJsonPath = rootResolved
  ? path.join(path.dirname(rootResolved), path.basename(rootResolved).replace(/\.json$/, ''))
  : null;

let expoMapsResolved = null;
let expoMapsResolveError = null;
try {
  expoMapsResolved = expoMapsRequire.resolve('expo-module-scripts/tsconfig.base');
} catch (error) {
  expoMapsResolveError = String(error?.message ?? error);
}

// #region agent log
sendLog('H1', 'scripts/debug-tsconfig-resolution.mjs:51', 'Dependency visibility from root resolver', {
  extendsValue,
  rootResolved,
  rootResolveError,
});
// #endregion

// #region agent log
sendLog('H2', 'scripts/debug-tsconfig-resolution.mjs:58', 'Dependency visibility from expo-maps resolver', {
  expoMapsDir,
  expoMapsResolved,
  expoMapsResolveError,
});
// #endregion

// #region agent log
sendLog('H3', 'scripts/debug-tsconfig-resolution.mjs:66', 'Resolved file existence checks', {
  rootResolvedExists: rootResolved ? fs.existsSync(rootResolved) : false,
  expoMapsResolvedExists: expoMapsResolved ? fs.existsSync(expoMapsResolved) : false,
});
// #endregion

// #region agent log
sendLog('H4', 'scripts/debug-tsconfig-resolution.mjs:74', 'Package and config file presence checks', {
  expoMapsPkgJsonPath,
  expoMapsTsconfigPath,
  expoMapsTsconfigExists: fs.existsSync(expoMapsTsconfigPath),
});
// #endregion

const parsed = ts.getParsedCommandLineOfConfigFile(expoMapsTsconfigPath, {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: () => {},
});
const configFileText = fs.readFileSync(expoMapsTsconfigPath, 'utf8');
const parseTextJson = ts.parseConfigFileTextToJson(expoMapsTsconfigPath, configFileText);

// #region agent log
sendLog('H5', 'scripts/debug-tsconfig-resolution.mjs:90', 'TypeScript parser results for config file', {
  tsVersion: ts.version,
  parseError: parseTextJson.error ? ts.flattenDiagnosticMessageText(parseTextJson.error.messageText, '\n') : null,
  parsedExists: Boolean(parsed),
  parsedErrorCount: parsed?.errors?.length ?? 0,
  parsedErrors: (parsed?.errors ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')),
});
// #endregion

// #region agent log
sendLog('H6', 'scripts/debug-tsconfig-resolution.mjs:101', 'tsconfig.base path variant existence', {
  resolvedJsonPath: rootResolved,
  resolvedNoJsonPath: extendsNoJsonPath || null,
  existsJsonPath: rootResolved ? fs.existsSync(rootResolved) : false,
  existsNoJsonPath: extendsNoJsonPath ? fs.existsSync(extendsNoJsonPath) : false,
});
// #endregion

console.log('debug-tsconfig-resolution: instrumentation emitted');
