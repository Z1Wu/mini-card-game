import asyncio
import json
import logging
import websockets
from typing import Set, Dict
from game.state import GameManager
from game.rules import GameRules
from game.victory import VictoryChecker
from game.models import GameState, CardUsageType, CardType

logger = logging.getLogger(__name__)


class GameWebSocketServer:
    def __init__(self, host: str = "localhost", port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.player_connections: Dict[str, websockets.WebSocketServerProtocol] = {}
        self.game_manager = GameManager()
        self.game_manager.create_game("default_game")
        self.game_rules = GameRules(self.game_manager)
        self.honor_student_responses: Dict[str, str] = {}
        self.pending_rich_girl: dict | None = None  # { player_id, card_id, target_player_id, take_card_id?: str }
        self.pending_news_club: dict | None = None  # { order: [player_id], index: int }
        self.pending_class_rep: dict | None = None  # { player_id, card_id, target_player_id, my_card_id?: str }
        self.pending_honor_student_responders: dict | None = None  # { player_id: "criminal"|"alien" } 仅持犯人/外星人的玩家需响应
        self.honor_student_actor_id: str | None = None  # 打出优等生的玩家，结束后需收到举手结果

    async def register_client(self, websocket: websockets.WebSocketServerProtocol):
        self.clients.add(websocket)
        connected_users = list(self.player_connections.keys())
        logger.info("Client connected. Total clients: %s, identified users: %s", len(self.clients), connected_users)

    async def unregister_client(self, websocket: websockets.WebSocketServerProtocol):
        self.clients.discard(websocket)
        player_id = self._get_player_id_by_websocket(websocket)
        if player_id:
            del self.player_connections[player_id]
        remaining = list(self.player_connections.keys())
        logger.info("Player %s disconnected. Total clients: %s, identified users: %s", player_id or "(unknown)", len(self.clients), remaining)

    def _get_player_id_by_websocket(self, websocket: websockets.WebSocketServerProtocol) -> str:
        for player_id, ws in self.player_connections.items():
            if ws == websocket:
                return player_id
        return None

    async def broadcast(self, message: dict):
        if self.clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.clients],
                return_exceptions=True
            )

    async def send_to_client(self, websocket: websockets.WebSocketServerProtocol, message: dict):
        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            logger.error("Error sending message to client: %s", e)

    async def handle_message(self, websocket: websockets.WebSocketServerProtocol, message: str):
        try:
            data = json.loads(message)
            message_type = data.get("type")

            if message_type == "login":
                await self._handle_login(websocket, data)
            elif message_type == "reconnect":
                await self._handle_reconnect(websocket, data)
            elif message_type == "join_game":
                await self._handle_join_game(websocket, data)
            elif message_type == "start_game":
                await self._handle_start_game(data)
            elif message_type == "play_card":
                await self._handle_play_card(websocket, data)
            elif message_type == "skill_choice":
                await self._handle_skill_choice(websocket, data)
            elif message_type == "news_club_choice":
                await self._handle_news_club_choice(websocket, data)
            elif message_type == "class_rep_choice":
                await self._handle_class_rep_choice(websocket, data)
            elif message_type == "honor_student_response":
                await self._handle_honor_student_response(websocket, data)
            elif message_type == "get_game_state":
                await self._handle_get_game_state(data)
            elif message_type == "query_game_status":
                await self._handle_query_game_status(websocket)
            else:
                await self.send_to_client(websocket, {
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })
        except json.JSONDecodeError:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Invalid JSON format"
            })
        except Exception as e:
            logger.error("Error handling message: %s", e)
            await self.send_to_client(websocket, {
                "type": "error",
                "message": str(e)
            })

    async def _handle_login(self, websocket: websockets.WebSocketServerProtocol, data: dict):
        from auth.users import authenticate_user, get_user_name
        
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Missing username or password"
            })
            return
        
        if not authenticate_user(username, password):
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Invalid username or password"
            })
            return
        
        player_id = username
        
        if player_id in self.player_connections:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "该玩家已经在线"
            })
            return
        
        player_name = get_user_name(username)
        
        existing_player = None
        if self.game_manager.game:
            for player in self.game_manager.game.players:
                if player.id == player_id:
                    existing_player = player
                    break
        
        if existing_player:
            self.player_connections[player_id] = websocket
            await self.send_to_client(websocket, {
                "type": "login_success",
                "player_id": player_id,
                "player_name": existing_player.name
            })
            await self._broadcast_game_state()
        else:
            if self.game_manager.game and self.game_manager.game.state != GameState.WAITING:
                await self.send_to_client(websocket, {
                    "type": "error",
                    "message": "游戏正在进行中，无法加入新玩家"
                })
                return
            
            success = self.game_manager.add_player(player_id, player_name)
            if success:
                self.player_connections[player_id] = websocket
                await self.send_to_client(websocket, {
                    "type": "login_success",
                    "player_id": player_id,
                    "player_name": player_name
                })
                await self._broadcast_player_list()
            else:
                await self.send_to_client(websocket, {
                    "type": "error",
                    "message": "Failed to join game"
                })

    async def _handle_reconnect(self, websocket: websockets.WebSocketServerProtocol, data: dict):
        from auth.users import authenticate_user
        
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Missing username or password"
            })
            return
        
        if not authenticate_user(username, password):
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Invalid username or password"
            })
            return
        
        player_id = username
        
        existing_player = None
        if self.game_manager.game:
            for player in self.game_manager.game.players:
                if player.id == player_id:
                    existing_player = player
                    break
        
        if not existing_player:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Player not found in game"
            })
            return
        
        self.player_connections[player_id] = websocket
        await self.send_to_client(websocket, {
            "type": "reconnect_success",
            "player_id": player_id,
            "player_name": existing_player.name
        })
        await self._broadcast_game_state()

    async def _handle_join_game(self, websocket: websockets.WebSocketServerProtocol, data: dict):
        player_id = data.get("player_id")
        player_name = data.get("player_name")

        if not player_id or not player_name:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Missing player_id or player_name"
            })
            return

        success = self.game_manager.add_player(player_id, player_name)
        if success:
            self.player_connections[player_id] = websocket
            await self.send_to_client(websocket, {
                "type": "join_success",
                "player_id": player_id,
                "player_name": player_name
            })
            await self._broadcast_player_list()
        else:
            await self.send_to_client(websocket, {
                "type": "error",
                "message": "Failed to join game"
            })

    async def _handle_start_game(self, data: dict):
        player_id = data.get("player_id")
        if not self.game_manager.game:
            await self.broadcast({
                "type": "error",
                "message": "No game exists"
            })
            return

        if len(self.game_manager.game.players) < 3:
            await self.broadcast({
                "type": "error",
                "message": "Need at least 3 players to start"
            })
            return

        success = self.game_manager.start_game()
        if success:
            await self._broadcast_game_state()
        else:
            await self.broadcast({
                "type": "error",
                "message": "Failed to start game"
            })

    def _find_card_in_hand(self, player, card_id: str):
        for c in player.hand:
            if c.id == card_id:
                return c
        return None

    async def _handle_play_card(self, websocket: websockets.WebSocketServerProtocol, data: dict):
        from game.models import CardUsageType

        player_id = data.get("player_id")
        card_id = data.get("card_id")
        usage_type_str = data.get("usage_type")
        target_player_id = data.get("target_player_id")

        if not player_id or not card_id or not usage_type_str:
            await self.broadcast({
                "type": "error",
                "message": "Missing required fields"
            })
            return

        try:
            usage_type = CardUsageType(usage_type_str)
        except ValueError:
            await self.broadcast({
                "type": "error",
                "message": f"Invalid usage type: {usage_type_str}"
            })
            return

        game = self.game_manager.game
        if game and game.state == GameState.PLAYING and usage_type == CardUsageType.SKILL and target_player_id:
            current = game.players[game.current_player_index]
            if current.id == player_id:
                card = self._find_card_in_hand(current, card_id)
                if card and card.name == CardType.CLASS_REP:
                    target_player = next((p for p in game.players if p.id == target_player_id), None)
                    if not target_player or target_player.id == player_id:
                        await self.send_to_client(websocket, {"type": "error", "message": "目标玩家无效"})
                        return
                    if not current.hand or not target_player.hand:
                        await self.send_to_client(websocket, {"type": "error", "message": "双方均需有手牌"})
                        return
                    self.pending_class_rep = {
                        "player_id": player_id,
                        "card_id": card_id,
                        "target_player_id": target_player_id,
                        "my_card_id": None,
                    }
                    await self.send_to_client(websocket, {
                        "type": "class_rep_choice_required",
                        "your_hand": [c.model_dump() for c in current.hand if c.id != card_id],
                        "target_player_name": target_player.name,
                    })
                    return
                if card and card.name == CardType.RICH_GIRL:
                    target_player = next((p for p in game.players if p.id == target_player_id), None)
                    if not target_player:
                        await self.send_to_client(websocket, {"type": "error", "message": "目标玩家不存在"})
                        return
                    if not target_player.hand:
                        await self.send_to_client(websocket, {"type": "error", "message": "目标玩家无手牌"})
                        return
                    # 大小姐选牌时不能看到对方手牌内容，只传 id 供选择
                    target_hand = [{"id": c.id} for c in target_player.hand]
                    your_hand = [c.model_dump() for c in current.hand if c.id != card_id]
                    self.pending_rich_girl = {
                        "player_id": player_id,
                        "card_id": card_id,
                        "target_player_id": target_player_id,
                    }
                    await self.send_to_client(websocket, {
                        "type": "skill_choice_required",
                        "skill_type": "rich_girl",
                        "target_player_id": target_player_id,
                        "target_player_name": target_player.name,
                        "target_hand": target_hand,
                        "your_hand": your_hand,
                    })
                    return

        target_card_id = data.get("target_card_id")
        hand_card_id = data.get("hand_card_id")
        harmony_card_id = data.get("harmony_card_id")
        current_for_check = game.players[game.current_player_index] if game and game.state == GameState.PLAYING else None
        card_for_check = self._find_card_in_hand(current_for_check, card_id) if current_for_check else None
        is_discipline_view = (
            game and usage_type == CardUsageType.SKILL and target_player_id
            and card_for_check and card_for_check.name == CardType.DISCIPLINE_COMMITTEE
        )
        is_library = card_for_check and card_for_check.name == CardType.LIBRARY_COMMITTEE
        is_news_club = card_for_check and card_for_check.name == CardType.NEWS_CLUB
        success = self.game_rules.play_card(
            player_id, card_id, usage_type, target_player_id, target_card_id,
            hand_card_id=hand_card_id, harmony_card_id=harmony_card_id
        )
        is_honor_student = card_for_check and card_for_check.name == CardType.HONOR_STUDENT
        if success:
            if is_honor_student and usage_type == CardUsageType.SKILL:
                g = self.game_manager.game
                self.pending_honor_student_responders = {}
                for p in g.players:
                    if p.id == player_id:
                        continue
                    has_criminal = any(c.name == CardType.CRIMINAL for c in p.hand)
                    has_alien = any(c.name == CardType.ALIEN for c in p.hand)
                    if has_criminal:
                        self.pending_honor_student_responders[p.id] = "criminal"
                    elif has_alien:
                        self.pending_honor_student_responders[p.id] = "alien"
                self.honor_student_actor_id = player_id
                actor_ws = self.player_connections.get(player_id)
                if actor_ws:
                    await self.send_to_client(actor_ws, {"type": "honor_student_waiting"})
                await self.broadcast({"type": "honor_student_phase", "phase": "waiting"})
                if not self.pending_honor_student_responders:
                    await self._process_honor_student_responses()
                else:
                    for pid, role in self.pending_honor_student_responders.items():
                        ws = self.player_connections.get(pid)
                        if ws:
                            await self.send_to_client(ws, {"type": "honor_student_choice_required", "role": role})
            if is_discipline_view and target_player_id:
                target_player = next((p for p in self.game_manager.game.players if p.id == target_player_id), None)
                if target_player and websocket:
                    await self.send_to_client(websocket, {
                        "type": "view_hand",
                        "target_player_id": target_player_id,
                        "target_player_name": target_player.name,
                        "hand": [c.model_dump() for c in target_player.hand],
                    })
            if is_library and usage_type == CardUsageType.SKILL and websocket:
                g = self.game_manager.game
                await self.send_to_client(websocket, {
                    "type": "view_harmony",
                    "harmony_area": [c.model_dump() for c in g.harmony_area],
                })
            if is_news_club and usage_type == CardUsageType.SKILL:
                g = self.game_manager.game
                n = len(g.players)
                order = [g.players[(g.current_player_index + i) % n].id for i in range(n)]
                self.pending_news_club = {"order": order, "index": 0}
                first_id = order[0]
                first_player = next((p for p in g.players if p.id == first_id), None)
                ws = self.player_connections.get(first_id)
                await self.broadcast({"type": "news_club_in_progress", "current_player_id": first_id, "order": order})
                if first_player and ws:
                    await self.send_to_client(ws, {
                        "type": "news_club_choice_required",
                        "your_hand": [c.model_dump() for c in first_player.hand],
                        "next_player_name": g.players[(g.current_player_index + 1) % n].name,
                    })
            await self._broadcast_game_state()
            if self.game_manager.game.state == GameState.GAME_OVER:
                victory_checker = VictoryChecker(self.game_manager.game)
                winner = victory_checker.check_victory()
                if winner:
                    await self._broadcast_game_over(winner)
        else:
            fail_message = "出牌失败"
            if current_for_check and len(current_for_check.hand) <= 1:
                fail_message = "手牌已剩一张，本回合不能出牌，请等待其他玩家"
            elif card_for_check and card_for_check.name == CardType.CRIMINAL:
                fail_message = "犯人牌不可打出，仅可被其他卡牌效果移动"
            elif card_for_check and card_for_check.name == CardType.HOME_CLUB and game and (not game.harmony_area or len(game.harmony_area) == 0):
                fail_message = "调和区为空时无法使用归宅部特技"
            await self.send_to_client(websocket, {
                "type": "error",
                "message": fail_message
            })

    async def _handle_skill_choice(self, websocket: websockets.WebSocketServerProtocol, data: dict):
        player_id = data.get("player_id")
        target_player_id = data.get("target_player_id")
        take_card_id = data.get("take_card_id")
        give_card_id = data.get("give_card_id")
        if not self.pending_rich_girl or self.pending_rich_girl.get("player_id") != player_id:
            await self.send_to_client(websocket, {"type": "error", "message": "没有待处理的大小姐选牌"})
            return
        if self.pending_rich_girl.get("target_player_id") != target_player_id or not take_card_id:
            await self.send_to_client(websocket, {"type": "error", "message": "选牌参数不完整"})
            return
        g = self.game_manager.game
        target_player = next((p for p in g.players if p.id == target_player_id), None)
        if not target_player:
            await self.send_to_client(websocket, {"type": "error", "message": "目标玩家不存在"})
            return
        taken_card = self._find_card_in_hand(target_player, take_card_id)
        if not taken_card:
            await self.send_to_client(websocket, {"type": "error", "message": "所选牌不在目标手牌中"})
            return
        if not give_card_id:
            current = next((p for p in g.players if p.id == player_id), None)
            your_hand = [c.model_dump() for c in current.hand] if current else []
            await self.send_to_client(websocket, {
                "type": "rich_girl_choose_give",
                "taken_card": taken_card.model_dump(),
                "your_hand": your_hand,
            })
            return
        card_id = self.pending_rich_girl["card_id"]
        success = self.game_rules.execute_rich_girl_skill(
            player_id, card_id, target_player_id, take_card_id, give_card_id
        )
        self.pending_rich_girl = None
        if success:
            await self._broadcast_game_state()
            if self.game_manager.game.state == GameState.GAME_OVER:
                victory_checker = VictoryChecker(self.game_manager.game)
                winner = victory_checker.check_victory()
                if winner:
                    await self._broadcast_game_over(winner)
        else:
            await self.send_to_client(websocket, {"type": "error", "message": "大小姐选牌执行失败"})

    async def _handle_class_rep_choice(self, websocket: websockets.WebSocketServerProtocol, data: dict):
        player_id = data.get("player_id")
        card_id = data.get("card_id")  # 所选的手牌 id
        if not self.pending_class_rep or not card_id:
            await self.send_to_client(websocket, {"type": "error", "message": "班长选牌参数不完整"})
            return
        g = self.game_manager.game
        if not g:
            return
        if self.pending_class_rep.get("my_card_id") is None:
            if player_id != self.pending_class_rep["player_id"]:
                await self.send_to_client(websocket, {"type": "error", "message": "当前不是你的选牌回合"})
                return
            self.pending_class_rep["my_card_id"] = card_id
            target_id = self.pending_class_rep["target_player_id"]
            target_player = next((p for p in g.players if p.id == target_id), None)
            actor_name = next((p.name for p in g.players if p.id == self.pending_class_rep["player_id"]), "")
            target_name = target_player.name if target_player else ""
            actor_ws = self.player_connections.get(self.pending_class_rep["player_id"])
            if actor_ws:
                await self.send_to_client(actor_ws, {"type": "class_rep_waiting", "target_player_name": target_name})
            await self.broadcast({"type": "class_rep_phase", "phase": "waiting_target", "actor_name": actor_name, "target_name": target_name})
            if target_player:
                target_ws = self.player_connections.get(target_id)
                if target_ws:
                    await self.send_to_client(target_ws, {
                        "type": "class_rep_choice_required",
                        "your_hand": [c.model_dump() for c in target_player.hand],
                        "target_player_name": actor_name,
                    })
            return
        if player_id != self.pending_class_rep["target_player_id"]:
            await self.send_to_client(websocket, {"type": "error", "message": "当前不是你的选牌回合"})
            return
        target_card_id = card_id
        my_card_id = self.pending_class_rep["my_card_id"]
        actor_id = self.pending_class_rep["player_id"]
        target_id = self.pending_class_rep["target_player_id"]
        actor = next((p for p in g.players if p.id == actor_id), None)
        target_p = next((p for p in g.players if p.id == target_id), None)
        card_actor_gave = next((c.model_dump() for c in (actor.hand if actor else []) if c.id == my_card_id), None)
        card_target_gave = next((c.model_dump() for c in (target_p.hand if target_p else []) if c.id == target_card_id), None)
        success = self.game_rules.execute_class_rep_skill(
            actor_id, self.pending_class_rep["card_id"], target_id, my_card_id, target_card_id,
        )
        self.pending_class_rep = None
        if success:
            actor_name = actor.name if actor else ""
            target_name = target_p.name if target_p else ""
            await self.broadcast({"type": "class_rep_phase", "phase": "done", "actor_name": actor_name, "target_name": target_name})
            aw = self.player_connections.get(actor_id)
            if aw and card_actor_gave and card_target_gave:
                await self.send_to_client(aw, {"type": "class_rep_result", "card_you_gave": card_actor_gave, "card_you_received": card_target_gave})
            tw = self.player_connections.get(target_id)
            if tw and card_actor_gave and card_target_gave:
                await self.send_to_client(tw, {"type": "class_rep_result", "card_you_gave": card_target_gave, "card_you_received": card_actor_gave})
            await self._broadcast_game_state()
            if self.game_manager.game.state == GameState.GAME_OVER:
                victory_checker = VictoryChecker(self.game_manager.game)
                winner = victory_checker.check_victory()
                if winner:
                    await self._broadcast_game_over(winner)
        else:
            await self.send_to_client(websocket, {"type": "error", "message": "班长交换执行失败"})

    async def _handle_news_club_choice(self, websocket: websockets.WebSocketServerProtocol, data: dict):
        player_id = data.get("player_id")
        card_id = data.get("card_id")
        if not self.pending_news_club or not player_id or not card_id:
            await self.send_to_client(websocket, {"type": "error", "message": "新闻部选牌参数不完整"})
            return
        order = self.pending_news_club["order"]
        idx = self.pending_news_club["index"]
        if idx >= len(order) or order[idx] != player_id:
            await self.send_to_client(websocket, {"type": "error", "message": "当前不是你的选牌回合"})
            return
        # 不能使用上家递过来的牌进行交换
        card_received = self.pending_news_club.get("card_received_by_next")
        if idx >= 1 and card_received and card_id == card_received:
            await self.send_to_client(websocket, {"type": "error", "message": "不能使用上家递过来的牌进行交换"})
            return
        from_id = order[idx]
        to_id = order[(idx + 1) % len(order)]
        from_p = next((p for p in self.game_manager.game.players if p.id == from_id), None)
        chosen_card_dump = None
        if from_p:
            for c in from_p.hand:
                if c.id == card_id:
                    chosen_card_dump = c.model_dump()
                    break
        ok = self.game_rules.apply_news_club_pass(from_id, to_id, card_id)
        if not ok:
            await self.send_to_client(websocket, {"type": "error", "message": "新闻部传牌失败"})
            return
        if chosen_card_dump:
            await self.send_to_client(websocket, {"type": "news_club_you_chose", "card": chosen_card_dump})
        # 记录本轮递给下家的牌，下家选牌时不能选这张
        self.pending_news_club["card_received_by_next"] = card_id
        self.pending_news_club["index"] = idx + 1
        if idx + 1 >= len(order):
            self.game_rules.game_manager.next_turn()
            self.pending_news_club = None
            await self.broadcast({"type": "news_club_ended"})
            await self._broadcast_game_state()
            g = self.game_manager.game
            if g and g.state == GameState.GAME_OVER:
                victory_checker = VictoryChecker(g)
                winner = victory_checker.check_victory()
                if winner:
                    await self._broadcast_game_over(winner)
        else:
            next_id = order[idx + 1]
            next_player = next((p for p in self.game_manager.game.players if p.id == next_id), None)
            next_ws = self.player_connections.get(next_id)
            g = self.game_manager.game
            next_next_id = order[(idx + 2) % len(order)] if len(order) > 1 else next_id
            next_next_player = next((p for p in g.players if p.id == next_next_id), None)
            next_next_name = next_next_player.name if next_next_player else ""
            await self.broadcast({"type": "news_club_in_progress", "current_player_id": next_id, "order": order})
            if next_player and next_ws:
                await self.send_to_client(next_ws, {
                    "type": "news_club_choice_required",
                    "your_hand": [c.model_dump() for c in next_player.hand],
                    "next_player_name": next_next_name,
                    "exclude_card_id": self.pending_news_club.get("card_received_by_next"),
                })
            await self._broadcast_game_state()

    async def _handle_get_game_state(self, data: dict):
        player_id = data.get("player_id")
        websocket = self.player_connections.get(player_id)
        if websocket:
            await self.send_to_client(websocket, {
                "type": "game_state",
                "game_state": self.game_manager.game.model_dump() if self.game_manager.game else None
            })

    async def _handle_query_game_status(self, websocket: websockets.WebSocketServerProtocol):
        """无需登录即可查询：当前是否有对局、对局状态、参与玩家名称。"""
        g = self.game_manager.game
        if not g:
            await self.send_to_client(websocket, {
                "type": "game_status",
                "has_game": False,
                "state": None,
                "player_names": []
            })
            return
        state = g.state.value if g.state else None
        player_names = [p.name for p in g.players]
        await self.send_to_client(websocket, {
            "type": "game_status",
            "has_game": True,
            "state": state,
            "player_names": player_names
        })

    async def _handle_honor_student_response(self, websocket: websockets.WebSocketServerProtocol, data: dict):
        player_id = data.get("player_id")
        response = data.get("response")  # "raise_hand" | "none"
        if not player_id:
            await self.send_to_client(websocket, {"type": "error", "message": "优等生响应参数不完整"})
            return
        g = self.game_manager.game
        if not g or g.state != GameState.SPECIAL_PHASE:
            await self.send_to_client(websocket, {"type": "error", "message": "当前不在优等生特殊阶段"})
            return
        if not self.pending_honor_student_responders or player_id not in self.pending_honor_student_responders:
            await self.send_to_client(websocket, {"type": "error", "message": "无需响应或已响应"})
            return
        role = self.pending_honor_student_responders[player_id]
        if role == "criminal":
            response = "raise_hand"
        elif not response:
            response = "none"
        self.honor_student_responses[player_id] = response
        del self.pending_honor_student_responders[player_id]
        if not self.pending_honor_student_responders:
            await self._process_honor_student_responses()

    async def _process_honor_student_responses(self):
        g = self.game_manager.game
        actor_id = self.honor_student_actor_id
        raised_names = []
        if g and actor_id:
            for pid, resp in self.honor_student_responses.items():
                if resp == "raise_hand":
                    p = next((x for x in g.players if x.id == pid), None)
                    if p:
                        raised_names.append(p.name)
        if actor_id:
            actor_ws = self.player_connections.get(actor_id)
            if actor_ws:
                await self.send_to_client(actor_ws, {
                    "type": "honor_student_result",
                    "raised_player_names": raised_names,
                })
        self.honor_student_responses.clear()
        self.pending_honor_student_responders = None
        self.honor_student_actor_id = None
        await self.broadcast({"type": "honor_student_phase", "phase": "done"})
        if g:
            g.state = GameState.PLAYING
        self.game_rules.game_manager.next_turn()
        await self._broadcast_game_state()
        g = self.game_manager.game
        if g and g.state == GameState.GAME_OVER:
            victory_checker = VictoryChecker(g)
            winner = victory_checker.check_victory()
            if winner:
                await self._broadcast_game_over(winner)

    async def _broadcast_player_list(self):
        if self.game_manager.game:
            players = [
                {
                    "id": player.id,
                    "name": player.name,
                    "hand_count": len(player.hand)
                }
                for player in self.game_manager.game.players
            ]
            await self.broadcast({
                "type": "player_list",
                "players": players
            })

    async def _broadcast_game_state(self):
        if self.game_manager.game:
            await self.broadcast({
                "type": "game_state",
                "game_state": self.game_manager.game.model_dump()
            })

    async def _broadcast_game_over(self, winner_id: str):
        await self.broadcast({
            "type": "game_over",
            "winner_id": winner_id
        })

    async def handle_client(self, websocket: websockets.WebSocketServerProtocol):
        await self.register_client(websocket)
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            logger.info("Connection closed by client")
        except Exception as e:
            logger.error("Error handling client: %s", e)
        finally:
            await self.unregister_client(websocket)

    async def start(self):
        logger.info("Starting WebSocket server on %s:%s", self.host, self.port)
        async with websockets.serve(self.handle_client, self.host, self.port):
            await asyncio.Future()
