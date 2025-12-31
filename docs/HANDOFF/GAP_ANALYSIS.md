# Gap Analysis

UI
- BLOCKER: No formal UI blueprint in repo. Consequence: UI implementation diverges across contributors.
- REQUIRED: No documented interaction rules. Consequence: inconsistent behavior across screens.

Backend
- REQUIRED: No backend API contract. Consequence: integration work cannot start cleanly.

Domain Logic
- BLOCKER: Orbits and autoplay weighting are not implemented. Consequence: rotation system is incomplete.
- REQUIRED: Long-term ignore decay is missing. Consequence: rotation does not fade as specified.

Persistence
- BLOCKER: Save and rotation do not persist beyond local storage. Consequence: memory model is lost across devices and reinstalls.

Integration
- REQUIRED: Rules engine package is empty. Consequence: logic cannot be reused by Studio or future services.
