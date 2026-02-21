from enum import Enum
from typing import Optional, List
from pydantic import BaseModel

class CardType(str, Enum):
    CLASS_REP = "班长"
    LIBRARY_COMMITTEE = "图书委员"
    ALIEN = "外星人"
    HOME_CLUB = "归宅部"
    HEALTH_COMMITTEE = "保健委员"
    DISCIPLINE_COMMITTEE = "风纪委员"
    NEWS_CLUB = "新闻部"
    RICH_GIRL = "大小姐"
    ACCOMPLICE = "共犯"
    INFECTED = "感染者"
    CRIMINAL = "犯人"
    STUDENT_COUNCIL_PRESIDENT = "学生会长"
    HONOR_STUDENT = "优等生"

class CardUsageType(str, Enum):
    SKILL = "特技"
    HARMONY = "调和"
    DOUBT = "质疑"

class Card(BaseModel):
    id: str
    name: CardType
    description: str
    harmony_value: int
    victory_priority: int
    victory_condition: str
    owner_id: Optional[str] = None
    is_face_up: bool = False
    location: str = "hand"
    target_player_id: Optional[str] = None

class Player(BaseModel):
    id: str
    name: str
    hand: List[Card] = []
    field_cards: List[Card] = []
    doubt_cards: List[Card] = []
    is_connected: bool = True
    current_hand_count: int = 0

class GameState(str, Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    SPECIAL_PHASE = "special_phase"
    GAME_OVER = "game_over"

class Game(BaseModel):
    id: str
    state: GameState = GameState.WAITING
    players: List[Player] = []
    harmony_area: List[Card] = []
    current_player_index: int = 0
    turn_count: int = 0
    player_count: int = 0
    required_harmony_value: int = 0
    winner: Optional[str] = None
