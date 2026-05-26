import React from "react";

export default function DenPlaceholder({ title, description }) {
  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">HOUND DEN</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <section className="panel">
        <p>This section is scaffolded and ready for Phase 2/3 implementation.</p>
      </section>
    </div>
  );
}
