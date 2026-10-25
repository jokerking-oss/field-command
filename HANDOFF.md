# 交接说明 · HANDOFF

> 给接手这个仓库的 AI / 开发者。
> 读完这份再动手。这里写的都是**踩过的坑**，不是客套话。
> 最后更新：2026-10-01（分支 `F2`）

---

## 0. 这是什么

**前线指令 · FIELD COMMAND** —— 浏览器玩的像素回合制战棋，支持单人对 AI 与 2–4 人局域网混战。

- **零依赖**：纯 Node.js，没有 `node_modules`，不用 `npm install`。
- **原始版本**由 Candelor0 创建，MIT 许可（见 `LICENSE`）。当前仓库在其授权下独立演进。
- 代码规模：约 11,400 行（含 CSS）。

---

## 1. 怎么跑起来（30 秒）

```bash
node server.mjs          # 或 npm start
# 打开 http://localhost:4173
```

- 需要 **Node ≥ 20**（本机实测 v22.22.2）。
- 服务默认监听 `0.0.0.0:4173`，可用 `PORT=xxxx node server.mjs` 改。
- Windows 可双击 `开始游戏.bat`，macOS 双击 `开始游戏.command`。
- **不要**用 `python -m http.server` 之类的静态服务替代 —— `server.mjs` 承担了服务端指令校验、SSE 广播与存档，静态服务跑不出完整游戏。

---

## 2. 怎么验证（重要）

### 2.1 单元测试

```bash
# 必须逐文件跑，不能 node --test test/
node --test test/engine.test.mjs
node --test test/renderer.test.mjs     # 若存在
# …… 逐个来
```

> **坑**：`node --test test/`（传目录）在本机会报 `MODULE_NOT_FOUND`。必须逐文件传路径。

当前基线：**9 个测试文件，67 项断言全绿**。

| 文件 | 断言数 |
|---|---|
| `engine.test.mjs` | 17 |
| `hero-cinematic.test.mjs` | 14 |
| `hud-layout.test.mjs` | 14 |
| `server.test.mjs` | 7 |
| `combat-visual.test.mjs` | 6 |
| `save-store.test.mjs` | 3 |
| `animation-timing.test.mjs` / `capture-scene.test.mjs` / `property-flag.test.mjs` | 各 2 |

### 2.2 浏览器端验证（可选，但改 UI 就必须做）

工作区里另有两个辅助服务（不在本仓库内）：

- **4189 静态服务**：以工作区根为根目录，供浏览器测试页加载被测代码。
  > **坑**：测试页必须与游戏**同源**。`4173` 没有开 CORS 头，从 `4189` 去 `fetch` 游戏页面会被浏览器拦掉，截出来是纯黑页。
- **4188 结果接收器**：测试页 `POST /result` 上报，`GET /harvest` 读回。

> **坑（最省时间的一条）**：`--virtual-time-budget` 在这套真实游戏页面上会**卡死**——页面有 SSE 长连接，浏览器永不进入 idle，虚拟时间推不动。要驱动真实页面，只能走 Chrome DevTools Protocol（`--remote-debugging-port` + `Page.captureScreenshot`），用真实等待。

仓库内自带三个开发/验证页（在 `public/` 下，与游戏同源）：
- `_devlook.html` —— 目视排版（抽顶栏 + 战场注入，挂真实 renderer）
- `_devgeom.html` —— 几何量测
- `_menucheck.html` —— 命令菜单时序/落位端到端验证（`?stage=select` / `?stage=move`）

它们从 `index.html` 派生、共用真实模块，**不是**可以随便删的临时文件。

---

## 3. 架构地图

```
server.mjs              Node HTTP + SSE；服务端校验指令，按房间广播状态
save-store.mjs          版本化原子持久化（临时文件 + fsync + 原子替换）+ .bak 回退

public/shared/
  engine.mjs            共享纯规则引擎：地图、兵种数据、移动/战斗/占领/生产/AI
                        ★ 纯函数、无 DOM 依赖，是唯一权威的事实来源
  animation-timing.mjs  动画时长常量（单帧/整格/交火节拍）
  hud-layout.mjs        命令菜单落位的纯函数（可单测，见 §5）

public/
  renderer.mjs          Canvas 像素绘制 + 交互坐标；1683 行，最核心
  app.mjs               界面逻辑：选中、拖拽、指令、房间、封面；1593 行
  unit-art.mjs          程序绘制的像素单位
  unit-direction.mjs    朝向
  unit-motion.mjs       步态 / 履带
  unit-death.mjs        击毁与倒地
  combat-scene.mjs      双军交火编排
  capture-scene.mjs     占领动画（升旗/降半旗的时序）
  property-flag.mjs     据点旗帜状态
  hero-cinematic.mjs    封面「循环战争」的纯函数时间轴
  index.html / style.css / aw-ui.css / aw-hud.css
  fonts/                Ark Pixel 12px（SIL OFL-1.1）+ 许可原文
```

**样式分成三层，刻意如此**（删一行 `<link>` 即可回退）：

