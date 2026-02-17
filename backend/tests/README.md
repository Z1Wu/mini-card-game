# 测试说明

## 测试目录结构

```
tests/
├── unit/              # 单元测试（不需要外部依赖）
│   ├── test_basic.py
│   ├── test_cards.py
│   └── test_game_state.py
├── e2e/               # E2E 集成测试（需要运行中的服务端）
│   ├── test_game_flow.py
│   └── test_client.py
└── __init__.py
```

## 测试类型

### 单元测试 (Unit Tests)
- **位置**: `tests/unit/`
- **标记**: `@pytest.mark.unit`
- **特点**:
  - 不需要外部依赖
  - 不需要运行服务端
  - 执行速度快
  - 测试单个函数或类

### E2E 集成测试 (End-to-End Tests)
- **位置**: `tests/e2e/`
- **标记**: `@pytest.mark.e2e`
- **特点**:
  - 需要运行中的服务端
  - 测试完整的游戏流程
  - 使用 WebSocket 客户端
  - 执行速度较慢

## 运行测试

### 运行所有单元测试
```bash
cd backend
uv run pytest tests/unit/ -v
```

### 运行所有 E2E 测试
```bash
# 终端1：启动服务端
cd backend
uv run python main.py

# 终端2：运行 E2E 测试
cd backend
uv run pytest tests/e2e/ -v -s
```

### 使用标记运行测试
```bash
# 只运行单元测试
uv run pytest -m unit -v

# 只运行 E2E 测试
uv run pytest -m e2e -v

# 排除 E2E 测试
uv run pytest -m "not e2e" -v
```

### 运行特定测试文件
```bash
# 单元测试
uv run pytest tests/unit/test_basic.py -v -s
uv run pytest tests/unit/test_cards.py -v
uv run pytest tests/unit/test_game_state.py -v

# E2E 测试
uv run pytest tests/e2e/test_game_flow.py -v -s
```

### 运行特定测试函数
```bash
# 单元测试
uv run pytest tests/unit/test_basic.py::test_game_state -v -s
uv run pytest tests/unit/test_cards.py::test_create_card_deck -v

# E2E 测试
uv run pytest tests/e2e/test_game_flow.py::test_basic_flow -v -s
```

## 使用 Docker 运行 E2E 测试

### 启动服务端
```bash
docker-compose up -d backend
```

### 运行 E2E 测试
```bash
docker-compose exec backend uv run pytest tests/e2e/ -v -s
```

### 停止服务端
```bash
docker-compose down
```

## 测试标记

| 标记 | 说明 | 依赖 |
|------|------|------|
| `@pytest.mark.unit` | 单元测试 | 无 |
| `@pytest.mark.e2e` | E2E 集成测试 | 需要运行中的服务端 |
| `@pytest.mark.slow` | 慢速测试 | 可能有外部依赖 |

## CI/CD 集成

### GitHub Actions 示例
```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: |
          cd backend
          pip install uv
          uv sync
      - name: Run unit tests
        run: |
          cd backend
          uv run pytest -m unit -v

  e2e-tests:
    runs-on: ubuntu-latest
    services:
      backend:
        image: card_game_backend
        ports:
          - 8765:8765
    steps:
      - uses: actions/checkout@v2
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: |
          cd backend
          pip install uv
          uv sync
      - name: Run E2E tests
        run: |
          cd backend
          uv run pytest -m e2e -v
```

## 最佳实践

1. **开发时**：先运行单元测试，确保代码逻辑正确
2. **提交前**：运行所有测试，确保没有破坏性更改
3. **CI/CD**：分离单元测试和 E2E 测试，提高并行度
4. **调试**：使用 `-s` 标志查看详细输出
5. **性能**：单元测试应该快速完成（< 1秒）

## 常见问题

### 问题1：E2E 测试连接失败
```
ConnectionRefusedError: [Errno 111] Connection refused
```
**解决方法**：
- 确保服务端已启动
- 检查端口是否正确：`lsof -i :8765`

### 问题2：测试超时
```
TimeoutError: [Errno 110] Connection timed out
```
**解决方法**：
- 增加等待时间
- 检查网络连接
- 查看服务端日志

### 问题3：导入错误
```
ModuleNotFoundError: No module named 'backend'
```
**解决方法**：
- 确保在 `backend` 目录下运行测试
- 检查 `PYTHONPATH` 环境变量
