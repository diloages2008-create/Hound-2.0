import test from "node:test";
import assert from "node:assert/strict";
import { createLibraryProvider } from "./libraryProvider.js";

test("mock provider lists tracks from manifest and resolves stream URL", async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        tracks: [
          {
            trackId: "t1",
            title: "Night Tape",
            artist: "Rae",
            album: "Night Lines",
            durationSec: 200,
            streamUrl: "http://localhost:5173/mock-library/audio/t1.mp3",
            world: "Night Drive",
            orbit: "discovery"
          }
        ]
      };
    }
  });
  const provider = createLibraryProvider({ mode: "mock", fetchImpl });
  const tracks = await provider.listTracks();
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].id, "t1");
  const src = await provider.resolveStreamUrl(tracks[0]);
  assert.equal(src, "http://localhost:5173/mock-library/audio/t1.mp3");
});

test("api provider keeps same contract as mock provider for player calls", async () => {
  const provider = createLibraryProvider({ mode: "api" });
  const tracks = await provider.listTracks();
  assert.deepEqual(tracks, []);
  const src = await provider.resolveStreamUrl({
    id: "cloud:t2",
    remoteUrl: "https://cdn.example.com/audio/t2.m3u8"
  });
  assert.equal(src, "https://cdn.example.com/audio/t2.m3u8");
});

test("mock provider resolves local file path to vite fs url", async () => {
  const fetchImpl = async () => ({
    ok: true,
    async json() {
      return {
        tracks: [
          {
            trackId: "t-local",
            title: "Local",
            artist: "Local Artist",
            filePath: "C:\\Music\\Artist\\Track 01.flac"
          }
        ]
      };
    }
  });
  const provider = createLibraryProvider({ mode: "mock", fetchImpl });
  const [track] = await provider.listTracks();
  const src = await provider.resolveStreamUrl(track);
  assert.equal(src, "/@fs/C:/Music/Artist/Track%2001.flac");
});
