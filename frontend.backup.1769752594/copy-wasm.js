import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const wasmFiles = ['web-ifc.wasm', 'web-ifc-mt.wasm'];
const sourceDir = join(__dirname, 'node_modules', 'web-ifc');
const destDir = join(__dirname, 'public');

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

wasmFiles.forEach(file => {
  const source = join(sourceDir, file);
  const dest = join(destDir, file);
  
  if (existsSync(source)) {
    copyFileSync(source, dest);
    console.log(`✓ Copied ${file}`);
  }
});
