import json
import pytest
from auth import users
from config import Config
from websocket.hub import RoomHubWebSocketServer, DEFAULT_ROOM_CODE

class Socket:
    def __init__(self): self.messages = []
    async def send(self, raw): self.messages.append(json.loads(raw))

@pytest.fixture
def avatar_users(tmp_path, monkeypatch):
    path = tmp_path / 'users.json'
    path.write_text(json.dumps([{'username': 'player1', 'password': 'password1', 'name': '玩家1'}, {'username': 'player2', 'password': 'password2', 'name': '玩家2'}]), encoding='utf-8')
    monkeypatch.setattr(Config, 'AUTH_USERS_FILE', str(path))
    monkeypatch.setattr(users, '_USERS', {})
    return path

@pytest.mark.unit
def test_avatar_persists_and_survives_account_updates(avatar_users):
    assert users.set_user_avatar('player1', 'library')
    users.update_user('player1', name='新名字')
    users._USERS = {}
    assert users.get_user_avatar('player1') == 'library'
    assert users.authenticate_user('player1', 'password1')
    assert not users.set_user_avatar('player1', '../../invalid')
    assert not users.set_user_avatar('player1', [])
    assert users.get_user_avatar('player1') == 'library'

@pytest.mark.unit
async def test_avatar_uses_authenticated_identity_and_broadcasts(avatar_users):
    hub = RoomHubWebSocketServer()
    actor, observer, stranger = Socket(), Socket(), Socket()
    await hub._handle_set_avatar(stranger, {'avatar_id': 'library'})
    assert stranger.messages[-1]['code'] == 'authentication_required'
    hub._authenticated_users[actor] = 'player1'
    server = hub._rooms[DEFAULT_ROOM_CODE].server
    server.game_manager.add_player('player1', '玩家1')
    server.game_manager.add_player('player2', '玩家2')
    server.clients.update([actor, observer])
    server.player_connections.update({'player1': actor, 'player2': observer})
    await hub._handle_set_avatar(actor, {'avatar_id': 'alien', 'player_id': 'player2'})
    assert users.get_user_avatar('player1') == 'alien'
    assert users.get_user_avatar('player2') is None
    assert actor.messages[-1] == {'type': 'avatar_saved', 'avatar_id': 'alien'}
    player_list = next(m for m in observer.messages if m['type'] == 'player_list')
    assert player_list['players'][0]['avatar_id'] == 'alien'
    await hub._handle_set_avatar(actor, {'avatar_id': 'invalid'})
    assert actor.messages[-1]['code'] == 'invalid_avatar'
    assert users.get_user_avatar('player1') == 'alien'

@pytest.mark.unit
async def test_login_returns_saved_avatar(avatar_users):
    users.set_user_avatar('player1', 'rich-girl')
    hub = RoomHubWebSocketServer()
    socket = Socket()
    await hub._handle_hub_login(socket, {'username': 'player1', 'password': 'password1'})
    assert socket.messages[-1]['avatar_id'] == 'rich-girl'
    await hub._bind_identity_to_room(socket, hub._rooms[DEFAULT_ROOM_CODE], 'player1')
    assert hub._rooms[DEFAULT_ROOM_CODE].server.game_manager.game.players[0].avatar_id == 'rich-girl'
