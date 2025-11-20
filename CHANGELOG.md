# blue-notes

## 1.5.0

### Minor Changes

- [#31](https://github.com/oceanByte/obsidian-blue-notes/pull/31) [`7928f52`](https://github.com/oceanByte/obsidian-blue-notes/commit/7928f520b6e248229f0512bba5460510daca7f3e) Thanks [@oceanByte](https://github.com/oceanByte)! - ## Ollama AI Chat Integration & Chat UI Improvements

  ### Major Features

  - **Ollama Provider Integration**: Added local AI chat support through Ollama, providing completely private, offline AI conversations

    - REST API integration with `/api/chat` and `/api/tags` endpoints
    - Support for streaming responses
    - Automatic model discovery from local Ollama installation
    - Dynamic model selection with dropdown interface
    - Default models: Llama 2/3, Mistral, Gemma, Code Llama
    - Server URL configuration (default: http://localhost:11434)

  - **Privacy-First Default**: Ollama is now the default chat provider, emphasizing local-first AI
    - Complete offline capability after initial model download
    - No API keys or third-party services required
    - Your notes never leave your device

  ### Chat UI Improvements

  - **Markdown-Preserving Copy**: Copy button now preserves markdown formatting instead of converting to plain text

    - Maintains code blocks, links, bold/italic text, lists, etc.
    - Better integration with note-taking workflows

  - **Enhanced Export Functionality**:

    - Added seconds to timestamp (prevents duplicate filename errors)
    - Exported files automatically open after creation
    - Format: `Chat 2024-01-15 14-30-45.md`

  - **Improved Button Clarity**: Updated button emojis for better UX

    - Export conversation: 💾
    - New conversation: ✨ (was 📄)
    - Add current note: 📌 (was 📄)
    - Add custom context: +

  - **Better Timestamp Visibility**: Fixed timestamp contrast issues in light mode
    - Now properly readable in both light and dark themes
    - Uses `--text-normal` color for proper contrast

  ### Documentation Updates

  - Comprehensive README updates highlighting Ollama support
  - Clear distinction between local (Ollama) and cloud providers
  - Added hardware requirements (8GB+ RAM recommended)
  - Updated FAQ to reflect offline AI chat capability
  - Privacy section emphasizes completely private local AI option

  ### Technical Improvements

  - Provider-agnostic architecture maintains consistency across all chat providers
  - Clean separation of concerns for easy provider addition
  - Proper error handling for unavailable Ollama instances
  - Automatic model discovery on settings load

  This release transforms Blue Notes into a truly privacy-first note-taking assistant with powerful local AI capabilities, while maintaining flexibility for users who prefer cloud providers.

## 1.4.0

### Minor Changes

- [#29](https://github.com/oceanByte/obsidian-blue-notes/pull/29) [`5f26a77`](https://github.com/oceanByte/obsidian-blue-notes/commit/5f26a773dc74a7703111766b496b4be02437ea0b) Thanks [@oceanByte](https://github.com/oceanByte)! - Added inline semantic search suggestions that trigger with '//' and provide real-time results as you type.

## 1.3.0

### Minor Changes

- [#26](https://github.com/oceanByte/obsidian-blue-notes/pull/26) [`28f1787`](https://github.com/oceanByte/obsidian-blue-notes/commit/28f17870be12fc94411b7240bcf685052ebdc3ad) Thanks [@oceanByte](https://github.com/oceanByte)! - Add chat context button for current note and fix export filename sanitization.

  **Features:**

  - Add "Add Current Note" button in chat context section that allows quick inclusion of the currently open markdown file as context in AI conversations. The button appears next to the manual file selector and validates that only markdown files are added.

  **Fixes:**

  - Fix chat export failing with "File name cannot contain any of the following characters: \ /" error. Filenames are now properly sanitized by removing invalid characters (< > : " / \ | ? \*), allowing exports to complete successfully on all platforms.

  Both features improve the chat experience by reducing friction and fixing a blocking issue with conversation exports.

## 1.2.1

### Patch Changes

- [#20](https://github.com/oceanByte/obsidian-blue-notes/pull/20) [`73c8fe7`](https://github.com/oceanByte/obsidian-blue-notes/commit/73c8fe7463d47464b8863572a36e53d983faf446) Thanks [@oceanByte](https://github.com/oceanByte)! - Fix deprecated and non-working chat models. Removed deprecated Groq mixtral-8x7b-32768 model and added qwen/qwen3-32b as replacement. Updated Requesty provider to use correct model IDs: fixed google/gemini-2.0-flash-exp to google/gemini-2.0-flash-001, replaced deprecated anthropic/claude-3.5-sonnet with anthropic/claude-3-7-sonnet-20250219, and removed non-functional models.

## 1.2.0

### Minor Changes

- [#17](https://github.com/oceanByte/obsidian-blue-notes/pull/17) [`8a993a4`](https://github.com/oceanByte/obsidian-blue-notes/commit/8a993a40796a5d47d33b2027e61ffbb88878ddba) Thanks [@oceanByte](https://github.com/oceanByte)! - Improve vault processing progress notifications. Use a single updating notification that refreshes after every batch instead of creating multiple stacked notifications. Remove ETA display and only show notifications when files are actually processed. Progress updates are now real-time and less intrusive.

- [#17](https://github.com/oceanByte/obsidian-blue-notes/pull/17) [`8a993a4`](https://github.com/oceanByte/obsidian-blue-notes/commit/8a993a40796a5d47d33b2027e61ffbb88878ddba) Thanks [@oceanByte](https://github.com/oceanByte)! - Add token-aware chunking to prevent content truncation. The system now automatically detects token limits from model config files and adjusts chunk sizes accordingly (using 0.75 word-to-token ratio). This ensures all content is embedded without silent truncation, fixing information loss in embeddings.

## 1.1.1

### Patch Changes

- [#12](https://github.com/oceanByte/obsidian-blue-notes/pull/12) [`bc601b2`](https://github.com/oceanByte/obsidian-blue-notes/commit/bc601b21a1269a5f35fa7158cf7e91457365a17c) Thanks [@oceanByte](https://github.com/oceanByte)! - Replace tar package with native Node.js implementation using zlib module. This removes an external dependency while maintaining full functionality for extracting npm package tarballs. The plugin now has a more lightweight footprint with minimal external dependencies.

## 1.1.0

### Minor Changes

- [#2](https://github.com/oceanByte/obsidian-blue-notes/pull/2) [`a9f4a24`](https://github.com/oceanByte/obsidian-blue-notes/commit/a9f4a24cd5447929ed4e775f52a2ac1eeb6bf30a) Thanks [@oceanByte](https://github.com/oceanByte)! - Change default embedding model to Multilingual E5 Small. The new default model provides better multilingual support (100+ languages) with excellent performance using efficient int8 quantization. Users who prefer the English-only model can still select all-MiniLM-L6-v2 from settings.

- [#2](https://github.com/oceanByte/obsidian-blue-notes/pull/2) [`a9f4a24`](https://github.com/oceanByte/obsidian-blue-notes/commit/a9f4a24cd5447929ed4e775f52a2ac1eeb6bf30a) Thanks [@oceanByte](https://github.com/oceanByte)! - Implement per-model embedding caches. Each embedding model now maintains its own separate cache file, allowing users to freely switch between models without recomputing embeddings. Switching back to a previously used model is now instant if embeddings are already cached.

### Patch Changes

- [#2](https://github.com/oceanByte/obsidian-blue-notes/pull/2) [`a9f4a24`](https://github.com/oceanByte/obsidian-blue-notes/commit/a9f4a24cd5447929ed4e775f52a2ac1eeb6bf30a) Thanks [@oceanByte](https://github.com/oceanByte)! - Automatically process vault when switching embedding models. When users change models in settings, the plugin now automatically reprocesses files that need new embeddings, eliminating the need to manually run "Process entire vault".

- [#2](https://github.com/oceanByte/obsidian-blue-notes/pull/2) [`a9f4a24`](https://github.com/oceanByte/obsidian-blue-notes/commit/a9f4a24cd5447929ed4e775f52a2ac1eeb6bf30a) Thanks [@oceanByte](https://github.com/oceanByte)! - Reduce notice spam during model changes. Simplified notifications when switching embedding models from 4-5 notices down to 2-3, providing cleaner UX while maintaining helpful progress feedback.

## 1.0.0

### Major Changes

- [#1](https://github.com/oceanByte/obsidian-blue-notes/pull/1) [`8adefff`](https://github.com/oceanByte/obsidian-blue-notes/commit/8adefff) Thanks [@oceanByte](https://github.com/oceanByte)! - Initial release of Blue Notes. Semantic search and AI chat for Obsidian

### Features

- **Multi-provider AI chat system** - Support for Anthropic Claude, OpenAI, and Groq with streaming responses
- **Local semantic search** - ONNX runtime-based embeddings running locally on your device (cross-platform support)
- **Intelligent note chunking** - Automatic content chunking with heading preservation for better context
- **Context-aware chat** - Select specific notes to include as context in AI conversations
- **Private and offline** - All semantic search happens locally, only chat feature requires internet
- **Comprehensive test suite** - Built with Vitest for reliability
- **Automated releases** - CI/CD workflows with Changesets for version management
