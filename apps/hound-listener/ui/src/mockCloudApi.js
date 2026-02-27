const ALBUMS = [
  {
    albumId: "mock-album-1",
    title: "Night Lines",
    artistName: "Rae Haven",
    coverUrl: "https://cdn.hound.fm/assets/mock/night-lines.jpg",
    genre: "Alt Soul",
    moodTags: ["Late Night", "Warm"]
  },
  {
    albumId: "mock-album-2",
    title: "Glass District",
    artistName: "Rae Haven",
    coverUrl: "https://cdn.hound.fm/assets/mock/glass-district.jpg",
    genre: "Indie Rock",
    moodTags: ["Grit", "Road"]
  }
];

const TRACKS = {
  "mock-album-1": [
    { trackId: "mock-track-1", title: "Streetlight Tape", durationSec: 212 },
    { trackId: "mock-track-2", title: "Half Sleep", durationSec: 198 }
  ],
  "mock-album-2": [
    { trackId: "mock-track-3", title: "Glass District", durationSec: 231 },
    { trackId: "mock-track-4", title: "Fast Window", durationSec: 204 }
  ]
};

const CREDITS = {
  "mock-album-1": [{ personName: "S. Rivera", role: "Producer", trackId: "mock-track-1" }],
  "mock-album-2": [{ personName: "O. Wynn", role: "Producer", trackId: "mock-track-3" }]
};

function parseBody(options = {}) {
  if (!options.body) return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

function getUserIdFromHeaders(options = {}) {
  const headers = options.headers || {};
  const auth = headers.Authorization || headers.authorization || "";
  const match = auth.match(/^Bearer\s+mock-token:(.+)$/i);
  return match ? match[1] : "";
}

export async function mockListenerRequest(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  parseBody(options);

  if (method === "POST" && (path === "/v1/auth/artist/login" || path === "/v1/auth/listener/login")) {
    return {
      accessToken: "mock-token:listener-user",
      refreshToken: "mock-refresh:listener-user",
      userId: "listener-user",
      artistId: "mock-artist"
    };
  }

  if (method === "POST" && path === "/v1/auth/refresh") {
    return {
      accessToken: "mock-token:listener-user",
      refreshToken: "mock-refresh:listener-user",
      userId: "listener-user"
    };
  }

  if (method === "GET" && path === "/v1/auth/me") {
    const userId = getUserIdFromHeaders(options);
    if (!userId) throw new Error("missing bearer token");
    return { userId, email: "listener@mock.local", role: "listener" };
  }

  if (method === "POST" && path === "/v1/auth/logout") {
    return { ok: true };
  }

  if (method === "GET" && path === "/v1/listener/home") {
    return {
      featuredAlbum: ALBUMS[0],
      featuredArtist: { artistId: "mock-artist", stageName: ALBUMS[0].artistName },
      rails: [
        { key: "new-week", title: "New This Week", albums: ALBUMS },
        { key: "deep-cuts", title: "Deep Cuts", albums: [...ALBUMS].reverse() }
      ]
    };
  }

  const albumMatch = path.match(/^\/v1\/listener\/albums\/([^/]+)$/);
  if (method === "GET" && albumMatch) {
    const albumId = albumMatch[1];
    const album = ALBUMS.find((item) => item.albumId === albumId);
    if (!album) throw new Error("album not found");
    return {
      album,
      tracks: TRACKS[albumId] || [],
      credits: CREDITS[albumId] || [],
      about: "Mock album detail payload"
    };
  }

  const streamMatch = path.match(/^\/v1\/listener\/tracks\/([^/]+)\/stream$/);
  if (method === "GET" && streamMatch) {
    const trackId = streamMatch[1];
    return {
      trackId,
      manifestUrl: `https://cdn.hound.fm/audio/mock/${trackId}.mp3`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  }

  if (method === "POST" && path === "/v1/listener/telemetry/events") {
    return { accepted: true };
  }

  const saveMatch = path.match(/^\/v1\/listener\/tracks\/([^/]+)\/save$/);
  if (method === "POST" && saveMatch) {
    return { trackId: saveMatch[1], saved: true };
  }

  throw new Error(`mock route not found: ${method} ${path}`);
}
