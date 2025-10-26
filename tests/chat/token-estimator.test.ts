import { TokenEstimator } from "../../src/chat/utils/token-estimator";

describe("TokenEstimator", () => {
  describe("estimateTokens", () => {
    it("should estimate tokens for empty string", () => {
      expect(TokenEstimator.estimateTokens("")).toBe(0);
    });

    it("should estimate tokens for short text", () => {
      const text = "Hello world";
      const estimated = TokenEstimator.estimateTokens(text);
      expect(estimated).toBe(Math.ceil(text.length / 4));
    });

    it("should estimate tokens for longer text", () => {
      const text =
        "This is a longer piece of text that should have more tokens";
      const estimated = TokenEstimator.estimateTokens(text);
      expect(estimated).toBe(Math.ceil(text.length / 4));
    });
  });

  describe("estimateMessagesTokens", () => {
    it("should estimate tokens for empty messages array", () => {
      expect(TokenEstimator.estimateMessagesTokens([])).toBe(0);
    });

    it("should estimate tokens for single message", () => {
      const messages = [{ role: "user", content: "Hello" }];
      const estimated = TokenEstimator.estimateMessagesTokens(messages);
      expect(estimated).toBeGreaterThan(0);
    });

    it("should estimate tokens for multiple messages", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
        { role: "user", content: "How are you?" },
      ];
      const estimated = TokenEstimator.estimateMessagesTokens(messages);
      expect(estimated).toBeGreaterThan(0);
    });

    it("should add overhead tokens per message", () => {
      const messages = [{ role: "user", content: "Test" }];
      const estimated = TokenEstimator.estimateMessagesTokens(messages);
      const contentTokens = Math.ceil("Test".length / 4);
      expect(estimated).toBe(contentTokens + 4);
    });
  });

  describe("truncateToTokenLimit", () => {
    it("should not truncate if under limit", () => {
      const text = "Short text";
      const truncated = TokenEstimator.truncateToTokenLimit(text, 1000);
      expect(truncated).toBe(text);
    });

    it("should truncate if over limit", () => {
      const text = "This is a very long text that should be truncated";
      const truncated = TokenEstimator.truncateToTokenLimit(text, 5);
      expect(truncated).toContain("[Content truncated due to length...]");
    });

    it("should truncate to approximately correct length", () => {
      const text = "A".repeat(1000);
      const maxTokens = 10;
      const truncated = TokenEstimator.truncateToTokenLimit(text, maxTokens);
      const maxChars = maxTokens * 4;
      expect(truncated.length).toBeLessThanOrEqual(maxChars + 50);
    });
  });

  describe("truncateTextsToFit", () => {
    it("should return empty array for empty input", () => {
      const result = TokenEstimator.truncateTextsToFit([], 1000);
      expect(result).toEqual([]);
    });

    it("should return all texts if under limit", () => {
      const texts = ["Short", "Text", "Here"];
      const result = TokenEstimator.truncateTextsToFit(texts, 1000);
      expect(result).toEqual(texts);
    });

    it("should fit as many texts as possible", () => {
      const texts = ["Text one", "Text two", "Text three", "Text four"];
      const result = TokenEstimator.truncateTextsToFit(texts, 10);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(texts.length);
    });

    it("should truncate last text if it exceeds remaining tokens", () => {
      const texts = ["Short", "A".repeat(1000)];
      const result = TokenEstimator.truncateTextsToFit(texts, 20);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBe("Short");
    });

    it("should stop adding texts when tokens run out", () => {
      const texts = ["A".repeat(100), "B".repeat(100), "C".repeat(100)];
      const result = TokenEstimator.truncateTextsToFit(texts, 30);
      expect(result.length).toBeLessThan(texts.length);
    });
  });
});
