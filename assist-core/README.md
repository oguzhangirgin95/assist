# Assist Core

Simplified AI Agent Workflow Core.

## Overview

This project provides a simple, data-driven architecture for AI Agents.
It includes:
- **Agents**: Defined in `config/agents/*.yaml`
- **Workflows**: Defined in `config/workflows/*.yaml`
- **CLI**: `assist` command to run workflows.

## Installation

```bash
npm install assist-core
npx assist init
```

For installing into an existing repository (local path / .tgz, Windsurf usage), see:
- docs/installing-into-another-project.md

During initialization, you will be asked to select your language (English/Turkish).
This will create an `assist/` folder in your project with all configurations.

## Usage

### List Workflows
```bash
npx assist list
```

### Run a Workflow
```bash
npx assist run prd
npx assist run dev-story
```

This command will output the instructions for the AI Agent (Windsurf/Copilot) to follow.

## Architecture

- **Data-Driven**: All logic is defined in YAML files.
- **Agent-Centric**: The CLI provides context; the AI Agent performs the work.