| 文件 | 职责 |
|---|---|
| `style.css` | 原始基础样式（2512 行，改动要克制） |
| `aw-ui.css` | 界面语言层：色板变量、顶栏、主页全屏化 |
| `aw-hud.css` | HUD 层：点阵字体、面板浮层化、命令菜单、说明栏 |

---

## 4. 渲染机制（不懂这几条会写出"看不出效果"的代码）

1. **`setScene()` 是浅合并** —— `{...scene, ...next, state}`。只传你想改的字段。

2. **动画是"差分"出来的，不是"播放"出来的。**
   `renderer.mjs` 内部比较**上一帧 state** 与**这一帧 state**，自己推断出：谁移动了（补间）、谁开火了（交火姿态）、谁炸了（爆炸）、谁死了（倒地）。核心函数 `combatFromStates`。
   - **推论：每帧必须传一个「新对象」。** 原地改同一个对象再传进去 = 引用相等 = 不差分 = 画面不动。
   - **推论：改 state 就是改画面。** 想加新演出，不需要写播放器，只要按节拍推进 state。

3. **换 `mapId` = 让渲染器当新战场**，会清掉全部补间与爆炸状态。
   （判据是 `previousState.mapId === state.mapId`。）封面的"无缝重置"就靠这个。

4. **`scene` 是 `createRenderer()` 闭包内的 `let`，不是模块作用域。**
   > **坑（我在这上面炸过一次）**：把读 `scene.xxx` 的辅助函数写在**模块作用域**，测试全绿但渲染器整体崩溃（`ReferenceError: scene is not defined`），因为那条分支测试没走到。
   > **规则：凡引用 `scene` 的渲染辅助函数，必须定义在 `createRenderer()` 闭包内。**

5. **`eventTile()` 读 `getBoundingClientRect()`** —— 它返回**变换之后**的矩形。所以用 CSS `transform: scale()` 推镜头，cover 比例与点击命中会**自动跟随**，不需要改代码。（已实测。）

6. **坐标换算接口**：`renderer.tileToScreen(tileX, tileY)` → `{ x, y, cell }`，与命中测试**同源**。HUD 浮层要贴单位就调它，不要自己算。

---

## 5. UI 改造进度（F1 → F5）

工作分支 `F2`，`F1` 是**冻结基线**，见 §6。

| 轮次 | 做了什么 | 提交 |
|---|---|---|
| **F1** | 拖拽箭头 + 路径回退 + 链式寻路；卡顿与点击回归修复 | `5b83c42`（tag `F1`） |
| **F2** | 战场化大改：全屏战场、范围高亮重做、环形光标、伤害浮标 | `66f0f5d` `23675b7` |
| **F4** | 引入参考界面语言层 `aw-ui.css`；主页/战斗页全屏化 | `69051af` |
| **F5** | 点阵字体 + 右侧 268px 面板列收掉、全部浮层化 | `619981f` |
| **F5+** | 命令菜单：**落点确认后才出现** + **跟随终点框、贴它右上角** | `fd5019d` `bda79f6` `edbccf3` |
| **F5+** | 封面：从静态图换成一段永远演不完的**循环战争** | `f8eca7d` |

### 命令菜单的三次语义变更（别再改回去）

1. ~~单位正下方居中~~ → 正好压住刚展开的移动范围格，点目的地点到菜单。
2. ~~贴屏幕边缘~~ → 不挡了，但菜单钉死在屏幕边，离终点大半屏，视线要来回跳。
3. **✅ 跟随选定的终点格，贴它的右上角** —— 菜单左下角对齐终点格右上角，向右上展开，与终点格**永不重叠**。终靠右就翻左上，靠顶就翻右下（**只由视口逼出，不是偏好**）。

> 另一个根因教训：菜单"不跟随"的真正原因是 **`app.mjs` 的锚点取错了** —— 原来取部队当前位置，不是选定的终点格。摆位算法再对也没用。

实现：`public/shared/hud-layout.mjs` 的 `commandMenuPosition()`（纯函数，14 条单测）+ `app.mjs` 的 `positionCommandMenu()`。
定位后会把实际锚点回写 DOM（`data-anchor-x/y/cell/side/above`），端到端验证据此**断言几何**，不必靠肉眼读截图。

### 封面「循环战争」

- `public/hero-cinematic.mjs`：纯函数时间轴。一轮 14 秒的桥头攻防。
- **没有 mp4**。视频做不到首尾无缝（会跳帧）、占体积、像素风格接不上。
- **循环无缝的关键**：轮末硝烟涨满 → 在最浓处换 `mapId` → 渲染器当新战场清掉补间。淡出段放在**周期开头**，所以 t=0 与 t=14000⁻ 都是满烟，接缝才连续。
- **封面布阵必须自定义**：引擎默认布阵两军分踞 18×14 的对角，相距十几格，一次移动力走不到一起 —— 会变成"循环行军"。
- 路径全部由引擎 `reachable()` 现算，**不手写坐标**。
- 镜头推近 2 倍（`aw-ui.css` 里 `transform`）。不推近时一格只有 78px，坦克小到看不清在打什么。

