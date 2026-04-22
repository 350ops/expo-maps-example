import fs from 'node:fs';
import path from 'node:path';

const moduleDir = path.resolve(process.cwd(), 'node_modules', 'expo-module-scripts');
const sourcePath = path.join(moduleDir, 'tsconfig.base.json');
const shimPath = path.join(moduleDir, 'tsconfig.base');

if (!fs.existsSync(moduleDir) || !fs.existsSync(sourcePath)) {
  console.log('[ensure-expo-module-scripts-tsconfig-base] expo-module-scripts not installed; skipping');
  process.exit(0);
}

if (!fs.existsSync(shimPath)) {
  fs.writeFileSync(shimPath, '{\n  "extends": "./tsconfig.base.json"\n}\n', 'utf8');
  console.log('[ensure-expo-module-scripts-tsconfig-base] created tsconfig.base shim');
} else {
  console.log('[ensure-expo-module-scripts-tsconfig-base] shim already exists');
}
