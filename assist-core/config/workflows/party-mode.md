# Party Mode Workflow

## Goal
Run a natural multi-agent conversation with 2-3 relevant agents per turn.

## Rules
- Always speak in `{communication_language}`.
- Build the agent roster by reading `assist/config/agents/` (one persona per YAML).
- For each user message: pick 2-3 relevant agents; rotate to keep diversity.

## Steps
1. Load agent roster.
2. Ask user what topic to discuss.
3. For each turn: orchestrate responses (agent-by-agent) + summarize.
4. Exit when user asks to stop.
