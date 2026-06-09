# bill.bobos.farm — AI 拍照识别点单 · 设计

**日期:** 2026-06-05
**范围:** 给 bill 子域(`(bill)` 路由组)新增「拍照/选图 → AI 识别纸质·手写点单 → 自动匹配菜单 → 人工核对 → 并入购物车」的能力,仅对用 **111111** 高级密码登录的用户开放。

> **2026-06-09 放量:** 测试通过后已全量开放——AI 识别对所有已登录会话可用(888888 普通密码即可),`ai` session flag 不再被消费(基础设施保留,便于将来重新门控);列表页新增「拍照新建」入口。下文的 111111 门控描述仅为历史设计记录。

---

## 1. 背景与目标

现有 bill 子域流程:密码登录(`BILL_PASSWORD`)→ `/list` → `/new`(`ReceiptEditor` → `MenuView` 手动点菜 → `CheckoutView` 复核 → 保存 → 分享)。

手动点菜对一桌多品项的纸质单子较慢。目标:店员把**手写/打印的纸质点单**拍照(或从相册选图),AI 识别出菜品 + 数量,自动匹配到本店菜单填好购物车,店员核对后继续走现有结账流程。

**门槛:** 普通密码 **888888** 登录 → 看不到 AI;高级密码 **111111** 登录 → 解锁 AI。`111111` 既是登录口令,也是 AI 开关。

---

## 2. 用到的外部服务(已确认)

