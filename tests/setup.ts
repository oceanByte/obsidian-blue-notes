import { vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile() {
	const envPath = path.join(__dirname, '..', '.env');
	if (fs.existsSync(envPath)) {
		const envContent = fs.readFileSync(envPath, 'utf-8');
		envContent.split('\n').forEach(line => {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				const [key, ...valueParts] = trimmed.split('=');
				if (key && valueParts.length > 0) {
					const value = valueParts.join('=');
					process.env[key.trim()] = value.trim();
				}
			}
		});
	}
}

loadEnvFile();

global.console = {
	...console,
	error: vi.fn(),
	warn: vi.fn(),
	log: vi.fn(),
	info: vi.fn(),
	debug: vi.fn(),
};
