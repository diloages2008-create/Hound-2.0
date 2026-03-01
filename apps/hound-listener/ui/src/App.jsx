import React, { useEffect, useMemo, useRef, useState } from "react";
import { mockListenerRequest } from "./mockCloudApi.js";

// Track shape contract:
// Track {
//   id: string, path: string, title: string, artist: string, album: string | null,
//   durationSec: number | null,
//   rotation: boolean, rotationManual: null | boolean, saved: boolean,
//   rotationScore: number, lastPositiveListenAt: string | null,
//   lastNegativeListenAt: string | null,
//   rotationOverride: "none" | "force_on" | "force_off",
//   playCountTotal: number,
//   playHistory: Array<PlayTelemetry>,
//   analysisStatus: "pending" | "queued" | "in_progress" | "complete" | "error",
//   loudnessLUFS: number | null,
//   gain: number,
//   loudnessReady: boolean,
//   bpm: number | null,
//   key: string | null,
//   mode: string | null,
//   orbit: "rotation" | "recent" | "discovery" | null,
//   evidenceScore: number,
//   forceOn: boolean,
//   forceOff: boolean
// }

// PlayTelemetry contract:
// {
//   play_start_time: string,
//   play_end_time: string,
//   play_duration_seconds: number,
//   track_total_duration: number,
//   percent_listened: number,
//   skipped_early: boolean,
//   replayed_same_session: number,
//   completed_play: boolean,
//   manual_skip: boolean,
//   auto_advance: boolean,
//   timestamp: string
// }

// SessionEndPayload contract:
// { listenedSeconds: number, tracksPlayed: number, skips: number }

const SHARE_READY = true;
const GATE_DISABLED = true;

const Icon = ({ children, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const IconMenu = () => (
  <Icon>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </Icon>
);

const IconSettings = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V21a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H3a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V3a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H21a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.6z" />
  </Icon>
);

const IconHome = () => (
  <Icon>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 10v10h14V10" />
  </Icon>
);

const IconLibrary = () => (
  <Icon>
    <rect x="4" y="3" width="6" height="18" rx="1" />
    <rect x="14" y="3" width="6" height="18" rx="1" />
  </Icon>
);

const IconSearch = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.6" y2="16.6" />
  </Icon>
);

const IconPlaylists = () => (
  <Icon>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </Icon>
);

const IconSave = ({ filled = false }) => (
  <Icon>
    <path
      d="M12 21s-6-4.4-9-8.5C1 9 2.5 6 5.8 6c2 0 3.5 1.2 4.2 2.4C10.7 7.2 12.2 6 14.2 6 17.5 6 19 9 21 12.5 18 16.6 12 21 12 21z"
      fill={filled ? "currentColor" : "none"}
    />
  </Icon>
);

const IconRotation = ({ slashed = false }) => (
  <Icon>
    <path d="M3 12a9 9 0 0 1 15.5-6.4" />
    <polyline points="18 3 18 7 14 7" />
    <path d="M21 12a9 9 0 0 1-15.5 6.4" />
    <polyline points="6 21 6 17 10 17" />
    {slashed ? <line x1="4" y1="4" x2="20" y2="20" /> : null}
  </Icon>
);

const IconQueue = () => (
  <Icon>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="12" y2="18" />
    <polygon points="16,16 20,18 16,20" />
  </Icon>
);

const IconPrev = () => (
  <Icon>
    <polygon points="11,19 3,12 11,5" />
    <line x1="21" y1="5" x2="21" y2="19" />
  </Icon>
);

const IconNext = () => (
  <Icon>
    <polygon points="13,5 21,12 13,19" />
    <line x1="3" y1="5" x2="3" y2="19" />
  </Icon>
);

const IconPlay = () => (
  <Icon>
    <polygon points="8,5 19,12 8,19" />
  </Icon>
);

const IconPause = () => (
  <Icon>
    <rect x="6" y="5" width="4" height="14" />
    <rect x="14" y="5" width="4" height="14" />
  </Icon>
);

const IconVolume = () => (
  <Icon>
    <polygon points="3,9 7,9 12,5 12,19 7,15 3,15" />
    <path d="M16 9a4 4 0 0 1 0 6" />
    <path d="M18.5 6a7 7 0 0 1 0 12" />
  </Icon>
);

const SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  "https://rbhlvbutqzgqogsrqwet.supabase.co";
const SUPABASE_ANON =
  (typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_SUPABASE_ANON || import.meta.env?.VITE_SUPABASE_ANON_KEY)) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiaGx2YnV0cXpncW9nc3Jxd2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MDg5NDQsImV4cCI6MjA4MjQ4NDk0NH0.RTIUt8x3k4ziUNltGCrNkda7BRpoxsxGtJBPOo-gqVk";
const GATE_BASE = `${SUPABASE_URL}/functions/v1`;
const REDEEM_URL = `${GATE_BASE}/redeem`;
const CHECKIN_URL = `${GATE_BASE}/checkin`;
const API_V1_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_HOUND_API_BASE) ||
  `${GATE_BASE}/api-v1`;
const API_MODE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_HOUND_API_MODE) || "live";
const CLOUD_TOKEN_KEY = "hound_listener_token";
const CLOUD_REFRESH_KEY = "hound_listener_refresh_token";

const styles = {
  app: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#0b1120",
    color: "#e5e7eb"
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #1f2937",
    padding: "0 18px",
    height: "56px"
  },
  topBarCenter: {
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase"
  },
  menuButton: {
    border: "1px solid #334155",
    borderRadius: "8px",
    background: "transparent",
    color: "#e5e7eb",
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center"
  },
  settingsButton: {
    border: "1px solid #334155",
    borderRadius: "8px",
    background: "transparent",
    color: "#e5e7eb",
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center"
  },
  brand: {
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "2px"
  },
  appBody: {
    flex: 1,
    display: "flex",
    minHeight: 0
  },
  sidebar: {
    width: "260px",
    borderRight: "1px solid #1f2937",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "#0b1120"
  },
  sidebarHidden: {
    width: "72px",
    padding: "12px 8px"
  },
  sidebarButton: (active) => ({
    border: "1px solid #1f2937",
    borderRadius: "10px",
    background: active ? "#12243a" : "#0f172a",
    color: "#e5e7eb",
    padding: "10px 12px",
    minHeight: "44px",
    textAlign: "left",
    display: "flex",
    gap: "10px",
    alignItems: "center",
    cursor: "pointer",
    fontWeight: 600
  }),
  sidebarIcon: {
    width: "18px",
    textAlign: "center"
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "24px",
    paddingBottom: "96px",
    overflowY: "auto",
    minHeight: 0
  },
  library: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  homePage: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  sectionTitle: {
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#cbd5f5"
  },
  rowScroll: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(160px, 1fr)",
    gap: "12px",
    overflowX: "auto",
    paddingBottom: "6px"
  },
  tile: {
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "12px",
    background: "#0f172a",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: "160px",
    cursor: "pointer"
  },
  tileArt: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "8px",
    background: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontSize: "10px",
    fontWeight: 700
  },
  tileTitle: {
    fontWeight: 700,
    fontSize: "13px"
  },
  tileArtist: {
    fontSize: "12px",
    color: "#9ca3af"
  },
  homeCard: {
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "14px",
    background: "#0f172a",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  homeCardTitle: {
    fontSize: "13px",
    fontWeight: 700
  },
  homeActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap"
  },
  playlistPage: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  queuePage: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  searchPage: {
    display: "flex",
    flexDirection: "column",
    gap: "12px"
  },
  settingsPage: {
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  settingsSection: {
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "14px",
    background: "#0f172a",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  settingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    fontSize: "13px"
  },
  input: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "10px 12px",
    borderRadius: "8px"
  },
  libraryButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap"
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px"
  },
  primaryButton: {
    border: "none",
    background: "#38bdf8",
    color: "#0a0f1a",
    padding: "10px 14px",
    borderRadius: "8px",
    fontWeight: 700
  },
  secondaryButton: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "10px 14px",
    borderRadius: "8px",
    fontWeight: 600
  },
  listTitle: {
    fontSize: "14px",
    fontWeight: 700,
    margin: "6px 0"
  },
  table: {
    display: "grid",
    gap: "6px"
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 80px 90px",
    fontSize: "11px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#94a3b8",
    padding: "0 8px"
  },
  tableRow: (active) => ({
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 80px 90px",
    alignItems: "center",
    gap: "8px",
    padding: "10px 8px",
    minHeight: "52px",
    borderRadius: "10px",
    border: "1px solid #1f2937",
    background: active ? "#12243a" : "#0f172a",
    cursor: "pointer"
  }),
  tableCell: {
    fontSize: "13px"
  },
  tableMeta: {
    fontSize: "12px",
    color: "#9ca3af"
  },
  iconButton: {
    border: "1px solid #334155",
    borderRadius: "8px",
    background: "transparent",
    color: "#e5e7eb",
    width: "36px",
    height: "36px",
    display: "grid",
    placeItems: "center"
  },
  iconButtonActive: {
    background: "#1e293b"
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  row: (active) => ({
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #1f2937",
    background: active ? "#12243a" : "#0f172a",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  }),
  rowTitle: {
    fontWeight: 700,
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    gap: "8px"
  },
  rowArtist: {
    fontSize: "12px",
    color: "#9ca3af"
  },
  rowActions: {
    display: "flex",
    gap: "8px",
    alignItems: "center"
  },
  menuPopup: {
    position: "fixed",
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: "10px",
    padding: "6px",
    minWidth: "180px",
    zIndex: 50,
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)"
  },
  menuItem: {
    padding: "8px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    color: "#e5e7eb"
  },
  menuItemMuted: {
    color: "#94a3b8"
  },
  menuDivider: {
    height: "1px",
    background: "#1f2937",
    margin: "4px 0"
  },
  menuSub: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginTop: "6px"
  },
  queueButton: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600
  },
  queuePanel: {
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "12px",
    background: "#0f172a",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  queueHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontSize: "13px",
    fontWeight: 700
  },
  queueNowPlaying: {
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #1f2937",
    background: "#111827",
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  queueNowLabel: {
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  },
  queueNowTitle: {
    fontSize: "14px",
    fontWeight: 700
  },
  queueNowArtist: {
    fontSize: "12px",
    color: "#9ca3af"
  },
  queueList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  queueRow: {
    border: "1px solid #1f2937",
    borderRadius: "10px",
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px"
  },
  queueMeta: {
    display: "flex",
    flexDirection: "column",
    gap: "2px"
  },
  queueTitle: {
    fontSize: "13px",
    fontWeight: 600
  },
  queueArtist: {
    fontSize: "11px",
    color: "#9ca3af"
  },
  queueActions: {
    display: "flex",
    gap: "6px",
    alignItems: "center"
  },
  queueDrag: {
    border: "1px dashed #334155",
    background: "transparent",
    color: "#9ca3af",
    padding: "4px 8px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "grab"
  },
  queueActionButton: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    padding: "4px 8px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 600
  },
  empty: {
    color: "#9ca3af",
    fontSize: "13px"
  },
  badge: {
    border: "1px solid #334155",
    borderRadius: "999px",
    padding: "2px 6px",
    fontSize: "10px",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  },
  playerWrap: {
    display: "flex",
    justifyContent: "center"
  },
  playerCard: {
    width: "100%",
    maxWidth: "420px",
    background: "#121827",
    borderRadius: "16px",
    padding: "20px",
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: "16px"
  },
  cover: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #1f2937, #0f172a)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    color: "#94a3b8",
    userSelect: "none"
  },
  trackTitle: {
    fontSize: "18px",
    fontWeight: 700,
    margin: 0
  },
  trackArtist: {
    fontSize: "13px",
    color: "#9ca3af",
    margin: "6px 0 0 0"
  },
  controls: {
    display: "flex",
    gap: "8px",
    justifyContent: "center",
    flexWrap: "wrap"
  },
  controlButton: {
    border: "none",
    background: "#1e293b",
    color: "#e5e7eb",
    padding: "8px 12px",
    borderRadius: "8px",
    fontWeight: 600,
    minWidth: "70px"
  },
  playButton: {
    background: "#38bdf8",
    color: "#0a0f1a"
  },
  likeActive: {
    background: "#dc2626",
    color: "#fff"
  },
  saveActive: {
    background: "#22c55e",
    color: "#0a0f1a"
  },
  errorBanner: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #7f1d1d",
    background: "#1f0b0b",
    color: "#fecaca",
    fontSize: "12px"
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20
  },
  modal: {
    background: "#121827",
    borderRadius: "12px",
    padding: "18px",
    border: "1px solid #1f2937",
    width: "min(420px, 90vw)",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  loadingBarWrap: {
    height: "6px",
    borderRadius: "999px",
    background: "#1f2937",
    overflow: "hidden"
  },
  loadingBar: {
    height: "100%",
    width: "40%",
    background: "#38bdf8"
  },
  modalButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "10px"
  },
  nowPlayingBar: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    height: "72px",
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: 0,
    padding: "12px",
    display: "grid",
    gridTemplateColumns: "1fr 1.5fr 1fr",
    alignItems: "center",
    gap: "12px",
    zIndex: 10,
    cursor: "pointer"
  },
  nowPlayingLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: "260px"
  },
  nowPlayingArt: {
    width: "48px",
    height: "48px",
    borderRadius: "8px",
    background: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    fontSize: "10px",
    fontWeight: 700
  },
  nowPlayingCenter: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    alignItems: "center",
    padding: "0 12px"
  },
  nowPlayingRight: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    alignItems: "center",
    minWidth: "320px"
  },
  nowPlayingInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0
  },
  nowPlayingContext: {
    fontSize: "10px",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  },
  nowPlayingTitle: {
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  nowPlayingArtist: {
    fontSize: "11px",
    color: "#9ca3af",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  nowPlayingControls: {
    display: "flex",
    gap: "6px",
    alignItems: "center"
  },
  nowPlayingButton: {
    border: "1px solid #334155",
    background: "transparent",
    color: "#e5e7eb",
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    display: "grid",
    placeItems: "center"
  },
  nowPlayingProgressWrap: {
    width: "100%",
    height: "4px",
    background: "#1f2937",
    borderRadius: "999px",
    overflow: "hidden"
  },
  nowPlayingProgress: {
    height: "100%",
    background: "#38bdf8",
    width: "0%"
  },
  nowPlayingTime: {
    fontSize: "11px",
    color: "#9ca3af",
    padding: "2px 6px",
    borderRadius: "999px"
  },
  hudPanel: {
    position: "fixed",
    right: "12px",
    bottom: "84px",
    width: "320px",
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderRadius: "12px",
    padding: "12px",
    fontSize: "11px",
    color: "#e5e7eb",
    zIndex: 30
  },
  hudTitle: {
    fontSize: "12px",
    fontWeight: 700,
    marginBottom: "6px"
  },
  hudRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    padding: "2px 0"
  }
};

const getFileName = (filePath) => {
  if (typeof filePath !== "string") return "Unknown file";
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
};

const parseTrackMeta = (filePath) => {
  const title = getFileName(filePath).replace(/\.[^/.\\]+$/, "") || "Unknown Title";
  return { title, artist: "Unknown Artist" };
};

const getAlbumName = () => "Unknown Album";

const computeGainFromLufs = (lufs) => {
  if (!Number.isFinite(lufs)) return 1;
  const target = -14;
  const gainDb = target - lufs;
  return Math.pow(10, gainDb / 20);
};

const MarqueeText = ({ text }) => (
  <span className="marquee-static" aria-label={text}>
    <span>{text}</span>
  </span>
);

const getDeviceId = () => {
  try {
    const stored = localStorage.getItem("Hound.deviceId");
    if (stored) return stored;
    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem("Hound.deviceId", id);
    return id;
  } catch {
    return `Hound-${Date.now()}`;
  }
};

const clearHoundStorage = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("Hound."))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore
  }
};

const getContextLabel = (context) => {
  if (!context || typeof context !== "object") return "Library";
  return context.label || "Library";
};

const normalizeTrack = (track) => ({
  ...track,
  rotation: track.rotation ?? false,
  rotationManual: track.rotationManual ?? null,
  saved: track.saved ?? false,
  rotationScore: Number.isFinite(track.rotationScore) ? track.rotationScore : 0,
  lastPositiveListenAt: track.lastPositiveListenAt ?? null,
  lastNegativeListenAt: track.lastNegativeListenAt ?? null,
  rotationOverride: track.rotationOverride ?? "none",
  playCountTotal: Number.isFinite(track.playCountTotal) ? track.playCountTotal : 0,
  playHistory: Array.isArray(track.playHistory) ? track.playHistory : [],
  analysisStatus: track.analysisStatus ?? "pending",
  loudnessLUFS: Number.isFinite(track.loudnessLUFS) ? track.loudnessLUFS : null,
  gain: Number.isFinite(track.gain) ? track.gain : 1,
  loudnessReady: track.loudnessReady ?? false,
  bpm: Number.isFinite(track.bpm) ? track.bpm : null,
  key: track.key ?? null,
  mode: track.mode ?? null,
  album: track.album ?? null,
  durationSec: Number.isFinite(track.durationSec) ? track.durationSec : null,
  orbit: track.orbit ?? null,
  evidenceScore: Number.isFinite(track.evidenceScore) ? track.evidenceScore : 0,
  forceOn: !!track.forceOn,
  forceOff: !!track.forceOff
});

