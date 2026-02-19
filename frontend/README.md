# 卡牌游戏前端

多人在线卡牌游戏前端实现，使用 React + TypeScript + Vite。

## 技术栈

- **React 18+**: UI 框架
- **TypeScript**: 类型安全
- **Vite**: 构建工具
- **Tailwind CSS**: 样式框架
- **Zustand**: 状态管理
- **React Router**: 路由管理
- **WebSocket**: 实时通信

## 项目结构

```
frontend/
├── src/
│   ├── components/      # 组件
│   │   ├── common/     # 通用组件
│   │   ├── game/       # 游戏组件
│   │   └── layout/     # 布局组件
│   ├── pages/          # 页面
│   ├── hooks/          # 自定义 Hooks
│   ├── stores/         # 状态管理
│   ├── services/       # 服务层
│   ├── types/          # 类型定义
│   ├── utils/          # 工具函数
│   └── assets/        # 静态资源
├── public/            # 公共资源
├── package.json
└── vite.config.ts
```

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

`.env` 文件内容：

```env
VITE_WS_URL=ws://localhost:8765
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 4. 构建生产版本

```bash
npm run build
```

### 5. 预览生产版本

```bash
npm run preview
```

## 功能特性

### 已实现

- ✅ WebSocket 连接管理
- ✅ 玩家加入游戏
- ✅ 游戏大厅
- ✅ 游戏主界面
- ✅ 卡牌显示
- ✅ 出卡功能
- ✅ 游戏状态同步
- ✅ 响应式设计

### 待实现

- ⏳ 游戏结果页面
- ⏳ 卡牌动画效果
- ⏳ 音效和背景音乐
- ⏳ 游戏规则说明
- ⏳ 设置页面
- ⏳ 好友系统
- ⏳ 排行榜

## 页面说明

### 首页 (/)
- 输入玩家名称
- 加入游戏
- 连接到 WebSocket 服务器

### 大厅 (/lobby)
- 查看玩家列表
- 等待其他玩家
- 开始游戏（需要至少 3 名玩家）

### 游戏页面 (/game)
- 查看其他玩家
- 查看调和区
- 查看自己的手牌
- 出卡操作
- 游戏状态同步

## 开发指南

### 添加新组件

1. 在 `src/components/` 下创建组件文件
2. 导出组件
3. 在页面中使用

### 添加新页面

1. 在 `src/pages/` 下创建页面文件
2. 在 `src/App.tsx` 中添加路由

### 添加新的 WebSocket 消息类型

1. 在 `src/types/message.ts` 中定义消息类型
2. 在 `src/services/websocket.ts` 中添加处理逻辑
3. 在组件中使用 `wsService.on()` 监听消息

### 状态管理

使用 Zustand 进行状态管理：

```typescript
import { useGameStore } from '../stores/gameStore';

function MyComponent() {
  const { gameState, setGameState } = useGameStore();
  
  // 使用状态
  console.log(gameState);
  
  // 更新状态
  setGameState(newState);
}
```

## 测试

### 手动测试

1. 启动后端服务器
2. 启动前端开发服务器
3. 打开多个浏览器窗口
4. 以不同玩家身份加入游戏
5. 测试游戏流程

### 自动化测试

待实现...

## 部署

### Vercel

1. 推送代码到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

### Docker

```bash
docker build -t card-game-frontend .
docker run -p 3000:80 card-game-frontend
```

### 静态托管

```bash
npm run build
# 将 dist 目录部署到任何静态托管服务
```

## 常见问题

### WebSocket 连接失败

1. 确保后端服务器正在运行
2. 检查 `.env` 文件中的 `VITE_WS_URL` 是否正确
3. 检查防火墙设置

### 样式不生效

1. 确保已安装 Tailwind CSS
2. 检查 `tailwind.config.js` 配置
3. 清除缓存并重新构建

### 类型错误

1. 确保 TypeScript 版本正确
2. 运行 `npm run build` 检查类型错误
3. 检查 `tsconfig.json` 配置

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License
