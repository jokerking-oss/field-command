# 封面素材来源与许可

> 本文件记录 `public/media/` 下素材的**出处、许可、加工方式**。
> 起因：这层背景是外部素材，不是本项目原创，必须留下可追溯的记录 ——
> 将来换素材、对外发布、或者有人问「这段视频哪来的」，都以此为准。

---

## 当前使用的素材

| 项 | 值 |
|---|---|
| 文件 | `public/media/intro-loop.mp4`（4.3 MB，1280×720，25fps，10.0s） |
| 静态帧 | `public/media/intro-poster.jpg`（视频加载前的占位图） |
| 素材站 | [Mixkit](https://mixkit.co/)（免费素材站） |
| 素材 id | **23049** |
| 原片名 | *Soldiers walking in the forest* |
| 原片页 | https://mixkit.co/free-stock-video/soldiers-walking-in-the-forest-23049/ |
| 原片时长 | 16.92s |
| 画面内容 | 士兵小队在树林中持枪推进，右侧有腾起的烟雾 |

### ⚠️ 许可：Mixkit Restricted License（仅限个人 / 非商业用途）

原片页面标注为 **Restricted License**，页面按钮与 `copyrightNotice`
均写明 **"720p Version for Personal Use only"** / **"for personal use only"**。

**可以**：自己玩、放本机、局域网联机、发给朋友、个人展示。
**不可以**：上架、收费、接广告、打赏、任何形式的商业分发。

> 注意：该素材页的 JSON-LD 里 `description` 字段写了一段
> "commercial and non-commercial projects worry-free"，**与页面主体自相矛盾**。
> 以按钮文案与 `copyrightNotice` 为准 —— 即 **Restricted / 个人使用**。
> 不要被那段 JSON-LD 误导。

**用户已于 2026-10-01 确认本项目为个人自用、不商用**，故当前可用。

### 将来要商用怎么办

不用改一行代码，**替换 `public/media/intro-loop.mp4` 即可**。
建议直接录制本游戏自己的对局画面做成循环视频（`_dragtest/` 下有截图工具可参考），
这样版权 100% 自有，风格也和游戏内一致。要求：

- 容器 MP4 / H.264 / `yuv420p`
- 尺寸 1280×720（`object-fit: cover` 会自动裁切，别差太多即可）
- 时长 8–12s
- **首尾画面状态要接近**，否则循环会跳（见下）
- 无音轨（页面按 `muted` 播放）

---

## 这段循环是怎么做出来的

原始素材 **没有任何一支是天然无缝的**（10 支候选全部验过，直接首尾相接都会跳）。
做法是：**从原片里找出首尾画面状态最接近的一段，直接硬切**。

1. 对全片按 4fps 抽帧，缩到 16×9 灰度当指纹；
2. 滑动窗口算「第 i 帧 vs 第 i+N 帧」的平均灰度差，取差值最小的窗口；
3. 结果：**`6.75s → 16.75s`**（10 秒窗口，灰度差 **25.69**，全片最低）。

**为什么硬切而不是交叉溶接**：先试过 `xfade` 溶接（首尾各 1.2s 重叠淡化），
在 `t=7.5s` 那一带留下了**明显的鬼影**——两名士兵叠成两个半透明人影。
原因是画面里人物运动幅度大，淡化会把两个姿态一起显出来。
改用「首尾状态本来就接近 + 硬切」之后，接缝处士兵位置、烟雾形态、光照都对得上，
肉眼看不出来。

**复现命令**（需要 ffmpeg）：

```bash
# 裁出最佳窗口（-ss 起点 -t 时长），不重编码之外的任何处理
ffmpeg -y -ss 6.75 -t 10 -i 原片.mp4 -an \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  intro-loop.mp4
```

---

## 候选素材留档

调研时下载了 10 支候选，原件与对照图在**工作区**（不在仓库里，避免仓库体积膨胀）：

- 原始 720p：`_vidref/mp4/`（10 支）
- 每支 4 帧内容抽检：`_vidref/CONTENT.png`
- 内容 + 首尾接缝总览：`_vidref/REVIEW.png`
- 最终接缝验证：`_vidref/SEAM_TEST.png`

顺带记录一个限制：**YouTube / Vimeo / Bilibili 在本机网络下不可达**（返回 000），
所以无法从那些「战争片排行榜」类平台直接取素材。Mixkit 是当时唯一稳定可达、
且画质对得上写实 + 电影感的免费素材站。
