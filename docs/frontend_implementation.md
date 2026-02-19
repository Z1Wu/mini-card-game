# 前端实现方案

## 1. 技术栈选择

### 1.1 核心框架
- **React 18+**: 组件化开发，生态丰富
- **TypeScript**: 类型安全，提高代码质量
- **Vite**: 快速的构建工具，开发体验好

### 1.2 状态管理
- **Zustand**: 轻量级状态管理，适合小型项目
- **React Context**: 用于全局状态（如用户信息）

### 1.3 UI 框架
- **Tailwind CSS**: 快速构建响应式 UI
- **Headless UI**: 无样式组件库，可定制性强
- **Framer Motion**: 动画效果

### 1.4 WebSocket 通信
- **WebSocket API**: 原生 WebSocket
- **useWebSocket**: 自定义 Hook 管理 WebSocket 连接

### 1.5 工具库
- **axios**: HTTP 请求（如果有 REST API）
- **dayjs**: 日期处理
- **clsx**: 类名合并
- **react-hot-toast**: 消息提示

## 2. 项目结构

```
frontend/
├── public/
│   ├── index.html
│   └── favicon.ico
├── src/
│   ├── assets/              # 静态资源
│   │   ├── images/
│   │   └── styles/
│   ├── components/          # 公共组件
│   │   ├── common/         # 通用组件
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── Toast.tsx
│   │   ├── game/           # 游戏相关组件
│   │   │   ├── GameBoard.tsx
│   │   │   ├── PlayerHand.tsx
│   │   │   ├── HarmonyArea.tsx
│   │   │   ├── OpponentArea.tsx
│   │   │   └── Card.tsx
│   │   └── layout/         # 布局组件
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── Sidebar.tsx
│   ├── pages/              # 页面
│   │   ├── Home.tsx        # 首页
│   │   ├── Lobby.tsx       # 大厅
│   │   ├── Game.tsx        # 游戏页面
│   │   └── Result.tsx      # 结果页面
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useWebSocket.ts
│   │   ├── useGameState.ts
│   │   └── useCard.ts
│   ├── stores/             # 状态管理
│   │   ├── gameStore.ts
│   │   └── playerStore.ts
│   ├── services/           # 服务层
│   │   ├── websocket.ts
│   │   └── gameService.ts
│   ├── types/              # 类型定义
│   │   ├── game.ts
│   │   ├── card.ts
│   │   └── player.ts
│   ├── utils/              # 工具函数
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   │   └── validators.ts
│   ├── App.tsx             # 根组件
│   ├── main.tsx            # 入口文件
│   └── vite-env.d.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

## 3. 核心功能模块

### 3.1 WebSocket 连接管理

#### 3.1.1 WebSocket Hook
```typescript
// hooks/useWebSocket.ts
interface WebSocketHook {
  connect: (url: string) => void;
  disconnect: () => void;
  send: (message: any) => void;
  isConnected: boolean;
  lastMessage: any;
  error: Error | null;
}

export const useWebSocket = (): WebSocketHook => {
  // WebSocket 连接管理
  // 消息发送和接收
  // 错误处理
  // 重连机制
};
```

#### 3.1.2 消息类型定义
```typescript
// types/message.ts
type MessageType = 
  | 'join_game'
  | 'join_success'
  | 'start_game'
  | 'play_card'
  | 'game_state'
  | 'game_over'
  | 'error';

interface WebSocketMessage {
  type: MessageType;
  [key: string]: any;
}
```

### 3.2 游戏状态管理

#### 3.2.1 游戏状态 Store
```typescript
// stores/gameStore.ts
interface GameState {
  gameId: string;
  state: 'waiting' | 'playing' | 'ended';
  players: Player[];
  currentPlayerIndex: number;
  harmonyArea: Card[];
  winner: string | null;
}

