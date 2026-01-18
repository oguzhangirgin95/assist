# Workflow Status

## Goal
Tell the user the best next workflow to run.

## Steps
1. Check if `{status_file}` exists.
2. If not, create it using `template` and ask user for project phase.
3. Read status; detect missing artifacts (PRD/UX/architecture/stories).
4. Recommend next workflow(s) with rationale.

## Output
- Short recommendation in chat.
- Update `{status_file}` when user completes a phase.
