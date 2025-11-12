# blue-notes

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