const useSessionStats = () => {
  const statsRef = useRef({ listenedSeconds: 0, tracksPlayed: 0, skips: 0 });
  const lastTimeRef = useRef(0);
  const sessionActiveRef = useRef(false);

  const startSessionIfNeeded = () => {
    if (!sessionActiveRef.current) {
      statsRef.current = { listenedSeconds: 0, tracksPlayed: 0, skips: 0 };
      lastTimeRef.current = 0;
      sessionActiveRef.current = true;
    }
  };

  const markTrackPlayed = () => {
    statsRef.current.tracksPlayed += 1;
  };

  const markSkip = () => {
    statsRef.current.skips += 1;
  };

  const addListenedDelta = (delta) => {
    if (delta > 0) {
      statsRef.current.listenedSeconds += delta;
    }
  };

  const endSession = () => {
    sessionActiveRef.current = false;
    return {
      listenedSeconds: Number(statsRef.current.listenedSeconds.toFixed(1)),
      tracksPlayed: statsRef.current.tracksPlayed,
      skips: statsRef.current.skips
    };
  };

  return {
    statsRef,
    lastTimeRef,
    sessionActiveRef,
    startSessionIfNeeded,
    markTrackPlayed,
    markSkip,
    addListenedDelta,
    endSession
  };
};

