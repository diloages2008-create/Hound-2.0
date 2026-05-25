# Branching Model

## Branch Roles
- `main`: stable/current/online-ready branch.
- `hound/updates`: active patch/update branch.
- `feature/*`: optional short-lived experiment branches.

## Standard Workflow
1. Start from `hound/updates`.
2. Make changes and commit in small, clear commits.
3. Run build/tests locally.
4. Open PR from `hound/updates` into `main`.
5. Merge only after CI passes.
6. Deploy from `main`.

## Rules
- Do not do normal development directly on `main`.
- Keep `main` clean and synchronized with `origin/main`.
- Use `feature/*` only for isolated experiments, then merge back to `hound/updates`.

## Current CI
- Pull requests into `main` run CI.
- Pushes to `hound/updates` run CI.
- Pushes to `main` run CI.

