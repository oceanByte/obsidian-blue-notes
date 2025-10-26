import { vi, Mock } from 'vitest';
import * as fs from "fs";
import * as path from "path";
import { SimpleTokenizer } from "../../src/embeddings/providers/onnx/tokenizer";

vi.mock("fs");

describe("SimpleTokenizer", () => {
  const mockVocab = `[PAD]
[UNK]
[CLS]
[SEP]
the
cat
sat
on
mat
dog
run
jump
hello
world
test`;

  beforeEach(() => {
    (fs.readFileSync as Mock).mockReturnValue(mockVocab);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should load vocabulary from file", () => {
      const tokenizer = new SimpleTokenizer("/path/to/vocab.txt");
      expect(fs.readFileSync).toHaveBeenCalledWith(
        "/path/to/vocab.txt",
        "utf-8",
      );
    });

    it("should initialize special token IDs", () => {
      const tokenizer = new SimpleTokenizer("/path/to/vocab.txt");
      const inputs = tokenizer.createInputs("test");
      expect(inputs.input_ids[0]).toBe(2);
      expect(inputs.input_ids[inputs.input_ids.length - 1]).toBe(0);
    });
  });

  describe("tokenize", () => {
    let tokenizer: SimpleTokenizer;

    beforeEach(() => {
      tokenizer = new SimpleTokenizer("/path/to/vocab.txt");
    });

    it("should tokenize simple text", () => {
      const tokens = tokenizer.tokenize("hello world");
      expect(tokens[0]).toBe(2);
      expect(tokens[tokens.length - 1]).toBe(0);
    });

    it("should handle empty text", () => {
      const tokens = tokenizer.tokenize("");
      expect(tokens.length).toBe(128);
      expect(tokens[0]).toBe(2);
      const sepIndex = tokens.indexOf(3);
      expect(sepIndex).toBeGreaterThan(0);
      expect(tokens[tokens.length - 1]).toBe(0);
    });

    it("should convert to lowercase", () => {
      const tokens1 = tokenizer.tokenize("HELLO");
      const tokens2 = tokenizer.tokenize("hello");
      expect(tokens1[1]).toBe(tokens2[1]);
    });

    it("should use UNK token for unknown words", () => {
      const tokens = tokenizer.tokenize("unknownword");
      expect(tokens[1]).toBe(1);
    });

    it("should pad to max length 128", () => {
      const tokens = tokenizer.tokenize("test");
      expect(tokens.length).toBe(128);
    });

    it("should truncate if exceeds max length", () => {
      const longText = new Array(200).fill("test").join(" ");
      const tokens = tokenizer.tokenize(longText);
      expect(tokens.length).toBe(128);
    });

    it("should add CLS token at start", () => {
      const tokens = tokenizer.tokenize("hello world");
      expect(tokens[0]).toBe(2);
    });

    it("should add SEP token after text", () => {
      const tokens = tokenizer.tokenize("hello");
      expect(tokens[2]).toBe(3);
    });

    it("should pad with PAD tokens", () => {
      const tokens = tokenizer.tokenize("test");
      const padCount = tokens.filter((t) => t === 0).length;
      expect(padCount).toBeGreaterThan(100);
    });
  });

  describe("createInputs", () => {
    let tokenizer: SimpleTokenizer;

    beforeEach(() => {
      tokenizer = new SimpleTokenizer("/path/to/vocab.txt");
    });

    it("should create input_ids", () => {
      const inputs = tokenizer.createInputs("hello world");
      expect(inputs.input_ids).toBeDefined();
      expect(Array.isArray(inputs.input_ids)).toBe(true);
      expect(inputs.input_ids.length).toBe(128);
    });

    it("should create attention_mask", () => {
      const inputs = tokenizer.createInputs("hello world");
      expect(inputs.attention_mask).toBeDefined();
      expect(Array.isArray(inputs.attention_mask)).toBe(true);
      expect(inputs.attention_mask.length).toBe(128);
    });

    it("should create token_type_ids", () => {
      const inputs = tokenizer.createInputs("hello world");
      expect(inputs.token_type_ids).toBeDefined();
      expect(Array.isArray(inputs.token_type_ids)).toBe(true);
      expect(inputs.token_type_ids.length).toBe(128);
    });

    it("should set attention_mask correctly for non-pad tokens", () => {
      const inputs = tokenizer.createInputs("hello");
      expect(inputs.attention_mask[0]).toBe(1);
      expect(inputs.attention_mask[1]).toBe(1);
      expect(inputs.attention_mask[2]).toBe(1);
    });

    it("should set attention_mask to 0 for pad tokens", () => {
      const inputs = tokenizer.createInputs("hello");
      const lastPadIndex = inputs.attention_mask.lastIndexOf(0);
      expect(lastPadIndex).toBeGreaterThan(10);
    });

    it("should set all token_type_ids to 0", () => {
      const inputs = tokenizer.createInputs("hello world");
      expect(inputs.token_type_ids.every((id) => id === 0)).toBe(true);
    });

    it("should handle multi-word input", () => {
      const inputs = tokenizer.createInputs("the cat sat on the mat");
      const nonPadTokens = inputs.attention_mask.filter((m) => m === 1).length;
      expect(nonPadTokens).toBeGreaterThan(5);
    });

    it("should produce consistent output for same input", () => {
      const inputs1 = tokenizer.createInputs("test");
      const inputs2 = tokenizer.createInputs("test");
      expect(inputs1.input_ids).toEqual(inputs2.input_ids);
      expect(inputs1.attention_mask).toEqual(inputs2.attention_mask);
    });

    it("should handle special characters", () => {
      const inputs = tokenizer.createInputs("hello, world!");
      expect(inputs.input_ids).toBeDefined();
      expect(inputs.input_ids.length).toBe(128);
    });

    it("should handle numbers in text", () => {
      const inputs = tokenizer.createInputs("test 123 data");
      expect(inputs.input_ids).toBeDefined();
      expect(
        inputs.attention_mask.filter((m) => m === 1).length,
      ).toBeGreaterThan(3);
    });
  });

  describe("edge cases", () => {
    let tokenizer: SimpleTokenizer;

    beforeEach(() => {
      tokenizer = new SimpleTokenizer("/path/to/vocab.txt");
    });

    it("should handle single word", () => {
      const inputs = tokenizer.createInputs("hello");
      expect(inputs.input_ids.length).toBe(128);
    });

    it("should handle whitespace-only input", () => {
      const inputs = tokenizer.createInputs("   ");
      expect(inputs.input_ids[0]).toBe(2);
      const nonPadTokens = inputs.attention_mask.filter((m) => m === 1);
      expect(nonPadTokens.length).toBeLessThan(10);
    });

    it("should handle very long text", () => {
      const longText = new Array(500).fill("word").join(" ");
      const inputs = tokenizer.createInputs(longText);
      expect(inputs.input_ids.length).toBe(128);
    });

    it("should handle text with multiple spaces", () => {
      const inputs = tokenizer.createInputs("hello    world");
      expect(inputs.input_ids).toBeDefined();
    });

    it("should handle text with newlines", () => {
      const inputs = tokenizer.createInputs("hello\nworld");
      expect(inputs.input_ids).toBeDefined();
    });

    it("should handle text with tabs", () => {
      const inputs = tokenizer.createInputs("hello\tworld");
      expect(inputs.input_ids).toBeDefined();
    });
  });
});