---

## 6. 硬约束（红线，破了会出事）

1. **`F1` 是冻结基线，不许改写。**
   tag `F1`、提交 `5b83c42`、快照目录 `field-command-F1-snapshot/`。任何改造在 `F2` 及以后做。需要回退时这是唯一干净点。

2. **`path` 数组契约不能改。**
   `test/engine.test.mjs` 里有 `assert.deepEqual` 硬断言（约 130 行）锁定了 `path` 的结构。改结构必须同步改那个测试并说明理由。

3. **`engine.mjs` 是纯的。** 不要在里面引 DOM、`window`、`fetch`。它同时被服务端与浏览器加载。

4. **服务端指令必须校验。** `server.mjs` 不接受客户端传来的任意 state，只接受"指令"并在服务端重放。别为了让某个 UI 效果更快而开后门直传 state。

5. **`data/` 不进版本控制**（已 gitignore）。里面是存档与**重连凭证**，静态服务不暴露该目录。

6. **版权边界**：
   - `LICENSE`（MIT）只覆盖**代码**，原始作者 Candelor0。
   - 本项目用到的《高级战争》参考素材属**任天堂 / Intelligent Systems**。当前仓库里**没有任何一个像素拷贝**，只复刻了不受版权保护的视觉**规格**（色值、比例、字距、版式语法）。
   - 新增素材时请自己画，或者确认许可。**不要把别人的美术资源提交进来。**
   - `public/fonts/` 的 Ark Pixel 是 SIL OFL-1.1，许可原文随字体一起放在同目录，**不要删**。

7. **不引入 npm 依赖。** 这个项目"零依赖"是有意为之（双击就能跑）。要加依赖先证明非加不可。

---

## 7. 已知问题 / 未完成

### 已知 bug（未修）

- **移动判定顺序**：`handleTile()` 里格占用判定的顺序有缺陷，特定情况下会误判目标格是否可达。**根因已定位，未修。**

### 未做项

- 单位上的**状态角标**（已行动 / 正在占领 / 低血）
- **动态指令菜单**（按单位当前能做什么生成项，现在是固定集合）
- **主页登录 UI**：曾有个请求要把某参考项目的登录页移植过来，那项目根本没有登录页，此事**从未解决**，需要重新确认需求。
- 引擎层面未实现：海空军、战争迷雾、完整战役、地图编辑器（见 `README.md`）。

---

## 8. 环境坑（本机特有，换机器大概率不适用）

> 如果你**不在**原开发机上，这一节可以直接跳过。这里只是解释为什么某些命令长得很怪。

- **有个死代理**：`http_proxy=http://127.0.0.1:49678` 返回 502。所有 `curl` 必须加 `--noproxy '*'`；Edge 必须加 `--no-proxy-server`。
- **git 不在 PATH**，用的是 PortableGit：`.../PortableGit/versions/1.2.0/cmd/git.exe`。
- **Edge headless** 用于截图/DOM 导出：`--headless=new --disable-gpu --no-proxy-server --no-sandbox --virtual-time-budget=N --window-size=W,H`。
- **机器是 S0 低功耗待机（Modern Standby）机型**：空闲久了会**冻结后台进程**，三个服务会集体掉线。长任务期间不能关屏/合盖。
- **Node 用绝对路径**调：`C:/Users/<user>/.workbuddy/binaries/node/versions/22.22.2-3/node.exe`。

---

## 9. 动手前的建议顺序

1. `node server.mjs`，打开 `http://localhost:4173`，**先把游戏玩一遍**（点单位 → 拖拽出路线 → 落点确认 → 指令菜单 → 结束回合）。不知道它现在什么样，改不出好东西。
2. 跑一遍单元测试，确认 67/67 是绿的 —— 这是你的基线。
3. 读 `public/renderer.mjs` 的 `setScene` 与 `combatFromStates`（§4 第 2 条），**这是理解整个项目动画的钥匙**。
4. 再读 `public/app.mjs` 的选中/拖拽/指令三段。
5. 改 UI 时：**先跑 `_menucheck.html` 之类的真实页面验证**，别只跑单测。这个项目已经出过"单测全绿但渲染器整体崩溃"的事故（见 §4 第 4 条）。

---

## 10. 沟通约定（来自本项目历次返工）

这位需求方**不是开发者**，但判断力很强、会拆你的前提。几条已被验证有效的做法：

- **别给"照着做"的文档，直接做完。** 他的原话：「为什么非得我做？你不能替我做吗？」
- **先讲原理再动手**，涉及系统/视觉改动时先把选项摆出来。
- **不要说"玄乎"的话。** 格言体、对偶句、抽象总括会被直接驳回（原话：「你说的玄玄乎乎的，听不懂」）。要**短句 + 他的具体情境 + 数字**。
- **验证要给客观证据，不要"我觉得好看了"。** 这个项目的每次返工都源于此 —— 截图、量测、断言，比形容词管用。
- 需要他手动点一下的东西，**一律放到桌面**，中文命名。
