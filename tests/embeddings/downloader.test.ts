import { ModelDownloader } from "../../src/embeddings/providers/onnx/downloader";
import { ONNXModelType } from "../../src/embeddings/provider-interface";
import * as fs from "fs";
import * as path from "path";

vi.mock("obsidian");
vi.mock("../../src/utils/logger");

describe("ModelDownloader", () => {
  let downloader: ModelDownloader;
  const testModelDir = path.join(__dirname, "test-models");

  beforeEach(() => {
    downloader = new ModelDownloader(testModelDir);
    if (fs.existsSync(testModelDir)) {
      fs.rmSync(testModelDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testModelDir)) {
      fs.rmSync(testModelDir, { recursive: true });
    }
  });

  describe("getModelDir", () => {
    it("should return correct model directory path", () => {
      const modelDir = downloader.getModelDir(ONNXModelType.DEFAULT);
      expect(modelDir).toBe(path.join(testModelDir, ONNXModelType.DEFAULT));
    });

    it("should return different paths for different model types", () => {
      const dir1 = downloader.getModelDir(ONNXModelType.DEFAULT);
      const dir2 = downloader.getModelDir(ONNXModelType.E5_SMALL);
      expect(dir1).not.toBe(dir2);
    });
  });

  describe("isModelDownloaded", () => {
    it("should return false when model is not downloaded", () => {
      const isDownloaded = downloader.isModelDownloaded(ONNXModelType.DEFAULT);
      expect(isDownloaded).toBe(false);
    });

    it("should return true when model files exist", () => {
      const modelDir = downloader.getModelDir(ONNXModelType.DEFAULT);
      fs.mkdirSync(modelDir, { recursive: true });
      fs.writeFileSync(path.join(modelDir, "model.onnx"), "test");
      fs.writeFileSync(path.join(modelDir, "tokenizer.json"), "test");

      const isDownloaded = downloader.isModelDownloaded(ONNXModelType.DEFAULT);
      expect(isDownloaded).toBe(true);
    });

    it("should return false when only model.onnx exists", () => {
      const modelDir = downloader.getModelDir(ONNXModelType.DEFAULT);
      fs.mkdirSync(modelDir, { recursive: true });
      fs.writeFileSync(path.join(modelDir, "model.onnx"), "test");

      const isDownloaded = downloader.isModelDownloaded(ONNXModelType.DEFAULT);
      expect(isDownloaded).toBe(false);
    });

    it("should return false when only tokenizer.json exists", () => {
      const modelDir = downloader.getModelDir(ONNXModelType.DEFAULT);
      fs.mkdirSync(modelDir, { recursive: true });
      fs.writeFileSync(path.join(modelDir, "tokenizer.json"), "test");

      const isDownloaded = downloader.isModelDownloaded(ONNXModelType.DEFAULT);
      expect(isDownloaded).toBe(false);
    });
  });

  describe("getModelInfo", () => {
    it("should return model info for DEFAULT model", () => {
      const info = downloader.getModelInfo(ONNXModelType.DEFAULT);
      expect(info.name).toBe("all-MiniLM-L6-v2");
      expect(info.dimension).toBe(384);
      expect(info.urls.model).toContain("huggingface.co");
      expect(info.description).toContain("90MB");
    });

    it("should return model info for E5 model", () => {
      const info = downloader.getModelInfo(ONNXModelType.E5_SMALL);
      expect(info.name).toBe("multilingual-e5-small");
      expect(info.dimension).toBe(384);
    });

    it("should return model info for all new models", () => {
      const modelTypes = [ONNXModelType.E5_SMALL];

      for (const modelType of modelTypes) {
        const info = downloader.getModelInfo(modelType);
        expect(info).toBeDefined();
        expect(info.name).toBeTruthy();
        expect(info.dimension).toBeGreaterThan(0);
        expect(info.urls.model).toContain("huggingface.co");
        expect(info.description).toBeTruthy();
      }
    });

    it("should have correct dimensions for models", () => {
      expect(downloader.getModelInfo(ONNXModelType.DEFAULT).dimension).toBe(384);
      expect(downloader.getModelInfo(ONNXModelType.E5_SMALL).dimension).toBe(384);
    });
  });

  describe("getModelPaths", () => {
    it("should return correct file paths", () => {
      const modelDir = downloader.getModelDir(ONNXModelType.DEFAULT);
      fs.mkdirSync(modelDir, { recursive: true });
      fs.writeFileSync(path.join(modelDir, "tokenizer.json"), "test");

      const paths = downloader.getModelPaths(ONNXModelType.DEFAULT);
      expect(paths.modelPath).toContain("model.onnx");
      expect(paths.tokenizerPath).toContain("tokenizer.json");
      expect(paths.configPath).toContain("config.json");
    });

    it("should return paths within model directory", () => {
      const modelDir = downloader.getModelDir(ONNXModelType.DEFAULT);
      const paths = downloader.getModelPaths(ONNXModelType.DEFAULT);

      expect(paths.modelPath.startsWith(modelDir)).toBe(true);
      expect(paths.tokenizerPath.startsWith(modelDir)).toBe(true);
      expect(paths.configPath.startsWith(modelDir)).toBe(true);
    });
  });

  describe("getAllModels", () => {
    it("should return all available model types", () => {
      const models = downloader.getAllModels();
      expect(models.length).toBe(2);
      expect(models).toContain(ONNXModelType.DEFAULT);
      expect(models).toContain(ONNXModelType.E5_SMALL);
    });
  });

  describe("getDownloadedModels", () => {
    it("should return empty array when no models are downloaded", () => {
      const downloaded = downloader.getDownloadedModels();
      expect(downloaded).toEqual([]);
    });

    it("should return downloaded models", () => {
      const modelDir1 = downloader.getModelDir(ONNXModelType.DEFAULT);
      fs.mkdirSync(modelDir1, { recursive: true });
      fs.writeFileSync(path.join(modelDir1, "model.onnx"), "test");
      fs.writeFileSync(path.join(modelDir1, "tokenizer.json"), "test");

      const modelDir2 = downloader.getModelDir(ONNXModelType.E5_SMALL);
      fs.mkdirSync(modelDir2, { recursive: true });
      fs.writeFileSync(path.join(modelDir2, "model.onnx"), "test");
      fs.writeFileSync(path.join(modelDir2, "tokenizer.json"), "test");

      const downloaded = downloader.getDownloadedModels();
      expect(downloaded.length).toBe(2);
      expect(downloaded).toContain(ONNXModelType.DEFAULT);
      expect(downloaded).toContain(ONNXModelType.E5_SMALL);
    });
  });

  describe("deleteModel", () => {
    it("should return false when model does not exist", () => {
      const deleted = downloader.deleteModel(ONNXModelType.DEFAULT);
      expect(deleted).toBe(false);
    });

    it("should delete model directory and return true", () => {
      const modelDir = downloader.getModelDir(ONNXModelType.DEFAULT);
      fs.mkdirSync(modelDir, { recursive: true });
      fs.writeFileSync(path.join(modelDir, "model.onnx"), "test");
      fs.writeFileSync(path.join(modelDir, "tokenizer.json"), "test");

      expect(fs.existsSync(modelDir)).toBe(true);

      const deleted = downloader.deleteModel(ONNXModelType.DEFAULT);
      expect(deleted).toBe(true);
      expect(fs.existsSync(modelDir)).toBe(false);
    });

    it("should not affect other models when deleting one", () => {
      const modelDir1 = downloader.getModelDir(ONNXModelType.DEFAULT);
      const modelDir2 = downloader.getModelDir(ONNXModelType.E5_SMALL);

      fs.mkdirSync(modelDir1, { recursive: true });
      fs.writeFileSync(path.join(modelDir1, "model.onnx"), "test");
      fs.writeFileSync(path.join(modelDir1, "tokenizer.json"), "test");

      fs.mkdirSync(modelDir2, { recursive: true });
      fs.writeFileSync(path.join(modelDir2, "model.onnx"), "test");
      fs.writeFileSync(path.join(modelDir2, "tokenizer.json"), "test");

      downloader.deleteModel(ONNXModelType.DEFAULT);

      expect(fs.existsSync(modelDir1)).toBe(false);
      expect(fs.existsSync(modelDir2)).toBe(true);
    });
  });

  describe("File size estimation", () => {
    it("should return correct file sizes for all models", () => {
      const testCases = [
        { model: ONNXModelType.DEFAULT, expectedSize: 90 },
        { model: ONNXModelType.E5_SMALL, expectedSize: 80 },
      ];

      for (const { model, expectedSize } of testCases) {
        const modelInfo = downloader.getModelInfo(model);
        const size = (downloader as any).estimateFileSize(modelInfo, "model");
        expect(size).toBe(expectedSize);
      }
    });

    it("should return 0.5 MB for vocab files", () => {
      const modelInfo = downloader.getModelInfo(ONNXModelType.DEFAULT);
      const size = (downloader as any).estimateFileSize(modelInfo, "vocab");
      expect(size).toBe(0.5);
    });
  });

  describe("Download time estimation", () => {
    it("should estimate download time based on file size", () => {
      const estimateTime = (downloader as any).estimateDownloadTime.bind(downloader);

      expect(estimateTime(5)).toBe(1); // 5 MB = 1 second
      expect(estimateTime(10)).toBe(2); // 10 MB = 2 seconds
      expect(estimateTime(90)).toBe(18); // 90 MB = 18 seconds
      expect(estimateTime(420)).toBe(84); // 420 MB = 84 seconds (1m 24s)
      expect(estimateTime(1000)).toBe(200); // 1000 MB = 200 seconds (3m 20s)
    });

    it("should round up to nearest second", () => {
      const estimateTime = (downloader as any).estimateDownloadTime.bind(downloader);

      expect(estimateTime(1)).toBe(1); // Should round up
      expect(estimateTime(7)).toBe(2); // 7 / 5 = 1.4, rounds to 2
    });
  });

  describe("Model registry completeness", () => {
    it("should have all model types defined in enum", () => {
      const allModelTypes = Object.values(ONNXModelType);

      for (const modelType of allModelTypes) {
        const info = downloader.getModelInfo(modelType);
        expect(info).toBeDefined();
        expect(info.name).toBeTruthy();
        expect(info.urls.model).toBeTruthy();
        expect(info.urls.vocab).toBeTruthy();
      }
    });

    it("should have valid HuggingFace URLs for all models", () => {
      const allModelTypes = Object.values(ONNXModelType);

      for (const modelType of allModelTypes) {
        const info = downloader.getModelInfo(modelType);
        expect(info.urls.model).toMatch(/^https:\/\/huggingface\.co/);
        expect(info.urls.vocab).toMatch(/^https:\/\/huggingface\.co/);
        if (info.urls.config) {
          expect(info.urls.config).toMatch(/^https:\/\/huggingface\.co/);
        }
      }
    });
  });
});
