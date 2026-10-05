# 面试准备网站：首版架构与跨端扩展边界

首版采用 React / Vinext、REST `/api/v1` 和 Cloudflare D1。题库由 PDF 导入的静态 JSON 提供，D1 保存按用户隔离的训练进度。当前交付范围是网站；微信小程序客户端、微信登录和账号绑定尚未实现。学习、自评和订正展示不需要 AI API。

## 题库与订正

- `question-bank.json` 是可复用内容源，包含 `schemaVersion`、`sources` 和 `questions`。首次导入共有 9 份来源、2,464 条题目记录；保留总册与专题册各自的出处。
- `questions[].id` 是稳定题目 ID，例如 `multimodal-6.2.2`；API 和进度中的 `questionId` 对应此字段。ID 不因排序、界面语言或答案编辑改变，原题号另存于 `number`。后续改版使用迁移映射，不重新按数组位置编号。
- 保留 `sourceId`、章节、题干、考点、解答过程、原答案和 `pageStart` / `pageEnd`。缺失答案用显式标记表示。
- 订正以独立数组保存，使用 `questionId` 关联原题，包含 `kind`、`title`、`body` 和官方参考链接。页面区分原答案、订正与编辑解读，不静默改写来源文字。
- 相似题可以归入重复主题组，但不能仅凭标题相似就合并记录或覆盖出处。

## REST 契约与共享边界

| 操作 | 接口 | 约定 |
| --- | --- | --- |
| 筛选和搜索 | `GET /api/v1/questions` | 支持来源、章节、关键词和有界分页；列表返回摘要 |
| 题目详情 | `GET /api/v1/questions/{questionId}` | 返回原内容、出处及独立订正 |
| 读取个人进度 | `GET /api/v1/progress` | 只返回当前认证用户的数据 |
| 保存单题进度 | `PUT /api/v1/progress/{questionId}` | 输入校验、幂等写入，并返回服务器保存的状态 |

接口使用 UTF-8 JSON、稳定错误码和明确的 HTTP 状态。请求体不提供可任意指定的 `userId`。保留内容版本与进度版本，便于后续处理客户端缓存和跨设备冲突。契约可用一份 OpenAPI 文档描述，首版不需要搭建多套 SDK 生成流程。[OpenAPI 官方规范](https://spec.openapis.org/oas/v3.1)

可共享的是数据结构、校验、筛选、训练队列和统计等纯 TypeScript 逻辑。网络、认证、存储、页面与日期显示通过平台适配层处理；共享逻辑不依赖 DOM、React 页面生命周期或浏览器本地存储。

## D1 与个人训练进度

进度以 `(userId, questionId)` 建立唯一约束，保存学习状态、收藏、笔记、复习次数和更新时间。所有查询、写入和删除都用服务端验证的用户身份限定范围；认证信息不能由客户端自报的用户 ID 代替。SQL 使用参数绑定。[D1 prepared statements 官方文档](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)

查看题目、揭示答案与自评掌握度是不同动作。建议状态为 `unseen`、`learning`、`mastered`，收藏和笔记独立保存。服务器生成 UTC 时间；日期展示和连续学习天数按明确的用户时区计算。浏览器缓存只改善交互，D1 是云端进度来源。记录练习次数时要防止重试重复计数；跨设备更新应检测冲突，避免静默覆盖笔记或学习状态。

## 界面语言与内容语言

首版界面支持 `zh-CN` / `en`，题干、原答案和现有订正仍为中文。用 `uiLocale` 和 `contentLanguage: "zh-CN"` 分别表示两者，英文界面明确提示题库内容当前为中文。切换界面语言不改变题目 ID 或个人进度。

导航、按钮、状态、错误、分类标签和数字日期格式进入界面字典；题库原文保持独立。将来翻译题库时，按题目 ID、目标语言和来源内容版本保存翻译，标注翻译状态，不复制成新的训练题目。

## 微信小程序：未来接入

未来小程序复用同一题库和 REST API，单独实现页面及 `wx.request` 网络适配器。微信逻辑层不是浏览器，不能直接沿用依赖 `window` / `document` 的前端模块。[微信逻辑层官方说明](https://developers.weixin.qq.com/miniprogram/dev/framework/app-service/)

当前 `wx.request` 文档的方法列表包含 GET、POST、PUT、DELETE 等，未列 PATCH；原生 Promise 风格标为不支持。因此进度接口采用 PUT，未来适配器包装回调并检查 `statusCode`，不能把 `success` 回调直接当作业务成功。[wx.request 官方文档](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html)

正式接入前需配置通讯域名、HTTPS 和有效证书，并满足官方域名要求；开发工具跳过域名校验不能代替真机验证。客户端还需处理请求并发、超时以及进入后台后的中断。[微信网络官方说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)

未来微信认证采用 `wx.login` 获取 code、服务端调用 code2Session、生成自有登录态。AppSecret 和 session_key 保留在服务器。微信身份映射到网站内部用户 ID，已有网站账号需通过验证后绑定；不能假设 UnionID 总是可用或仅凭昵称合并账号。[微信登录官方说明](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)

## 验收重点

1. 题目 ID 唯一，题目和订正关联正确，PDF 出处可追溯。
2. 中英文界面切换不改变中文题目、训练队列和个人进度。
3. 同一账号跨浏览器恢复进度；不同账号无法读取或修改彼此数据。
4. 网络重试不重复累计复习，跨设备修改不静默丢失。
5. 未登录请求不能访问个人进度；服务器拒绝伪造身份和无效题目 ID。
6. API 能由普通 HTTP 客户端调用，未来小程序只需新增平台适配与身份绑定。
7. 网站验收与未来微信真机、域名及账号绑定验收分开记录，不将架构预留表述为小程序已经交付。
