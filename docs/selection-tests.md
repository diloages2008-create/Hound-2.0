# Selection Engine Test Scenarios

Run these in the listener app with Dev Mode + Orbit HUD enabled.

1) Queue overrides all
- Queue 3 tracks, ensure autoplay never triggers until queue is empty.

2) Autoplay gate
- repeatMode off AND shuffle off, let a track end -> playback stops.

3) forceOff never appears
- Mark a track forceOff, verify it never appears in any pool.

4) forceOn always in Rotation
- Mark forceOn, orbit becomes rotation and track is eligible even if never played.

5) Recent promotion
- Play the same track with 2 qualified listens -> orbit becomes rotation.

6) Rotation demotion
- Put a track in rotation, perform repeated early skips -> orbit leaves rotation.

7) Daily decay
- Set a recent track lastPositiveListenAt older than threshold -> moves to discovery on launch.

8) Diversity rule
- Same artist should not play twice in a row when alternatives exist.

9) Cooldown
- Last X tracks should not repeat unless pools are too small (then allow fallback).

10) Empty orbit fallback
- If rotation empty, pull from recent, then discovery, else stop.
