# 前端功能实现审查

审查时间：基于当前代码与后端协议对照。

---

## 已修复的问题

### 1. 出卡方式与后端不一致（会导致出卡失败）

- **问题**：前端 `CardUsageType` 使用英文 `'harmony'` / `'doubt'` / `'skill'`，后端期望中文 `'调和'` / `'质疑'` / `'特技'`，后端解析会报 `Invalid usage type`。
- **修复**：`frontend/src/types/game.ts` 中 `CardUsageType` 已改为与后端一致的中文枚举值。

### 2. 登录成功后的状态与跳转

- **问题**：`login_success` 时未用服务端返回的 `player_id`/`player_name` 同步 store，且未重置 `isConnecting`。
- **修复**：在 Login 的 `handleLoginSuccess` 中根据 `message.player_id` / `player_name` 调用 `setPlayer`，并 `setIsConnecting(false)`。

### 3. 游戏结束未展示

- **问题**：未监听 `game_over`，也未在界面展示获胜者。
- **修复**：Game 页监听 `game_over` 与 `game_state.state === 'game_over'`，设置 `winnerId` 并渲染结束页（获胜者 + “返回登录”按钮）。

### 4. 未登录可访问 /lobby、/game

- **问题**：直接访问 `/lobby` 或 `/game` 无校验，可能出现空 `playerId`。
- **修复**：Lobby 与 Game 的 `useEffect` 中若 `!playerId` 则 `navigate('/', { replace: true })`。

---

## 仍存在的限制（未改代码）

### 1. 质疑 / 特技缺少目标玩家选择

- **现象**：后端对「质疑」和部分「特技」（如班长、保健委员、风纪委员、大小姐等）需要 `target_player_id`，前端出卡时未传。
- **影响**：选「质疑」或需目标的「特技」时，后端会因缺少目标或校验失败而拒绝。
- **建议**：在选「质疑」或需目标的「特技」时，先弹出/展开“选择目标玩家”，再组 `play_card` 的 `target_player_id` 发送。可参考 `backend/game/rules.py` 中 `_play_doubt_card` 与 `_execute_card_effect` 的 target 要求。

### 2. 特殊阶段（优等生闭眼）未做 UI

- **现象**：后端有 `SPECIAL_PHASE` 与 `honor_student_response` 消息类型，前端未处理。
- **影响**：优等生发动特技时，其他玩家无法在界面上“举手”等响应。
- **建议**：当 `game_state.state === 'special_phase'` 时展示简单说明 + 响应按钮，并发送 `honor_student_response`。

### 3. playerStore.isConnected 与真实连接不同步

- **现象**：`isConnected` 仅在 Login 里 `setConnected(true)` 和 disconnect 时更新，WebSocket 断线/重连时未与 `wsService` 状态同步。
- **影响**：大厅等页面可能误显示“已连接”或“未连接”。
- **建议**：在 `wsService` 的 onopen/onclose 中通知 store 更新 `isConnected`，或在 useWebSocket 中根据连接状态同步到 store。

### 4. 进入 Game 页未主动拉取一次 game_state

- **现象**：仅依赖后端广播的 `game_state`，若进页时漏掉一次广播会一直“加载中”。
- **建议**：Game 页 mount 时若已连接则发一次 `get_game_state`（需后端支持），或由 Lobby 在 start_game 后携带/写入当前 game_state 再跳转。

---

## 与后端的消息对照（简要）

| 前端发送 | 后端处理 | 说明 |
|----------|----------|------|
| `login` | ✅ | username/password，与后端一致 |
| `start_game` | ✅ | player_id，与后端一致 |
| `play_card` | ✅ | usage_type 已改为中文；target_player_id 质疑/部分特技必填，前端暂未选目标 |
| `get_game_state` | ✅ | 后端有，前端 Game 页可考虑进入时发一次 |
| `reconnect` | ✅ | 类型有，未在本次审查中验证流程 |
| `honor_student_response` | ✅ | 后端有，前端未接/未发 |

| 后端推送 | 前端处理 | 说明 |
|----------|----------|------|
| `login_success` | ✅ | 已用 player_id/player_name 同步并跳转 |
| `player_list` | ✅ | Lobby 展示 |
| `game_state` | ✅ | Lobby/Game 更新 store，并用于 game_over 展示 |
| `game_over` | ✅ | Game 页展示结束与获胜者 |
| `error` | ✅ | Login/Lobby 均有展示 |

---

## 小结

- **出卡、登录同步、游戏结束、路由保护** 等已按上面说明修复，可与当前后端正常配合完成基本对局。
- **质疑/特技选目标、优等生阶段、连接状态同步、进入 Game 拉取状态** 仍为已知限制，可按需在后续迭代中补全。