interface GameStore {
  gameState: GameState | null;
  setGameState: (state: GameState) => void;
  updatePlayer: (playerId: string, updates: Partial<Player>) => void;
  addCardToHarmony: (card: Card) => void;
  resetGame: () => void;
}
```

#### 3.2.2 玩家状态 Store
```typescript
// stores/playerStore.ts
interface PlayerStore {
  playerId: string;
  playerName: string;
  isConnected: boolean;
  setPlayer: (id: string, name: string) => void;
  setConnected: (connected: boolean) => void;
}
```

### 3.3 游戏页面组件

#### 3.3.1 游戏主界面
```typescript
// pages/Game.tsx
export const Game = () => {
  const gameState = useGameStore();
  const { send } = useWebSocket();

  return (
    <div className="game-container">
      <Header />
      <OpponentArea />
      <HarmonyArea />
      <PlayerHand />
      <ActionButtons />
    </div>
  );
};
```

#### 3.3.2 玩家手牌组件
```typescript
// components/game/PlayerHand.tsx
export const PlayerHand = () => {
  const { gameState } = useGameStore();
  const { send } = useWebSocket();

  const handlePlayCard = (card: Card, usageType: CardUsageType) => {
    send({
      type: 'play_card',
      player_id: gameState.currentPlayer.id,
      card_id: card.id,
      usage_type: usageType,
    });
  };

  return (
    <div className="player-hand">
      {gameState.currentPlayer.hand.map(card => (
        <Card
          key={card.id}
          card={card}
          onPlay={handlePlayCard}
        />
      ))}
    </div>
  );
};
```

#### 3.3.3 卡牌组件
```typescript
// components/game/Card.tsx
interface CardProps {
  card: Card;
  onPlay?: (card: Card, usageType: CardUsageType) => void;
  isPlayable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}

export const Card = ({ card, onPlay, isPlayable, isSelected, onClick }: CardProps) => {
  return (
    <div
      className={clsx(
        'card',
        { 'playable': isPlayable },
        { 'selected': isSelected }
      )}
      onClick={onClick}
    >
      <div className="card-header">
        <span className="card-name">{card.name}</span>
        <span className="card-cost">{card.cost}</span>
      </div>
      <div className="card-body">
        <p className="card-description">{card.description}</p>
      </div>
      <div className="card-footer">
        <span className="card-harmony">{card.harmony_value}</span>
      </div>
      {onPlay && (
        <div className="card-actions">
          <button onClick={() => onPlay(card, 'harmony')}>调和</button>
          <button onClick={() => onPlay(card, 'doubt')}>质疑</button>
          <button onClick={() => onPlay(card, 'skill')}>特技</button>
        </div>
      )}
    </div>
  );
};
```

## 4. UI/UX 设计

### 4.1 设计原则
- **移动优先**: 优先考虑手机端体验
- **简洁明了**: 界面清晰，操作简单
- **响应式**: 适配不同屏幕尺寸
- **流畅动画**: 使用 Framer Motion 添加动画效果

### 4.2 页面布局

#### 4.2.1 首页
- 游戏标题和简介
- "开始游戏" 按钮
- "游戏规则" 按钮
- "设置" 按钮

#### 4.2.2 大厅
- 玩家列表
- 当前玩家数量
- "开始游戏" 按钮（当玩家数量 >= 3 时可用）
- "离开游戏" 按钮

#### 4.2.3 游戏页面
```
┌─────────────────────────┐
│       Header            │
├─────────────────────────┤
│    Opponent Area        │
│  (其他玩家的手牌数量)   │
├─────────────────────────┤
│    Harmony Area         │
│   (调和区的卡牌)        │
├─────────────────────────┤
│    Player Hand          │
│   (当前玩家的手牌)      │
├─────────────────────────┤
│    Action Buttons       │
│  (出卡、跳过等操作)    │
└─────────────────────────┘
```

#### 4.2.4 结果页面
- 游戏结果（胜利/失败）
- 获胜玩家信息
- "再来一局" 按钮
- "返回大厅" 按钮

### 4.3 颜色方案
- **主色调**: 蓝色系（科技感）
- **强调色**: 橙色（重要操作）
- **背景色**: 深色模式（游戏氛围）
- **文字色**: 白色/浅灰色

### 4.4 卡牌设计
- **卡牌尺寸**: 移动端 80x120px，桌面端 100x150px
- **卡牌样式**: 圆角矩形，带阴影
- **卡牌背面**: 统一的卡背图案
- **卡牌正面**: 包含卡牌名称、描述、费用、调和值

## 5. 移动端适配

### 5.1 响应式设计
```css
/* 移动端 */
@media (max-width: 768px) {
  .card {
    width: 80px;
    height: 120px;
  }
  
  .player-hand {
    gap: 8px;
  }
}

