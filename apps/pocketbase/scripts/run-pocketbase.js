import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pocketbaseDir = path.resolve(__dirname, '..');
const pocketbaseBinary = path.join(pocketbaseDir, 'pocketbase');
const args = process.argv.slice(2);

if (!existsSync(pocketbaseBinary)) {
	console.error(`PocketBase binary not found at ${pocketbaseBinary}`);
	process.exit(1);
}

if (args.includes('--migrationsDir=./pb_snapshots')) {
	mkdirSync(path.join(pocketbaseDir, 'pb_snapshots'), { recursive: true });
}

const child = spawn(pocketbaseBinary, args, {
	cwd: pocketbaseDir,
	stdio: 'inherit',
	env: process.env,
});

child.on('exit', (code, signal) => {
	if (signal) {
		process.kill(process.pid, signal);
		return;
	}

	process.exit(code ?? 0);
});

child.on('error', (error) => {
	console.error('Failed to start PocketBase:', error.message);
	process.exit(1);
});