| 项 | 值 | 来源 |
|---|---|---|
| 模型 | `MiniMax-M3`(原生多模态,支持图片输入) | office 工作站 hermes `config.yaml`;[MiniMax 官方](https://www.minimax.io/blog/minimax-m3) 确认多模态 |
| Base URL | `https://api.minimaxi.com/v1`(OpenAI 兼容) | hermes `config.yaml` |
| API Key | `sk-c…`(env `MINIMAX_API_KEY`) | hermes `~/.hermes/.env` 的 `MINIMAX_CN_API_KEY` |

- Key 拷进本项目 `.env.local`(已被 `.gitignore` 忽略)+ 生产 Vercel env,**绝不进 git**。
- 备注:之前对话里贴的 `sk_live_51…` 是 Stripe 格式,作废不用。上线后建议给本项目单独申请 key,并轮换已暴露的那个。

---

## 3. 架构总览

```
登录页 (111111) ──signSession(ai=true)──▶ cookie: exp.ai.sig
                                              │
/new (server)  verifySession → {ok, ai} ──aiEnabled──▶ ReceiptEditor ──▶ MenuView
                                                                              │ (aiEnabled 时显示相机入口)
                                                       拍照/选图 → canvas 缩图转 JPEG
                                                                              │
                                              POST /api/bill/recognize (JSON: {image: dataURL})
                                                  ├─ 鉴权: session.ok && session.ai  否则 403
                                                  ├─ 取 active 菜单 → 编号清单
                                                  ├─ src/lib/bill/ai.ts: recognizeOrder()
                                                  │     └─ MiniMax-M3 vision → JSON 行
                                                  └─ 解析+zod+编号映射 → {matched[], unmatched[]}
                                                                              │
                                              RecognitionReview(确认页)
                                                  └─ 确认 → 并入 ReceiptEditor 购物车 → 回 MenuView
```

设计为可独立理解/测试的单元:`password`(口令→ai 判定)、`session`(ai 标记签名)、`ai`(模型调用+解析)、`recognize` 路由(鉴权+编排)、`RecognitionReview`(纯展示+编辑)。

---

## 4. 鉴权改造(111111 解锁 AI)

### 4.1 `src/lib/bill/password.ts`
- `verifyBillPassword(input, ip)` 返回类型由 `{ ok, throttled? }` 改为 `{ ok, ai, throttled? }`。
- 逻辑:先查限流;再依次与 `BILL_PASSWORD`(命中 → `{ ok:true, ai:false }`)、`BILL_AI_PASSWORD`(命中 → `{ ok:true, ai:true }`)做 constant-time 比较;都不中 → `recordFail` + `{ ok:false, ai:false }`。
- 两个口令都缺(env 未配)时与现状一致:`recordFail` + 失败。`BILL_AI_PASSWORD` 未配时,只是 AI 永不解锁,不影响普通登录。

### 4.2 `src/lib/bill/session.ts`
- cookie 格式由 `exp.sig` 升级为 **`exp.ai.sig`**:
  - `signSession(expiresAt, ai: boolean)` → payload `` `${exp}.${ai?1:0}` ``,`sig = HMAC(payload)`,返回 `` `${exp}.${ai?1:0}.${sig}` ``。
  - `verifySession(cookie)` → `{ ok, ai }`:
    - 3 段 → 校验 `sig=HMAC(`exp.aiFlag`)`、过期 → `{ ok, ai: aiFlag==='1' }`。
    - 2 段(旧 cookie)→ 按旧逻辑校验 `sig=HMAC(exp)`,通过则 `{ ok:true, ai:false }`(**向后兼容**,老会话仍有效但无 AI)。
    - 其它 → `{ ok:false, ai:false }`。
- `signSession` 签名变更,所有调用点同步传 `ai`。

### 4.3 `src/app/api/bill/auth/route.ts`
- 取 `verifyBillPassword` 返回的 `ai`,`signSession(expiresAt, result.ai)`。其余不变。

### 4.4 `src/lib/bill/middleware.ts`
- `handleBillSubdomain` 里 `const { ok } = await verifySession(...)` 改为解构出 `ai` 不是必须的(middleware 只管能不能进,不管 AI)。**不改门禁逻辑**;`ai` 的消费放在页面层与 recognize 路由。

### 4.5 页面传递 `aiEnabled`
- `src/app/(bill)/panel/new/page.tsx`(server component):读 cookie → `verifySession` → 把 `session.ai` 作为 `aiEnabled` 传给 `<ReceiptEditor aiEnabled={...} />`。
- `ReceiptEditor` 增加 `aiEnabled?: boolean` prop,透传给 `MenuView`。
- `MenuView` 增加 `aiEnabled?: boolean` prop,仅 `true` 时渲染相机入口。
- (编辑页 `/edit/[id]` 暂不加识别入口——识别只用于新建,YAGNI。)

### 4.6 安全
- recognize 路由**服务端独立校验** `session.ai`,不依赖前端是否显示按钮 → 防止有人直接打接口刷 API 费用。
- 弱口令(888888/111111)对内部小工具可接受;长期建议换强口令。文档中标注。

---

## 5. 识别接口 `POST /api/bill/recognize`

**位置:** `src/app/api/bill/recognize/route.ts`(走 `/api/bill/` 前缀,middleware 已归类为 authed)。

**鉴权:** 读 `bill_session` cookie → `verifySession` → `ok && ai` 否则 403。(middleware 已挡 401 未登录;此处再加 ai 校验。)

**入参:** JSON body `{ image: string }`,`image` 为前端缩图后的 JPEG **dataURL**(`data:image/jpeg;base64,…`,§7.2 产出)。服务端 zod 校验:必须 `data:image/jpeg;base64,` 前缀、解码后 ≤ ~2.5 MB,否则 400。dataURL 直接传给 `recognizeOrder`(§6),省一次转换。

**流程:**
1. `prisma.menuItem.findMany({ where:{ isActive:true }, include:{ category:true }, orderBy:[...] })`。
2. 生成**带 1 起编号**的紧凑清单:`` `${n}. ${nameZh ?? nameEn}${nameZh? ' / '+nameEn : ''} $${price.toFixed(2)}` ``。建立 `n → menuItem` 映射。
3. 调 `recognizeOrder(imageDataUrl, numberedMenu)`(§6)。
4. 校验返回(zod):`lines: { itemNo: number|null, rawText: string, quantity: number(>=1), confidence?: number }[]`。
5. 映射:`itemNo` 命中 → matched 行(带 `menuItemId, nameEn, nameZh, priceCents, quantity, rawText, confidence`);`itemNo===null` 或越界 → unmatched 行(`rawText, quantity, confidence`)。
6. 返回 `{ matched: [...], unmatched: [...] }`。
7. **不存照片、不写库。**

**错误处理:** 模型超时/非法 JSON/网络错 → 500 `{ error }`,前端提示「识别失败,请重试或手动点菜」。

---

## 6. 模型封装 `src/lib/bill/ai.ts`

`recognizeOrder(imageDataUrl: string, numberedMenu: string): Promise<RecognizedLine[]>`

- 读取 env:`MINIMAX_API_KEY`、`MINIMAX_BASE_URL`(默认 `https://api.minimaxi.com/v1`)、`BILL_AI_MODEL`(默认 `MiniMax-M3`)。缺 key → 抛错。
- `POST {BASE_URL}/chat/completions`(OpenAI 兼容),`Authorization: Bearer <key>`,body:
  - `model`、`temperature: 0`、`messages`:1 条 user,`content` 为数组:`{type:'text', text: <指令+菜单清单>}` + `{type:'image_url', image_url:{ url: imageDataUrl }}`。
  - 指令要点:这是一张手写/打印的餐厅点单照片;对照下面编号菜单,逐行输出 `{itemNo, rawText, quantity, confidence}`;找不到对应菜品时 `itemNo` 置 null;**只返回 JSON 数组,不要多余文字**。
- 解析:剥离可能的 ```` ```json ```` 围栏 → `JSON.parse` → zod 校验 → 返回。解析失败抛错由路由兜底。
- provider 细节(路径/响应字段)集中在此文件,方便日后换模型/网关。

> 实现时先用一张样例点单照片实测 `/v1/chat/completions` 路径与图片块格式;若 minimaxi 需要 `/text/chatcompletion_v2` 原生格式,只改本文件。

---

## 7. 前端

### 7.1 入口(`MenuView` 顶部)
- `aiEnabled` 时,header 右侧「返回」旁加一个相机图标按钮,点开一个小菜单/弹层给两个选项:
  - **拍照**:`<input type="file" accept="image/*" capture="environment">`
  - **从文件选择**:`<input type="file" accept="image/*">`(相册/已有图片)
- 选中文件 → 走 7.2。

### 7.2 客户端预处理
- canvas 缩图:最长边 ≤ ~1600px,导出 `image/jpeg` 质量 ~0.8 的 dataURL。
- 作用:统一把 iOS HEIC 等转成 JPEG;压体积省 token/费用;`<img>` 解码 + canvas 在所有目标浏览器可用。

### 7.3 识别 + 确认页 `RecognitionReview`
新组件 `src/app/(bill)/components/RecognitionReview.tsx`,在 `ReceiptEditor` 里作为第三种 view(`menu | checkout | recognize`),或独立浮层。
- 上传中:loading。
- 结果:
  - **已匹配区**:每行显示菜品名(中/英)、单价、数量步进器、删除;可点「换菜品」打开菜品选择改绑。
  - **未匹配区**:显示识别原文 + 数量,标注「未匹配」,点一下打开菜品选择手动绑定;或丢弃。
  - 底部:**确认并加入**(把所有"已绑定菜品 + 数量"`addOrIncrement` 合并进 `ReceiptEditor.items`,回到 `MenuView`)/ 取消。
- 复用现有色板与组件风格(`shadow-card`、`#1A1208` 等);菜品选择可复用 `MenuView` 的数据源 `/api/menu/items`。

### 7.4 合并语义
- 确认时对每个已绑定行调用既有 `addOrIncrement` 逻辑(同 `menuItemId` 累加数量),保证与手动点菜一致。

---

## 8. 环境变量

`.env.local`(dev)+ Vercel(prod)新增:
```
BILL_AI_PASSWORD=111111
MINIMAX_API_KEY=sk-c…              # 从 office hermes 拷,勿提交
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
BILL_AI_MODEL=MiniMax-M3
```
`BILL_PASSWORD=888888` 应已存在。

---

## 9. 测试

- `password.test.ts`:888888 → `{ok:true, ai:false}`;111111 → `{ok:true, ai:true}`;错误口令 → 失败 + 计入限流;超过阈值 → throttled。
- `session.test.ts`:`signSession(exp,true)` → `verifySession` 得 `{ok:true, ai:true}`;`ai:false` 同理;**旧两段 cookie** → `{ok:true, ai:false}`;篡改 sig/过期 → `{ok:false}`。
- `ai.test.ts`:给定模型 JSON(含带围栏 / 含 `itemNo:null` / 数量缺省)→ 解析、zod 校验、编号映射、matched/unmatched 拆分正确(`fetch` mock)。
- `recognize` 路由:无 cookie → 401(middleware)/ 有效但 `ai:false` → 403 / `ai:true` 正常返回(mock `recognizeOrder`)。

---

## 10. 范围裁剪(YAGNI)

- 仅图片(jpg/png/webp;HEIC 前端转 JPEG),**不做 PDF**。
- 照片**不存档**、不写库。
- 不做多张批量、不做识别历史。
- 识别入口只在 `/new`,不在 `/edit`。

需要时再加。

---

## 11. 已知风险

- 弱口令 backdoor:任何拿到 111111 的人都能进面板。后端 AI 闸挡住"白嫖 API"的主要成本风险;面板访问风险对内部工具可接受,长期建议换强口令。
- 手写潦草识别有错 → 强制确认页(已选)。
- 每次识别有 API 成本;key 暂与 hermes 共用,建议后续单独配。
- `MiniMax-M3` 的 `/chat/completions` 图片块格式以实测为准,差异只影响 `ai.ts`。
