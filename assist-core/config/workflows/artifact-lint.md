# Artifact Lint

## Goal
Validate `assist/output` structure and minimum required artifacts.

## Steps
1. Run the `lint-artifacts` task against `{artifact_root}`.
2. If FAIL/CONCERNS: list missing/invalid items and suggest the workflow to fix.

## Notes
- This workflow is meant to be run before implementation and before release.
