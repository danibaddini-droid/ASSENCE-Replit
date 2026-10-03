---
name: Assence Gemini provider
description: Direct Gemini API key setup and legacy key troubleshooting for Assence.
---

Assence's natal analysis, transit analysis, and chat use the user's own Google Gemini API account through the backend `GEMINI_API_KEY` secret. This is separate from Replit's managed AI credits.

**Why:** The user chose personal Google Gemini billing after the Replit-managed OpenAI monthly limit blocked generation.

**How to apply:** Keep textual generation on the direct Gemini SDK path. Google AI Studio's 2026-09-25 key guidance says unrestricted legacy Standard keys are rejected; use a new Auth key or restrict the old key to Gemini API only. Never read or expose the secret value.