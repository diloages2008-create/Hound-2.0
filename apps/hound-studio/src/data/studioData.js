export const onboardingChecklist = [
  { id: "account", label: "Artist account created", done: true },
  { id: "rights", label: "Master rights confirmed", done: true },
  { id: "profile", label: "Profile data completed", done: true },
  { id: "review", label: "Curation review approved", done: false }
];

export const analyticsSnapshot = {
  plays: 18422,
  completionRate: 67,
  saves: 2419,
  followers: 830,
  estRevenue: 1276.4
};

export const catalogAlbums = [
  {
    id: "night-lines",
    title: "Night Lines",
    year: 2026,
    genre: "Alt Soul",
    moodTags: ["Late Night", "Warm", "Minimal"],
    tracks: 9,
    status: "live",
    credits: ["Producer: S. Rivera", "Mix: J. Kale", "Master: Cloud Room"]
  },
  {
    id: "glass-district",
    title: "Glass District",
    year: 2025,
    genre: "Indie Rock",
    moodTags: ["Fast", "Grit", "Road"],
    tracks: 11,
    status: "draft",
    credits: ["Producer: O. Wynn", "Engineer: P. Hall", "Writer: T. Ren"]
  }
];

export const featuredCollections = [
  {
    key: "new-week",
    label: "New This Week",
    description: "Fresh releases reviewed and approved by the Hound editorial team."
  },
  {
    key: "deep-cuts",
    label: "Deep Cuts",
    description: "Albums with high completion and replay behavior in focused listening sessions."
  }
];

export const artistProfile = {
  stageName: "Rae Haven",
  bio: "Rae Haven builds album-led records with live rhythm sections and tape-processed vocals.",
  influences: ["Sade", "Little Dragon", "Broadcast"],
  socials: {
    instagram: "@raehaven",
    tiktok: "@raehavenmusic",
    website: "raehaven.studio"
  },
  credits: ["Writer", "Co-Producer", "Vocal Arrangement"]
};
