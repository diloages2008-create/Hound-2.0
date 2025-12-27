# Hound Audio Contract

At any moment, Hound produces exactly one audio stream whose loudness, timing, and
lifecycle are fully controlled by the app.

If anything violates that, it is a bug.

## Audio Signal Chain (conceptual)
Decoded audio
-> session gain (crossfade envelopes, stop)
-> per-track gain (LUFS normalization)
-> app volume (user intent, unity by default)
-> OS / device volume (out of scope)

## Gain Hierarchy Rules
1) Per-track LUFS gain makes tracks comparable.
2) Session envelopes shape transitions (fade, gap, stop).
3) App volume multiplies after normalization and never exceeds unity.
4) OS volume is outside the engine's control.

Never invert this hierarchy.

## Lifecycle Rules
- Exactly one output path at any time (no overlap).
- Crossfade must not double output gain.
- Stop ends the session and must leave silence with no ghost audio.
- Silence is intentional, not an error.

## "Done" Definition
Audio is done enough when:
- You can listen for hours without drift, overlap, or weirdness.
- Scrub, stop, fade, normalize, and resume cleanly.
- The engine is boring and trusted.
