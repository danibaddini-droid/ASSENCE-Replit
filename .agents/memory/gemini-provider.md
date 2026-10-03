---
name: Assence Gemini provider
description: Direct Gemini API key setup and legacy key troubleshooting for Assence.
---

Assence's natal analysis, transit analysis, and chat use the user's own Google Gemini API account through the backend `GEMINI_API_KEY` secret. This is separate from Replit's managed AI credits.

**Why:** The user chose personal Google Gemini billing after the Replit-managed OpenAI monthly limit blocked generation.

**How to apply:** Keep textual generation on the direct Gemini SDK path. Google AI Studio's 2026-09-25 key guidance says unrestricted legacy Standard keys are rejected; use a new Auth key or restrict the old key to Gemini API only. Never read or expose the secret value.

Google model availability can differ for new API users, and the legacy GenerateContent API is no longer the recommended interface for new models. Verify current Google documentation when selecting a model; prefer the Interactions API and set `store: false` for natal-chart and chat inputs.

**Why:** A valid new key was accepted, but the previously common Gemini Flash model returned `NOT_FOUND` for new users; Google recommended a current model and Interactions API.

**How to apply:** When a Gemini model returns `NOT_FOUND`, check live model/API documentation before changing credentials or retrying the same request.

Do not retry daily quota errors that specify a long reset period; bounded backoff is for transient rate limits, server errors, and network failures.

**Why:** Repeating requests after a daily cap is exhausted cannot succeed before reset and consumes more of the limited request allowance.

**How to apply:** Inspect Gemini's rate-limit message and stop retries when it states a daily limit or a reset several hours away.