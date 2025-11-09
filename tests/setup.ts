import { vi } from 'vitest';

global.console = {
	...console,
	error: vi.fn(),
	warn: vi.fn(),
	log: vi.fn(),
	info: vi.fn(),
	debug: vi.fn(),
};
