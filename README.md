# AI 面试练习室

从 9 份 PDF 导入的个人面试准备网站：2,464 道题、177 章、669 节、1,920 页。

支持全文检索、专题/章节/状态筛选、随机练习、答案展开、自评、收藏、笔记和到期复习。题目保留原始题号与 PDF 物理页码；25 道缺失答案明确标记；27 条经资料核对的订正和范围提示独立展示，不覆盖原答案。

界面默认中文，可切换英文；题干、答案、章节名称和订正目前均为中文。切换界面语言不会改变题目 ID 或学习记录。

## 本地运行

要求 Node.js 22.13 以上，使用项目锁文件安装依赖。

```powershell
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_soft_logan.sql
npm run dev
```

迁移仅对尚未应用的本地数据库运行一次。预览地址以终端输出为准。便携模式通过 `/signin-with-chatgpt?return_to=/` 登录本地模拟账号 Seedy；生产身份由 Sites 平台提供。

## 文件结构

- `data/question-bank.json`：稳定题号、题干、考点、解答、原答案、来源页码。
- `data/corrections.json`：独立的订正、范围说明和参考链接。
- `public/sources/`：9 份原 PDF，支持 `#page=` 定位。
- `lib/contracts.ts`：不依赖 React 或浏览器的共享数据与 HTTP 接口类型。
- `lib/i18n.ts`：中英文界面字典和专题名称。
- `lib/client.ts`：网站的 fetch 适配器。
- `app/api/v1/`：版本化 REST 接口。
- `db/schema.ts`、`drizzle/`：学习记录表及迁移。
- `docs/architecture.md`、`docs/openapi.json`：后续小程序与国际化扩展说明、接口契约。

学习记录保存在 D1，按平台认证用户 ID 与题目 ID 隔离。revision 防止跨窗口覆盖，mutationId 使提交重放不重复计数。时间以 UTC 存储；待加强安排 1 天后复习，已掌握安排 7 天后复习。浏览器只保存语言偏好和当前标签页的未提交草稿。

## 验证

```powershell
npx tsc --noEmit
node scripts/verify-api.mjs http://127.0.0.1:5173
python scripts/verify_progress_sql.py --progress-source lib/progress.ts --schema-sql drizzle/0000_soft_logan.sql
```

API 验证仅允许本地地址，会在本地模拟账号下保存验证记录。本地 `.wrangler/` 数据不进入源码或部署包。SQL 验证使用真实迁移及源码 SQL，覆盖用户隔离、CAS 竞争、幂等重放及 RETURNING 返回行稳定性。

本次还通过浏览器验证了笔记保存/刷新恢复、登录前草稿保留、收藏、自评、语言切换、订正与空答案、空搜索结果、专题随机练习、390px 手机布局和手机导航。网站检索/打开题目的 WebMCP 工具已在支持的浏览器中验证有效与无效输入。

## 更新资料与后续扩展

`scripts/import_questions.py` 支持 `--text-dir`、`--pdf-dir`、`--output`、`--reextract`。当前导入器针对这 9 份资料；新增资料时先添加来源配置并核对题数。导入需要 pdfplumber 与 pypdf，抽取缓存和原始文本不进入部署包。

微信小程序尚未实现。下一阶段可复用题库、稳定 ID、接口契约和共享逻辑，新增 wx.request 适配器、微信登录与内部用户绑定、正式通讯域名及部署配置。现有私有 Sites 登录不能直接替代微信认证。多语言题目应按 questionId、locale 和 sourceRevision 单独维护翻译，避免修改原文或重置进度。
