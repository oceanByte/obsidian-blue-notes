---
"blue-notes": minor
---

Add token-aware chunking to prevent content truncation. The system now automatically detects token limits from model config files and adjusts chunk sizes accordingly (using 0.75 word-to-token ratio). This ensures all content is embedded without silent truncation, fixing information loss in embeddings.
