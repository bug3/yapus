---
paths:
  - ".github/workflows/**"
---

# Actions

## ACT-1. Pin every action to a full 40-character commit SHA, with its version tag in a trailing comment.

## ACT-2. Declare the workflow's top-level `permissions` as `contents: read`; grant more only on the job that needs it.

## ACT-3. Trigger a workflow that runs pull request code with `pull_request`, never with `pull_request_target` or `workflow_run`.

## ACT-4. Set `timeout-minutes` on every job.