/* 桌面端 */
@media (min-width: 769px) {
  .card {
    width: 100px;
    height: 150px;
  }
  
  .player-hand {
    gap: 12px;
  }
}
```

### 5.2 触摸优化
- 卡牌点击区域足够大
- 支持长按查看卡牌详情
- 支持滑动操作（如选择目标玩家）
- 防止误触（添加确认对话框）

### 5.3 性能优化
- 使用虚拟滚动（如果卡牌数量很多）
- 懒加载图片
- 使用 React.memo 优化组件渲染
- 使用 useMemo 和 useCallback 优化计算

## 6. 开发计划

### 6.1 第一阶段：基础框架（1-2 周）
- [ ] 项目初始化（Vite + React + TypeScript）
- [ ] 配置 Tailwind CSS
- [ ] 创建项目结构
- [ ] 实现路由（React Router）
- [ ] 实现基础布局组件

### 6.2 第二阶段：WebSocket 连接（1 周）
- [ ] 实现 WebSocket Hook
- [ ] 实现消息类型定义
- [ ] 实现连接管理
- [ ] 实现消息发送和接收
- [ ] 实现错误处理和重连机制

### 6.3 第三阶段：游戏页面（2-3 周）
- [ ] 实现游戏主界面
- [ ] 实现玩家手牌组件
- [ ] 实现卡牌组件
- [ ] 实现调和区组件
- [ ] 实现对手区域组件
- [ ] 实现操作按钮组件

### 6.4 第四阶段：游戏逻辑（2 周）
- [ ] 实现出卡逻辑
- [ ] 实现游戏状态更新
- [ ] 实现胜利条件检查
- [ ] 实现游戏结束处理

### 6.5 第五阶段：其他页面（1 周）
- [ ] 实现首页
- [ ] 实现大厅页面
- [ ] 实现结果页面
- [ ] 实现设置页面

### 6.6 第六阶段：优化和测试（1-2 周）
- [ ] 移动端适配优化
- [ ] 性能优化
- [ ] 动画效果优化
- [ ] 测试和修复 bug

## 7. 技术难点和解决方案

### 7.1 WebSocket 连接稳定性
**问题**: 网络不稳定导致连接断开
**解决方案**: 
- 实现自动重连机制
- 心跳检测
- 连接状态提示

### 7.2 游戏状态同步
**问题**: 多个客户端状态不一致
**解决方案**:
- 以服务端状态为准
- 使用乐观更新（Optimistic Updates）
- 实现状态回滚机制

### 7.3 移动端性能
**问题**: 移动端性能较差
**解决方案**:
- 使用虚拟滚动
- 懒加载图片
- 减少不必要的渲染
- 使用 Web Workers 处理复杂计算

### 7.4 触摸操作体验
**问题**: 触摸操作不如鼠标精确
**解决方案**:
- 增大点击区域
- 添加触觉反馈
- 实现手势操作
- 防止误触

## 8. 测试策略

### 8.1 单元测试
- 使用 Vitest 进行单元测试
- 测试核心逻辑函数
- 测试自定义 Hooks

### 8.2 集成测试
- 使用 Playwright 进行 E2E 测试
- 测试完整的游戏流程
- 测试 WebSocket 通信

### 8.3 手动测试
- 在不同设备上测试
- 测试不同浏览器兼容性
- 测试网络不稳定情况

## 9. 部署方案

### 9.1 构建配置
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['framer-motion'],
        },
      },
    },
  },
});
```

### 9.2 部署选项
- **Vercel**: 自动部署，支持 HTTPS
- **Netlify**: 简单易用，支持表单
- **GitHub Pages**: 免费，适合静态网站
- **Docker**: 与后端一起部署

### 9.3 Docker 部署
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 10. 后续优化

### 10.1 功能增强
- 添加音效和背景音乐
- 添加游戏回放功能
- 添加好友系统
- 添加排行榜

### 10.2 性能优化
- 使用 Service Worker 缓存资源
- 实现离线模式
- 优化图片加载
- 使用 CDN 加速

### 10.3 用户体验优化
- 添加新手引导
- 添加成就系统
- 添加个性化设置
- 添加多语言支持
