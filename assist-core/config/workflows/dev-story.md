# Dev Story

## Goal
Implement a single story with tests and clean quality gates.

## Steps
1. Load `project_context` (if exists).
2. Ask user for `story_file` (or list `{story_dir}` and let them pick).
3. Implement tasks/subtasks in order.
4. Run tests + lint (tooling-dependent).
5. Update story status + link to PR/commit if available.

## Output
- Code changes in repo.
- Story notes updated.
