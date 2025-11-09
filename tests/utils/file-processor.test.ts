import { FileProcessor } from "../../src/utils/file-processor";
import { TFile, Vault, App } from "obsidian";

describe("FileProcessor", () => {
  let mockVault: Mocked<Vault>;
  let mockApp: Mocked<App>;
  let fileProcessor: FileProcessor;

  beforeEach(() => {
    mockVault = {
      cachedRead: vi.fn(),
      getMarkdownFiles: vi.fn(),
      getAbstractFileByPath: vi.fn(),
    } as any;

    mockApp = {
      vault: mockVault,
      metadataCache: {
        getFileCache: vi.fn(),
      },
    } as any;

    fileProcessor = new FileProcessor(mockVault, mockApp);
  });

  describe("getFilesInFolder", () => {
    it("should return files in specified folder", async () => {
      const files = [
        new TFile("notes/file1.md"),
        new TFile("notes/file2.md"),
        new TFile("other/file3.md"),
      ];
      mockVault.getMarkdownFiles.mockReturnValue(files as any);

      const result = await fileProcessor.getFilesInFolder("notes");

      expect(result).toHaveLength(2);
      expect(result[0].path).toBe("notes/file1.md");
      expect(result[1].path).toBe("notes/file2.md");
    });

    it("should return empty array for folder with no files", async () => {
      const files = [new TFile("notes/file1.md")];
      mockVault.getMarkdownFiles.mockReturnValue(files as any);

      const result = await fileProcessor.getFilesInFolder("empty");

      expect(result).toHaveLength(0);
    });

    it("should handle nested folder paths", async () => {
      const files = [
        new TFile("notes/subfolder/file1.md"),
        new TFile("notes/subfolder/file2.md"),
        new TFile("notes/other/file3.md"),
      ];
      mockVault.getMarkdownFiles.mockReturnValue(files as any);

      const result = await fileProcessor.getFilesInFolder("notes/subfolder");

      expect(result).toHaveLength(2);
    });

    it("should handle root folder", async () => {
      const files = [new TFile("file1.md"), new TFile("notes/file2.md")];
      mockVault.getMarkdownFiles.mockReturnValue(files as any);

      const result = await fileProcessor.getFilesInFolder("");

      expect(result).toHaveLength(2);
    });
  });

  describe("extractText", () => {
    it("should extract clean text from markdown", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("# Heading\n\nParagraph text.");

      const result = await fileProcessor.extractText(file);

      expect(result).toBe("Heading Paragraph text.");
    });

    it("should remove frontmatter", async () => {
      const file = new TFile("test.md");
      const content = `---
title: Test
tags: [tag1, tag2]
---

Content here`;
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).toBe("Content here");
      expect(result).not.toContain("title");
      expect(result).not.toContain("tags");
    });

    it("should remove code blocks", async () => {
      const file = new TFile("test.md");
      const content = `Text before

\`\`\`javascript
const code = 'removed';
\`\`\`

Text after`;
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).not.toContain("const code");
      expect(result).toContain("Text before");
      expect(result).toContain("Text after");
    });

    it("should remove inline code", async () => {
      const file = new TFile("test.md");
      const content = "Use `inline code` in markdown";
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).not.toContain("`");
      expect(result).toContain("Use");
      expect(result).toContain("in markdown");
    });

    it("should extract link text and remove URLs", async () => {
      const file = new TFile("test.md");
      const content = "Check [this link](https://example.com) for info";
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).toContain("this link");
      expect(result).not.toContain("https://");
      expect(result).not.toContain("[");
      expect(result).not.toContain("]");
    });

    it("should remove markdown formatting characters", async () => {
      const file = new TFile("test.md");
      const content = "**bold** *italic* ~~strikethrough~~ # heading";
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).not.toContain("**");
      expect(result).not.toContain("*");
      expect(result).not.toContain("~~");
      expect(result).not.toContain("#");
      expect(result).toContain("bold");
      expect(result).toContain("italic");
    });

    it("should normalize whitespace", async () => {
      const file = new TFile("test.md");
      const content = "Text   with    multiple   spaces\n\n\nand newlines";
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).not.toContain("   ");
      expect(result).toBe("Text with multiple spaces and newlines");
    });

    it("should handle empty file", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("");

      const result = await fileProcessor.extractText(file);

      expect(result).toBe("");
    });

    it("should handle file with only frontmatter", async () => {
      const file = new TFile("test.md");
      const content = `---
title: Test
---
`;
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).toBe("");
    });

    it("should handle complex markdown", async () => {
      const file = new TFile("test.md");
      const content = `---
title: Complex
---

# Heading

Some **bold** and *italic* text.

\`\`\`python
def hello():
    pass
\`\`\`

More text with [link](url) and \`code\`.`;
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).toContain("Heading");
      expect(result).toContain("Some bold and italic text");
      expect(result).not.toContain("```");
      expect(result).not.toContain("def hello");
      expect(result).toContain("link");
    });
  });

  describe("extractMetadata", () => {
    it("should extract word count", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("one two three four five");
      mockApp.metadataCache.getFileCache.mockReturnValue({});

      const result = await fileProcessor.extractMetadata(file);

      expect(result.wordCount).toBe(5);
    });

    it("should extract tags from metadata cache", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("content");
      mockApp.metadataCache.getFileCache.mockReturnValue({
        tags: [{ tag: "#tag1" }, { tag: "#tag2" }],
      });

      const result = await fileProcessor.extractMetadata(file);

      expect(result.tags).toContain("#tag1");
      expect(result.tags).toContain("#tag2");
    });

    it("should extract tags from frontmatter", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("content");
      mockApp.metadataCache.getFileCache.mockReturnValue({
        frontmatter: { tags: ["work", "important"] },
      });

      const result = await fileProcessor.extractMetadata(file);

      expect(result.tags).toContain("#work");
      expect(result.tags).toContain("#important");
    });

    it("should extract folder path", async () => {
      const file = new TFile("notes/subfolder/test.md");
      file.parent = { path: "notes/subfolder" } as any;
      mockVault.cachedRead.mockResolvedValue("content");
      mockApp.metadataCache.getFileCache.mockReturnValue({});

      const result = await fileProcessor.extractMetadata(file);

      expect(result.folder).toBe("notes/subfolder");
    });

    it("should handle root folder files", async () => {
      const file = new TFile("test.md");
      file.parent = null;
      mockVault.cachedRead.mockResolvedValue("content");
      mockApp.metadataCache.getFileCache.mockReturnValue({});

      const result = await fileProcessor.extractMetadata(file);

      expect(result.folder).toBe("");
    });

    it("should remove duplicate tags", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("content");
      mockApp.metadataCache.getFileCache.mockReturnValue({
        tags: [{ tag: "#tag1" }, { tag: "#tag1" }],
        frontmatter: { tags: ["tag1"] },
      });

      const result = await fileProcessor.extractMetadata(file);

      const tag1Count = result.tags.filter((t) => t === "#tag1").length;
      expect(tag1Count).toBe(1);
    });

    it("should handle files with no tags", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("content");
      mockApp.metadataCache.getFileCache.mockReturnValue({});

      const result = await fileProcessor.extractMetadata(file);

      expect(result.tags).toEqual([]);
    });

    it("should count words excluding markdown syntax", async () => {
      const file = new TFile("test.md");
      const content = `---
title: Test
---

# Heading

**Bold** text`;
      mockVault.cachedRead.mockResolvedValue(content);
      mockApp.metadataCache.getFileCache.mockReturnValue({});

      const result = await fileProcessor.extractMetadata(file);

      expect(result.wordCount).toBe(3);
    });

    it("should handle empty files", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("");
      mockApp.metadataCache.getFileCache.mockReturnValue({});

      const result = await fileProcessor.extractMetadata(file);

      expect(result.wordCount).toBeLessThanOrEqual(1);
      expect(result.tags).toEqual([]);
    });

    it("should handle missing metadata cache", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("content");
      mockApp.metadataCache.getFileCache.mockReturnValue(null);

      const result = await fileProcessor.extractMetadata(file);

      expect(result.tags).toEqual([]);
      expect(result.wordCount).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle files with special characters in path", async () => {
      const file = new TFile("notes/file (1).md");
      mockVault.cachedRead.mockResolvedValue("content");

      const result = await fileProcessor.extractText(file);

      expect(result).toBe("content");
    });

    it("should handle unicode content", async () => {
      const file = new TFile("test.md");
      mockVault.cachedRead.mockResolvedValue("Hello 世界 🌍");
      mockApp.metadataCache.getFileCache.mockReturnValue({});

      const result = await fileProcessor.extractText(file);

      expect(result).toContain("Hello");
      expect(result).toContain("世界");
    });

    it("should handle very long content", async () => {
      const file = new TFile("test.md");
      const longContent = "word ".repeat(10000);
      mockVault.cachedRead.mockResolvedValue(longContent);
      mockApp.metadataCache.getFileCache.mockReturnValue({});

      const result = await fileProcessor.extractText(file);
      const metadata = await fileProcessor.extractMetadata(file);

      expect(result.length).toBeGreaterThan(0);
      expect(metadata.wordCount).toBe(10000);
    });

    it("should handle malformed frontmatter", async () => {
      const file = new TFile("test.md");
      const content = `---
title: Test
invalid yaml: [
---

Content`;
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).toContain("Content");
    });

    it("should handle nested markdown links", async () => {
      const file = new TFile("test.md");
      const content = "[[Internal Link]] and [External](https://example.com)";
      mockVault.cachedRead.mockResolvedValue(content);

      const result = await fileProcessor.extractText(file);

      expect(result).toContain("External");
    });
  });
});
