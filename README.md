# Hound (Phase 1)

Local-only desktop app for importing and playing audio files.

## Run modes
- `npm run dev:app` (or `npm run start`): launches Electron + preload + Vite. Import works here.
- `npm run dev:web`: runs Vite in the browser only. `window.hound` is undefined and Import will not work.

## How to Verify Hound Phase 1
Run:
- `npm run start`

Button-by-button checks:
1) Top bar
   - Click "Library": stays on Library screen.
   - Click "Player" with 0 tracks: button is disabled.
2) Library screen
   - Click "Import": file picker opens; cancel -> no change.
   - Select 1-3 files: list populates in import order; titles are filenames; artist is "Unknown Artist".
   - Click a track row: navigates to Player and starts playback at 0:00.
   - Click "Clear Library": list clears, playback stops, selectedTrackId resets, Player button disabled.
3) Player screen (with a selected track)
   - Prev: if previous exists -> switch + play from 0:00; else restart current from 0:00.
   - Play/Pause: toggles playback without overlapping audio.
   - Next: if next exists -> switch + play from 0:00; else stop playback and stay selected.
   - Stop: stops playback, resets to 0:00, opens recap modal.
   - Like: toggles liked state; Library row shows "<3".
   - Flip: switches to Back view; "Back to Front" returns.
   - Double-click cover: flips to Back view.
4) Recap modal
   - "Close": closes modal, stays on Player.
   - "Go to Library": closes modal and navigates to Library.
