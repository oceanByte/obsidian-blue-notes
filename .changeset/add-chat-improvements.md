---
"blue-notes": minor
---

Add chat context button for current note and fix export filename sanitization.

**Features:**
- Add "Add Current Note" button in chat context section that allows quick inclusion of the currently open markdown file as context in AI conversations. The button appears next to the manual file selector and validates that only markdown files are added.

**Fixes:**
- Fix chat export failing with "File name cannot contain any of the following characters: \ /" error. Filenames are now properly sanitized by removing invalid characters (< > : " / \ | ? *), allowing exports to complete successfully on all platforms.

Both features improve the chat experience by reducing friction and fixing a blocking issue with conversation exports.
