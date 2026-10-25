/**
 * HUD 摆位计算（纯函数，无 DOM 依赖）。
 *
 * 单独成模块的理由：这段算术最容易错，而它又**只能在浏览器里出效果**——
 * 以前埋在 app.mjs 内部，node 测试因为 app.mjs 顶层就摸 document 而无法 import，
 * 于是「点不到、被挡住」这类问题只能靠肉眼截图抓，回归代价极高。
 * 抽出来之后 test/hud-layout.test.mjs 可以直接钉住行为。
 */

/** 顶栏高度（aw-ui.css 里 .topbar 的通栏高度）。 */
export const TOPBAR_H = 52;
/** 底部说明栏高度（aw-hud.css 里 .command-bar）。 */
export const COMMAND_BAR_H = 30;
/** 贴屏幕边留缝（只在终点格太靠边、需要夹紧时才会用到）。 */
export const EDGE_GAP = 12;
/** 菜单与终点格之间的最小缝。 */
export const MIN_GAP = 8;
/** 菜单与终点格之间的最大缝——格越大缝越宽会让菜单"飘"，所以封顶。 */
export const MAX_GAP = 16;

/**
 * 命令菜单的中心点该落在哪儿。
 *
 * ★ 定位语义：**跟随选定的终点格，贴在它的右上角**。
 *   菜单的**左下角**对齐终点格右上角，向右上方展开，因此
 *   菜单与终点格本身**永不重叠**——玩家始终看得见、点得到自己选的落点。
 *
 * ★ 演进史（三条错解，别走回头路）：
 *   ① 「单位正下方居中」——正好糊在刚展开的移动范围格上，点目的地点到菜单。
 *   ② 「贴单位左右侧边」——菜单半宽 88px，格半宽在 cover 下 50px，
 *      怎么摆都吃掉相邻格，把可达范围挖掉一块。
 *   ③ 「贴屏幕边缘 + 垂直错开」——不挡了，但菜单钉死在屏幕左/右边，
 *      与终点格相距大半屏，视线要来回跳，用户判词是"要跟随"。
 *   ④ 现方案：贴在终点格右上角。既不压终点格，又与它贴身相邻。
 *
 * ★ 两个方向的翻边规则（都是视口逼的，不是偏好）：
 *   · 水平：右侧装不下菜单 → 翻到终点格左上角，向左展开。
 *   · 垂直：上方装不下菜单 → 翻到终点格右下角，向下展开。
 *   翻边后仍夹紧在顶栏/说明栏/屏幕边之内，任何视口尺寸都不产生越界或 NaN。
 *
 * @param {{anchorX:number, anchorY:number, menuW:number, menuH:number,
 *          vw:number, vh:number, cell?:number}} input
 * @returns {{cx:number, cy:number, side:"right"|"left", above:boolean}}
 *          菜单中心点（配 CSS `translate(-50%,-50%)`）；side/above 描述实际展开方向
 */
export function commandMenuPosition({
  anchorX,
  anchorY,
  menuW,
  menuH,
  vw,
  vh,
  cell = 40,
}) {
  const half = Math.max(0, cell) / 2;
  // 缝随格宽走（cover 放大后格约 101px，小缝会显得粘连），但夹在 8–16
  const gap = Math.max(MIN_GAP, Math.min(MAX_GAP, half * 0.32));

  const minTop = TOPBAR_H + 6;
  const maxBottom = vh - COMMAND_BAR_H - 6;

  // ── 水平：首选从终点格**右边缘**外起，向右展开 ──────────────────────
  let left = anchorX + half + gap;
  let side = "right";
  if (left + menuW > vw - EDGE_GAP) {
    // 右侧装不下 → 翻到格左边缘外，向左展开
    left = anchorX - half - gap - menuW;
    side = "left";
  }
  // 夹紧进视口。菜单比视口还宽（极端窄屏）时退化为贴 0，至少能看见左边。
  left =
    menuW + EDGE_GAP * 2 <= vw
      ? Math.min(Math.max(left, EDGE_GAP), vw - EDGE_GAP - menuW)
      : Math.max(0, Math.min(left, vw - menuW));

  // ── 垂直：首选菜单**底边**贴着终点格上边缘，即整体在格上方 ──────────
  let top = anchorY - half - gap - menuH;
  let above = true;
  if (top < minTop) {
    // 上方装不下 → 翻到格下边缘外，向下展开
    top = anchorY + half + gap;
    above = false;
  }
  // 夹紧。可用带比菜单还矮时贴住上界，宁可压家具也不能算出 NaN。
  top =
    menuH <= maxBottom - minTop
      ? Math.min(Math.max(top, minTop), maxBottom - menuH)
      : minTop;

  return { cx: left + menuW / 2, cy: top + menuH / 2, side, above };
}
