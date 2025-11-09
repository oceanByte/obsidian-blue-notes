import { vi, Mock } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EmbeddingCache } from '../../src/embeddings/cache';

vi.mock('fs');

describe('EmbeddingCache', () => {
	const testPluginDir = '/test/plugin/dir';
	const testCacheDir = path.join(testPluginDir, 'cache');
	const testCacheFile = path.join(testCacheDir, 'embeddings-multilingual-e5-small.json');

	beforeEach(() => {
		vi.clearAllMocks();
		(fs.existsSync as Mock).mockReturnValue(false);
		(fs.mkdirSync as Mock).mockImplementation(() => {});
		(fs.readFileSync as Mock).mockReturnValue('{}');
		(fs.writeFileSync as Mock).mockImplementation(() => {});
	});

	describe('constructor', () => {
		it('should set cache directory path', () => {
			const cache = new EmbeddingCache(testPluginDir);
			expect(cache).toBeDefined();
		});
	});

	describe('initialize', () => {
		it('should create cache directory if not exists', async () => {
			(fs.existsSync as Mock).mockReturnValue(false);
			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();
			expect(fs.mkdirSync).toHaveBeenCalledWith(testCacheDir, { recursive: true });
		});

		it('should load existing cache file', async () => {
			const mockCache = {
				version: '1.0.0',
				model: 'test-model',
				created: Date.now(),
				embeddings: {
					'test.md': {
						vector: [1, 2, 3],
						hash: 'abc123',
						timestamp: Date.now(),
						metadata: { wordCount: 10, tags: [], folder: '' },
					},
				},
			};
			(fs.existsSync as Mock).mockReturnValue(true);
			(fs.readFileSync as Mock).mockReturnValue(JSON.stringify(mockCache));

			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();

			expect(fs.readFileSync).toHaveBeenCalledWith(testCacheFile, 'utf-8');
		});

		it('should handle corrupted cache file', async () => {
			(fs.existsSync as Mock).mockReturnValue(true);
			(fs.readFileSync as Mock).mockReturnValue('invalid json');

			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();

			const stats = cache.getStats();
			expect(stats.count).toBe(0);
		});

		it('should not create directory if already exists', async () => {
			(fs.existsSync as Mock).mockReturnValue(true);
			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();
			expect(fs.mkdirSync).not.toHaveBeenCalled();
		});
	});

	describe('get', () => {
		it('should return null for non-existent file', () => {
			const cache = new EmbeddingCache(testPluginDir);
			const result = cache.get('nonexistent.md', 'hash123');
			expect(result).toBeNull();
		});

		it('should return null for mismatched hash', async () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			const result = cache.get('test.md', 'differenthash');
			expect(result).toBeNull();
		});

		it('should return vector for matching file and hash', () => {
			const cache = new EmbeddingCache(testPluginDir);
			const vector = [1, 2, 3, 4, 5];
			cache.set('test.md', vector, 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			const result = cache.get('test.md', 'hash123');
			expect(result).toEqual(vector);
		});
	});

	describe('set', () => {
		it('should store embedding with metadata', () => {
			const cache = new EmbeddingCache(testPluginDir);
			const vector = [1, 2, 3];
			const metadata = { wordCount: 50, tags: ['#tag1'], folder: 'notes' };

			cache.set('test.md', vector, 'hash123', metadata);
			const result = cache.get('test.md', 'hash123');

			expect(result).toEqual(vector);
		});

		it('should update existing entry', () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('test.md', [1, 2, 3], 'hash1', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			cache.set('test.md', [4, 5, 6], 'hash2', {
				wordCount: 20,
				tags: [],
				folder: '',
			});

			const result = cache.get('test.md', 'hash2');
			expect(result).toEqual([4, 5, 6]);
		});

		it('should mark cache as dirty', async () => {
			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			await cache.save();
			expect(fs.writeFileSync).toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('should remove entry from cache', () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			cache.remove('test.md');
			const result = cache.get('test.md', 'hash123');
			expect(result).toBeNull();
		});

		it('should handle removing non-existent entry', () => {
			const cache = new EmbeddingCache(testPluginDir);
			expect(() => cache.remove('nonexistent.md')).not.toThrow();
		});

		it('should mark cache as dirty when removing', async () => {
			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			cache.remove('test.md');
			await cache.save();
			expect(fs.writeFileSync).toHaveBeenCalled();
		});
	});

	describe('getAll', () => {
		it('should return all cached embeddings', () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('file1.md', [
				{ chunkId: 'chunk-0', vector: [1, 2, 3], chunk: { chunkId: 'chunk-0', content: 'test', headings: [], startLine: 0, endLine: 0, wordCount: 1, preview: 'test' } }
			], 'hash1', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			cache.set('file2.md', [
				{ chunkId: 'chunk-0', vector: [4, 5, 6], chunk: { chunkId: 'chunk-0', content: 'test2', headings: [], startLine: 0, endLine: 0, wordCount: 1, preview: 'test2' } }
			], 'hash2', {
				wordCount: 20,
				tags: [],
				folder: '',
			});

			const all = cache.getAll();
			expect(Object.keys(all)).toHaveLength(2);
			expect(all['file1.md'].chunks[0].vector).toEqual([1, 2, 3]);
			expect(all['file2.md'].chunks[0].vector).toEqual([4, 5, 6]);
		});

		it('should return empty object for empty cache', () => {
			const cache = new EmbeddingCache(testPluginDir);
			const all = cache.getAll();
			expect(all).toEqual({});
		});
	});

	describe('getFilePaths', () => {
		it('should return all file paths', () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('file1.md', [1, 2, 3], 'hash1', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			cache.set('file2.md', [4, 5, 6], 'hash2', {
				wordCount: 20,
				tags: [],
				folder: '',
			});

			const paths = cache.getFilePaths();
			expect(paths).toHaveLength(2);
			expect(paths).toContain('file1.md');
			expect(paths).toContain('file2.md');
		});

		it('should return empty array for empty cache', () => {
			const cache = new EmbeddingCache(testPluginDir);
			const paths = cache.getFilePaths();
			expect(paths).toEqual([]);
		});
	});

	describe('has', () => {
		it('should return true for cached file with matching hash', () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			expect(cache.has('test.md', 'hash123')).toBe(true);
		});

		it('should return false for non-existent file', () => {
			const cache = new EmbeddingCache(testPluginDir);
			expect(cache.has('nonexistent.md', 'hash123')).toBe(false);
		});

		it('should return false for mismatched hash', () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			expect(cache.has('test.md', 'differenthash')).toBe(false);
		});
	});

	describe('computeHash', () => {
		it('should compute consistent hash for same content', () => {
			const content = 'test content';
			const hash1 = EmbeddingCache.computeHash(content);
			const hash2 = EmbeddingCache.computeHash(content);
			expect(hash1).toBe(hash2);
		});

		it('should compute different hash for different content', () => {
			const hash1 = EmbeddingCache.computeHash('content 1');
			const hash2 = EmbeddingCache.computeHash('content 2');
			expect(hash1).not.toBe(hash2);
		});

		it('should handle empty content', () => {
			const hash = EmbeddingCache.computeHash('');
			expect(hash).toBeDefined();
			expect(typeof hash).toBe('string');
		});

		it('should handle unicode content', () => {
			const hash = EmbeddingCache.computeHash('Hello 世界 🌍');
			expect(hash).toBeDefined();
			expect(typeof hash).toBe('string');
		});
	});

	describe('save', () => {
		it('should write cache to disk when dirty', async () => {
			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			await cache.save();
			expect(fs.writeFileSync).toHaveBeenCalledWith(
				testCacheFile,
				expect.any(String),
				'utf-8'
			);
		});

		it('should not write when cache is not dirty', async () => {
			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();
			await cache.save();
			expect(fs.writeFileSync).not.toHaveBeenCalled();
		});

		it('should mark cache as not dirty after save', async () => {
			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			await cache.save();
			(fs.writeFileSync as Mock).mockClear();
			await cache.save();
			expect(fs.writeFileSync).not.toHaveBeenCalled();
		});

		it('should throw error on write failure', async () => {
			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			(fs.writeFileSync as Mock).mockImplementation(() => {
				throw new Error('Write failed');
			});
			await expect(cache.save()).rejects.toThrow('Write failed');
		});
	});

	describe('clear', () => {
		it('should remove all embeddings', () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('file1.md', [1, 2, 3], 'hash1', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			cache.set('file2.md', [4, 5, 6], 'hash2', {
				wordCount: 20,
				tags: [],
				folder: '',
			});
			cache.clear();
			expect(cache.getFilePaths()).toHaveLength(0);
		});

		it('should mark cache as dirty', async () => {
			const cache = new EmbeddingCache(testPluginDir);
			await cache.initialize();
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			cache.clear();
			await cache.save();
			expect(fs.writeFileSync).toHaveBeenCalled();
		});
	});

	describe('getStats', () => {
		it('should return correct count', () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('file1.md', [1, 2, 3], 'hash1', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			cache.set('file2.md', [4, 5, 6], 'hash2', {
				wordCount: 20,
				tags: [],
				folder: '',
			});
			const stats = cache.getStats();
			expect(stats.count).toBe(2);
		});

		it('should return size in bytes', () => {
			const cache = new EmbeddingCache(testPluginDir);
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			const stats = cache.getStats();
			expect(stats.size).toBeGreaterThan(0);
		});

		it('should track timestamps', () => {
			const cache = new EmbeddingCache(testPluginDir);
			const now = Date.now();
			cache.set('test.md', [1, 2, 3], 'hash123', {
				wordCount: 10,
				tags: [],
				folder: '',
			});
			const stats = cache.getStats();
			expect(stats.oldestTimestamp).toBeLessThanOrEqual(now);
			expect(stats.newestTimestamp).toBeGreaterThanOrEqual(now);
		});

		it('should handle empty cache', () => {
			const cache = new EmbeddingCache(testPluginDir);
			const stats = cache.getStats();
			expect(stats.count).toBe(0);
			expect(stats.size).toBeGreaterThan(0);
		});
	});
});
