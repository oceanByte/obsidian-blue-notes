import { ChatSessionManager } from "../../src/chat/chat-session";

describe("ChatSessionManager", () => {
  let manager: ChatSessionManager;

  beforeEach(() => {
    manager = new ChatSessionManager();
  });

  describe("createNewSession", () => {
    it("should create a new session", () => {
      const session = manager.createNewSession();
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.created).toBeGreaterThan(0);
      expect(session.messages).toEqual([]);
      expect(session.contextNotes).toEqual([]);
    });

    it("should replace existing session", () => {
      const session1 = manager.createNewSession();
      const session2 = manager.createNewSession();
      expect(session2.id).not.toBe(session1.id);
      expect(manager.getCurrentSession()).toBe(session2);
    });
  });

  describe("getCurrentSession", () => {
    it("should return null when no session exists", () => {
      expect(manager.getCurrentSession()).toBeNull();
    });

    it("should return current session", () => {
      const session = manager.createNewSession();
      expect(manager.getCurrentSession()).toBe(session);
    });
  });

  describe("addMessage", () => {
    it("should create session if none exists", () => {
      expect(manager.getCurrentSession()).toBeNull();
      manager.addMessage({
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });
      expect(manager.getCurrentSession()).not.toBeNull();
    });

    it("should add message to current session", () => {
      manager.createNewSession();
      const message = {
        role: "user" as const,
        content: "Hello",
        timestamp: Date.now(),
      };
      manager.addMessage(message);
      expect(manager.getMessages()).toContain(message);
    });

    it("should update session timestamp", async () => {
      const session = manager.createNewSession();
      const originalTimestamp = session.updated;

      await new Promise((resolve) => setTimeout(resolve, 10));

      manager.addMessage({
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });
      expect(session.updated).toBeGreaterThan(originalTimestamp);
    });
  });

  describe("getMessages", () => {
    it("should return empty array when no session", () => {
      expect(manager.getMessages()).toEqual([]);
    });

    it("should return all messages", () => {
      manager.createNewSession();
      const messages = [
        { role: "user" as const, content: "Hello", timestamp: Date.now() },
        { role: "assistant" as const, content: "Hi", timestamp: Date.now() },
      ];
      messages.forEach((msg) => manager.addMessage(msg));
      expect(manager.getMessages()).toEqual(messages);
    });
  });

  describe("setContextNotes", () => {
    it("should create session if none exists", () => {
      manager.setContextNotes(["note1.md"]);
      expect(manager.getCurrentSession()).not.toBeNull();
    });

    it("should set context notes", () => {
      manager.createNewSession();
      const notes = ["note1.md", "note2.md"];
      manager.setContextNotes(notes);
      expect(manager.getContextNotes()).toEqual(notes);
    });
  });

  describe("getContextNotes", () => {
    it("should return empty array when no session", () => {
      expect(manager.getContextNotes()).toEqual([]);
    });

    it("should return context notes", () => {
      manager.createNewSession();
      const notes = ["note1.md", "note2.md"];
      manager.setContextNotes(notes);
      expect(manager.getContextNotes()).toEqual(notes);
    });
  });

  describe("clearSession", () => {
    it("should clear current session", () => {
      manager.createNewSession();
      manager.addMessage({
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });
      manager.clearSession();
      expect(manager.getCurrentSession()).toBeNull();
    });
  });

  describe("hasMessages", () => {
    it("should return false when no session", () => {
      expect(manager.hasMessages()).toBe(false);
    });

    it("should return false for empty session", () => {
      manager.createNewSession();
      expect(manager.hasMessages()).toBe(false);
    });

    it("should return true when messages exist", () => {
      manager.createNewSession();
      manager.addMessage({
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });
      expect(manager.hasMessages()).toBe(true);
    });
  });

  describe("exportToMarkdown", () => {
    it("should return empty string when no session", () => {
      expect(manager.exportToMarkdown()).toBe("");
    });

    it("should return empty string for session with no messages", () => {
      manager.createNewSession();
      expect(manager.exportToMarkdown()).toBe("");
    });

    it("should export conversation to markdown", () => {
      manager.createNewSession();
      manager.addMessage({
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });
      manager.addMessage({
        role: "assistant",
        content: "Hi there!",
        timestamp: Date.now(),
      });

      const markdown = manager.exportToMarkdown();
      expect(markdown).toContain("# Chat Session");
      expect(markdown).toContain("### You");
      expect(markdown).toContain("Hello");
      expect(markdown).toContain("### AI");
      expect(markdown).toContain("Hi there!");
    });

    it("should include context notes in export", () => {
      manager.createNewSession();
      manager.setContextNotes(["note1.md", "note2.md"]);
      manager.addMessage({
        role: "user",
        content: "Hello",
        timestamp: Date.now(),
      });

      const markdown = manager.exportToMarkdown();
      expect(markdown).toContain("## Context Notes");
      expect(markdown).toContain("[[note1.md]]");
      expect(markdown).toContain("[[note2.md]]");
    });
  });
});
