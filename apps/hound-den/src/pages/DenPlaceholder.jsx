import React from "react";

const pageCopy = {
  "Tracks & Assets": {
    focus: "Inspect upload assets, playback readiness, and recovery actions.",
    lanes: [
      "Asset inventory by release/track",
      "Transcode health and manifest integrity",
      "Recovery actions (retry, replace, archive)"
    ]
  },
  Catalog: {
    focus: "Control what listeners discover first.",
    lanes: [
      "Feature and pin releases",
      "Hide broken catalog items",
      "Priority and visibility ordering"
    ]
  },
  Analytics: {
    focus: "Read platform usage and release performance at a glance.",
    lanes: [
      "Active listeners and session volume",
      "Top tracks/releases/artists",
      "Playback quality and error trends"
    ]
  },
  "System Health": {
    focus: "Watch core platform services and incident risk.",
    lanes: [
      "API, auth, and database health",
      "Worker and ingest heartbeat",
      "Deploy version and environment status"
    ]
  },
  Settings: {
    focus: "Manage admin controls and security posture.",
    lanes: [
      "Role and permission policy",
      "2FA readiness and session controls",
      "Feature flags and maintenance mode"
    ]
  }
};

export default function DenPlaceholder({ title, description }) {
  const copy = pageCopy[title] || {
    focus: description,
    lanes: ["Core controls", "Operational visibility", "Admin actions"]
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">HOUND DEN</p>
        <h1>{title}</h1>
        <p>{copy.focus}</p>
      </header>

      <section className="panel-grid panel-grid-double">
        {copy.lanes.map((lane) => (
          <article key={lane} className="panel">
            <h2>{lane}</h2>
            <p>{description}</p>
            <div className="album-actions">
              <button type="button" className="secondary-button">Inspect</button>
              <button type="button" className="secondary-button">Open Queue</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
