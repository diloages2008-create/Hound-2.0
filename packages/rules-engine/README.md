# @hound/rules-engine

Shared rules engine for Hound selection and recommendation behavior.

## Exports
- `DEFAULT_POLICY`
- `withPolicy(policy)`
- `scoreTrackFromTelemetry(track, telemetry, policy)`
- `buildOrbitPools(tracks, nowISO, policy)`
- `pickNextTrack({ tracks, queue, currentTrackId, policy })`
- `suggestNextAlbums({ currentAlbumId, albums, listenerSignals, limit })`

## Run tests
`npm --workspace packages/rules-engine run test`
