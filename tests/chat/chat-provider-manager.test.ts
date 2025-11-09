import { ChatProviderManager } from "../../src/chat/providers/chat-provider-manager";
import { ChatSettings } from "../../src/chat/chat-settings";

describe("ChatProviderManager", () => {
  let settings: ChatSettings;
  let manager: ChatProviderManager;

  beforeEach(() => {
    settings = {
      provider: "openai",
      apiKeys: {
        openai: "test-openai-key",
        groq: "test-groq-key",
      },
      models: {
        openai: "gpt-4",
        groq: "llama-3.1-70b-versatile",
      },
      temperature: 0.7,
      maxTokens: 2000,
      includeContext: true,
      contextStrategy: "current",
      maxContextNotes: 5,
      systemPrompt: "You are helpful",
    };
    manager = new ChatProviderManager(settings);
  });

  describe("initialize", () => {
    it("should initialize with providers that have API keys", () => {
      manager.initialize();
      expect(manager.isProviderAvailable("openai")).toBe(true);
      expect(manager.isProviderAvailable("groq")).toBe(true);
    });

    it("should not initialize providers without API keys", () => {
      settings.apiKeys.openai = "";
      settings.apiKeys.groq = "";
      manager = new ChatProviderManager(settings);
      manager.initialize();
      expect(manager.isProviderAvailable("openai")).toBe(false);
      expect(manager.isProviderAvailable("groq")).toBe(false);
    });

    it("should select default provider", () => {
      manager.initialize();
      const provider = manager.getProvider();
      expect(provider).not.toBeNull();
      expect(provider?.name).toBe("OpenAI");
    });
  });

  describe("selectProvider", () => {
    beforeEach(() => {
      manager.initialize();
    });

    it("should select OpenAI provider", () => {
      manager.selectProvider("openai");
      const provider = manager.getProvider();
      expect(provider?.name).toBe("OpenAI");
    });

    it("should select Groq provider", () => {
      manager.selectProvider("groq");
      const provider = manager.getProvider();
      expect(provider?.name).toBe("Groq");
    });

    it("should handle invalid provider name", () => {
      manager.selectProvider("invalid");
      expect(manager.getProvider()).toBeNull();
    });

    it("should handle unconfigured provider", () => {
      settings.apiKeys.groq = "";
      manager = new ChatProviderManager(settings);
      manager.initialize();
      manager.selectProvider("groq");
      expect(manager.getProvider()).toBeNull();
    });
  });

  describe("getProvider", () => {
    it("should auto-initialize and return provider", () => {
      const provider = manager.getProvider();
      expect(provider).not.toBeNull();
    });

    it("should return current provider after initialize", () => {
      manager.initialize();
      const provider = manager.getProvider();
      expect(provider).not.toBeNull();
    });
  });

  describe("getAvailableProviders", () => {
    it("should return all configured providers", () => {
      manager.initialize();
      const providers = manager.getAvailableProviders();
      expect(providers).toContain("openai");
      expect(providers).toContain("groq");
    });

    it("should not return providers without API keys", () => {
      settings.apiKeys.groq = "";
      manager = new ChatProviderManager(settings);
      manager.initialize();
      const providers = manager.getAvailableProviders();
      expect(providers).toContain("openai");
      expect(providers).not.toContain("groq");
    });
  });

  describe("isProviderAvailable", () => {
    beforeEach(() => {
      manager.initialize();
    });

    it("should return true for configured provider", () => {
      expect(manager.isProviderAvailable("openai")).toBe(true);
    });

    it("should return false for unconfigured provider", () => {
      settings.apiKeys.groq = "";
      manager = new ChatProviderManager(settings);
      manager.initialize();
      expect(manager.isProviderAvailable("groq")).toBe(false);
    });

    it("should return false for non-existent provider", () => {
      expect(manager.isProviderAvailable("invalid")).toBe(false);
    });
  });

  describe("getCurrentProviderName", () => {
    it("should return current provider name", () => {
      expect(manager.getCurrentProviderName()).toBe("openai");
    });
  });

  describe("getCurrentModel", () => {
    it("should return current model", () => {
      expect(manager.getCurrentModel()).toBe("gpt-4");
    });
  });

  describe("updateSettings", () => {
    it("should reinitialize with new settings", () => {
      manager.initialize();
      expect(manager.getCurrentModel()).toBe("gpt-4");

      settings.models.openai = "gpt-3.5-turbo";
      manager.updateSettings(settings);

      expect(manager.getCurrentModel()).toBe("gpt-3.5-turbo");
    });

    it("should handle removing API keys", () => {
      manager.initialize();
      expect(manager.isProviderAvailable("openai")).toBe(true);

      settings.apiKeys.openai = "";
      manager.updateSettings(settings);

      expect(manager.isProviderAvailable("openai")).toBe(false);
    });
  });

  describe("dispose", () => {
    it("should clear all providers", () => {
      manager.initialize();
      manager.dispose();
      expect(manager.getProvider()).toBeNull();
      expect(manager.getAvailableProviders()).toEqual([]);
    });
  });
});
