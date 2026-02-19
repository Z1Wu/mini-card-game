# MCP 浏览器使用指南

在 Cursor 里让 AI 用“浏览器”测试前端，需要先启用并配置 MCP（Model Context Protocol）的浏览器能力。有两种方式：内置浏览器 MCP 和第三方 Playwright MCP。

---

## 一、MCP 基础：在哪里配置

1. **设置入口**  
   - 左下角齿轮 **设置 (Settings)** → **Features** → **MCP**  
   - 或直接打开 **Cursor Settings**，搜索 “MCP”

2. **配置文件（二选一或同时用）**  
   - **项目级**：项目根目录 `.cursor/mcp.json`（只对当前项目生效，可提交到 Git 共享）  
   - **全局**：`~/.cursor/mcp.json`（对所有工作区生效）

3. **生效方式**  
   - 修改 `mcp.json` 后需要 **重启 Cursor**，MCP 在启动时加载。  
   - 在 **Composer / Agent 模式** 下，MCP 工具才会对 AI 可见、可调用。

---

## 二、方式一：内置 cursor-ide-browser

Cursor 自带一个名为 **cursor-ide-browser** 的 MCP 服务（你项目下的 `mcps/cursor-ide-browser/` 即其元数据）。

**如何确认是否启用：**

1. 打开 **Cursor Settings** → **MCP**（或 Features → MCP Servers）。  
2. 查看列表中是否有 **cursor-ide-browser** 或 “Browser” 等内置项。  
3. 若有 “Add New MCP Server” 或“从目录添加”，可在这里添加/启用内置浏览器（具体名称以你当前 Cursor 版本为准）。

**已知问题：**  
部分 Cursor 版本存在 bug：内置浏览器 MCP 在一个系统里注册，但执行命令时在另一套里查找，导致调用 `browser_navigate` 等工具时报 “No server found with tool: browser_navigate” 或 **available tools 为空**。若你遇到这种情况，用下面的“方式二”更稳妥。

---

## 三、方式二：第三方 Playwright MCP（推荐）

用社区维护的 **@playwright/mcp**，通过 `mcp.json` 配置，AI 可以控制 Playwright 浏览器（打开页面、点击、输入等），适合做前端自动化测试。

**1. 确保本机已安装 Node.js（建议 18+）**

```bash
node -v
```

**2. 在项目里添加 MCP 配置**

在项目根目录创建或编辑 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "browser": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

**3. 重启 Cursor**

完全退出 Cursor 再打开当前项目。

**4. 验证**

- 打开 **Composer / Agent**（例如 `Cmd+I` 或 `Ctrl+I`）。  
- 在输入框或上下文里可以看到/选择 “Available Tools” 或类似入口。  
- 若配置成功，应能看到与 browser/playwright 相关的工具（如打开页面、截图、点击等，具体名称以 Playwright MCP 文档为准）。

之后你可以直接对 AI 说：“用浏览器打开 http://localhost:3002 并测试登录流程”，AI 会尝试调用这些工具。

---

## 四、使用时的注意点

- **只在 Composer/Agent 中可用**：普通聊天窗口不会加载 MCP 工具，要在 Agent/Composer 里对话。  
- **明确让 AI 用浏览器**：可以说“用 MCP 浏览器打开 xxx”“用 Playwright 打开前端页面并点击登录”等。  
- **工具审批**：若 Cursor 设置了“执行前询问”，第一次调用 MCP 工具时会弹出确认，需要你允许。  
- **前端与后端要已启动**：例如后端 `ws://localhost:8765`、前端 `http://localhost:3002`，否则 AI 打开的页面会连不上。

---

## 五、可选：仅本机使用、不提交的配置

若你希望 MCP 配置只在本机生效、不提交到 Git，可以：

- 使用 **全局** `~/.cursor/mcp.json` 配置 browser；  
- 或在项目 `.gitignore` 中加入 `.cursor/mcp.json`，再在本地创建 `.cursor/mcp.json`。

这样团队其他人不会受你本机 MCP 配置影响。

---

## 六、小结

| 方式           | 优点           | 缺点 / 注意           |
|----------------|----------------|------------------------|
| 内置 cursor-ide-browser | 无需额外安装   | 部分版本有 bug，工具可能不可用 |
| Playwright MCP | 稳定、可自动化测试 | 需 Node、需在 mcp.json 中配置 |

**推荐**：若内置浏览器工具一直不可用，在项目或全局的 `mcp.json` 里加上 `@playwright/mcp`，重启 Cursor 后在 Agent 里用“用浏览器打开并测试前端”即可。

---

## 七、调试 Playwright MCP 是否工作正常

如果 Cursor 里看到类似 `sh -c playwright-mcp` 或不确定 Playwright MCP 是否被正确启动，可以按下面方式在本地验证。

### 1. 确认命令和依赖

项目里实际配置的是 **npx** 启动，不是单独的 `playwright-mcp` 可执行文件：

```bash
# 检查 Node / npx
node -v   # 建议 18+
which npx

# 看 Playwright MCP 是否可执行、版本与帮助
npx -y @playwright/mcp@latest --help
```

能正常打出帮助说明包已能运行。

### 2. 用 stdio 发 MCP 请求（最直接）

Playwright MCP 默认用 **stdio** 通信：从标准输入读 JSON-RPC，向标准输出写响应。在终端里发一条合法的 **initialize** 请求，看是否有正常 JSON 响应：

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | timeout 5 npx -y @playwright/mcp@latest 2>&1
```

**正常时**会看到类似：

```json
{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"Playwright","version":"0.0.68"}},"jsonrpc":"2.0","id":1}
```

说明进程能启动、能解析 MCP 并返回 `serverInfo`，即 **Playwright MCP 工作正常**。

若报错 `Invalid input: expected string, received undefined` 等，多半是上面 `params` 里少写了 `protocolVersion` / `capabilities` / `clientInfo`，按上面完整 payload 再试即可。

### 3. 用 MCP Inspector 调试（可选）

想可视化查看 MCP 的 tools、请求与响应，可以用官方 Inspector：

```bash
npx @modelcontextprotocol/inspector npx -y @playwright/mcp@latest
```

然后在浏览器打开 `http://localhost:5173`，在 Inspector 里可以看到该 MCP 暴露的 tools 并手动发请求，确认 `browser_navigate`、`browser_snapshot` 等是否可用。

### 4. 在 Cursor 里确认

- **Settings → MCP**：看是否有对应 Playwright 的条目（如 `browser` 或 `project-0-card_game_dev-browser`），状态是否为已连接/绿色。
- **Agent 里**：让 AI “列出当前可用的 MCP tools”，看是否包含 `project-0-card_game_dev-browser-browser_navigate` 等。

### 5. 关于 `sh -c playwright-mcp`

若日志或界面里出现 **`sh -c playwright-mcp`**，通常是 Cursor 用 shell 去执行「名为 playwright-mcp 的命令」。你当前配置里没有单独安装 `playwright-mcp` 这个命令，实际用的是：

- **command**: `npx`
- **args**: `["-y", "@playwright/mcp@latest"]`

所以若看到 `sh -c playwright-mcp` 且失败，多半是 Cursor 某处用了错误命令；确认 `mcp.json` 里是上面的 `npx` + `@playwright/mcp@latest`，并用**步骤 2** 在终端验证该命令工作正常即可。
