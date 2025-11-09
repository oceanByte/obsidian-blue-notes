# blue-notes

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
