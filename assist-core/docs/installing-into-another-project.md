# Installing Assist Core Into Another Project

This guide explains how to install `assist-core` into an existing repository and use it with Windsurf.

## Prerequisites

- Node.js 18+ (recommended)
- npm

## Install

Choose one of the following installation methods.

### Option A — Install from npm (if published)

```bash
npm install -D assist-core
```

### Option B — Install from a local folder (Windows-friendly)

From your target repo root:

```powershell
npm install -D "C:\Projects\Team\assist\assist-core"; npx assist init --lang en
```

Notes:
- Use `;` in PowerShell to chain commands.
- Replace the path with wherever your `assist-core` folder lives.

### Option C — Install from a tarball (.tgz)

1) In the `assist-core` folder:

```bash
npm pack
```

2) In your target repo root:

```powershell
npm install -D "C:\path\to\assist-core-<version>.tgz"; npx assist init --lang en
```

## Initialize (required)

Run this from the **root of the target repository**:

```bash
npx assist init --lang en
```

Supported languages:
- `en`
- `tr`

## What `init` generates

After init, your target repository will contain:

- `assist/config/` — a copy of the core configuration (agents/workflows/tasks)
- `assist/settings.json` — project settings (language, project root)
- `assist/config_source.json` — resolved variables used by workflows (paths, languages, user name)
- `assist/output/` — default output folders (planning/implementation/etc.)

Editor integrations (generated at the target repo root):
- `.windsurf/rules/` and `.windsurf/workflows/` — Windsurf Rules + slash workflows
- `.github/agents/` — editor agent definitions (for compatible editors)

## Using in Windsurf

1) Open the target repo in Windsurf.
2) Reload the window once after running init (Windsurf needs to re-index rules/workflows).
3) Use slash workflows in chat, for example:
   - `/create-product-brief`
   - `/prd`
   - `/dev-story`
4) Persona switching is also provided via slash workflows:
   - `/analyst`, `/dev`, `/architect`, `/product-owner`, `/scrum-master`, `/test`, `/ui-designer`, `/master`

Important UX note:
- The `Code` / `Ask` selector is Windsurf’s built-in mode selector.
- Assist personas do not appear as “modes” there; they are discovered as Rules and Workflows.

## Updating

After upgrading `assist-core` in a repo:

```bash
npx assist init --lang en
```

`init` is safe to re-run and will refresh generated files and `assist/config_source.json`.

## Troubleshooting

### It asks me for planning_artifacts / language / user_name

This usually means the repo hasn’t been initialized.

- Confirm `assist/config_source.json` exists in the target repo
- Re-run:

```bash
npx assist init --lang en
```

### Windsurf doesn’t show the new rules/workflows

- Reload Windsurf window
- Ensure `.windsurf/` exists at the target repo root
- If you previously had a `.windsurfrules` file, `init` will move it to a `.bak` file so it won’t override `.windsurf/`

## Remove (optional)

To remove Assist Core from a target repo:

- `npm uninstall assist-core`
- Optionally delete generated folders:
  - `assist/`
  - `.windsurf/`
  - `.github/agents/`
