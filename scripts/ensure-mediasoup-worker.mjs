import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const workerBin = path.resolve(
  process.cwd(),
  'node_modules/mediasoup/worker/out/Release/mediasoup-worker'
);

if (fs.existsSync(workerBin)) {
  console.log(`[ensure-mediasoup-worker] Worker binary already present at ${workerBin}`);
  process.exit(0);
}

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'node_modules/mediasoup/package.json'), 'utf8')
);
const version = pkg.version;
const outDir = path.dirname(workerBin);
fs.mkdirSync(outDir, { recursive: true });

const candidates = ['kernel6', 'kernel5'];
for (const tag of candidates) {
  const url = `https://github.com/versatica/mediasoup/releases/download/${version}/mediasoup-worker-${version}-linux-x64-${tag}.tgz`;
  const tgz = path.join(outDir, `worker-${tag}.tgz`);
  try {
    console.log(`[ensure-mediasoup-worker] Attempting prebuilt download: ${url}`);
    execSync(`curl -fsSL "${url}" -o "${tgz}" && tar -xzf "${tgz}" -C "${outDir}"`, {
      stdio: 'inherit',
    });
    fs.unlinkSync(tgz);
    if (fs.existsSync(workerBin)) {
      fs.chmodSync(workerBin, 0o755);
      console.log(`[ensure-mediasoup-worker] Successfully installed mediasoup-worker (${tag})`);
      process.exit(0);
    }
  } catch {
    if (fs.existsSync(tgz)) fs.unlinkSync(tgz);
  }
}

console.error('[ensure-mediasoup-worker] Failed to fetch prebuilt mediasoup-worker binary.');
process.exit(1);
