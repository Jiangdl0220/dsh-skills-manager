# dsh-skills-manager

> Manage installed [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) skills from a dedicated **Settings page** — browse the full skill catalog (no more digging through the `/` picker), search, disable/enable without reinstalling, and delete into a restorable trash. Works on desktop and web.

DSH skills are only visible through the `/` command in the composer, with no way to disable or remove them. This plugin adds a «Skills» settings page that turns the skill catalog into a manageable list.

## Screenshots

<!-- Drop screenshots into docs/screenshots/ and reference them below with `![alt](docs/screenshots/file.png)` -->
![Skills management list](docs/screenshots/skills-list.png)

## Features

- **Full skill list**: every installed skill (name, description, source, path, state) with **search** and **pagination** (20 per page) — no more paging through the `/` picker.
- **Disable / Enable**: disabling hides a skill from the `/` picker while keeping its files — re-enable anytime, no uninstall/reinstall.
- **Delete (trash)**: deletion moves the skill directory into `~/.dsh/.skill-trash/`, restorable with one click.
- **Delete forever**: trashed entries can be permanently purged (irreversible).
- **Built-in skills are read-only**: bundled skills shipped with the app are marked read-only and cannot be touched.

Works on both **DSH Desktop** and **`dsh web`**: the plugin only uses official DSH contracts (`typert` / `skills` / `fs` / `shell`, client `remote` / `slots` / `locale`) and no desktop-only services.

## Install

```sh
dsh plugin --profile desktop add @jiangdaoli/dsh-skills-manager   # Desktop
# or
dsh plugin --profile web add @jiangdaoli/dsh-skills-manager       # web
```

After install + restart, open **Settings → Skills**.

> **Install from npm** (the package name above). This GitHub repo contains source only — the built `lib/` artifacts are produced by CI at release time, so installing straight from the repo would miss files. To install from source, run `pnpm install && pnpm build` first.

## How it works

| Action | Implementation |
| --- | --- |
| Disable | Rename `<skill-dir>/SKILL.md` → `SKILL.md.disabled` (the skill filesystem watcher refreshes automatically; the `/` picker hides it immediately) |
| Enable | Reverse rename |
| Trash | Move to `~/.dsh/.skill-trash/<name>-<ts>/` and write a `.json` sidecar with the original path |
| Restore | Move back to the recorded original location |
| Delete forever | `rm -rf` the trash entry |

Safety boundary: every mutation path passes an `fs.resolve` + `fs.contains` guard and is confined to `~/.dsh/skills`, `~/.agents/skills`, and the trash root; bundled and runtime-registered skills are read-only.

## Development

```sh
pnpm install
pnpm build     # tsc declarations + esbuild (lib/index.js host + lib/client.js client bundle)
pnpm typecheck
pnpm node test/core.test.mjs   # core logic tests (temp dirs + fake fs/shell)
```

## License

[MIT](LICENSE)
