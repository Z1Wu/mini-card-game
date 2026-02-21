/** 与后端 GameState 一致 */
export enum GameState {
  WAITING = 'waiting',
  PLAYING = 'playing',
  SPECIAL_PHASE = 'special_phase',
  GAME_OVER = 'game_over',
}

export enum CardType {
  CLASS_REP = '班长',
  LIBRARY_COMMITTEE = '图书委员',
  ALIEN = '外星人',
  HOME_CLUB = '归宅部',
  HEALTH_COMMITTEE = '保健委员',
  DISCIPLINE_COMMITTEE = '风纪委员',
  NEWS_CLUB = '新闻部',
  RICH_GIRL = '大小姐',
  ACCOMPLICE = '共犯',
  INFECTED = '感染者',
  CRIMINAL = '犯人',
  STUDENT_COUNCIL_PRESIDENT = '学生会长',
  HONOR_STUDENT = '优等生',
}

/** 与后端一致：后端 CardUsageType 使用中文枚举值 */
export enum CardUsageType {
  HARMONY = '调和',
  DOUBT = '质疑',
  SKILL = '特技',
}

export interface Card {
  id: string;
  name: CardType;
  description: string;
  harmony_value: number;
  victory_priority: number;
  victory_condition: string;
  owner_id: string | null;
  is_face_up: boolean;
  location: 'hand' | 'field' | 'harmony' | 'discard';
  target_player_id: string | null;
}

export interface Player {
  id: string;
  name: string;
  hand: Card[];
  field_cards: Card[];
  doubt_cards: Card[];
  is_connected: boolean;
  current_hand_count: number;
}

export interface Game {
  id: string;
  state: GameState;
  players: Player[];
  harmony_area: Card[];
  current_player_index: number;
  turn_count: number;
  player_count: number;
  required_harmony_value: number;
  winner: string | null;
}
