# CLAUDE.md

This file provides project-specific guidance for Claude Code. Update this file whenever Claude does something incorrectly so it learns not to repeat mistakes.

## Project Overview

React 19 + TypeScript + Vite app with Tailwind CSS, React Router, and Lucide icons.

## Development Workflow

Give Claude verification loops for 2-3x quality improvement:

1. Make changes
2. Run typecheck
3. Lint before committing
4. Before creating PR: run full lint and typecheck

## Code Style & Conventions

- Prefer `type` over `interface`; never use `enum` (use string literal unions instead)
- Use descriptive variable names
- Keep functions small and focused
- Handle errors explicitly, don't swallow them
- No `any` type in TypeScript without explicit approval

## Commands Reference

```sh
npm run dev          # Start dev server
npm run build        # Type check + build
npm run lint         # Lint all files
npm run preview      # Preview production build
```

## Self-Improvement

After every correction or mistake, update this CLAUDE.md with a rule to prevent repeating it. Claude is good at writing rules for itself.

End corrections with: "Now update CLAUDE.md so you don't make that mistake again."

Keep iterating until the mistake rate measurably drops.

## Working with Plan Mode

- Start every complex task in plan mode (shift+tab to cycle)
- Pour energy into the plan so Claude can 1-shot the implementation
- When something goes sideways, switch back to plan mode and re-plan. Don't keep pushing.
- Use plan mode for verification steps too, not just for the build

## Parallel Work

- For tasks that need more compute, use subagents to work in parallel
- Offload individual tasks to subagents to keep the main context window clean and focused
- When working in parallel, only one agent should edit a given file at a time
- For fully parallel workstreams, use git worktrees:
  `git worktree add .claude/worktrees/<name> origin/main`

## Automation

- Use `/loop` to run a skill on a recurring interval (e.g., `/loop 5m /babysit`)
- Turn repetitive workflows into skills, then loop them for hands-free automation

## Things Claude Should NOT Do

- Don't use `any` type in TypeScript without explicit approval
- Don't skip error handling
- Don't make breaking API changes without discussion
- Don't add features, refactor, or introduce abstractions beyond what the task requires

## Project-Specific Patterns

- State lives in `src/store.ts`
- Shared types live in `src/types.ts`
- Utility functions live in `src/utils/`
- Page-level components live in `src/pages/`
- Reusable UI components live in `src/components/`

---

_Update this file continuously. Every mistake Claude makes is a learning opportunity._
