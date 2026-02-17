import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from e2e.test_client import GameTestClient

@pytest.mark.e2e
async def test_basic_flow():
    print("\n=== 测试基本游戏流程 ===\n")

    client1 = GameTestClient()
    client2 = GameTestClient()
    client3 = GameTestClient()

    try:
        print("1. 玩家加入游戏")
        await client1.connect("player_1", "玩家1")
        await client2.connect("player_2", "玩家2")
        await client3.connect("player_3", "玩家3")

        await asyncio.sleep(1)

        print("\n2. 获取游戏状态")
        state = await client1.get_game_state()
        print(f"  游戏状态: {state}")

        print("\n3. 玩家1出卡（调和）")
        await client1.play_card("班长_0", "harmony")

        print("\n4. 玩家2出卡（特技）")
        await client2.play_card("图书委员_0", "skill")

        print("\n5. 玩家3出卡（质疑）")
        await client3.play_card("风纪委员_0", "doubt", "player_1")

        print("\n6. 获取最终游戏状态")
        state = await client1.get_game_state()
        print(f"  游戏状态: {state}")

    finally:
        await client1.close()
        await client2.close()
        await client3.close()

@pytest.mark.e2e
async def test_honor_student_skill():
    print("\n=== 测试优等生特技 ===\n")

    client1 = GameTestClient()
    client2 = GameTestClient()
    client3 = GameTestClient()

    try:
        print("1. 玩家加入游戏")
        await client1.connect("player_1", "玩家1")
        await client2.connect("player_2", "玩家2")
        await client3.connect("player_3", "玩家3")

        await asyncio.sleep(1)

        print("\n2. 玩家1使用优等生特技")
        await client1.play_card("优等生_0", "skill")

        print("\n3. 其他玩家响应")
        await client2.respond_honor_student("none")
        await client3.respond_honor_student("raise_hand")

        print("\n4. 获取游戏状态")
        state = await client1.get_game_state()
        print(f"  游戏状态: {state}")

    finally:
        await client1.close()
        await client2.close()
        await client3.close()

@pytest.mark.e2e
async def test_multiple_clients():
    print("\n=== 测试多个客户端同时连接 ===\n")

    clients = []
    for i in range(6):
        client = GameTestClient()
        await client.connect(f"player_{i+1}", f"玩家{i+1}")
        clients.append(client)

    await asyncio.sleep(1)

    state = await clients[0].get_game_state()
    print(f"  游戏状态: {state}")

    for client in clients:
        await client.close()

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
