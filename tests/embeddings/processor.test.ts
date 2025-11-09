import { vi, type Mocked } from "vitest";
import { EmbeddingProcessor } from "../../src/embeddings/processor";
import { EmbeddingCache } from "../../src/embeddings/cache";
import { TFile } from "obsidian";
import { Notice } from "obsidian";

vi.mock("obsidian", async () => {
  const actual = await vi.importActual("obsidian");
  return {
    ...actual,
    Notice: vi.fn(),
  };
});

const mockPlugin = {
  app: {
    vault: {
      getMarkdownFiles: vi.fn().mockReturnValue([]),
    },
  },
  providerManager: {
    getProvider: vi.fn(),
  },
  settings: {
    processing: {
      minWordCount: 10,
      batchSize: 10,
      adaptiveBatching: false,
    },
  },
};

describe("EmbeddingProcessor", () => {
  let processor: EmbeddingProcessor;
  let mockCache: Mocked<EmbeddingCache>;
  let mockProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCache = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
      getAll: vi.fn().mockReturnValue({}),
      getStats: vi.fn().mockReturnValue({
        count: 0,
        chunkCount: 0,
        size: 100,
        oldestTimestamp: Date.now(),
        newestTimestamp: Date.now(),
      }),
    } as any;

    mockProvider = {
      embed: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    };

    mockPlugin.providerManager.getProvider.mockReturnValue(mockProvider);
    processor = new EmbeddingProcessor(mockPlugin as any, mockCache);
    (processor as any).fileProcessor = {
      extractText: vi
        .fn()
        .mockResolvedValue(
          "test content with many words here to meet minimum word count requirement",
        ),
      extractMetadata: vi.fn().mockResolvedValue({
        wordCount: 100,
        tags: [],
        folder: "",
      }),
    };
  });

  describe("processFile", () => {
    it("should throw error when no provider available", async () => {
      mockPlugin.providerManager.getProvider.mockReturnValue(null);
      const file = new TFile("test.md");

      await expect(processor.processFile(file)).rejects.toThrow(
        "No embedding provider available",
      );
    });

    it("should use cached embedding if available", async () => {
      const file = new TFile("test.md");
      mockCache.get.mockReturnValue([
        {
          chunkId: "chunk-0",
          vector: new Array(384).fill(0.1),
          chunk: {
            chunkId: "chunk-0",
            content: "test",
            headings: [],
            startLine: 0,
            endLine: 0,
            wordCount: 1,
            preview: "test",
          },
        },
      ]);

      const result = await processor.processFile(file);

      expect(result).toBe(false);
      expect(mockProvider.embed).not.toHaveBeenCalled();
    });

    it("should generate new embedding if not cached", async () => {
      const file = new TFile("test.md");
      mockCache.get.mockReturnValue(null);

      const result = await processor.processFile(file);

      expect(result).toBe(true);
      expect(mockProvider.embed).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
    });

    it("should skip files below minimum word count", async () => {
      const file = new TFile("test.md");
      (processor as any).fileProcessor.extractText.mockResolvedValue("short");
      mockCache.get.mockReturnValue(null);

      await expect(processor.processFile(file)).rejects.toThrow(
        "File has only 1 words",
      );
    });

    it("should process files below minimum word count when skipMinWordCheck is true", async () => {
      const file = new TFile("test.md");
      (processor as any).fileProcessor.extractText.mockResolvedValue("short");
      mockCache.get.mockReturnValue(null);

      const result = await processor.processFile(file, true);

      expect(result).toBe(true);
      expect(mockProvider.embed).toHaveBeenCalled();
    });

    it("should store embedding with metadata in cache", async () => {
      const file = new TFile("test.md");
      const embedding = new Array(384).fill(0.5);
      mockProvider.embed.mockResolvedValue(embedding);
      mockCache.get.mockReturnValue(null);

      await processor.processFile(file);

      expect(mockCache.set).toHaveBeenCalledWith(
        file.path,
        expect.arrayContaining([
          expect.objectContaining({
            chunkId: expect.any(String),
            vector: embedding,
            chunk: expect.objectContaining({
              content: expect.any(String),
              headings: expect.any(Array),
              wordCount: expect.any(Number),
            }),
          }),
        ]),
        expect.any(String),
        expect.objectContaining({
          wordCount: 100,
          tags: [],
          folder: "",
        }),
      );
    });

    it("should compute content hash for cache key", async () => {
      const file = new TFile("test.md");
      mockCache.get.mockReturnValue(null);

      await processor.processFile(file);

      expect(mockCache.get).toHaveBeenCalledWith(file.path, expect.any(String));
    });
  });

  describe("processVault", () => {
    beforeEach(() => {
      mockPlugin.settings.processing.minWordCount = 0;
    });

    it("should not process when already processing", async () => {
      (processor as any).queue.setProcessing(true);

      await processor.processVault();

      expect(Notice).toHaveBeenCalled();
    });

    it("should show notice when no provider available", async () => {
      mockPlugin.providerManager.getProvider.mockReturnValue(null);

      await processor.processVault();

      expect(Notice).toHaveBeenCalled();
    });

    it("should process all markdown files", async () => {
      const files = [
        new TFile("file1.md"),
        new TFile("file2.md"),
        new TFile("file3.md"),
      ];
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue(files);
      mockCache.get.mockReturnValue(null);

      await processor.processVault(false);

      expect(mockProvider.embed).toHaveBeenCalledTimes(3);
    });

    it("should save cache after processing", async () => {
      const files = [new TFile("file1.md")];
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue(files);
      mockCache.get.mockReturnValue(null);

      await processor.processVault(false);

      expect(mockCache.save).toHaveBeenCalled();
    });

    it("should handle processing errors gracefully", async () => {
      const files = [new TFile("file1.md"), new TFile("file2.md")];
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue(files);
      mockProvider.embed.mockRejectedValueOnce(new Error("Embed failed"));
      mockProvider.embed.mockResolvedValueOnce(new Array(384).fill(0.1));
      mockCache.get.mockReturnValue(null);

      await processor.processVault(false);

      expect(mockCache.save).toHaveBeenCalled();
    });

    it("should skip cached files", async () => {
      const files = [new TFile("file1.md"), new TFile("file2.md")];
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue(files);
      mockCache.get
        .mockReturnValueOnce([
          {
            chunkId: "chunk-0",
            vector: new Array(384).fill(0.1),
            chunk: {
              chunkId: "chunk-0",
              content: "test",
              headings: [],
              startLine: 0,
              endLine: 0,
              wordCount: 1,
              preview: "test",
            },
          },
        ])
        .mockReturnValueOnce(null);

      await processor.processVault(false);

      expect(mockProvider.embed).toHaveBeenCalledTimes(1);
    });

    it("should set isProcessing flag during processing", async () => {
      const files = [new TFile("file1.md")];
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue(files);

      const promise = processor.processVault(false);
      expect(processor.isCurrentlyProcessing()).toBe(true);
      await promise;
      expect(processor.isCurrentlyProcessing()).toBe(false);
    });

    it("should create batches for processing", async () => {
      const files = Array.from(
        { length: 25 },
        (_, i) => new TFile(`file${i}.md`),
      );
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue(files);
      mockPlugin.settings.processing.batchSize = 10;
      mockCache.get.mockReturnValue(null);

      await processor.processVault(false);

      expect(mockCache.save).toHaveBeenCalled();
      expect(mockProvider.embed).toHaveBeenCalledTimes(25);
    });
  });

  describe("processBatch", () => {
    it("should show notice when no provider available", async () => {
      mockPlugin.providerManager.getProvider.mockReturnValue(null);
      const files = [new TFile("test.md")];

      await processor.processBatch(files);

      expect(Notice).toHaveBeenCalled();
    });

    it("should process all files in batch", async () => {
      const files = [
        new TFile("file1.md"),
        new TFile("file2.md"),
        new TFile("file3.md"),
      ];
      mockCache.get.mockReturnValue(null);

      await processor.processBatch(files);

      expect(mockProvider.embed).toHaveBeenCalledTimes(3);
    });

    it("should save cache after batch processing", async () => {
      const files = [new TFile("test.md")];
      mockCache.get.mockReturnValue(null);

      await processor.processBatch(files);

      expect(mockCache.save).toHaveBeenCalled();
    });

    it("should handle errors in batch processing", async () => {
      const files = [new TFile("file1.md"), new TFile("file2.md")];
      mockProvider.embed
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce(new Array(384).fill(0.1));
      mockCache.get.mockReturnValue(null);

      await processor.processBatch(files);

      expect(mockCache.save).toHaveBeenCalled();
    });

    it("should show completion notice", async () => {
      const files = [new TFile("test.md")];
      mockCache.get.mockReturnValue(null);

      await processor.processBatch(files);

      expect(Notice).toHaveBeenCalled();
    });
  });

  describe("invalidate", () => {
    it("should remove file from cache", () => {
      const file = new TFile("test.md");

      processor.invalidate(file);

      expect(mockCache.remove).toHaveBeenCalledWith(file.path);
    });
  });

  describe("queueFile", () => {
    it("should add file to queue", async () => {
      const file = new TFile("test.md");
      (processor as any).queue.setProcessing(false);

      processor.queueFile(file);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockProvider.embed).toHaveBeenCalled();
    });

    it("should not add duplicate files", () => {
      const file = new TFile("test.md");
      (processor as any).queue.setProcessing(true);

      processor.queueFile(file);
      processor.queueFile(file);

      expect(processor.getQueueSize()).toBe(1);
    });
  });

  describe("getQueueSize", () => {
    it("should return 0 for empty queue", () => {
      expect(processor.getQueueSize()).toBe(0);
    });

    it("should return correct queue size", () => {
      const file1 = new TFile("file1.md");
      const file2 = new TFile("file2.md");
      (processor as any).queue.setProcessing(true);

      processor.queueFile(file1);
      processor.queueFile(file2);

      expect(processor.getQueueSize()).toBe(2);
    });
  });

  describe("isCurrentlyProcessing", () => {
    it("should return false when not processing", () => {
      expect(processor.isCurrentlyProcessing()).toBe(false);
    });

    it("should return true during processing", async () => {
      const files = [new TFile("file1.md")];
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue(files);
      mockProvider.embed.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(new Array(384).fill(0.1)), 100),
          ),
      );

      const promise = processor.processVault(false);
      expect(processor.isCurrentlyProcessing()).toBe(true);
      await promise;
    });
  });

  describe("checkAndQueueModified", () => {
    it("should queue modified files", () => {
      const file = new TFile("test.md");
      const initialTime = Date.now();
      file.stat.mtime = initialTime;
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue([file]);
      (processor as any).queue.setProcessing(true);

      processor.checkAndQueueModified();
      file.stat.mtime = initialTime + 1000;
      processor.checkAndQueueModified();

      expect(processor.getQueueSize()).toBeGreaterThan(0);
    });

    it("should not queue unmodified files", () => {
      const file = new TFile("test.md");
      file.stat.mtime = Date.now();
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue([file]);

      processor.checkAndQueueModified();
      const queueSize1 = processor.getQueueSize();
      processor.checkAndQueueModified();
      const queueSize2 = processor.getQueueSize();

      expect(queueSize2).toBe(queueSize1);
    });

    it("should not queue files on first check", () => {
      const file = new TFile("test.md");
      mockPlugin.app.vault.getMarkdownFiles.mockReturnValue([file]);

      processor.checkAndQueueModified();

      expect(processor.getQueueSize()).toBe(0);
    });
  });
});
