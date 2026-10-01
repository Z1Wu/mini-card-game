# 柔和红调与回合提示（Issue #141）

承接 #139 的人物辨识度设计，保留同一角色的发色、瞳色、制服年级色、姿势及场景；用内置 ImageGen 逐张编辑，移除大片血迹，并改成柔和红色环境光。素材按实际卡面显示尺寸压缩，减少锐利纹理与传输量。

- 卡面：`frontend/src/assets/art/cards/*-soft-red-v3.webp`，480×720，约 26–44 KB。
- 桌面：`frontend/src/assets/art/tabletop-soft-red-v3.webp`，959×540，约 55 KB。
- 最终编辑提示词：`docs/soft-red-art-prompts.json`。旧版本素材保留。
- 卡牌名称提高字号；底色按胜利条件视觉分组，统一牌背不暴露角色。
- 调和卡面及长按详情不显示优先级；隐藏牌的数值仍不公开。
- `TurnAnnouncement` 根据游戏 ID、回合计数与当前玩家 ID 去重；初始回合也提示，2.2 秒自动消失，快速切换会重启计时。提示不拦截鼠标/触摸，支持减少动态效果。
- 预览：`/fixtures/card-art`；回合演示：`/fixtures/game-table?turns=1`。
- 验证：Vitest、lint、build，九组桌面布局、全角色素材加载，以及 `e2e/capture-turn-announcement.mjs` 回合动画检查。
