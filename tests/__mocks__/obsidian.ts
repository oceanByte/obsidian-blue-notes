import { vi } from 'vitest';

export class Plugin {
	app: any;
	manifest: any;
	loadData = vi.fn();
	saveData = vi.fn();
	addCommand = vi.fn();
	registerEvent = vi.fn();
	registerDomEvent = vi.fn();
	registerInterval = vi.fn();
}

export class TFile {
	path: string;
	name: string;
	parent: any;
	stat: { mtime: number; ctime: number; size: number };

	constructor(path: string) {
		this.path = path;
		this.name = path.split('/').pop() || path;
		this.parent = null;
		this.stat = {
			mtime: Date.now(),
			ctime: Date.now(),
			size: 1000,
		};
	}
}

export class Vault {
	cachedRead = vi.fn();
	getMarkdownFiles = vi.fn(() => []);
	getAbstractFileByPath = vi.fn();
}

export class App {
	vault: Vault;
	workspace: any;
	metadataCache: any;

	constructor() {
		this.vault = new Vault();
		this.workspace = {};
		this.metadataCache = {
			getFileCache: vi.fn(),
		};
	}
}

export class Notice {
	constructor(message: string) {
		console.log(`Notice: ${message}`);
	}
}

export class SuggestModal<T> {
	app: App;
	inputEl: any;
	containerEl: any;

	constructor(app: App) {
		this.app = app;
		this.inputEl = {} as any;
		this.containerEl = {} as any;
	}

	getSuggestions(query: string): T[] | Promise<T[]> {
		return [];
	}

	renderSuggestion(value: T, el: HTMLElement): void {}

	onChooseSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void {}

	setPlaceholder(placeholder: string): void {}

	setInstructions(instructions: Array<{ command: string; purpose: string }>): void {}

	open(): void {}

	close(): void {}
}

export const requestUrl = vi.fn();