export default function App() {
  const [authState, setAuthState] = useState({ status: "authed", message: "" });
  const [inviteCode, setInviteCode] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudToken, setCloudToken] = useState(() => localStorage.getItem(CLOUD_TOKEN_KEY) || "");
  const [cloudRefreshToken, setCloudRefreshToken] = useState(() => localStorage.getItem(CLOUD_REFRESH_KEY) || "");
  const [cloudRole, setCloudRole] = useState(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");
  const [cloudHome, setCloudHome] = useState(null);
  const [cloudAlbum, setCloudAlbum] = useState(null);
  const [cloudStreamInfo, setCloudStreamInfo] = useState(null);

  const [screen, setScreen] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredLibraryId, setHoveredLibraryId] = useState(null);
  const [rotationMenu, setRotationMenu] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recap, setRecap] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [recommendationCandidates, setRecommendationCandidates] = useState([]);
  const [recommendationSeedId, setRecommendationSeedId] = useState(null);
  const [orbitHud, setOrbitHud] = useState(null);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [shuffleOn, setShuffleOn] = useState(false);
  const [queue, setQueue] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editingPlaylistName, setEditingPlaylistName] = useState("");
  const [playbackContext, setPlaybackContext] = useState({
    type: "library",
    id: null,
    label: "Library",
    shuffle: false,
    trackIds: []
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [activeArtist, setActiveArtist] = useState(null);
  const [albumPlaylistId, setAlbumPlaylistId] = useState("");
  const [artistPlaylistId, setArtistPlaylistId] = useState("");
  const [sessionHistory, setSessionHistory] = useState([]);
  const [lastSession, setLastSession] = useState(null);
  const [sessionMode, setSessionMode] = useState("Normal");
  const [settings, setSettings] = useState({
    loudnessEnabled: true,
    crossfadeEnabled: true,
    gapSeconds: 1,
    resumeOnLaunch: true,
    stopEndsSession: true
  });
  const [devMode, setDevMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showRemaining, setShowRemaining] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const searchInputRef = useRef(null);
  const navHistoryRef = useRef([]);
  const navSkipRef = useRef(false);
  const audioARef = useRef(null);
  const audioBRef = useRef(null);
  const activeAudioRef = useRef("A");
  const isCrossfadingRef = useRef(false);
  const lastPlayedTrackIdRef = useRef(null);
  const shufflePlanRef = useRef({ list: [], index: -1, contextKey: "" });
  const queueRef = useRef([]);
  const lastNonQueueContextRef = useRef({
    type: "library",
    id: null,
    label: "Library",
    shuffle: false,
    trackIds: []
  });
  const lastPlaybackRef = useRef({ context: null, trackId: null, position: 0 });
  const persistTimerRef = useRef(0);
  const pendingSeekRef = useRef(null);
  const pendingNextRef = useRef(null);
  const lastRecommendationRef = useRef(null);
  const playSourceRef = useRef({ source: "library", seedTrackId: null });
  const recentPlayedRef = useRef([]);
  const playContextRef = useRef("manual");
  const cloudEventMilestonesRef = useRef({});
  const cloudRetryRef = useRef({});
  const session = useSessionStats();
  const sessionPlayCountsRef = useRef({});
  const playStartRef = useRef(null);
  const CROSSFADE_SECONDS = 1;
  // Audio contract: one output path, deterministic gain chain, and explicit session boundaries.

  const selectedIndex = useMemo(
    () => tracks.findIndex((track) => track.id === selectedTrackId),
    [tracks, selectedTrackId]
  );
  const selectedTrack = selectedIndex >= 0 ? tracks[selectedIndex] : null;

  useEffect(() => {
    if (cloudToken) {
      localStorage.setItem(CLOUD_TOKEN_KEY, cloudToken);
    } else {
      localStorage.removeItem(CLOUD_TOKEN_KEY);
    }
  }, [cloudToken]);

  useEffect(() => {
    if (cloudRefreshToken) {
      localStorage.setItem(CLOUD_REFRESH_KEY, cloudRefreshToken);
    } else {
      localStorage.removeItem(CLOUD_REFRESH_KEY);
    }
  }, [cloudRefreshToken]);


  const refreshTrackFeatures = async (ids) => {
    const getter = window?.Hound?.getTrackFeatures;
    if (typeof getter !== "function") return;
    const results = await Promise.all(ids.map((id) => getter(id)));
    const map = new Map(results.filter(Boolean).map((item) => [item.trackId, item]));
    setTracks((prev) =>
      prev.map((track) => {
        const feature = map.get(track.id);
        if (!feature) return track;
        const lufs = Number.isFinite(feature.loudnessLUFS) ? feature.loudnessLUFS : track.loudnessLUFS;
        return {
          ...track,
          analysisStatus: feature.analysisStatus ?? track.analysisStatus,
          loudnessLUFS: lufs,
          gain: computeGainFromLufs(lufs),
          loudnessReady: Number.isFinite(lufs),
          bpm: Number.isFinite(feature.bpm) ? feature.bpm : track.bpm,
          key: feature.key ?? track.key,
          mode: feature.mode ?? track.mode,
          durationSec: Number.isFinite(feature.durationSec) ? feature.durationSec : track.durationSec
        };
      })
    );
  };

  const queueAnalysisForTracks = (list) => {
    const queue = window?.Hound?.queueAnalysis;
    if (typeof queue !== "function") return;
    const payload = list
      .filter((track) => track && track.id && track.path)
      .map((track) => ({
        id: track.id,
        path: track.path,
        title: track.title,
        artist: track.artist,
        contentHash: track.contentHash,
        fileSize: track.fileSize,
        mtimeMs: track.mtimeMs
      }));
    if (payload.length > 0) {
      queue(payload);
    }
  };

  const saveLibraryTracks = (list) => {
    const saver = window?.Hound?.saveLibrary;
    if (typeof saver !== "function") return;
    const payload = list
      .filter((track) => track && track.id && track.path)
      .map((track) => ({
        id: track.id,
        path: track.path,
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationSec: track.durationSec,
        contentHash: track.contentHash
      }));
    if (payload.length > 0) {
      saver(payload);
    }
  };

  const ORBIT_CONFIG = {
    qualifiedThreshold: 0.65,
    earlySkipThreshold: 0.2,
    promotionQualifiedPlays: 2,
    demotionSkips: 2,
    recentDecayDays: 14,
    discoveryIgnoreDays: 30,
    cooldownSize: 3
  };
  const ROTATION_EARN_THRESHOLD = ORBIT_CONFIG.qualifiedThreshold;
  const ROTATION_DECAY_WINDOW = 5;
  const ROTATION_DECAY_SKIPS = 3;
  const AUTOPLAY_WEIGHTS = {
    rotation: 70,
    recent: 20,
    discovery: 10
  };
  const LONG_IGNORED_DAYS = ORBIT_CONFIG.discoveryIgnoreDays;

  function getActiveAudio() {
    return activeAudioRef.current === "A" ? audioARef.current : audioBRef.current;
  }

  function getInactiveAudio() {
    return activeAudioRef.current === "A" ? audioBRef.current : audioARef.current;
  }

  const scaleVolume = (gain) => Math.min(1, Math.max(0, gain * volume));

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    if (GATE_DISABLED) return;
    const token = localStorage.getItem("Hound.token");
    const expiresAt = Number(localStorage.getItem("Hound.tokenExpires"));
    if (!token || !Number.isFinite(expiresAt)) {
      setAuthState({ status: "unauth", message: "" });
      return;
    }
    if (Date.now() > expiresAt) {
      localStorage.removeItem("Hound.token");
      localStorage.removeItem("Hound.tokenExpires");
      setAuthState({ status: "unauth", message: "Session expired." });
      return;
    }
    setAuthState({ status: "authed", message: "" });
    const deviceId = getDeviceId();
    fetch(CHECKIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`
      },
      body: JSON.stringify({ token, deviceId })
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.ok) {
          if (data?.forceGate) {
            setAuthState({ status: "revoked", message: data?.error || "Access revoked." });
          }
          return;
        }
        if (data.wipeOnNextLaunch) {
          clearHoundStorage();
          setAuthState({ status: "unauth", message: "Device reset required." });
        }
      })
      .catch(() => {
        // keep session if network blips
      });
  }, []);

  useEffect(() => {
    setTracks((prev) => {
      let changed = false;
      const next = prev.map((track) => {
        const normalized = normalizeTrack(track);
        if (normalized !== track) changed = true;
        return normalized;
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    const loadLibrary = async () => {
      const loader = window?.Hound?.loadLibrary;
      if (typeof loader !== "function") return;
      const items = await loader();
      if (!Array.isArray(items)) return;
      const normalized = items.map((track) => {
        if (!track || !track.path) return track;
        const base = track.title ? track : { ...track, ...parseTrackMeta(track.path) };
        const override = track.forceOn ? "force_on" : track.forceOff ? "force_off" : "none";
        const orbit = track.orbit || (track.forceOn ? "rotation" : "discovery");
        return normalizeTrack({
          ...base,
          gain: 1,
          loudnessReady: false,
          analysisStatus: "pending",
          rotationOverride: override,
          rotation: orbit === "rotation",
          forceOn: !!track.forceOn,
          forceOff: !!track.forceOff,
          orbit
        });
      });
      setTracks(normalized.filter(Boolean));
      const ids = normalized.map((track) => track?.id).filter(Boolean);
      if (ids.length > 0) {
        refreshTrackFeatures(ids);
        queueAnalysisForTracks(normalized);
      }
    };
    loadLibrary();
  }, []);

  useEffect(() => {
    const onProgress = (_event, payload) => {
      if (!payload?.trackId) return;
      setTracks((prev) =>
        prev.map((track) =>
          track.id === payload.trackId
            ? { ...track, analysisStatus: "in_progress" }
            : track
        )
      );
    };
    const onCompleted = (_event, payload) => {
      if (!payload?.trackId) return;
      setTracks((prev) =>
        prev.map((track) => {
          if (track.id !== payload.trackId) return track;
          const lufs = Number.isFinite(payload.loudnessLUFS)
            ? payload.loudnessLUFS
            : track.loudnessLUFS;
          return {
            ...track,
            analysisStatus: "complete",
            loudnessLUFS: lufs ?? null,
            gain: computeGainFromLufs(lufs),
            loudnessReady: Number.isFinite(lufs)
          };
        })
      );
      refreshTrackFeatures([payload.trackId]);
    };
    const offProgress = window?.Hound?.onAnalysisProgress?.(onProgress);
    const offCompleted = window?.Hound?.onAnalysisCompleted?.(onCompleted);
    return () => {
      offProgress?.();
      offCompleted?.();
    };
  }, []);

  useEffect(() => {
    const fetchNeighbors = async () => {
      const getNeighbors = window?.Hound?.getNeighbors;
      if (!selectedTrackId || typeof getNeighbors !== "function") {
        setRecommendationCandidates([]);
        setRecommendationSeedId(null);
        return;
      }
      const results = await getNeighbors(selectedTrackId, 200);
      setRecommendationCandidates(Array.isArray(results) ? results : []);
      setRecommendationSeedId(selectedTrackId);
    };
    fetchNeighbors();
  }, [selectedTrackId]);

  useEffect(() => {
    if (screen !== "settings") return;
    const getMetrics = window?.Hound?.getRecommendationMetrics;
    if (typeof getMetrics !== "function") return;
    getMetrics().then((data) => setMetrics(data));
  }, [screen]);

  useEffect(() => {
    if (navSkipRef.current) {
      navSkipRef.current = false;
      return;
    }
    const history = navHistoryRef.current;
    if (history.length === 0 || history[history.length - 1] !== screen) {
      history.push(screen);
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== "search") return;
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [screen]);

  useEffect(() => {
    const closeMenus = () => {
      setRotationMenu(null);
      setContextMenu(null);
    };
    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
  }, []);

  useEffect(() => {
    if (GATE_DISABLED) return;
    if (authState.status !== "authed") return;
    let stopped = false;
    const poll = () => {
      const token = localStorage.getItem("Hound.token");
      const deviceId = getDeviceId();
      if (!token) return;
      fetch(CHECKIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`
        },
        body: JSON.stringify({ token, deviceId })
      })
        .then((res) => res.json())
        .then((data) => {
          if (stopped) return;
          if (!data || !data.ok) {
            if (data?.forceGate) {
              setAuthState({ status: "revoked", message: data?.error || "Access revoked." });
            }
            return;
          }
          if (data.wipeOnNextLaunch) {
            clearHoundStorage();
            setAuthState({ status: "unauth", message: "Device reset required." });
          }
        })
        .catch(() => {
          // keep session if network blips
        });
    };
    const interval = setInterval(poll, 15000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [authState.status]);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("Hound.settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed && typeof parsed === "object") {
          setSettings((prev) => ({ ...prev, ...parsed }));
        }
      }
      const savedHistory = localStorage.getItem("Hound.sessionHistory");
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          setSessionHistory(parsedHistory);
        }
      }
      const savedLast = localStorage.getItem("Hound.lastSession");
      if (savedLast) {
        const parsedLast = JSON.parse(savedLast);
        if (parsedLast && typeof parsedLast === "object") {
          setLastSession(parsedLast);
          if (parsedLast.mode) {
            setSessionMode(parsedLast.mode);
          }
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("Hound.settings", JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem("Hound.sessionHistory", JSON.stringify(sessionHistory));
    } catch {
      // ignore storage errors
    }
  }, [sessionHistory]);

  useEffect(() => {
    if (!lastSession) return;
    try {
      localStorage.setItem("Hound.lastSession", JSON.stringify(lastSession));
    } catch {
      // ignore storage errors
    }
  }, [lastSession]);
  useEffect(() => {
    if (!settings.resumeOnLaunch) return;
    if (!selectedTrackId || !playbackContext) return;
    lastPlaybackRef.current = {
      context: playbackContext,
      trackId: selectedTrackId,
      position: currentTime
    };
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem("Hound.lastPlayback", JSON.stringify(lastPlaybackRef.current));
      } catch {
        // ignore
      }
    }, 250);
  }, [settings.resumeOnLaunch, selectedTrackId, playbackContext, currentTime]);

  useEffect(() => {
    if (!settings.resumeOnLaunch) return;
    try {
      const stored = localStorage.getItem("Hound.lastPlayback");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || !parsed.trackId || !parsed.context) return;
      setContext(parsed.context);
      setSelectedTrackId(parsed.trackId);
      pendingSeekRef.current = Number(parsed.position) || 0;
    } catch {
      // ignore
    }
  }, [settings.resumeOnLaunch]);

  useEffect(() => {
    if (!settings.loudnessEnabled) {
      setTracks((prev) =>
        prev.map((track) => ({ ...track, gain: 1, loudnessReady: true }))
      );
    }
  }, [settings.loudnessEnabled]);

  useEffect(() => {
    const audio = getActiveAudio();
    if (!audio || !selectedTrack) return;
    const baseVolume =
      settings.loudnessEnabled && Number.isFinite(selectedTrack.gain)
        ? selectedTrack.gain
        : 1;
    audio.volume = scaleVolume(baseVolume);
  }, [volume, selectedTrack, settings.loudnessEnabled]);

  useEffect(() => {
    window?.Hound?.setPlaybackActive?.(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    if (!settings.resumeOnLaunch) return;
    if (!lastSession || !lastSession.lastTrackId) return;
    if (selectedTrackId) return;
    const exists = tracks.some((track) => track.id === lastSession.lastTrackId);
    if (exists) {
      setSelectedTrackId(lastSession.lastTrackId);
    }
  }, [lastSession, settings.resumeOnLaunch, tracks, selectedTrackId]);

  const stopAllAudio = () => {
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    [audioARef.current, audioBRef.current].forEach((audio) => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    });
  };

  const fadeAudio = (audio, from, to, durationMs, onDone) => {
    if (!audio) {
      if (onDone) onDone();
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      audio.volume = from + (to - from) * progress;
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else if (onDone) {
        onDone();
      }
    };
    requestAnimationFrame(tick);
  };

  useEffect(() => {
    const onError = async (event) => {
      const audio = event.currentTarget;
      const active = getActiveAudio();
      if (active !== audio) return;
      const current = selectedTrack;
      if (current?.remoteUrl && current?.cloudTrackId) {
        const retries = cloudRetryRef.current[current.id] || 0;
        if (retries < 1) {
          cloudRetryRef.current[current.id] = retries + 1;
          try {
            const refreshed = await cloudRequest(`/v1/listener/tracks/${current.cloudTrackId}/stream`);
            setCloudStreamInfo(refreshed);
            setTracks((prev) =>
              prev.map((track) =>
                track.id === current.id ? { ...track, remoteUrl: refreshed.manifestUrl } : track
              )
            );
            loadAndPlay({ ...current, remoteUrl: refreshed.manifestUrl });
            return;
          } catch {
            // fall through to error
          }
        }
      }
      setError("Could not play this file.");
      setIsPlaying(false);
      setIsBuffering(false);
    };
    const onLoadedMetadata = (event) => {
      const audio = event.currentTarget;
      if (getActiveAudio() !== audio) return;
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      if (pendingSeekRef.current !== null) {
        const seekTo = Math.max(0, Number(pendingSeekRef.current) || 0);
        audio.currentTime = seekTo;
        setCurrentTime(seekTo);
        pendingSeekRef.current = null;
      }
    };
    const onTimeUpdate = (event) => {
      const audio = event.currentTarget;
      if (getActiveAudio() !== audio) return;
      if (!session.sessionActiveRef.current || !isPlaying) return;
      const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      const delta = currentTime - session.lastTimeRef.current;
      session.addListenedDelta(delta);
      session.lastTimeRef.current = currentTime;
      if (!isSeeking) {
        setCurrentTime(currentTime);
      }

      const current = selectedTrack;
      if (cloudToken && current?.cloudTrackId) {
        const total = Number.isFinite(audio.duration) ? audio.duration : Number(current.durationSec || 0);
        if (total > 0) {
          const pct = (currentTime / total) * 100;
          const marks = cloudEventMilestonesRef.current[current.id] || {};
          const milestones = [
            { at: 25, type: "progress_25" },
            { at: 50, type: "progress_50" },
            { at: 75, type: "progress_75" },
            { at: 95, type: "progress_95" }
          ];
          milestones.forEach((milestone) => {
            if (!marks[milestone.type] && pct >= milestone.at) {
              marks[milestone.type] = true;
              cloudEventMilestonesRef.current[current.id] = marks;
              cloudRequest(
                "/v1/listener/telemetry/events",
                {
                  method: "POST",
                  body: JSON.stringify({
                    events: [
                      {
                        eventId: `${current.cloudTrackId}:${milestone.type}:${Math.floor(Date.now() / 1000)}`,
                        trackId: current.cloudTrackId,
                        eventType: milestone.type,
                        eventTime: new Date().toISOString(),
                        payload: { percent: milestone.at }
                      }
                    ]
                  })
                },
                true
              ).catch(() => {});
            }
          });
        }
      }
    };
    const onWaiting = (event) => {
      const audio = event.currentTarget;
      if (getActiveAudio() !== audio) return;
      setIsBuffering(true);
    };
    const onPlaying = (event) => {
      const audio = event.currentTarget;
      if (getActiveAudio() !== audio) return;
      setIsBuffering(false);
    };
  const onEnded = (event) => {
    const audio = event.currentTarget;
    if (getActiveAudio() !== audio) return;
    if (queueRef.current.length > 0) {
      handleNext({ fromEnded: true });
      return;
    }
    handleNext({ fromEnded: true });
  };
    const audios = [audioARef.current, audioBRef.current].filter(Boolean);
    audios.forEach((audio) => {
      audio.addEventListener("error", onError);
      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("waiting", onWaiting);
      audio.addEventListener("playing", onPlaying);
    });
    return () => {
      audios.forEach((audio) => {
        audio.removeEventListener("error", onError);
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("waiting", onWaiting);
        audio.removeEventListener("playing", onPlaying);
      });
    };
  }, [
    isPlaying,
    session,
    isSeeking,
    selectedIndex,
    tracks.length,
    settings.crossfadeEnabled,
    settings.gapSeconds,
    cloudToken,
    selectedTrack
  ]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const activeTag = document.activeElement?.tagName ?? "";
      if (activeTag === "TEXTAREA") return;
      if (activeTag === "INPUT") {
        const inputType = document.activeElement?.getAttribute("type") || "text";
        if (inputType === "text" || inputType === "search" || inputType === "password") {
          return;
        }
      }
      if (event.code === "Space") {
        event.preventDefault();
        togglePlayPause();
        return;
      }
      if (event.ctrlKey && event.code === "KeyB") {
        event.preventDefault();
        setSidebarOpen((prev) => !prev);
        return;
      }
      if (event.ctrlKey && event.code === "Digit1") {
        event.preventDefault();
        setScreen("home");
        return;
      }
      if (event.ctrlKey && event.code === "Digit2") {
        event.preventDefault();
        setScreen("library");
        return;
      }
      if (event.ctrlKey && event.code === "Digit3") {
        event.preventDefault();
        setScreen("search");
        return;
      }
      if (event.ctrlKey && event.code === "Digit4") {
        event.preventDefault();
        setScreen("playlist");
        return;
      }
      if (event.ctrlKey && event.code === "Digit5") {
        event.preventDefault();
        setScreen("settings");
        return;
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
        return;
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        handleNext({ manual: true });
        return;
      }
      if (event.altKey && event.code === "ArrowLeft") {
        event.preventDefault();
        goBack();
        return;
      }
      if (event.code === "KeyS") {
        event.preventDefault();
        handleStop();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const getTrackPlaybackSrc = (track) => {
    if (track?.remoteUrl) return track.remoteUrl;
    const normalized = track.path.replace(/\\/g, "/");
    const prefixed = normalized.startsWith("/") ? normalized : `/${normalized}`;
    return `houndfile://${encodeURI(prefixed)}`;
  };

  const loadAndPlay = (track) => {
    if (!track) return;
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    const audio = getActiveAudio();
    if (!audio) return;
    const src = getTrackPlaybackSrc(track);
    stopAllAudio();
    // Signal chain: per-track LUFS gain -> session envelope (crossfade) -> app volume (unity).
    const baseVolume = settings.loudnessEnabled && Number.isFinite(track.gain) ? track.gain : 1;
    const safeVolume = scaleVolume(baseVolume);
    audio.volume = safeVolume;
    audio.src = src;
    audio.load();
    setCurrentTime(0);
    setError("");
    session.startSessionIfNeeded();
    session.markTrackPlayed();
    lastPlayedTrackIdRef.current = track.id;
    sessionPlayCountsRef.current[track.id] =
      (sessionPlayCountsRef.current[track.id] || 0) + 1;
    playStartRef.current = {
      trackId: track.id,
      play_start_time: new Date().toISOString()
    };
    if (track.cloudTrackId && cloudToken) {
      cloudEventMilestonesRef.current[track.id] = {};
      const eventTime = new Date().toISOString();
      cloudRequest(
        "/v1/listener/telemetry/events",
        {
          method: "POST",
          body: JSON.stringify({
            events: [
              {
                eventId: `${track.cloudTrackId}:play_start:${Math.floor(Date.now() / 1000)}`,
                trackId: track.cloudTrackId,
                eventType: "play_start",
                eventTime,
                payload: { source: playContextRef.current || "manual" }
              }
            ]
          })
        },
        true
      ).catch(() => {});
    }
    recentPlayedRef.current = [
      track.id,
      ...recentPlayedRef.current.filter((id) => id !== track.id)
    ].slice(0, 5);
    setLastSession((prev) => ({
      ...prev,
      lastTrackId: track.id,
      queue: queueRef.current,
      mode: sessionMode
    }));
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setError("Could not play this file.");
        setIsPlaying(false);
      });
  };

  const startCrossfade = (nextIndex) => {
    if (isCrossfadingRef.current) return;
    if (nextIndex < 0 || nextIndex >= tracks.length) return;
    const currentAudio = getActiveAudio();
    const nextAudio = getInactiveAudio();
    if (!currentAudio || !nextAudio) return;
    const nextTrack = tracks[nextIndex];
    const nextGainRaw =
      settings.loudnessEnabled && Number.isFinite(nextTrack.gain) ? nextTrack.gain : 1;
    const nextGain = scaleVolume(nextGainRaw);
    const src = getTrackPlaybackSrc(nextTrack);
    isCrossfadingRef.current = true;
    nextAudio.pause();
    nextAudio.currentTime = 0;
    nextAudio.volume = 0;
    nextAudio.src = src;
    nextAudio.load();
    session.startSessionIfNeeded();
    session.markTrackPlayed();
    sessionPlayCountsRef.current[nextTrack.id] =
      (sessionPlayCountsRef.current[nextTrack.id] || 0) + 1;
    playStartRef.current = {
      trackId: nextTrack.id,
      play_start_time: new Date().toISOString()
    };
    nextAudio
      .play()
      .then(() => {
        // Crossfade envelope must not exceed unity gain.
        fadeAudio(nextAudio, 0, nextGain, CROSSFADE_SECONDS * 1000);
        fadeAudio(currentAudio, currentAudio.volume, 0, CROSSFADE_SECONDS * 1000, () => {
          currentAudio.pause();
          currentAudio.currentTime = 0;
          activeAudioRef.current = activeAudioRef.current === "A" ? "B" : "A";
          setSelectedTrackId(nextTrack.id);
          setIsPlaying(true);
          setShowBack(false);
          setDuration(Number.isFinite(nextAudio.duration) ? nextAudio.duration : 0);
          setCurrentTime(0);
          isCrossfadingRef.current = false;
        });
      })
      .catch(() => {
        setError("Could not play this file.");
        setIsPlaying(false);
        isCrossfadingRef.current = false;
      });
  };

  const popQueueTrackId = () => {
    const currentQueue = queueRef.current;
    if (!Array.isArray(currentQueue) || currentQueue.length === 0) return null;
    let nextId = null;
    const remaining = [...currentQueue];
    while (remaining.length > 0) {
      const candidate = remaining.shift();
      const exists = tracks.some((track) => track.id === candidate);
      if (exists) {
        nextId = candidate;
        break;
      }
    }
    queueRef.current = remaining;
    setQueue(remaining);
    return nextId;
  };

  const togglePlayPause = () => {
    const audio = getActiveAudio();
    if (!selectedTrack || !audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    const resumeGain =
      settings.loudnessEnabled && Number.isFinite(selectedTrack.gain)
        ? selectedTrack.gain
        : audio.volume;
    audio.volume = scaleVolume(resumeGain);
    session.startSessionIfNeeded();
    if (lastPlayedTrackIdRef.current !== selectedTrack.id) {
      session.markTrackPlayed();
      lastPlayedTrackIdRef.current = selectedTrack.id;
      audio.currentTime = 0;
      sessionPlayCountsRef.current[selectedTrack.id] =
        (sessionPlayCountsRef.current[selectedTrack.id] || 0) + 1;
      playStartRef.current = {
        trackId: selectedTrack.id,
        play_start_time: new Date().toISOString()
      };
    }
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setError("Could not play this file.");
        setIsPlaying(false);
      });
  };

  const goToTrack = (index, options = {}) => {
    if (index < 0 || index >= tracks.length) return;
    const { openPlayer = false } = options;
    if (selectedTrack && tracks[index].id !== selectedTrack.id) {
      finalizePlay({ manualSkip: true, autoAdvance: false });
    }
    if (lastRecommendationRef.current?.recommendedTrackId === tracks[index].id) {
      playSourceRef.current = {
        source: "recommendation",
        seedTrackId: lastRecommendationRef.current.seedTrackId
      };
    } else {
      playSourceRef.current = { source: "library", seedTrackId: null };
    }
    setSelectedTrackId(tracks[index].id);
    if (openPlayer) {
      setScreen("player");
    }
    loadAndPlay(tracks[index]);
  };

  const handlePrev = () => {
    if (!selectedTrack || !getActiveAudio()) return;
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    finalizePlay({ manualSkip: true, autoAdvance: false });
    const audio = getActiveAudio();
    const effectiveContext = getEffectiveContext();
    const ids = getContextTrackIds(effectiveContext);
    const currentIdx = ids.indexOf(selectedTrack.id);
    const useShuffle = effectiveContext.shuffle || (effectiveContext.type === "library" && shuffleOn);
    if (useShuffle) {
      const plan = ensureShufflePlan(effectiveContext, selectedTrack.id);
      if (plan.index > 0) {
        plan.index -= 1;
        const prevId = plan.list[plan.index];
        const prevIndex = tracks.findIndex((track) => track.id === prevId);
        if (prevIndex >= 0) {
          goToTrack(prevIndex);
          return;
        }
      }
      if (repeatMode === "all" && plan.list.length > 1) {
        plan.index = plan.list.length - 1;
        const lastId = plan.list[plan.index];
        const lastIndex = tracks.findIndex((track) => track.id === lastId);
        if (lastIndex >= 0) {
          goToTrack(lastIndex);
          return;
        }
      }
      audio.currentTime = 0;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setError("Could not play this file.");
          setIsPlaying(false);
        });
      return;
    }
    if (currentIdx > 0) {
      goToContextIndex(ids, currentIdx - 1);
      return;
    }
    if (repeatMode === "all" && ids.length > 0) {
      goToContextIndex(ids, ids.length - 1);
      return;
    }
    audio.currentTime = 0;
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => {
        setError("Could not play this file.");
        setIsPlaying(false);
      });
  };

  const buildContext = (base) => {
    if (!base || typeof base !== "object") {
      return {
        type: "library",
        id: null,
        label: "Library",
        shuffle: false,
        trackIds: tracks.map((track) => track.id)
      };
    }
    const label = base.label || (base.type === "playlist" && base.name
      ? `Playlist: ${base.name}`
      : base.type === "album" && base.name
        ? `Album: ${base.name}`
        : base.type === "artist" && base.name
          ? `Artist: ${base.name}`
          : base.type === "search"
            ? "Search"
            : base.type === "queue"
              ? "Queue"
              : "Library");
    return {
      type: base.type || "library",
      id: base.id || null,
      label,
      shuffle: !!base.shuffle,
      trackIds: Array.isArray(base.trackIds) && base.trackIds.length > 0
        ? base.trackIds
        : tracks.map((track) => track.id)
    };
  };

  const setContext = (nextContext) => {
    const context = buildContext(nextContext);
    const returningFromQueue = playbackContext.type === "queue" && context.type !== "queue";
    if (context.type !== "queue") {
      lastNonQueueContextRef.current = context;
    }
    if (!returningFromQueue && context.type !== "queue") {
      shufflePlanRef.current = { list: [], index: -1, contextKey: "" };
    }
    setPlaybackContext(context);
  };

  const getContextTrackIds = (context) => {
    if (!context || typeof context !== "object") return tracks.map((t) => t.id);
    if (context.type === "playlist" && context.id) {
      const playlist = playlists.find((item) => item.id === context.id);
      if (playlist) return playlist.trackIds;
    }
    return context.trackIds && context.trackIds.length > 0
      ? context.trackIds
      : tracks.map((t) => t.id);
  };

  const buildShufflePlan = (ids, currentId) => {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const remaining = currentId ? ids.filter((id) => id !== currentId) : [...ids];
    for (let i = remaining.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    return currentId ? [currentId, ...remaining] : remaining;
  };

  const ensureShufflePlan = (context, currentId) => {
    const ids = getContextTrackIds(context);
    const key = `${context.type || "library"}:${context.id || ""}:${ids.join(",")}`;
    const plan = shufflePlanRef.current;
    const hasCurrent = currentId ? plan.list.includes(currentId) : plan.list.length > 0;
    if (plan.contextKey !== key || !hasCurrent) {
      const list = buildShufflePlan(ids, currentId);
      const index = currentId ? list.indexOf(currentId) : 0;
      shufflePlanRef.current = { list, index, contextKey: key };
      return shufflePlanRef.current;
    }
    if (currentId && plan.index === -1) {
      plan.index = plan.list.indexOf(currentId);
    }
    return plan;
  };

  const getEffectiveContext = () =>
    playbackContext.type === "queue" ? lastNonQueueContextRef.current : playbackContext;

  const isAutoplayEnabled = () => repeatMode !== "off" || shuffleOn;

  const keyIndex = (key) => {
    const map = {
      C: 0,
      "C#": 1,
      D: 2,
      "D#": 3,
      E: 4,
      F: 5,
      "F#": 6,
      G: 7,
      "G#": 8,
      A: 9,
      "A#": 10,
      B: 11
    };
    return key in map ? map[key] : null;
  };

  const keyDistance = (a, b) => {
    const ai = keyIndex(a);
    const bi = keyIndex(b);
    if (ai === null || bi === null) return null;
    const diff = Math.abs(ai - bi);
    return Math.min(diff, 12 - diff);
  };

  const getOrbit = (track) => {
    const now = Date.now();
    const lastPlay = track.playHistory?.[0];
    const inRotation = track.rotationOverride === "force_on" || track.rotation === true;
    const inRecent =
      lastPlay && lastPlay.percent_listened >= ROTATION_EARN_THRESHOLD && !lastPlay.skipped_early;
    if (inRotation) return "rotation";
    if (inRecent) return "recent";
    if ((track.playCountTotal || 0) === 0) return "discovery";
    if (track.saved) return "recent";
    const lastPositive = track.lastPositiveListenAt
      ? Date.parse(track.lastPositiveListenAt)
      : null;
    const cutoffMs = LONG_IGNORED_DAYS * 24 * 60 * 60 * 1000;
    if (Number.isFinite(lastPositive) && now - lastPositive >= cutoffMs) {
      return "discovery";
    }
    return "recent";
  };

  const rankRecommendationPool = (seedTrack, candidates) => {
    if (!seedTrack || !Array.isArray(candidates)) return [];
    const seedArtist = seedTrack.artist;
    return candidates
      .map((candidate) => {
        const track = tracks.find((item) => item.id === candidate.trackId);
        if (!track) return null;
        if (track.rotationOverride === "force_off") return null;
        const orbit = getOrbit(track);
        let score = Number.isFinite(candidate.score) ? candidate.score : 0;
        if (orbit === "rotation") score += 0.15;
        if (orbit === "recent") score += 0.1;
        if (orbit === "discovery") score += 0.05;
        const lastPlay = track.playHistory?.[0];
        if (lastPlay?.skipped_early) score -= 0.2;
        if (lastPlay?.completed_play) score += 0.1;
        if (seedArtist && track.artist === seedArtist) score -= 0.15;
        if (Number.isFinite(candidate.bpm) && Number.isFinite(seedTrack.bpm)) {
          const tempoDiff = Math.abs(candidate.bpm - seedTrack.bpm);
          score -= Math.min(0.2, tempoDiff / 200);
        }
        const dist = keyDistance(candidate.key, seedTrack.key);
        if (Number.isFinite(dist)) {
          score -= (dist / 6) * 0.1;
        }
        return { track, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);
  };

  const selectNextTrack = ({ currentTrack }) => {
    const weights = { ...AUTOPLAY_WEIGHTS };
    const queuedId = popQueueTrackId();
    if (queuedId) {
      const picked = tracks.find((track) => track.id === queuedId) || null;
      const trace = {
        currentTrackId: currentTrack?.id ?? null,
        pickedTrackId: picked?.id ?? null,
        reason: "queue",
        rolledOrbit: null,
        weights,
        poolSizes: { rotation: 0, recent: 0, discovery: 0 },
        filtersApplied: { forceOff: 0, cooldownBlocked: 0, artistBlocked: 0 }
      };
      setOrbitHud(trace);
      window?.Hound?.logSelectionTrace?.(trace);
      return { track: picked, source: "queue", trace };
    }
    if (repeatMode === "one" && currentTrack) {
      const trace = {
        currentTrackId: currentTrack.id,
        pickedTrackId: currentTrack.id,
        reason: "repeat",
        rolledOrbit: null,
        weights,
        poolSizes: { rotation: 0, recent: 0, discovery: 0 },
        filtersApplied: { forceOff: 0, cooldownBlocked: 0, artistBlocked: 0 }
      };
      setOrbitHud(trace);
      window?.Hound?.logSelectionTrace?.(trace);
      return { track: currentTrack, source: "repeat", trace };
    }
    if (!isAutoplayEnabled()) {
      const trace = {
        currentTrackId: currentTrack?.id ?? null,
        pickedTrackId: null,
        reason: "autoplay_off",
        rolledOrbit: null,
        weights,
        poolSizes: { rotation: 0, recent: 0, discovery: 0 },
        filtersApplied: { forceOff: 0, cooldownBlocked: 0, artistBlocked: 0 }
      };
      setOrbitHud(trace);
      window?.Hound?.logSelectionTrace?.(trace);
      return null;
    }

    const cooldownIds = new Set(recentPlayedRef.current.slice(0, ORBIT_CONFIG.cooldownSize));
    const buckets = { rotation: [], recent: [], discovery: [] };
    let forceOffCount = 0;
    tracks.forEach((track) => {
      if (!track || track.id === currentTrack?.id) return;
      if (track.forceOff) {
        forceOffCount += 1;
        return;
      }
      const orbit = track.forceOn ? "rotation" : track.orbit || "discovery";
      if (!buckets[orbit]) return;
      buckets[orbit].push(track);
    });

    if (currentTrack && recommendationSeedId === currentTrack.id && recommendationCandidates.length > 0) {
      const discoveryCandidates = recommendationCandidates
        .map((candidate) => tracks.find((track) => track.id === candidate.trackId))
        .filter((track) => track && !track.forceOff && track.orbit === "discovery");
      if (discoveryCandidates.length > 0) {
        buckets.discovery = discoveryCandidates;
      }
    }

    const availableOrbits = Object.entries(buckets).filter(([, items]) => items.length > 0);
    if (availableOrbits.length === 0) {
      const trace = {
        currentTrackId: currentTrack?.id ?? null,
        pickedTrackId: null,
        reason: "fallback_none",
        rolledOrbit: null,
        weights,
        poolSizes: {
          rotation: buckets.rotation.length,
          recent: buckets.recent.length,
          discovery: buckets.discovery.length
        },
        filtersApplied: { forceOff: forceOffCount, cooldownBlocked: 0, artistBlocked: 0 }
      };
      setOrbitHud(trace);
      window?.Hound?.logSelectionTrace?.(trace);
      return null;
    }

    const totalWeight = availableOrbits.reduce(
      (sum, [key]) => sum + (AUTOPLAY_WEIGHTS[key] || 0),
      0
    );
    let pick = Math.random() * totalWeight;
    const rollPercent = totalWeight > 0 ? Math.round((pick / totalWeight) * 100) : 0;
    let chosenOrbit = availableOrbits[0][0];
    for (const [key] of availableOrbits) {
      pick -= AUTOPLAY_WEIGHTS[key] || 0;
      if (pick <= 0) {
        chosenOrbit = key;
        break;
      }
    }

    const bucket = buckets[chosenOrbit];
    const sameArtist = currentTrack?.artist;
    const withoutCooldown = bucket.filter((track) => !cooldownIds.has(track.id));
    const withoutArtist = withoutCooldown.filter((track) => track.artist !== sameArtist);
    const pool = withoutArtist.length > 0 ? withoutArtist : withoutCooldown.length > 0 ? withoutCooldown : bucket;
    if (pool.length === 0) {
      const trace = {
        currentTrackId: currentTrack?.id ?? null,
        pickedTrackId: null,
        reason: "fallback_empty_pool",
        rolledOrbit: chosenOrbit,
        weights,
        poolSizes: {
          rotation: buckets.rotation.length,
          recent: buckets.recent.length,
          discovery: buckets.discovery.length
        },
        filtersApplied: { forceOff: forceOffCount, cooldownBlocked: 0, artistBlocked: 0 }
      };
      setOrbitHud(trace);
      window?.Hound?.logSelectionTrace?.(trace);
      return null;
    }
    const savedPool = pool.filter((track) => track.saved);
    const finalPool = savedPool.length > 0 ? savedPool : pool;
    const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];
    if (currentTrack && chosen) {
      lastRecommendationRef.current = {
        seedTrackId: currentTrack.id,
        recommendedTrackId: chosen.id
      };
    }
    const cooldownBlocked = bucket.length - withoutCooldown.length;
    const artistBlocked = withoutCooldown.length - withoutArtist.length;
    const trace = {
      currentTrackId: currentTrack?.id ?? null,
      pickedTrackId: chosen?.id ?? null,
      reason: `orbit_roll_${rollPercent}%`,
      rolledOrbit: chosenOrbit,
      weights,
      poolSizes: {
        rotation: buckets.rotation.length,
        recent: buckets.recent.length,
        discovery: buckets.discovery.length
      },
      filtersApplied: {
        forceOff: forceOffCount,
        cooldownBlocked,
        artistBlocked
      }
    };
    setOrbitHud(trace);
    window?.Hound?.logSelectionTrace?.(trace);
    return { track: chosen, source: "autoplay", trace };
  };

  const goBack = () => {
    const history = navHistoryRef.current;
    if (history.length <= 1) return;
    history.pop();
    const prev = history[history.length - 1];
    navSkipRef.current = true;
    setScreen(prev);
  };

  const appendPlayTelemetry = (trackId, telemetry) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        const history = Array.isArray(track.playHistory) ? track.playHistory : [];
        const nextHistory = [telemetry, ...history].slice(0, 20);
        return { ...track, playHistory: nextHistory };
      })
    );
  };

  const applyRotationRules = (trackId, telemetry) => {
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        const rotationOverride = track.rotationOverride ?? "none";
        const nextPlayCount = (Number.isFinite(track.playCountTotal) ? track.playCountTotal : 0) + 1;
        const history = Array.isArray(track.playHistory) ? track.playHistory : [];
        const recent = [telemetry, ...history].slice(0, ROTATION_DECAY_WINDOW);
        const recentEarlySkips = recent.filter((entry) => entry.skipped_early).length;
        let rotationScore = Number.isFinite(track.rotationScore) ? track.rotationScore : 0;
        let positiveDelta = 0;
        let negativeDelta = 0;
        if (!telemetry.skipped_early && telemetry.percent_listened >= ROTATION_EARN_THRESHOLD) {
          positiveDelta += 20;
        }
        if (telemetry.completed_play) {
          positiveDelta += 10;
        }
        if (telemetry.replayed_same_session > 0) {
          positiveDelta += 10;
        }
        if (telemetry.skipped_early) {
          negativeDelta -= 30;
        } else if (telemetry.manual_skip && telemetry.percent_listened < 0.3) {
          negativeDelta -= 15;
        }
        rotationScore = Math.min(100, Math.max(0, rotationScore + positiveDelta + negativeDelta));
        let rotation = !!track.rotation;
        if (rotationOverride === "force_on") {
          rotation = true;
        } else if (rotationOverride === "force_off") {
          rotation = false;
        } else if (nextPlayCount >= 2) {
          if (rotationScore >= 60) {
            rotation = true;
          }
          if (rotationScore <= 35) {
            rotation = false;
          }
        }
        if (rotation && rotationOverride === "none" && recentEarlySkips >= ROTATION_DECAY_SKIPS) {
          rotation = false;
        }
        return {
          ...track,
          rotation,
          rotationScore,
          lastPositiveListenAt: positiveDelta > 0 ? telemetry.play_end_time : track.lastPositiveListenAt ?? null,
          lastNegativeListenAt: negativeDelta < 0 ? telemetry.play_end_time : track.lastNegativeListenAt ?? null,
          rotationOverride,
          playCountTotal: nextPlayCount
        };
      })
    );
  };

  const finalizePlay = ({ manualSkip, autoAdvance, endReason }) => {
    if (!selectedTrack) return;
    const start = playStartRef.current;
    if (!start || start.trackId !== selectedTrack.id) return;
    const endTime = new Date().toISOString();
    const totalDuration = Number.isFinite(duration) ? duration : 0;
    const listenedSeconds = Math.max(0, Number(currentTime) || 0);
    const percent = totalDuration > 0 ? Math.min(listenedSeconds / totalDuration, 1) : 0;
    const completed = percent >= 0.98 || (autoAdvance && percent >= 0.9);
    const skippedEarly = !!manualSkip && percent < ROTATION_EARN_THRESHOLD;
    const derivedEndReason = endReason
      || (completed ? "finished" : manualSkip ? "skipped" : autoAdvance ? "next" : "stopped");
    const count = sessionPlayCountsRef.current[selectedTrack.id] || 1;
    const telemetry = {
      eventId: `${selectedTrack.cloudTrackId || selectedTrack.id}:${start.play_start_time}:${endTime}`,
      play_start_time: start.play_start_time,
      play_end_time: endTime,
      play_duration_seconds: Number(listenedSeconds.toFixed(1)),
      track_total_duration: Number(totalDuration.toFixed(1)),
      percent_listened: Number(percent.toFixed(3)),
      skipped_early: skippedEarly,
      replayed_same_session: Math.max(0, count - 1),
      completed_play: completed,
      manual_skip: !!manualSkip,
      auto_advance: !!autoAdvance,
      timestamp: start.play_start_time
    };
    appendPlayTelemetry(selectedTrack.id, telemetry);
    applyRotationRules(selectedTrack.id, telemetry);
    const report = window?.Hound?.reportRecommendationSignal;
    if (typeof report === "function") {
      const source = playSourceRef.current?.source || "library";
      const seedTrackId = playSourceRef.current?.seedTrackId || null;
      report({
        trackId: selectedTrack.id,
        seedTrackId,
        source,
        signal: completed ? "positive" : skippedEarly ? "negative" : null,
        earlySkip: skippedEarly,
        completed,
        replayed: telemetry.replayed_same_session > 0,
        regret: source === "recommendation" && skippedEarly && percent < 0.2
      });
    }
    const logEvent = window?.Hound?.logPlaybackEvent;
    if (typeof logEvent === "function") {
      logEvent({
        trackId: selectedTrack.id,
        startedAt: start.play_start_time,
        endedAt: endTime,
        listenedSec: Number(listenedSeconds.toFixed(1)),
        completionPct: Number(percent.toFixed(3)),
        endReason: derivedEndReason,
        context: playContextRef.current
      }).then((result) => {
        if (result?.orbit) {
          setTracks((prev) =>
            prev.map((track) =>
              track.id === selectedTrack.id
                ? {
                  ...track,
                  orbit: result.orbit.orbit,
                  evidenceScore: result.orbit.evidenceScore ?? track.evidenceScore,
                  lastPositiveListenAt: result.orbit.lastPositiveListenAt ?? track.lastPositiveListenAt,
                  lastNegativeListenAt: result.orbit.lastNegativeAt ?? track.lastNegativeListenAt,
                  rotation: result.orbit.orbit === "rotation"
                }
                : track
            )
          );
        }
      });
    }

    if (cloudToken && selectedTrack.cloudTrackId) {
      const cloudTrackId = selectedTrack.cloudTrackId;
      const cloudEventType = completed ? "complete" : skippedEarly ? "skip" : null;
      if (cloudEventType) {
        cloudRequest(
          "/v1/listener/telemetry/events",
          {
            method: "POST",
            body: JSON.stringify({
              events: [
                {
                  eventId: `${cloudTrackId}:${cloudEventType}:${Math.floor(Date.now() / 1000)}`,
                  trackId: cloudTrackId,
                  eventType: cloudEventType,
                  eventTime: endTime,
                  payload: { percentListened: Number((percent * 100).toFixed(2)) }
                }
              ]
            })
          },
          true
        ).catch(() => {});
      }

      cloudRequest(
        "/v1/listener/telemetry/plays",
        {
          method: "POST",
          body: JSON.stringify({
            events: [
              {
                eventId: telemetry.eventId,
                trackId: cloudTrackId,
                playStartTime: telemetry.play_start_time,
                playEndTime: telemetry.play_end_time,
                percentListened: Number((telemetry.percent_listened * 100).toFixed(2)),
                skippedEarly: telemetry.skipped_early,
                replayedSameSession: telemetry.replayed_same_session,
                completedPlay: telemetry.completed_play,
                manualSkip: telemetry.manual_skip,
                autoAdvance: telemetry.auto_advance
              }
            ]
          })
        },
        true
      ).catch(() => {});
    }
    playStartRef.current = null;
  };

  const goToContextIndex = (ids, index) => {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    if (index < 0 || index >= ids.length) return false;
    const id = ids[index];
    const trackIndex = tracks.findIndex((track) => track.id === id);
    if (trackIndex >= 0) {
      goToTrack(trackIndex);
      return true;
    }
    return false;
  };

  const getNextInContext = () => {
    const effectiveContext = getEffectiveContext();
    const ids = getContextTrackIds(effectiveContext);
    const currentIdx = ids.indexOf(selectedTrack?.id);
    const useShuffle = effectiveContext.shuffle || (effectiveContext.type === "library" && shuffleOn);
    if (useShuffle && ids.length > 1) {
      const plan = ensureShufflePlan(effectiveContext, selectedTrack?.id);
      if (plan.index < plan.list.length - 1) {
        plan.index += 1;
        return plan.list[plan.index] || null;
      }
      if (repeatMode === "all") {
        shufflePlanRef.current = { list: [], index: -1, contextKey: "" };
        const refreshed = ensureShufflePlan(effectiveContext, selectedTrack?.id);
        if (refreshed.list.length > 0) {
          refreshed.index = 0;
          return refreshed.list[0] || null;
        }
      }
      return null;
    }
    if (currentIdx >= 0 && currentIdx < ids.length - 1) {
      return ids[currentIdx + 1];
    }
    if (repeatMode === "all" && ids.length > 0) {
      return ids[0];
    }
    return null;
  };

  const handleNext = (options = {}) => {
    if (!selectedTrack || !getActiveAudio()) return;
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    const { fromEnded = false, manual = false } = options;
    const audio = getActiveAudio();
    if (!fromEnded && audio.currentTime < 30) {
      session.markSkip();
    }
    finalizePlay({ manualSkip: !fromEnded, autoAdvance: fromEnded });
    if (playbackContext.type === "queue" && queueRef.current.length === 0) {
      setContext(lastNonQueueContextRef.current);
    }
    if (fromEnded && !isAutoplayEnabled()) {
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      return;
    }
    if (manual) {
      lastRecommendationRef.current = null;
      const queuedId = popQueueTrackId();
      if (queuedId) {
        playContextRef.current = "queue";
        const queuedIndex = tracks.findIndex((track) => track.id === queuedId);
        if (queuedIndex >= 0) {
          setContext({ type: "queue", label: "Queue" });
          goToTrack(queuedIndex);
          return;
        }
      }
      playContextRef.current = "manual";
      const nextId = getNextInContext();
      if (nextId) {
        const nextIndex = tracks.findIndex((track) => track.id === nextId);
        if (nextIndex >= 0) {
          goToTrack(nextIndex);
          return;
        }
      }
    } else {
      const selection = selectNextTrack({ currentTrack: selectedTrack });
      if (!selection) {
        playContextRef.current = "autoplay";
        return;
      }
      if (selection?.track) {
        if (selection.source === "queue") {
          playContextRef.current = "queue";
          setContext({ type: "queue", label: "Queue" });
        }
        if (selection.source === "repeat") {
          playContextRef.current = "autoplay";
          audio.currentTime = 0;
          audio
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => {
              setError("Could not play this file.");
              setIsPlaying(false);
            });
          return;
        }
        playContextRef.current = "autoplay";
        const nextIndex = tracks.findIndex((track) => track.id === selection.track.id);
        if (nextIndex >= 0) {
          goToTrack(nextIndex);
          return;
        }
      }
    }
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (pendingNextRef.current) {
      clearTimeout(pendingNextRef.current);
      pendingNextRef.current = null;
    }
    finalizePlay({ manualSkip: true, autoAdvance: false, endReason: "stopped" });
    stopAllAudio();
    setCurrentTime(0);
    setIsPlaying(false);
    if (settings.stopEndsSession) {
      const payload = session.endSession();
      setRecap(payload);
      sessionPlayCountsRef.current = {};
      const historyEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: new Date().toISOString(),
        mode: sessionMode,
        payload
      };
      setSessionHistory((prev) => [historyEntry, ...prev]);
      setLastSession((prev) => ({
        ...prev,
        lastTrackId: selectedTrackId,
        queue: queueRef.current,
        mode: sessionMode
      }));
    }
  };

  const handleImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const openAudioFiles = window?.Hound?.openAudioFiles;
      if (typeof openAudioFiles !== "function") {
        console.warn("[Hound] window.Hound.openAudioFiles is unavailable.");
        setImportError("Import is unavailable in this mode. Use the Electron app.");
        return;
      }
      const result = await openAudioFiles();
      if (!Array.isArray(result) || result.length === 0) return;
      setImportError("");
      setTracks((prev) => {
        const existingPaths = new Set(prev.map((track) => track.path));
        const existingIds = new Set(prev.map((track) => track.id));
        const additions = result
          .map((item) => {
            if (typeof item === "string") {
              return { path: item, trackId: item };
            }
            if (item && typeof item === "object") {
              return {
                path: item.path,
                trackId: item.trackId || item.id || item.contentHash || item.path,
                contentHash: item.contentHash,
                fileSize: item.fileSize,
                mtimeMs: item.mtimeMs
              };
            }
            return null;
          })
          .filter((item) => item && typeof item.path === "string" && item.path.trim().length > 0)
          .filter((item) => !existingPaths.has(item.path) && !existingIds.has(item.trackId))
          .map((item) => {
            const { title, artist } = parseTrackMeta(item.path);
            return {
              id: item.trackId,
              path: item.path,
              title,
              artist,
              contentHash: item.contentHash,
              fileSize: item.fileSize,
              mtimeMs: item.mtimeMs,
              album: null,
              durationSec: null,
              rotation: false,
              rotationManual: null,
              saved: false,
              rotationScore: 0,
              lastPositiveListenAt: null,
              lastNegativeListenAt: null,
              rotationOverride: "none",
              playCountTotal: 0,
              playHistory: [],
              gain: 1,
              loudnessReady: false,
              analysisStatus: "queued",
              loudnessLUFS: null,
              bpm: null,
              key: null,
              mode: null,
              orbit: "discovery",
              evidenceScore: 0,
              forceOn: false,
              forceOff: false
            };
          });
        const next = [...prev, ...additions];
        if (selectedTrackId === null && additions.length > 0) {
          setSelectedTrackId(additions[0].id);
        }
        saveLibraryTracks(next);
        queueAnalysisForTracks(additions);
        refreshTrackFeatures(additions.map((track) => track.id));
        return next;
      });
    } finally {
      setImporting(false);
    }
  };

  const redeemInvite = async () => {
    if (authBusy) return;
    const code = inviteCode.trim();
    if (!code) {
      setAuthError("Invite code required.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const deviceId = getDeviceId();
      const label = inviteLabel.trim();
      const res = await fetch(REDEEM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`
        },
        body: JSON.stringify({ inviteCode: code, deviceId, label })
      });
      const data = await res.json();
      if (!data || !data.token) {
        setAuthState({ status: "unauth", message: "" });
        setAuthError(data?.error || "Invite rejected.");
        setAuthBusy(false);
        return;
      }
      const expiresAt = Number(data.expiresAt) || Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem("Hound.token", data.token);
      localStorage.setItem("Hound.tokenExpires", String(expiresAt));
      setAuthState({ status: "authed", message: "" });
    } catch {
      setAuthState({ status: "unauth", message: "" });
      setAuthError("Could not reach access server.");
    } finally {
      setAuthBusy(false);
    }
  };

  const clearLibrary = () => {
    window?.Hound?.clearLibrary?.();
    setTracks([]);
    setSelectedTrackId(null);
    setScreen("library");
    setIsPlaying(false);
    setQueue([]);
    setRecommendationCandidates([]);
    setRecommendationSeedId(null);
    setImportError("");
    stopAllAudio();
    setCurrentTime(0);
    setDuration(0);
  };

  const handleRowClick = (trackId, contextOverride = null) => {
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index === -1) return;
    lastRecommendationRef.current = null;
    playContextRef.current = "manual";
    const baseContext = contextOverride || {
      type: "library",
      id: null,
      label: "Library",
      shuffle: shuffleOn,
      trackIds: tracks.map((track) => track.id)
    };
    setContext(baseContext);
    shufflePlanRef.current = { list: [], index: -1, contextKey: "" };
    if (baseContext.shuffle || (baseContext.type === "library" && shuffleOn)) {
      shufflePlanRef.current = { list: [trackId], index: 0 };
    }
    goToTrack(index);
  };

  const queueTrackNext = (trackId) => {
    if (!trackId) return;
    setQueue((prev) => [...prev, trackId]);
  };

  const toggleRotation = () => {
    if (!selectedTrack) return;
    const nextForceOn = !selectedTrack.forceOn;
    const nextForceOff = false;
    window?.Hound?.updateTrackPrefs?.({
      trackId: selectedTrack.id,
      forceOn: nextForceOn,
      forceOff: nextForceOff,
      saved: selectedTrack.saved
    });
    setTracks((prev) =>
      prev.map((track) =>
        track.id === selectedTrack.id
          ? {
            ...track,
            forceOn: nextForceOn,
            forceOff: nextForceOff,
            rotation: nextForceOn,
            rotationManual: true,
            rotationOverride: nextForceOn ? "force_on" : "none",
            orbit: nextForceOn ? "rotation" : track.orbit
          }
          : track
      )
    );
  };

  const toggleSave = () => {
    if (!selectedTrack) return;
    const nextSaved = !selectedTrack.saved;
    window?.Hound?.updateTrackPrefs?.({
      trackId: selectedTrack.id,
      forceOn: selectedTrack.forceOn,
      forceOff: selectedTrack.forceOff,
      saved: nextSaved
    });
    setTracks((prev) =>
      prev.map((track) =>
        track.id === selectedTrack.id ? { ...track, saved: !track.saved } : track
      )
    );
    syncCloudSave(selectedTrack, nextSaved);
  };

  const setRotationOverrideFor = (trackId, override) => {
    const target = tracks.find((track) => track.id === trackId);
    const forceOn = override === "force_on";
    const forceOff = override === "force_off";
    if (target) {
      window?.Hound?.updateTrackPrefs?.({
        trackId,
        forceOn,
        forceOff,
        saved: target.saved
      });
    }
    setTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        if (override === "force_on") {
          return {
            ...track,
            rotation: true,
            rotationManual: true,
            rotationOverride: "force_on",
            forceOn: true,
            forceOff: false,
            orbit: "rotation"
          };
        }
        if (override === "force_off") {
          return {
            ...track,
            rotation: false,
            rotationManual: false,
            rotationOverride: "force_off",
            forceOn: false,
            forceOff: true,
            orbit: "discovery"
          };
        }
        return {
          ...track,
          rotationManual: null,
          rotationOverride: "none",
          forceOn: false,
          forceOff: false
        };
      })
    );
  };

  const toggleRotationFor = (trackId) => {
    const target = tracks.find((track) => track.id === trackId);
    const nextForceOn = target ? !target.forceOn : true;
    const nextForceOff = false;
    if (target) {
      window?.Hound?.updateTrackPrefs?.({
        trackId,
        forceOn: nextForceOn,
        forceOff: nextForceOff,
        saved: target.saved
      });
    }
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId
          ? {
            ...track,
            forceOn: nextForceOn,
            forceOff: nextForceOff,
            rotation: nextForceOn,
            rotationManual: true,
            rotationOverride: nextForceOn ? "force_on" : "none",
            orbit: nextForceOn ? "rotation" : track.orbit
          }
          : track
      )
    );
  };

  const toggleSaveFor = (trackId) => {
    const target = tracks.find((track) => track.id === trackId);
    if (target) {
      window?.Hound?.updateTrackPrefs?.({
        trackId,
        forceOn: target.forceOn,
        forceOff: target.forceOff,
        saved: !target.saved
      });
    }
    setTracks((prev) =>
      prev.map((track) =>
        track.id === trackId ? { ...track, saved: !track.saved } : track
      )
    );
    if (target) {
      syncCloudSave(target, !target.saved);
    }
  };

  const openRotationMenu = (trackId, event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setRotationMenu({
      trackId,
      x: rect.left,
      y: rect.bottom + 6
    });
  };

  const openContextMenu = (trackId, event) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      trackId,
      x: event.clientX,
      y: event.clientY,
      rotationOpen: false
    });
  };

  const formatTime = (value) => {
    if (!Number.isFinite(value) || value < 0) return "0:00";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const handleScrubStart = () => {
    setIsSeeking(true);
  };

  const handleScrubChange = (event) => {
    const nextValue = Number(event.target.value);
    if (!Number.isFinite(nextValue)) return;
    setCurrentTime(nextValue);
  };

  const handleScrubEnd = () => {
    const audio = getActiveAudio();
    if (!audio) {
      setIsSeeking(false);
      return;
    }
    audio.currentTime = currentTime;
    setIsSeeking(false);
  };

  const toggleShuffle = () => {
    const nextShuffle = !shuffleOn;
    setShuffleOn(nextShuffle);
    shufflePlanRef.current = { list: [], index: -1, contextKey: "" };
    if (nextShuffle && selectedTrack) {
      shufflePlanRef.current = { list: [selectedTrack.id], index: 0 };
    }
    setContext({
      type: "library",
      id: null,
      label: "Library",
      shuffle: nextShuffle,
      trackIds: tracks.map((track) => track.id)
    });
  };
  const toggleRepeatMode = () => {
    setRepeatMode((prev) => (prev === "off" ? "all" : prev === "all" ? "one" : "off"));
  };


  const moveQueueItem = (index, direction) => {
    setQueue((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const moveQueueItemTo = (fromIndex, toIndex) => {
    setQueue((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length) return prev;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      if (fromIndex === toIndex) return prev;
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const removeQueueItem = (index) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearQueue = () => {
    setQueue([]);
  };

  const queueItems = useMemo(() => {
    return queue
      .map((id) => tracks.find((track) => track.id === id))
      .filter(Boolean);
  }, [queue, tracks]);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );

  const createPlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPlaylists((prev) => [...prev, { id, name, trackIds: [] }]);
    setSelectedPlaylistId(id);
    setNewPlaylistName("");
    setCreatingPlaylist(false);
  };

  useEffect(() => {
    if (!selectedPlaylistId) return;
    setLastSession((prev) => ({
      ...prev,
      playlistId: selectedPlaylistId,
      mode: sessionMode
    }));
  }, [selectedPlaylistId, sessionMode]);

  const openAlbum = (name) => {
    if (!name) return;
    setActiveAlbum(name);
    setScreen("album");
  };

  const openArtist = (name) => {
    if (!name) return;
    setActiveArtist(name);
    setScreen("artist");
  };

  const resumeLastSession = (mode) => {
    if (!lastSession || !lastSession.lastTrackId) return;
    const index = tracks.findIndex((track) => track.id === lastSession.lastTrackId);
    if (index === -1) return;
    setSessionMode(mode);
    setQueue(Array.isArray(lastSession.queue) ? lastSession.queue : []);
    goToTrack(index);
  };

  const continueQueue = () => {
    if (!lastSession || !Array.isArray(lastSession.queue)) return;
    setQueue(lastSession.queue);
  };

  const continuePlaylist = () => {
    if (!lastSession || !lastSession.playlistId) return;
    setSelectedPlaylistId(lastSession.playlistId);
    setScreen("playlist");
  };

  const playAlbum = () => {
    if (albumTracks.length === 0) return;
    const trackIds = albumTracks.map((track) => track.id);
    const index = tracks.findIndex((track) => track.id === albumTracks[0].id);
    if (index >= 0) {
      setContext({
        type: "album",
        id: activeAlbum,
        name: activeAlbum,
        label: `Album: ${activeAlbum || "Unknown Album"}`,
        shuffle: false,
        trackIds
      });
      goToTrack(index);
    }
  };

  const shuffleAlbum = () => {
    if (albumTracks.length === 0) return;
    const trackIds = albumTracks.map((track) => track.id);
    const pick = albumTracks[Math.floor(Math.random() * albumTracks.length)];
    const index = tracks.findIndex((track) => track.id === pick.id);
    if (index >= 0) {
      setContext({
        type: "album",
        id: activeAlbum,
        name: activeAlbum,
        label: `Album: ${activeAlbum || "Unknown Album"}`,
        shuffle: true,
        trackIds
      });
      shufflePlanRef.current = { list: [pick.id], index: 0 };
      goToTrack(index);
    }
  };

  const addAlbumToPlaylist = () => {
    if (!albumPlaylistId || albumTracks.length === 0) return;
    albumTracks.forEach((track) => addTrackToPlaylist(albumPlaylistId, track.id));
  };

  const playArtist = () => {
    if (artistTracks.length === 0) return;
    const trackIds = artistTracks.map((track) => track.id);
    const index = tracks.findIndex((track) => track.id === artistTracks[0].id);
    if (index >= 0) {
      setContext({
        type: "artist",
        id: activeArtist,
        name: activeArtist,
        label: `Artist: ${activeArtist || "Unknown Artist"}`,
        shuffle: false,
        trackIds
      });
      goToTrack(index);
    }
  };

  const shuffleArtist = () => {
    if (artistTracks.length === 0) return;
    const trackIds = artistTracks.map((track) => track.id);
    const pick = artistTracks[Math.floor(Math.random() * artistTracks.length)];
    const index = tracks.findIndex((track) => track.id === pick.id);
    if (index >= 0) {
      setContext({
        type: "artist",
        id: activeArtist,
        name: activeArtist,
        label: `Artist: ${activeArtist || "Unknown Artist"}`,
        shuffle: true,
        trackIds
      });
      shufflePlanRef.current = { list: [pick.id], index: 0 };
      goToTrack(index);
    }
  };

  const addArtistToPlaylist = () => {
    if (!artistPlaylistId || artistTracks.length === 0) return;
    artistTracks.forEach((track) => addTrackToPlaylist(artistPlaylistId, track.id));
  };

  const playPlaylist = () => {
    if (!selectedPlaylist || selectedPlaylist.trackIds.length === 0) return;
    const trackIds = selectedPlaylist.trackIds;
    const firstId = trackIds[0];
    const index = tracks.findIndex((track) => track.id === firstId);
    if (index >= 0) {
      setContext({
        type: "playlist",
        id: selectedPlaylist.id,
        name: selectedPlaylist.name,
        label: `Playlist: ${selectedPlaylist.name}`,
        shuffle: false,
        trackIds
      });
      goToTrack(index);
    }
  };

  const shufflePlaylist = () => {
    if (!selectedPlaylist || selectedPlaylist.trackIds.length === 0) return;
    const trackIds = selectedPlaylist.trackIds;
    const pickId = trackIds[Math.floor(Math.random() * trackIds.length)];
    const index = tracks.findIndex((track) => track.id === pickId);
    if (index >= 0) {
      setContext({
        type: "playlist",
        id: selectedPlaylist.id,
        name: selectedPlaylist.name,
        label: `Playlist: ${selectedPlaylist.name}`,
        shuffle: true,
        trackIds
      });
      shufflePlanRef.current = { list: [pickId], index: 0 };
      goToTrack(index);
    }
  };

  const addTrackToPlaylist = (playlistId, trackId) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        if (playlist.trackIds.includes(trackId)) return playlist;
        return { ...playlist, trackIds: [...playlist.trackIds, trackId] };
      })
    );
  };

  const removeTrackFromPlaylist = (playlistId, trackId) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        return {
          ...playlist,
          trackIds: playlist.trackIds.filter((id) => id !== trackId)
        };
      })
    );
  };

  const deletePlaylist = (playlistId) => {
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== playlistId));
    if (selectedPlaylistId === playlistId) {
      setSelectedPlaylistId(null);
    }
  };

  const startEditPlaylist = (playlist) => {
    setEditingPlaylistId(playlist.id);
    setEditingPlaylistName(playlist.name);
  };

  const cancelEditPlaylist = () => {
    setEditingPlaylistId(null);
    setEditingPlaylistName("");
  };

  const saveEditPlaylist = () => {
    if (!editingPlaylistId) return;
    const nextName = editingPlaylistName.trim();
    if (!nextName) return;
    setPlaylists((prev) =>
      prev.map((playlist) =>
        playlist.id === editingPlaylistId ? { ...playlist, name: nextName } : playlist
      )
    );
    if (playbackContext.type === "playlist" && playbackContext.id === editingPlaylistId) {
      setContext({
        ...playbackContext,
        name: nextName,
        label: `Playlist: ${nextName}`
      });
    }
    setEditingPlaylistId(null);
    setEditingPlaylistName("");
  };

  const cloudRequest = async (path, options = {}, requireAuth = false, allowRefresh = true) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (requireAuth) {
      if (!cloudToken) throw new Error("No cloud token. Login first.");
      headers.Authorization = `Bearer ${cloudToken}`;
    }
    if (API_MODE === "mock") {
      return mockListenerRequest(path, { ...options, headers });
    }
    const response = await fetch(`${API_V1_BASE}${path}`, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (requireAuth && allowRefresh && response.status === 401 && cloudRefreshToken) {
        const refreshed = await refreshCloudToken();
        if (refreshed) {
          return cloudRequest(path, options, requireAuth, false);
        }
      }
      throw new Error(payload.error || `Cloud request failed (${response.status})`);
    }
    return payload;
  };

  const refreshCloudToken = async () => {
    if (!cloudRefreshToken) return false;
    try {
      const result = await cloudRequest(
        "/v1/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken: cloudRefreshToken })
        },
        false,
        false
      );
      setCloudToken(result.accessToken || "");
      setCloudRefreshToken(result.refreshToken || "");
      return true;
    } catch {
      setCloudToken("");
      setCloudRefreshToken("");
      setCloudRole(null);
      return false;
    }
  };

  const loadCloudMe = async () => {
    const me = await cloudRequest("/v1/auth/me", { method: "GET" }, true);
    setCloudRole(me.role || null);
    return me;
  };

  const loginCloud = async () => {
    setCloudBusy(true);
    setCloudError("");
    setCloudMessage("");
    try {
      const result = await cloudRequest("/v1/auth/listener/login", {
        method: "POST",
        body: JSON.stringify({ email: cloudEmail, password: cloudPassword })
      });
      setCloudToken(result.accessToken || "");
      setCloudRefreshToken(result.refreshToken || "");
      const me = await loadCloudMe();
      setCloudMessage(`Cloud login ok (${result.userId})`);
      if (me?.role) setCloudMessage(`Cloud login ok (${result.userId}, role: ${me.role})`);
    } catch (err) {
      setCloudError(err.message);
    } finally {
      setCloudBusy(false);
    }
  };

  const logoutCloud = async () => {
    setCloudBusy(true);
    setCloudError("");
    setCloudMessage("");
    try {
      if (cloudToken) {
        await cloudRequest("/v1/auth/logout", { method: "POST" }, true, false);
      }
      setCloudToken("");
      setCloudRefreshToken("");
      setCloudRole(null);
      setCloudMessage("Cloud session cleared.");
    } catch (err) {
      setCloudError(err.message);
    } finally {
      setCloudBusy(false);
    }
  };

  const loadCloudHome = async () => {
    setCloudBusy(true);
    setCloudError("");
    try {
      const home = await cloudRequest("/v1/listener/home");
      setCloudHome(home);
      setCloudMessage("Loaded cloud home rails.");
    } catch (err) {
      setCloudError(err.message);
    } finally {
      setCloudBusy(false);
    }
  };

  const loadCloudAlbum = async (albumId) => {
    setCloudBusy(true);
    setCloudError("");
    try {
      const album = await cloudRequest(`/v1/listener/albums/${albumId}`);
      setCloudAlbum(album);
      setCloudMessage(`Loaded album: ${album.album?.title || albumId}`);
    } catch (err) {
      setCloudError(err.message);
    } finally {
      setCloudBusy(false);
    }
  };

  const resolveCloudStream = async (trackId) => {
    setCloudBusy(true);
    setCloudError("");
    try {
      const stream = await cloudRequest(`/v1/listener/tracks/${trackId}/stream`);
      setCloudStreamInfo(stream);
      setCloudMessage(`Resolved stream for track ${trackId}`);
    } catch (err) {
      setCloudError(err.message);
    } finally {
      setCloudBusy(false);
    }
  };

  const syncCloudSave = async (track, saved) => {
    if (!cloudToken || !track?.cloudTrackId) return;
    try {
      await cloudRequest(
        `/v1/listener/tracks/${track.cloudTrackId}/save`,
        {
          method: "POST",
          body: JSON.stringify({ saved })
        },
        true
      );
    } catch {
      // best effort sync in v0.1
    }
  };

  const upsertCloudTrack = (track, streamUrl = null, albumMeta = null) => {
    const cloudId = `cloud:${track.trackId}`;
    const album = albumMeta?.title || cloudAlbum?.album?.title || "Cloud Album";
    const artist = albumMeta?.artistName || cloudAlbum?.album?.artistName || "Cloud Artist";
    let finalTrack = null;
    setTracks((prev) => {
      const existing = prev.find((item) => item.id === cloudId);
      const next = {
        ...(existing || {}),
        id: cloudId,
        cloudTrackId: track.trackId,
        title: track.title || existing?.title || "Cloud Track",
        artist,
        album,
        path: existing?.path || "",
        remoteUrl: streamUrl || existing?.remoteUrl || null,
        durationSec: track.durationSec || existing?.durationSec || null,
        saved: existing?.saved || false,
        rotation: existing?.rotation || false,
        rotationOverride: existing?.rotationOverride || "none",
        rotationScore: existing?.rotationScore || 0,
        playCountTotal: existing?.playCountTotal || 0,
        playHistory: Array.isArray(existing?.playHistory) ? existing.playHistory : [],
        analysisStatus: existing?.analysisStatus || "complete",
        loudnessLUFS: existing?.loudnessLUFS || null,
        gain: existing?.gain || 1,
        loudnessReady: true,
        forceOn: existing?.forceOn || false,
        forceOff: existing?.forceOff || false
      };
      finalTrack = next;
      if (existing) {
        return prev.map((item) => (item.id === cloudId ? next : item));
      }
      return [next, ...prev];
    });
    return finalTrack;
  };

  const playCloudTrack = async (track) => {
    setCloudBusy(true);
    setCloudError("");
    try {
      const stream = await cloudRequest(`/v1/listener/tracks/${track.trackId}/stream`);
      setCloudStreamInfo(stream);
      const localTrack = upsertCloudTrack(track, stream.manifestUrl, cloudAlbum?.album || null);
      if (localTrack) {
        setContext({ type: "cloud_album", label: `Cloud Album: ${cloudAlbum?.album?.title || "Unknown"}`, trackIds: [localTrack.id] });
        setSelectedTrackId(localTrack.id);
        loadAndPlay(localTrack);
      }
    } catch (err) {
      setCloudError(err.message);
    } finally {
      setCloudBusy(false);
    }
  };

  const queueCloudTrack = async (track) => {
    setCloudBusy(true);
    setCloudError("");
    try {
      const stream = await cloudRequest(`/v1/listener/tracks/${track.trackId}/stream`);
      const localTrack = upsertCloudTrack(track, stream.manifestUrl, cloudAlbum?.album || null);
      if (localTrack) {
        setQueue((prev) => [...prev, localTrack.id]);
        setCloudMessage(`Queued remote track: ${track.title}`);
      }
    } catch (err) {
      setCloudError(err.message);
    } finally {
      setCloudBusy(false);
    }
  };

  useEffect(() => {
    if (!cloudToken) return;
    loadCloudMe().catch(() => {
      setCloudToken("");
      setCloudRefreshToken("");
      setCloudRole(null);
    });
  }, [cloudToken]);

  const activeScreen = screen === "player" ? "player" : "library";
  const activePage =
    screen === "queue"
      ? "queue"
      : screen === "playlist"
        ? "playlist"
        : screen === "search"
          ? "search"
          : screen === "history"
            ? "history"
            : screen === "settings"
              ? "settings"
              : screen === "album"
                ? "album"
                : screen === "artist"
                  ? "artist"
                : screen === "home"
                    ? "home"
                    : activeScreen;
  const viewTitle =
    activePage === "home"
      ? "Home"
      : activePage === "library"
        ? "Library"
        : activePage === "search"
          ? "Search"
          : activePage === "playlist"
            ? "Playlists"
            : activePage === "settings"
              ? "Settings"
              : activePage === "player"
                ? "Now Playing"
                : activePage === "queue"
                  ? "Queue"
                  : activePage === "album"
                    ? "Album"
                    : activePage === "artist"
                      ? "Artist"
                      : "Library";
  const rotationTracks = useMemo(() => tracks.filter((track) => track.rotation), [tracks]);
  const savedTracks = useMemo(() => tracks.filter((track) => track.saved), [tracks]);
  const recentTracks = useMemo(() => {
    return [...tracks]
      .map((track) => ({
        track,
        lastPlayed: track.playHistory?.[0]?.play_end_time || ""
      }))
      .filter((entry) => entry.lastPlayed)
      .sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed))
      .map((entry) => entry.track);
  }, [tracks]);
  const discoveryTracks = useMemo(
    () => tracks.filter((track) => (track.playCountTotal || 0) === 0),
    [tracks]
  );
  const query = searchQuery.trim().toLowerCase();
  const searchTracks = query
    ? tracks.filter(
        (track) =>
          track.title.toLowerCase().includes(query) ||
          track.artist.toLowerCase().includes(query) ||
          getAlbumName(track).toLowerCase().includes(query)
      )
    : [];
  const searchPlaylists = query
    ? playlists.filter((playlist) => playlist.name.toLowerCase().includes(query))
    : [];
  const searchArtists = query
    ? Array.from(new Set(tracks.map((track) => track.artist)))
      .filter((artist) => artist.toLowerCase().includes(query))
    : [];
  const searchAlbums = query
    ? Array.from(new Set(tracks.map((track) => getAlbumName(track))))
      .filter((album) => album.toLowerCase().includes(query))
    : [];
  const albumTracks = activeAlbum
    ? tracks.filter((track) => getAlbumName(track) === activeAlbum)
    : [];
  const artistTracks = activeArtist
    ? tracks.filter((track) => track.artist === activeArtist)
    : [];
  const artistAlbums = useMemo(() => {
    if (!activeArtist) return [];
    const albumSet = new Set(artistTracks.map((track) => getAlbumName(track)));
    return Array.from(albumSet);
  }, [activeArtist, artistTracks]);

  const selectedStats = useMemo(() => {
    if (!selectedTrack?.playHistory) {
      return { qualifiedPlays: 0, earlySkips: 0, replays: 0 };
    }
    let qualifiedPlays = 0;
    let earlySkips = 0;
    let replays = 0;
    selectedTrack.playHistory.forEach((entry) => {
      if (entry.percent_listened >= ORBIT_CONFIG.qualifiedThreshold && !entry.skipped_early) {
        qualifiedPlays += 1;
      }
      if (entry.percent_listened < ORBIT_CONFIG.earlySkipThreshold || entry.play_duration_seconds < 15) {
        earlySkips += 1;
      }
      if (entry.replayed_same_session > 0) {
        replays += 1;
      }
    });
    return { qualifiedPlays, earlySkips, replays };
  }, [selectedTrack, ORBIT_CONFIG.qualifiedThreshold, ORBIT_CONFIG.earlySkipThreshold]);

  if (!GATE_DISABLED && (authState.status === "unauth" || authState.status === "revoked")) {
    return (
      <div style={styles.app}>
        <header style={styles.topBar}>
          <div style={styles.brand}>HOUND</div>
        </header>
        <main style={styles.content}>
          <section style={styles.homeCard}>
            <div style={styles.homeCardTitle}>Private Beta Access</div>
            <div style={styles.rowArtist}>
              Enter your invite code to unlock Hound.
            </div>
            <input
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Invite code"
              style={styles.input}
            />
            <input
              type="text"
              value={inviteLabel}
              onChange={(event) => setInviteLabel(event.target.value)}
              placeholder="Name or email (optional)"
              style={styles.input}
            />
            {authError ? <div style={styles.errorBanner}>{authError}</div> : null}
            {authState.message ? (
              <div style={styles.rowArtist}>{authState.message}</div>
            ) : null}
            <div style={styles.homeActions}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={redeemInvite}
                disabled={authBusy}
              >
                {authBusy ? "Checking..." : "Unlock"}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.topBar}>
        <button
          type="button"
          style={styles.menuButton}
          onClick={() => setSidebarOpen((prev) => !prev)}
          aria-label="Menu"
        >
          <IconMenu />
        </button>
        <div style={styles.topBarCenter}>{viewTitle}</div>
        <button
          type="button"
          style={styles.settingsButton}
          onClick={() => {
            if (activePage !== "settings") setScreen("settings");
          }}
          aria-label="Settings"
        >
          <IconSettings />
        </button>
      </header>

      <div style={styles.appBody}>
        <aside style={{ ...styles.sidebar, ...(sidebarOpen ? {} : styles.sidebarHidden) }}>
          <button
            type="button"
            style={{
              ...styles.sidebarButton(activePage === "home"),
              ...(sidebarOpen ? {} : { justifyContent: "center" })
            }}
            onClick={() => {
              if (activePage !== "home") setScreen("home");
            }}
          >
            <span style={styles.sidebarIcon}>
              <IconHome />
            </span>
            {sidebarOpen ? "Home" : null}
          </button>
          <button
            type="button"
            style={{
              ...styles.sidebarButton(activePage === "library"),
              ...(sidebarOpen ? {} : { justifyContent: "center" })
            }}
            onClick={() => {
              if (activePage !== "library") setScreen("library");
            }}
          >
            <span style={styles.sidebarIcon}>
              <IconLibrary />
            </span>
            {sidebarOpen ? "Library" : null}
          </button>
          <button
            type="button"
            style={{
              ...styles.sidebarButton(activePage === "search"),
              ...(sidebarOpen ? {} : { justifyContent: "center" })
            }}
            onClick={() => {
              if (activePage !== "search") setScreen("search");
            }}
          >
            <span style={styles.sidebarIcon}>
              <IconSearch />
            </span>
            {sidebarOpen ? "Search" : null}
          </button>
          <button
            type="button"
            style={{
              ...styles.sidebarButton(activePage === "playlist"),
              ...(sidebarOpen ? {} : { justifyContent: "center" })
            }}
            onClick={() => {
              if (activePage !== "playlist") setScreen("playlist");
            }}
          >
            <span style={styles.sidebarIcon}>
              <IconPlaylists />
            </span>
            {sidebarOpen ? "Playlists" : null}
          </button>
          <button
            type="button"
            style={{
              ...styles.sidebarButton(activePage === "settings"),
              ...(sidebarOpen ? {} : { justifyContent: "center" })
            }}
            onClick={() => {
              if (activePage !== "settings") setScreen("settings");
            }}
          >
            <span style={styles.sidebarIcon}>
              <IconSettings />
            </span>
            {sidebarOpen ? "Settings" : null}
          </button>
        </aside>

        <main style={styles.content}>
        {activePage === "home" ? (
          <section style={styles.homePage}>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Cloud Catalog (API v1)</div>
              <div style={styles.homeCard}>
                <div style={styles.homeCardTitle}>Mode: {API_MODE} | Endpoint: {API_V1_BASE}</div>
                <div style={styles.rowArtist}>Session role: {cloudRole || "none"}</div>
                <div style={styles.homeActions}>
                  <input
                    type="email"
                    value={cloudEmail}
                    onChange={(event) => setCloudEmail(event.target.value)}
                    placeholder="artist email"
                    style={styles.input}
                  />
                  <input
                    type="password"
                    value={cloudPassword}
                    onChange={(event) => setCloudPassword(event.target.value)}
                    placeholder="artist password"
                    style={styles.input}
                  />
                </div>
                <div style={styles.homeActions}>
                  <button type="button" style={styles.primaryButton} onClick={loginCloud} disabled={cloudBusy}>
                    Login
                  </button>
                  <button type="button" style={styles.secondaryButton} onClick={loadCloudMe} disabled={cloudBusy || !cloudToken}>
                    Who Am I
                  </button>
                  <button type="button" style={styles.secondaryButton} onClick={loadCloudHome} disabled={cloudBusy}>
                    Load Home Rails
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={logoutCloud}
                  >
                    Logout
                  </button>
                </div>
                {cloudMessage ? <div style={styles.rowArtist}>{cloudMessage}</div> : null}
                {cloudError ? <div style={styles.errorBanner}>{cloudError}</div> : null}
                {cloudHome?.rails?.length ? (
                  <div style={styles.list}>
                    {cloudHome.rails.map((rail) => (
                      <div key={rail.key} style={styles.homeCard}>
                        <div style={styles.homeCardTitle}>{rail.title}</div>
                        <div style={styles.rowScroll}>
                          {(rail.albums || []).slice(0, 6).map((album) => (
                            <div
                              key={album.albumId}
                              style={styles.tile}
                              onClick={() => loadCloudAlbum(album.albumId)}
                            >
                              <div style={styles.tileArt}>API</div>
                              <div style={styles.tileTitle}>{album.title}</div>
                              <div style={styles.tileArtist}>{album.artistName}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {cloudAlbum?.tracks?.length ? (
                  <div style={styles.homeCard}>
                    <div style={styles.homeCardTitle}>
                      Album Detail: {cloudAlbum.album?.title || "Unknown"}
                    </div>
                    <ul style={styles.list}>
                      {cloudAlbum.tracks.slice(0, 8).map((track) => (
                        <li key={track.trackId} style={styles.row(false)}>
                          <div style={styles.rowTitle}>
                            <span>{track.title}</span>
                            <button
                              type="button"
                              style={styles.queueButton}
                              onClick={() => playCloudTrack(track)}
                            >
                              Play Remote
                            </button>
                            <button
                              type="button"
                              style={styles.queueButton}
                              onClick={() => queueCloudTrack(track)}
                            >
                              Queue Remote
                            </button>
                          </div>
                          <div style={styles.rowArtist}>Track ID: {track.trackId}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {cloudStreamInfo?.manifestUrl ? (
                  <div style={styles.homeCard}>
                    <div style={styles.homeCardTitle}>Resolved Stream Manifest</div>
                    <div style={styles.rowArtist}>{cloudStreamInfo.manifestUrl}</div>
                  </div>
                ) : null}
              </div>
            </div>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Continue Listening</div>
              <div style={styles.rowScroll}>
                {recentTracks.slice(0, 6).map((track) => (
                  <div
                    key={track.id}
                    style={styles.tile}
                    onClick={() => handleRowClick(track.id)}
                    onContextMenu={(event) => openContextMenu(track.id, event)}
                  >
                    <div style={styles.tileArt}>ART</div>
                    <div style={styles.tileTitle}>{track.title}</div>
                    <div style={styles.tileArtist}>{track.artist}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>In Rotation</div>
              <div style={styles.rowScroll}>
                {rotationTracks.slice(0, 6).map((track) => (
                  <div
                    key={track.id}
                    style={styles.tile}
                    onClick={() => handleRowClick(track.id)}
                    onContextMenu={(event) => openContextMenu(track.id, event)}
                  >
                    <div style={styles.tileArt}>ART</div>
                    <div style={styles.tileTitle}>{track.title}</div>
                    <div style={styles.tileArtist}>{track.artist}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Recently Heard</div>
              <div style={styles.rowScroll}>
                {recentTracks.slice(0, 8).map((track) => (
                  <div
                    key={track.id}
                    style={styles.tile}
                    onClick={() => handleRowClick(track.id)}
                    onContextMenu={(event) => openContextMenu(track.id, event)}
                  >
                    <div style={styles.tileArt}>ART</div>
                    <div style={styles.tileTitle}>{track.title}</div>
                    <div style={styles.tileArtist}>{track.artist}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Something New</div>
              <div style={styles.rowScroll}>
                {discoveryTracks.slice(0, 8).map((track) => (
                  <div
                    key={track.id}
                    style={styles.tile}
                    onClick={() => handleRowClick(track.id)}
                    onContextMenu={(event) => openContextMenu(track.id, event)}
                  >
                    <div style={styles.tileArt}>ART</div>
                    <div style={styles.tileTitle}>{track.title}</div>
                    <div style={styles.tileArtist}>{track.artist}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : activePage === "library" ? (
          <section style={styles.library}>
            <div style={styles.headerRow}>
              <div style={styles.listTitle}>Library</div>
              <div style={styles.libraryButtons}>
                <button type="button" style={styles.primaryButton} onClick={handleImport}>
                  Import
                </button>
                <button type="button" style={styles.secondaryButton} onClick={clearLibrary}>
                  Clear Library
                </button>
              </div>
            </div>
            {settings.loudnessEnabled && tracks.some((track) => !track.loudnessReady) ? (
              <div style={styles.rowArtist}>
                Analyzing loudness... playback stays available.
              </div>
            ) : null}
            {importError ? <div style={styles.errorBanner}>{importError}</div> : null}
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <span>Title</span>
                <span>Artist</span>
                <span>Album</span>
                <span>Duration</span>
                <span>Actions</span>
              </div>
              {tracks.map((track) => {
                const durationSeconds = track.playHistory?.[0]?.track_total_duration || 0;
                const showActions = hoveredLibraryId === track.id;
                const showRotationControl =
                  track.rotation || (track.rotationOverride && track.rotationOverride !== "none");
                return (
                  <div
                    key={track.id}
                    style={styles.tableRow(track.id === selectedTrackId)}
                    onClick={() => handleRowClick(track.id)}
                    onMouseEnter={() => setHoveredLibraryId(track.id)}
                    onMouseLeave={() => setHoveredLibraryId(null)}
                    onContextMenu={(event) => openContextMenu(track.id, event)}
                  >
                    <div style={styles.tableCell}>{track.title}</div>
                    <div style={styles.tableMeta}>{track.artist}</div>
                    <div style={styles.tableMeta}>{getAlbumName(track)}</div>
                    <div style={styles.tableMeta}>
                      {durationSeconds ? formatTime(durationSeconds) : "--:--"}
                    </div>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {showActions ? (
                        <>
                          <button
                            type="button"
                            style={{
                              ...styles.iconButton,
                              ...(track.saved ? styles.iconButtonActive : {})
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSaveFor(track.id);
                            }}
                            aria-label="Save"
                          >
                            <IconSave filled={track.saved} />
                          </button>
                          {showRotationControl ? (
                            <button
                              type="button"
                              style={{
                                ...styles.iconButton,
                                ...(track.rotation ? styles.iconButtonActive : {})
                              }}
                              onClick={(event) => openRotationMenu(track.id, event)}
                              aria-label="Rotation"
                            >
                              <IconRotation slashed={track.rotationOverride === "force_off"} />
                            </button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {tracks.length === 0 ? (
                <div style={styles.empty}>No tracks yet. Click Import.</div>
              ) : null}
            </div>
          </section>
        ) : activePage === "search" ? (
          <section style={styles.searchPage}>
            <input
              type="text"
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tracks, artists, albums, playlists"
              style={styles.input}
            />
            {!query ? (
              <div style={styles.empty}>Type to search your library.</div>
            ) : (
              <>
                <div style={styles.listTitle}>Tracks</div>
                <ul style={styles.list}>
                  {searchTracks.map((track) => (
                    <li
                      key={track.id}
                      style={styles.row(track.id === selectedTrackId)}
                      onClick={() => handleRowClick(track.id, { type: "search", label: "Search", trackIds: searchTracks.map((item) => item.id) })}
                      onContextMenu={(event) => openContextMenu(track.id, event)}
                    >
                      <div style={styles.rowTitle}>
                        <span>{track.title}</span>
                      </div>
                      <div style={styles.rowArtist}>{track.artist}</div>
                    </li>
                  ))}
                  {searchTracks.length === 0 ? (
                    <li style={styles.empty}>No track matches.</li>
                  ) : null}
                </ul>
                <div style={styles.listTitle}>Artists</div>
                <ul style={styles.list}>
                  {searchArtists.map((artist) => (
                    <li
                      key={artist}
                      style={styles.row(activeArtist === artist)}
                      onClick={() => openArtist(artist)}
                    >
                      <div style={styles.rowTitle}>
                        <span>{artist}</span>
                      </div>
                    </li>
                  ))}
                  {searchArtists.length === 0 ? (
                    <li style={styles.empty}>No artist matches.</li>
                  ) : null}
                </ul>
                <div style={styles.listTitle}>Albums</div>
                <ul style={styles.list}>
                  {searchAlbums.map((album) => (
                    <li
                      key={album}
                      style={styles.row(activeAlbum === album)}
                      onClick={() => openAlbum(album)}
                    >
                      <div style={styles.rowTitle}>
                        <span>{album}</span>
                      </div>
                    </li>
                  ))}
                  {searchAlbums.length === 0 ? (
                    <li style={styles.empty}>No album matches.</li>
                  ) : null}
                </ul>
                {searchTracks.length === 0 &&
                searchArtists.length === 0 &&
                searchAlbums.length === 0 ? (
                  <div style={styles.empty}>No results found.</div>
                ) : null}
              </>
            )}
          </section>
        ) : activePage === "history" ? (
          <section style={styles.searchPage}>
            <div style={styles.listTitle}>Session History</div>
            <ul style={styles.list}>
              {sessionHistory.map((entry) => (
                <li
                  key={entry.id}
                  style={styles.row(false)}
                  onClick={() => setRecap(entry.payload)}
                >
                  <div style={styles.rowTitle}>
                    <span>{new Date(entry.date).toLocaleString()}</span>
                    <span style={styles.badge}>{entry.mode || "Normal"}</span>
                  </div>
                  <div style={styles.rowArtist}>
                    Duration: {entry.payload.listenedSeconds}s
                  </div>
                </li>
              ))}
              {sessionHistory.length === 0 ? (
                <li style={styles.empty}>No sessions yet.</li>
              ) : null}
            </ul>
          </section>
        ) : activePage === "settings" ? (
          <section style={styles.settingsPage}>
            <div style={styles.settingsSection}>
              <div style={styles.homeCardTitle}>Account</div>
              <div style={styles.settingRow}>
                <span>Access</span>
                <span>Local</span>
              </div>
            </div>
            <div style={styles.settingsSection}>
              <div style={styles.homeCardTitle}>Storage</div>
              <div style={styles.settingRow}>
                <span>Tracks</span>
                <span>{tracks.length}</span>
              </div>
              <div style={styles.settingRow}>
                <span>Playlists</span>
                <span>{playlists.length}</span>
              </div>
            </div>
            <div style={styles.settingsSection}>
              <div style={styles.homeCardTitle}>Advanced</div>
              <div style={styles.settingRow}>
                <span>Show Advanced</span>
                <input
                  type="checkbox"
                  checked={showAdvanced}
                  onChange={(event) => setShowAdvanced(event.target.checked)}
                />
              </div>
              <div style={styles.settingRow}>
                <span>Dev Mode</span>
                <input
                  type="checkbox"
                  checked={devMode}
                  onChange={(event) => setDevMode(event.target.checked)}
                />
              </div>
              {showAdvanced ? (
                <>
                  <div style={styles.settingRow}>
                    <span>Rotation overrides</span>
                    <span>Manual only</span>
                  </div>
                  {metrics ? (
                    <>
                      <div style={styles.settingRow}>
                        <span>Rec skip rate</span>
                        <span>
                          {metrics.totalPlays
                            ? `${Math.round((metrics.earlySkips / metrics.totalPlays) * 100)}%`
                            : "—"}
                        </span>
                      </div>
                      <div style={styles.settingRow}>
                        <span>Rec completion</span>
                        <span>
                          {metrics.totalPlays
                            ? `${Math.round((metrics.completions / metrics.totalPlays) * 100)}%`
                            : "—"}
                        </span>
                      </div>
                      <div style={styles.settingRow}>
                        <span>Rec replay</span>
                        <span>
                          {metrics.totalPlays
                            ? `${Math.round((metrics.replays / metrics.totalPlays) * 100)}%`
                            : "—"}
                        </span>
                      </div>
                      <div style={styles.settingRow}>
                        <span>Rec regret</span>
                        <span>
                          {metrics.totalPlays
                            ? `${Math.round((metrics.regrets / metrics.totalPlays) * 100)}%`
                            : "—"}
                        </span>
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
            </div>
          </section>
        ) : activePage === "album" ? (
          <section style={styles.playlistPage}>
            <div style={styles.listTitle}>Album</div>
            <div style={styles.rowArtist}>{activeAlbum || "Unknown Album"}</div>
            <div style={styles.homeActions}>
              <button type="button" style={styles.secondaryButton} onClick={playAlbum}>
                Play Album
              </button>
              <button type="button" style={styles.secondaryButton} onClick={shuffleAlbum}>
                Shuffle Album
              </button>
            </div>
            <div style={styles.homeActions}>
              <select
                value={albumPlaylistId}
                onChange={(event) => setAlbumPlaylistId(event.target.value)}
                style={styles.input}
              >
                <option value="">Add album to playlist</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={addAlbumToPlaylist}
                disabled={!albumPlaylistId || albumTracks.length === 0}
              >
                Add Album
              </button>
            </div>
            <ul style={styles.list}>
              {albumTracks.map((track) => (
                <li
                  key={track.id}
                  style={styles.row(track.id === selectedTrackId)}
                  onClick={() =>
                    handleRowClick(track.id, {
                      type: "album",
                      id: activeAlbum,
                      name: activeAlbum,
                      label: `Album: ${activeAlbum || "Unknown Album"}`,
                      trackIds: albumTracks.map((item) => item.id)
                    })
                  }
                  onContextMenu={(event) => openContextMenu(track.id, event)}
                >
                  <div style={styles.rowTitle}>
                    <span>{track.title}</span>
                  </div>
                  <div style={styles.rowArtist}>{track.artist}</div>
                </li>
              ))}
              {albumTracks.length === 0 ? (
                <li style={styles.empty}>No album tracks found.</li>
              ) : null}
            </ul>
          </section>
        ) : activePage === "artist" ? (
          <section style={styles.playlistPage}>
            <div style={styles.listTitle}>Artist</div>
            <div style={styles.rowArtist}>{activeArtist || "Unknown Artist"}</div>
            <div style={styles.homeActions}>
              <button type="button" style={styles.secondaryButton} onClick={playArtist}>
                Play Artist
              </button>
              <button type="button" style={styles.secondaryButton} onClick={shuffleArtist}>
                Shuffle Artist
              </button>
            </div>
            <div style={styles.homeActions}>
              <select
                value={artistPlaylistId}
                onChange={(event) => setArtistPlaylistId(event.target.value)}
                style={styles.input}
              >
                <option value="">Add artist to playlist</option>
                {playlists.map((playlist) => (
                  <option key={playlist.id} value={playlist.id}>
                    {playlist.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={addArtistToPlaylist}
                disabled={!artistPlaylistId || artistTracks.length === 0}
              >
                Add Artist
              </button>
            </div>
            <div style={styles.listTitle}>Albums</div>
            <ul style={styles.list}>
              {artistAlbums.map((album) => (
                <li
                  key={album}
                  style={styles.row(false)}
                  onClick={() => openAlbum(album)}
                >
                  <div style={styles.rowTitle}>
                    <span>{album}</span>
                  </div>
                </li>
              ))}
              {artistAlbums.length === 0 ? (
                <li style={styles.empty}>No albums found.</li>
              ) : null}
            </ul>
            <div style={styles.listTitle}>Tracks</div>
            <ul style={styles.list}>
              {artistTracks.map((track) => (
                <li
                  key={track.id}
                  style={styles.row(track.id === selectedTrackId)}
                  onClick={() =>
                    handleRowClick(track.id, {
                      type: "artist",
                      id: activeArtist,
                      name: activeArtist,
                      label: `Artist: ${activeArtist || "Unknown Artist"}`,
                      trackIds: artistTracks.map((item) => item.id)
                    })
                  }
                  onContextMenu={(event) => openContextMenu(track.id, event)}
                >
                  <div style={styles.rowTitle}>
                    <span>{track.title}</span>
                  </div>
                  <div style={styles.rowArtist}>{track.artist}</div>
                </li>
              ))}
              {artistTracks.length === 0 ? (
                <li style={styles.empty}>No tracks found.</li>
              ) : null}
            </ul>
          </section>
        ) : activePage === "queue" ? (
          <section style={styles.queuePage}>
            <div style={styles.queuePanel}>
              <div style={styles.queueHeader}>
                <span>Queue</span>
                <button
                  type="button"
                  style={styles.queueActionButton}
                  onClick={clearQueue}
                  disabled={queue.length === 0}
                >
                  Clear Queue
                </button>
              </div>
              {queueItems.length === 0 ? (
                <div style={styles.empty}>Queue is empty.</div>
              ) : (
                <ul style={styles.queueList}>
                  {queueItems.map((track, index) => (
                    <li
                      key={`${track.id}-${index}`}
                      style={styles.queueRow}
                      onClick={() => handleRowClick(track.id, { type: "queue", label: "Queue", trackIds: queueItems.map((item) => item.id) })}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", String(index));
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const raw = event.dataTransfer.getData("text/plain");
                        const fromIndex = Number(raw);
                        if (Number.isFinite(fromIndex)) {
                          moveQueueItemTo(fromIndex, index);
                        }
                      }}
                    >
                      <div style={styles.queueMeta}>
                        <span style={styles.queueTitle}>{track.title}</span>
                        <span style={styles.queueArtist}>{track.artist}</span>
                      </div>
                      <div style={styles.queueActions}>
                        {settings.loudnessEnabled && !track.loudnessReady ? (
                          <span style={styles.badge}>Analyzing</span>
                        ) : null}
                        <button
                          type="button"
                          style={styles.queueDrag}
                          aria-label="Drag to reorder"
                        >
                          Drag
                        </button>
                        <button
                          type="button"
                          style={styles.queueActionButton}
                          onClick={() => removeQueueItem(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : activePage === "playlist" ? (
          <section style={styles.playlistPage}>
            <div style={styles.headerRow}>
              <div style={styles.listTitle}>Playlists</div>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => setCreatingPlaylist(true)}
              >
                New Playlist
              </button>
            </div>
            {creatingPlaylist ? (
              <div style={styles.libraryButtons}>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(event) => setNewPlaylistName(event.target.value)}
                  placeholder="Playlist name"
                  style={{
                    flex: 1,
                    minWidth: "200px",
                    border: "1px solid #334155",
                    background: "transparent",
                    color: "#e5e7eb",
                    padding: "10px 12px",
                    borderRadius: "8px"
                  }}
                />
                <button type="button" style={styles.primaryButton} onClick={createPlaylist}>
                  Create
                </button>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => {
                    setCreatingPlaylist(false);
                    setNewPlaylistName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            <div style={styles.listTitle}>Your Playlists</div>
            <ul style={styles.list}>
              {playlists.map((playlist) => (
              <li
                key={playlist.id}
                style={styles.row(playlist.id === selectedPlaylistId)}
                onClick={() => setSelectedPlaylistId(playlist.id)}
              >
                <div style={styles.rowTitle}>
                  {editingPlaylistId === playlist.id ? (
                    <input
                      type="text"
                      value={editingPlaylistName}
                      onChange={(event) => setEditingPlaylistName(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      style={styles.input}
                    />
                  ) : (
                    <span>{playlist.name}</span>
                  )}
                  <div style={styles.rowActions}>
                    <span style={styles.badge}>{playlist.trackIds.length} tracks</span>
                    {editingPlaylistId === playlist.id ? (
                      <>
                        <button
                          type="button"
                          style={styles.queueButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            saveEditPlaylist();
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          style={styles.queueButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            cancelEditPlaylist();
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          style={styles.queueButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditPlaylist(playlist);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={styles.queueButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            deletePlaylist(playlist.id);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
              {playlists.length === 0 ? (
                <li style={styles.empty}>No playlists yet.</li>
              ) : null}
            </ul>
            <div style={styles.listTitle}>Playlist Tracks</div>
            {selectedPlaylist ? (
              <>
                <div style={styles.rowArtist}>{selectedPlaylist.name}</div>
                <div style={styles.homeActions}>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={playPlaylist}
                    disabled={selectedPlaylist.trackIds.length === 0}
                  >
                    Play Playlist
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={shufflePlaylist}
                    disabled={selectedPlaylist.trackIds.length === 0}
                  >
                    Shuffle Playlist
                  </button>
                  <button
                    type="button"
                    style={styles.secondaryButton}
                    onClick={() => {
                      if (window.confirm("Delete this playlist?")) {
                        deletePlaylist(selectedPlaylist.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
                <ul style={styles.list}>
                  {selectedPlaylist.trackIds.map((trackId) => {
                    const track = tracks.find((item) => item.id === trackId);
                    if (!track) return null;
                    return (
                      <li
                        key={track.id}
                        style={styles.row(track.id === selectedTrackId)}
                        onClick={() => handleRowClick(track.id, { type: "playlist", id: selectedPlaylist.id, name: selectedPlaylist.name, label: `Playlist: ${selectedPlaylist.name}`, trackIds: selectedPlaylist.trackIds })}
                        onContextMenu={(event) => openContextMenu(track.id, event)}
                      >
                        <div style={styles.rowTitle}>
                          <span>{track.title}</span>
                          <div style={styles.rowActions}>
                            {settings.loudnessEnabled && !track.loudnessReady ? (
                              <span style={styles.badge}>Analyzing</span>
                            ) : null}
                            <button
                              type="button"
                              style={styles.queueButton}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeTrackFromPlaylist(selectedPlaylist.id, track.id);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div style={styles.rowArtist}>{track.artist}</div>
                      </li>
                    );
                  })}
                  {selectedPlaylist.trackIds.length === 0 ? (
                    <li style={styles.empty}>Playlist is empty.</li>
                  ) : null}
                </ul>
                <div style={styles.listTitle}>Add Tracks</div>
                <ul style={styles.list}>
                  {tracks
                    .filter((track) => !selectedPlaylist.trackIds.includes(track.id))
                    .map((track) => {
                    const inPlaylist = selectedPlaylist.trackIds.includes(track.id);
                    return (
                      <li key={track.id} style={styles.row(false)}>
                        <div style={styles.rowTitle}>
                          <span>{track.title}</span>
                          <div style={styles.rowActions}>
                            {inPlaylist ? <span style={styles.badge}>Added</span> : null}
                            <button
                              type="button"
                              style={styles.queueButton}
                              onClick={() =>
                                addTrackToPlaylist(selectedPlaylist.id, track.id)
                              }
                              disabled={inPlaylist}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                        <div style={styles.rowArtist}>{track.artist}</div>
                      </li>
                    );
                  })}
                  {tracks.length === 0 ? (
                    <li style={styles.empty}>Import tracks to add.</li>
                  ) : null}
                </ul>
              </>
            ) : (
              <div style={styles.empty}>Select a playlist to view tracks.</div>
            )}
          </section>
        ) : (
          <section style={styles.playerWrap}>
            <div style={styles.playerCard}>
              {selectedTrack ? (
                <>
                  <div style={styles.cover}>Cover Art</div>
                  <div style={{ minHeight: "48px" }}>
                    <h2 style={styles.trackTitle}>
                      <MarqueeText text={selectedTrack.title} maxChars={22} />
                    </h2>
                    <p style={styles.trackArtist}>
                      <MarqueeText
                        text={`${selectedTrack.artist} - ${getAlbumName(selectedTrack)}`}
                        maxChars={36}
                      />
                    </p>
                  </div>
                  {error ? <div style={styles.errorBanner}>{error}</div> : null}
                  {isBuffering ? <div style={styles.rowArtist}>Buffering stream...</div> : null}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      step="0.1"
                      value={currentTime}
                      onMouseDown={handleScrubStart}
                      onTouchStart={handleScrubStart}
                      onChange={handleScrubChange}
                      onMouseUp={handleScrubEnd}
                      onTouchEnd={handleScrubEnd}
                      disabled={!selectedTrack}
                      aria-label="Seek"
                    />
                    <div
                      style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9ca3af" }}
                    >
                      <span onClick={() => setShowRemaining((prev) => !prev)} style={{ cursor: "pointer" }}>
                        {showRemaining
                          ? `-${formatTime(Math.max(duration - currentTime, 0))}`
                          : formatTime(currentTime)}
                      </span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                  <div style={styles.controls}>
                    <button
                      type="button"
                      style={styles.controlButton}
                      onClick={handlePrev}
                      aria-label="Previous"
                    >
                      <IconPrev />
                    </button>
                    <button
                      type="button"
                      style={{ ...styles.controlButton, ...styles.playButton }}
                      onClick={togglePlayPause}
                      aria-label="Play/Pause"
                    >
                      {isPlaying ? <IconPause /> : <IconPlay />}
                    </button>
                    <button
                      type="button"
                      style={styles.controlButton}
                      onClick={() => handleNext({ manual: true })}
                      aria-label="Next"
                    >
                      <IconNext />
                    </button>
                  </div>
                  <div style={styles.controls}>
                    <button
                      type="button"
                      style={{
                        ...styles.controlButton,
                        ...(selectedTrack.saved ? styles.saveActive : {})
                      }}
                      onClick={toggleSave}
                      aria-label="Save"
                    >
                      <IconSave filled={selectedTrack.saved} />
                    </button>
                    <button
                      type="button"
                      style={{
                        ...styles.controlButton,
                        ...(selectedTrack.rotation ? styles.likeActive : {}),
                        ...(selectedTrack.rotation || selectedTrack.rotationOverride !== "none"
                          ? {}
                          : { opacity: 0.6 })
                      }}
                      onClick={(event) => openRotationMenu(selectedTrack.id, event)}
                      aria-label="Rotation"
                    >
                      <IconRotation slashed={selectedTrack.rotationOverride === "force_off"} />
                    </button>
                    <button
                      type="button"
                      style={styles.controlButton}
                      onClick={() => setScreen("queue")}
                      aria-label="Queue"
                    >
                      <IconQueue />
                    </button>
                  </div>
                </>
              ) : (
                <div style={styles.empty}>Select a track from Library.</div>
              )}
            </div>
          </section>
        )}
      </main>
      </div>

      {selectedTrack ? (
        <div
          style={styles.nowPlayingBar}
          onClick={() => setScreen("player")}
          role="button"
          tabIndex={0}
        >
          <div style={styles.nowPlayingLeft}>
            <div style={styles.nowPlayingArt}>ART</div>
            <div style={styles.nowPlayingInfo}>
              <div style={{ minWidth: 0 }}>
                <MarqueeText text={selectedTrack.title} maxChars={24} />
                <MarqueeText text={selectedTrack.artist} maxChars={28} />
              </div>
            </div>
          </div>
          <div style={styles.nowPlayingCenter}>
            <div style={styles.nowPlayingControls}>
              <button
                type="button"
                style={styles.nowPlayingButton}
                onClick={(event) => {
                  event.stopPropagation();
                  handlePrev();
                }}
                aria-label="Previous"
              >
                <IconPrev />
              </button>
              <button
                type="button"
                style={styles.nowPlayingButton}
                onClick={(event) => {
                  event.stopPropagation();
                  togglePlayPause();
                }}
                aria-label="Play/Pause"
              >
                {isPlaying ? <IconPause /> : <IconPlay />}
              </button>
              <button
                type="button"
                style={styles.nowPlayingButton}
                onClick={(event) => {
                  event.stopPropagation();
                  handleNext({ manual: true });
                }}
                aria-label="Next"
              >
                <IconNext />
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="0.1"
              value={currentTime}
              style={{ width: "100%" }}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={handleScrubStart}
              onTouchStart={handleScrubStart}
              onChange={handleScrubChange}
              onMouseUp={handleScrubEnd}
              onTouchEnd={handleScrubEnd}
              aria-label="Seek"
            />
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "11px", color: "#9ca3af" }}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(Math.max(duration - currentTime, 0))}</span>
            </div>
          </div>
          <div style={styles.nowPlayingRight}>
            <button
              type="button"
              style={{
                ...styles.nowPlayingButton,
                ...(selectedTrack.saved ? styles.saveActive : {})
              }}
              onClick={(event) => {
                event.stopPropagation();
                toggleSave();
              }}
              aria-label="Save"
            >
              <IconSave filled={selectedTrack.saved} />
            </button>
            <button
              type="button"
              style={styles.nowPlayingButton}
              onClick={(event) => {
                event.stopPropagation();
                setScreen("queue");
              }}
              aria-label="Queue"
            >
              <IconQueue />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <IconVolume />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => setVolume(Number(event.target.value))}
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      ) : null}

      {rotationMenu ? (
        <div
          style={{ ...styles.menuPopup, left: rotationMenu.x, top: rotationMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            style={styles.menuItem}
            onClick={() => {
              setRotationOverrideFor(rotationMenu.trackId, "none");
              setRotationMenu(null);
            }}
          >
            Auto
          </div>
          <div
            style={styles.menuItem}
            onClick={() => {
              setRotationOverrideFor(rotationMenu.trackId, "force_on");
              setRotationMenu(null);
            }}
          >
            Force On
          </div>
          <div
            style={styles.menuItem}
            onClick={() => {
              setRotationOverrideFor(rotationMenu.trackId, "force_off");
              setRotationMenu(null);
            }}
          >
            Force Off
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <div
          style={{ ...styles.menuPopup, left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            style={styles.menuItem}
            onClick={() => {
              handleRowClick(contextMenu.trackId);
              setContextMenu(null);
            }}
          >
            Play
          </div>
          <div
            style={styles.menuItem}
            onClick={() => {
              queueTrackNext(contextMenu.trackId);
              setContextMenu(null);
            }}
          >
            Add to Queue
          </div>
          <div
            style={styles.menuItem}
            onClick={() => {
              toggleSaveFor(contextMenu.trackId);
              setContextMenu(null);
            }}
          >
            {tracks.find((track) => track.id === contextMenu.trackId)?.saved ? "Unsave" : "Save"}
          </div>
          <div
            style={{ ...styles.menuItem, ...styles.menuItemMuted }}
            onClick={() =>
              setContextMenu((prev) =>
                prev ? { ...prev, rotationOpen: !prev.rotationOpen } : prev
              )
            }
          >
            Rotation
          </div>
          {contextMenu.rotationOpen ? (
            <div style={styles.menuSub}>
              <div
                style={styles.menuItem}
                onClick={() => {
                  setRotationOverrideFor(contextMenu.trackId, "none");
                  setContextMenu(null);
                }}
              >
                Auto
              </div>
              <div
                style={styles.menuItem}
                onClick={() => {
                  setRotationOverrideFor(contextMenu.trackId, "force_on");
                  setContextMenu(null);
                }}
              >
                Force On
              </div>
              <div
                style={styles.menuItem}
                onClick={() => {
                  setRotationOverrideFor(contextMenu.trackId, "force_off");
                  setContextMenu(null);
                }}
              >
                Force Off
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {recap ? (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <div>Thanks for listening.</div>
            <div>Time listened: {recap.listenedSeconds}s</div>
            <div>Tracks played: {recap.tracksPlayed}</div>
            <div>Skips: {recap.skips}</div>
            <div style={styles.modalButtons}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => setRecap(null)}
              >
                Close
              </button>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => {
                  setRecap(null);
                  setScreen("library");
                }}
              >
                Go to Library
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {devMode && orbitHud ? (
        <div style={styles.hudPanel}>
          <div style={styles.hudTitle}>Orbit HUD</div>
          {(() => {
            const picked = tracks.find((track) => track.id === orbitHud.pickedTrackId);
            const cooldownBlocked = orbitHud.filtersApplied?.cooldownBlocked ?? 0;
            const artistBlocked = orbitHud.filtersApplied?.artistBlocked ?? 0;
            return (
              <>
          <div style={styles.hudRow}>
            <span>Current</span>
            <span>{selectedTrack?.title || "None"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Next Pick</span>
            <span>
              {picked?.title || "—"}
            </span>
          </div>
          <div style={styles.hudRow}>
            <span>Orbit</span>
            <span>{selectedTrack?.orbit || "unknown"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Evidence</span>
            <span>{selectedTrack?.evidenceScore ?? 0}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Last Positive</span>
            <span>{selectedTrack?.lastPositiveListenAt || "—"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Qualified</span>
            <span>{selectedStats.qualifiedPlays}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Early Skips</span>
            <span>{selectedStats.earlySkips}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Replays</span>
            <span>{selectedStats.replays}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Force</span>
            <span>{selectedTrack?.forceOn ? "on" : selectedTrack?.forceOff ? "off" : "none"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Saved</span>
            <span>{selectedTrack?.saved ? "yes" : "no"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Selection</span>
            <span>{orbitHud.reason || "—"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Rolled Orbit</span>
            <span>{orbitHud.rolledOrbit || "—"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Pools</span>
            <span>
              R:{orbitHud.poolSizes?.rotation ?? 0} | Re:{orbitHud.poolSizes?.recent ?? 0} | D:
              {orbitHud.poolSizes?.discovery ?? 0}
            </span>
          </div>
          <div style={styles.hudRow}>
            <span>Cooldown Blocked</span>
            <span>{cooldownBlocked ? `yes (${cooldownBlocked})` : "no"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Artist Blocked</span>
            <span>{artistBlocked ? `yes (${artistBlocked})` : "no"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>ForceOff Filter</span>
            <span>{orbitHud.filtersApplied?.forceOff ?? 0}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Next Orbit</span>
            <span>{picked?.orbit || "—"}</span>
          </div>
          <div style={styles.hudRow}>
            <span>Next Force</span>
            <span>{picked?.forceOn ? "on" : picked?.forceOff ? "off" : "none"}</span>
          </div>
              </>
            );
          })()}
        </div>
      ) : null}

      <audio ref={audioARef} />
      <audio ref={audioBRef} />
    </div>
  );
}





