# Hound Logic Engine (Canonical Terms)

## Core Model

- Listener: the user at the center of the system.
- Mood: the current listening direction.
- World: the active mood container.
- Song Orbits in each world:
  - Orbit 3: audition entry for all songs.
  - Orbit 2: proving ground.
  - Orbit 1: world main rotation (most trusted).
- 4th Orbit: the world layer itself (worlds orbit the listener).
- Favorites: listener-level songs, protected from skip-based punishment.
- Archive: inactive songs, retained by date for recovery.

## Movement Rules

- Promotion: `orbit_3 -> orbit_2 -> orbit_1` from positive signals.
- Demotion: `orbit_1 -> orbit_2 -> orbit_3` from repeated negative signals.
- Archive: non-favorite songs can move out of active orbits after repeated skip patterns across sessions.
- New Mood (world switch): consecutive skip sprees inside one world indicate world mismatch.
- Consecutive Skip Protection: during a world skip spree, skip penalties should not demote individual songs.
- Archive Re-entry: archived songs may re-enter Orbit 3 for limited retest attempts.

## Code Mapping

- Domain terms/constants:
  - `packages/domain-types/core.cjs`
  - `WORLD_ORBITS`: `orbit_1`, `orbit_2`, `orbit_3`
  - `HOUND_TERMS`: listener/world/mood/favorites/archive/new_mood
- Rules behavior:
  - `packages/rules-engine/core.cjs`
  - `resolveWorldOrbit(track, policy)`
  - `evaluateTrackMovement(track, telemetry, policy)`
  - `isWorldSkipSpree(events, policy)`
  - `shouldCountSkipsAgainstTrack({ worldRecentEvents, policy })`
  - `shouldSwitchWorld({ recentEvents, policy })`
  - `canReenterFromArchive(track, policy)`
  - `getArchivePath(archivedAtISO)`

## Product Sentence

Hound is a music system where favorites orbit the listener, worlds orbit the listener, and songs move through trust layers inside each world.
