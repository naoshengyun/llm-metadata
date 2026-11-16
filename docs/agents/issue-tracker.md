# Issue tracker: GitHub

Issues and specs live in https://github.com/naoshengyun/llm-metadata.
Use the `gh` CLI with an explicit `--repo naoshengyun/llm-metadata`.

The `origin` remote points to `basellm/llm-metadata`, the upstream project.
The `naoshengyun` remote and `gh` default target point to the organization fork.
Before the first tracker write in a session, verify the target:
`gh repo view naoshengyun/llm-metadata --json nameWithOwner`

Existing `tickets/` files remain historical references. Search existing GitHub
issues before creating new work; do not automatically migrate or duplicate them.

## Operations

- Create: `gh issue create --repo naoshengyun/llm-metadata --title "..." --body-file <file>`
- Read: `gh issue view <number> --repo naoshengyun/llm-metadata --json number,title,body,labels,comments`
- List: `gh issue list --repo naoshengyun/llm-metadata --state open --json number,title,body,labels`
- Comment: `gh issue comment <number> --repo naoshengyun/llm-metadata --body-file <file>`
- Label: `gh issue edit <number> --repo naoshengyun/llm-metadata --add-label "<label>"`
- Close: post the resolution comment, then run `gh issue close <number> --repo naoshengyun/llm-metadata`.
  Post comments separately even when the issue is already closed.

## Ticket relationships

Use native GitHub sub-issues and issue dependencies when available.
Check the installed gh help before choosing version-dependent flags or APIs.
If native relationships are unavailable, put `Part of #<parent>` and
`Blocked by: #<blocker>` at the top of the issue body.
A ticket is startable when all its blockers are closed.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Skill instructions

"Publish to the issue tracker" means create a GitHub issue in this repository.
"Fetch the relevant ticket" means read that GitHub issue and its comments.
Closing a development ticket does not imply production release or operational acceptance.
