# dsh-skills-manager

Manage installed [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) skills from a dedicated **Settings page** — no more digging through the `/` picker.

- **Browse**: a new «Skills» settings page lists every installed skill (name, description, source, path, state) with search.
- **Disable / Enable**: disabling hides a skill from the `/` picker while keeping its files — re-enable anytime, no uninstall/reinstall.
- **Delete (trash)**: deletion moves the skill directory into `~/.dsh/.skill-trash/`, restorable with one click.
- **Delete forever**: trashed entries can be permanently purged (irreversible).
- **Built-in skills are read-only**: bundled skills shipped with the app are marked read-only and cannot be touched.

Works on both **DSH Desktop** and **`dsh web`**: the plugin only uses official DSH contracts (`typert` / `skills` / `fs` / `shell`, client `remote` / `slots` / `locale`) and no desktop-only services.

## Install

Once published to npm (`@jiangdaoli/dsh-skills-manager`):

```sh
dsh plugin --profile desktop add @jiangdaoli/dsh-skills-manager   # Desktop
# or
dsh plugin --profile web add @jiangdaoli/dsh-skills-manager       # web
```

Or install from **Settings → Plugins → Market** once the package is listed in a catalog source. Restart DSH after installing, then open **Settings → Skills**.

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

Local install test:

```sh
dsh plugin --profile skm-test add .
dsh --profile skm-test --dump-config
```

## Release

- npm package: `@jiangdaoli/dsh-skills-manager` (scoped, community convention)
- GitHub repo: [Jiangdl0220/dsh-skills-manager](https://github.com/Jiangdl0220/dsh-skills-manager) (topic: `dsh-plugin`)
- Publishing: push a `vX.Y.Z` tag; [GitHub Actions](.github/workflows/release.yml) publishes via **npm OIDC trusted publishing** (no long-lived npm token; first-time binding on npmjs.com is required — see the workflow comments)

## License

[MIT](LICENSE)
