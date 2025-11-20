---
"blue-notes": minor
---

## Ollama AI Chat Integration & Chat UI Improvements

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
