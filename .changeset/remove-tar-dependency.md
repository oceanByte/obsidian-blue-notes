---
"blue-notes": patch
---

Replace tar package with native Node.js implementation using zlib module. This removes an external dependency while maintaining full functionality for extracting npm package tarballs. The plugin now has a more lightweight footprint with minimal external dependencies.
