# dsh-skills-manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@jiangdaoli/dsh-skills-manager` — a publishable DSH plugin (desktop + web) that adds a «技能管理» Settings page listing every installed user skill with enable/disable/trash/restore/delete-forever actions.

**Architecture:** Host half is a Typert Remote service (`skillsmgr` namespace) backed by `ctx.skills` (authoritative catalog) + `ctx.fs` (reads) + `ctx.shell` (mv/rm mutations). Client half registers a `settings.section` page and calls the remote namespace through the typert gateway. Disable = rename `SKILL.md` → `SKILL.md.disabled` (the skill filesystem watcher hides it from the `/` picker automatically). Delete = move into `~/.dsh/.skill-trash/<name>-<ts>` with an `.origin` sidecar for restore. Only user roots (`~/.dsh/skills`, `~/.agents/skills`) and the trash are mutable; bundled/built-in skills are read-only. Follows the proven conventions of the author's `dsh-archived-sessions` plugin (esbuild ModuleLoader bundle, OIDC npm publish).

**Tech Stack:** TypeScript, Cordis, esbuild, zod, Typert Remote protocol, React 18, pnpm.

**Spec:** see `docs/superpowers/specs/2026-08-21-skills-manager-design.md` (design approved in chat 2026-08-21).

## Global Constraints

- Package name `@jiangdaoli/dsh-skills-manager`; repo `Jiangdl0220/dsh-skills-manager`; GitHub topic `dsh-plugin`.
- Only official DSH contracts: `typert`, `skills`, `fs`, `shell`, client `remote`/`slots`/`locale`. No desktop-only services.
- No `preinstall`/`install`/`postinstall`/`prepare` lifecycle scripts (Community Market fail-closed rejects them). `prepublishOnly` is allowed.
- Mutable paths must pass the path guard: resolve via `ctx.fs` and verify containment inside a user root or the trash root; never touch bundled.
- Wire codecs (zod) shared verbatim between host manifest and client contribution.
- Client bundle format: `window.__ModuleLoader__.load({id, factory})`; host is ESM.

---
