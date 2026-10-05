# 使用 GitHub Actions 发布到 GitHub Pages

项目提供独立的 GitHub Pages 静态版本，复用题库、中英界面、检索、练习、收藏、笔记、自评和复习逻辑。原有 Sites 版本及账号数据库保持独立。

GitHub Pages 只托管静态文件，不能运行本项目的 `/api/v1/` 服务端接口或 D1 数据库。因此 Pages 版本直接读取打包的题库，将学习记录保存在当前浏览器的本地存储中，不要求 ChatGPT 登录。

当前公开仓库：[RyanCheng08/ai-interview-lab](https://github.com/RyanCheng08/ai-interview-lab)，已配置 GitHub Actions 作为 Pages 来源。

已通过静态构建与 TypeScript 检查；真实题库测试覆盖检索、分页、筛选、并发进度、备份校验和合并。浏览器验证了笔记与收藏刷新恢复、导出/导入 JSON、中英界面、PDF 子路径和 390px 手机导航。

## 首次发布

1. 将 `interview-lab` 项目作为 GitHub 仓库根目录上传；根目录应包含 `package.json`、`package-lock.json` 和 `.github/workflows/pages.yml`。使用 `main` 作为默认分支。
2. 打开仓库的 **Settings → Pages**，在 **Build and deployment → Source** 中选择 **GitHub Actions**。
3. 推送到 `main`，或在 **Actions → Publish interview lab to GitHub Pages → Run workflow** 选择 `main` 手动运行。
4. 查看工作流的 `build` 和 `deploy` 两个作业。部署成功后，`github-pages` 环境与 **Settings → Pages** 会显示实际访问地址。

普通项目仓库的地址通常是 `https://<用户名>.github.io/<仓库名>/`；用户或组织主页仓库可使用域名根路径。工作流从 `configure-pages` 获取实际 `base_path`，为静态资源和原 PDF 链接设置正确前缀，自定义域名无需手写仓库路径。[GitHub 官方发布配置说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)、[configure-pages 输出定义](https://github.com/actions/configure-pages/blob/v6/action.yml)。

工作流在 PR 中执行依赖安装、类型检查、本地存储验证与静态构建，不部署 PR。部署仅允许默认分支；若改名默认分支，需要同步修改工作流中 `push` 和 `pull_request` 的 `branches: [main]`。

## 浏览器学习记录与备份

Pages 上的收藏、笔记、掌握状态和复习安排保存在浏览器中。写入需要安全上下文中的 Web Locks，当前主流浏览器的 HTTPS 页面支持；不支持时保留阅读并提示保存失败，避免跨标签页覆盖。刷新和关闭网页后仍可恢复，但换浏览器、换设备、清除站点数据或使用隐私模式时，记录不能自动同步。

使用页面提供的进度导出功能下载 JSON 备份，再在另一个浏览器中导入；导入按题目合并，保留较新的记录，并刷新版本以防旧窗口覆盖。未保存草稿不会进入备份。备份包含个人笔记和学习记录，请保存在自己的位置；无需提交到 GitHub 仓库。更新同一地址的静态题库时，稳定题目 ID 会保留已有记录。

原私有 Sites 网站的账号记录保存在 D1，不会自动导入 Pages 本地存储。Pages 的浏览器备份用于 Pages 版本之间迁移，不会自动连接 Sites 数据库。若将来需要跨设备账号同步，需另行部署认证与存储服务。

## 本地构建和预览

需要 Node.js 24 或符合项目要求的版本。先按锁文件安装依赖，再构建 Pages 版本：

```powershell
npm ci
npx tsc --noEmit
node scripts/verify-pages-storage.mjs
npm run build:pages
npm run preview:pages
```

构建输出为 `pages-dist/`，预览地址以终端输出为准。模拟项目仓库子路径时，设置实际仓库名：

```powershell
$env:VITE_BASE_PATH = '/ai-interview-lab/'
npm run build:pages
npm run preview:pages
```

预览时访问输出 URL 下的 `/ai-interview-lab/`。取消该环境变量后再构建，可恢复根路径构建。部署只上传 `pages-dist/`，不会上传本地数据库、环境变量、个人笔记或开发缓存。

## 发布范围与排查

GitHub Pages 网站通常公开可访问。当前静态发布包包含完整题库、订正和 `public/sources/` 下的原 PDF；个人本地进度不会进入发布包。仓库是否能使用 Pages 与 GitHub 套餐及可见性有关，以仓库 **Settings → Pages** 的可用选项为准。[GitHub 官方可用范围及公开访问说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

- **`Read Pages configuration` 失败**：先确认该仓库已在 Settings 中选择 GitHub Actions 作为 Pages 来源，且操作者有仓库管理权限。
- **部署权限或环境限制失败**：检查仓库是否允许 Actions，以及 `github-pages` 环境是否允许默认分支部署。工作流内已设置 `pages: write` 与 `id-token: write`。[官方自定义工作流要求](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
- **静态资源或 PDF 返回 404**：确认发布的是 `pages-dist/`，并使用工作流给出的实际 Pages 地址；自定义域名应在 GitHub Pages 设置中配置。
- **学习记录消失**：核对是否换了浏览器或站点域名。恢复此前导出的 JSON 备份；没有备份的已清除浏览器数据无法由 GitHub Actions 恢复。

此发布路径不需要 Cloudflare、Sites 访问凭据或额外的 GitHub Personal Access Token。GitHub Actions 使用仓库提供的 `GITHUB_TOKEN` 和部署 OIDC 身份；首次开启 Pages 可由仓库管理员在 Settings 中完成。
