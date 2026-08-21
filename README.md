# dsh-skills-manager

Manage installed [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) skills from a dedicated **Settings page** — no more digging through the `/` picker.

- **浏览**：设置面板新增「技能管理」页，列出所有已安装技能（名称、描述、来源、位置、状态），支持搜索过滤。
- **停用 / 启用**：停用后技能从 `/` 列表隐藏，但文件保留，随时可重新启用（无需卸载重装）。
- **删除（回收站）**：删除把技能目录移入 `~/.dsh/.skill-trash/`，可一键恢复。
- **彻底删除**：回收站条目可彻底清除（不可恢复）。
- **内置技能只读**：随应用分发的 bundled 技能标记为只读，不可误删。

同时支持 **DSH Desktop** 与 **`dsh web`**：插件只依赖官方 DSH contract（`typert` / `skills` / `fs` / `shell` / client `remote` / `slots` / `locale`），不涉及任何桌面专用服务。

## 安装

发布到 npm 后（`@jiangdaoli/dsh-skills-manager`）：

```sh
dsh plugin --profile desktop add @jiangdaoli/dsh-skills-manager   # Desktop
# 或
dsh plugin --profile web add @jiangdaoli/dsh-skills-manager       # web
```

也可以在 **设置 → 插件 → 市场** 中安装（需先在目录源中收录）。安装后重启 DSH，在 **设置 → 技能管理** 查看。

## 工作原理

| 操作 | 实现 |
| --- | --- |
| 停用 | 重命名 `<技能目录>/SKILL.md` → `SKILL.md.disabled`（技能文件系统 watcher 自动刷新，`/` 列表立即隐藏） |
| 启用 | 反向重命名 |
| 删除 | 移动到 `~/.dsh/.skill-trash/<name>-<ts>/` 并写入 `.json` 记录原始路径 |
| 恢复 | 按记录移回原位置 |
| 彻底删除 | `rm -rf` 回收站条目 |

安全边界：所有变更路径都经过 `fs.resolve` + `fs.contains` 守卫，只允许操作 `~/.dsh/skills`、`~/.agents/skills` 与回收站内的文件；内置（bundled）技能与运行时注册技能只读。

## 开发

```sh
pnpm install
pnpm build     # tsc 类型声明 + esbuild（lib/index.js host + lib/client.js 客户端 bundle）
pnpm typecheck
pnpm node test/core.test.mjs   # 核心逻辑测试（临时目录 + 假 fs/shell）
```

本地安装测试：

```sh
dsh plugin --profile skm-test add .
dsh --profile skm-test --dump-config
```

## 发布

- npm 包名：`@jiangdaoli/dsh-skills-manager`（scoped，社区约定）
- GitHub 仓库：[Jiangdl0220/dsh-skills-manager](https://github.com/Jiangdl0220/dsh-skills-manager)（topic: `dsh-plugin`）
- 发布：打 `vX.Y.Z` tag 触发 [GitHub Actions](.github/workflows/release.yml) 通过 **npm OIDC trusted publishing** 发布（无需长期 npm token；首次需在 npm 后台绑定仓库，见 workflow 注释）

## License

[MIT](LICENSE)
