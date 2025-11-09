---
"blue-notes": minor
---

Implement per-model embedding caches. Each embedding model now maintains its own separate cache file, allowing users to freely switch between models without recomputing embeddings. Switching back to a previously used model is now instant if embeddings are already cached.
