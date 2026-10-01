import pytest

from game.models import GameState
from websocket.server import GameWebSocketServer
from tests.unit.test_voice_chat import FakeWebSocket


@pytest.mark.asyncio
async def test_state_request_restores_only_authenticated_chooser_prompt():
    server = GameWebSocketServer()
    sockets = {}
    for index in range(3):
        player_id = f'p{index}'
        server.game_manager.add_player(player_id, player_id)
        sockets[player_id] = FakeWebSocket()
        server.player_connections[player_id] = sockets[player_id]
    server.game_manager.game.state = GameState.PLAYING
    server.pending_news_club = {'order': ['p0', 'p1', 'p2'], 'index': 1, 'card_received_by_next': 'received'}
    await server._handle_get_game_state(sockets['p1'], {'player_id': 'p1'})
    prompt = sockets['p1'].messages[-1]
    assert prompt['type'] == 'news_club_choice_required'
    assert prompt['next_player_name'] == 'p2'
    assert prompt['exclude_card_id'] == 'received'
    await server._handle_get_game_state(sockets['p0'], {'player_id': 'p1'})
    assert all(message['type'] != 'news_club_choice_required' for message in sockets['p0'].messages)
    assert not sockets['p2'].messages
