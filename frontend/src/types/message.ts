import { CardUsageType, Card } from './game';

export type MessageType =
  | 'login'
  | 'login_success'
  | 'reconnect'
  | 'reconnect_success'
  | 'join_game'
  | 'join_success'
  | 'error'
  | 'player_list'
  | 'game_state'
  | 'get_game_state'
  | 'start_game'
  | 'reset_game'
  | 'play_card'
  | 'skill_choice_required'
  | 'skill_choice'
  | 'view_hand'
  | 'view_harmony'
  | 'news_club_choice_required'
  | 'news_club_choice'
  | 'class_rep_choice_required'
  | 'class_rep_choice'
  | 'rich_girl_choose_give'
  | 'honor_student_choice_required'
  | 'honor_student_waiting'
  | 'honor_student_result'
  | 'honor_student_response'
  | 'honor_student_phase'
  | 'class_rep_waiting'
  | 'class_rep_phase'
  | 'class_rep_result'
  | 'news_club_in_progress'
  | 'news_club_you_chose'
  | 'news_club_ended'
  | 'game_over'
  | 'query_game_status'
  | 'game_status';

export interface BaseMessage {
  type: MessageType;
}

export interface LoginMessage extends BaseMessage {
  type: 'login';
  username: string;
  password: string;
}

export interface LoginSuccessMessage extends BaseMessage {
  type: 'login_success';
  player_id: string;
  player_name: string;
}

export interface ReconnectMessage extends BaseMessage {
  type: 'reconnect';
  username: string;
  password: string;
}

export interface ReconnectSuccessMessage extends BaseMessage {
  type: 'reconnect_success';
  player_id: string;
  player_name: string;
}

export interface JoinGameMessage extends BaseMessage {
  type: 'join_game';
  player_id: string;
  player_name: string;
}

export interface JoinSuccessMessage extends BaseMessage {
  type: 'join_success';
  player_id: string;
  player_name: string;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  message: string;
}

/** 查询对局状态（无需登录） */
export interface QueryGameStatusMessage extends BaseMessage {
  type: 'query_game_status';
}

/** 对局状态（登录页展示用） */
export interface GameStatusMessage extends BaseMessage {
  type: 'game_status';
  has_game: boolean;
  state: 'waiting' | 'playing' | 'special_phase' | 'game_over' | null;
  player_names: string[];
}

export interface PlayerListMessage extends BaseMessage {
  type: 'player_list';
  players: Array<{
    id: string;
    name: string;
    hand_count: number;
  }>;
}

export interface GameStateMessage extends BaseMessage {
  type: 'game_state';
  game_state: any;
}

export interface GetGameStateMessage extends BaseMessage {
  type: 'get_game_state';
  player_id: string;
}

export interface StartGameMessage extends BaseMessage {
  type: 'start_game';
  player_id: string;
}

export interface ResetGameMessage extends BaseMessage {
  type: 'reset_game';
}

export interface PlayCardMessage extends BaseMessage {
  type: 'play_card';
  player_id: string;
  card_id: string;
  usage_type: CardUsageType;
  target_player_id?: string;
  /** 保健委员：所选场上正面牌的 id（该牌所在玩家由 target_player_id 指定） */
  target_card_id?: string;
  /** 归宅部：所选手牌 id、调和区卡牌 id */
  hand_card_id?: string;
  harmony_card_id?: string;
}

export interface SettlementSummary {
  harmony_total: number;
  required_harmony_value: number;
  harmony_reached: boolean;
  /** 质疑区数值总和最大且>0 的玩家 id 列表（多人并列则都视为被监禁） */
  imprisoned_player_ids: string[];
  player_doubt_totals: Record<string, number>;
}

export interface GameOverMessage extends BaseMessage {
  type: 'game_over';
  winner_id: string;
  settlement?: SettlementSummary;
}

/** 大小姐特技：服务端要求客户端选「从目标拿哪张、自己给哪张」。target_hand 仅含 id，不暴露牌面。 */
export interface SkillChoiceRequiredMessage extends BaseMessage {
  type: 'skill_choice_required';
  skill_type: 'rich_girl';
  target_player_id: string;
  target_player_name: string;
  /** 仅含 { id }，不传牌面信息，选牌时不可见对方牌面 */
  target_hand: { id: string }[] | Card[];
  your_hand: Card[];
}

export interface SkillChoiceMessage extends BaseMessage {
  type: 'skill_choice';
  player_id: string;
  target_player_id: string;
  take_card_id: string;
  give_card_id?: string;  // 大小姐第一阶段只发 take_card_id，看到牌后再发 give_card_id
}

/** 客户端发送：新闻部选牌 */
export interface NewsClubChoiceMessage extends BaseMessage {
  type: 'news_club_choice';
  player_id: string;
  card_id: string;
}

/** 客户端发送：班长选牌 */
export interface ClassRepChoiceMessage extends BaseMessage {
  type: 'class_rep_choice';
  player_id: string;
  card_id: string;
}

/** 客户端发送：优等生响应（举手/不举） */
export interface HonorStudentResponseMessage extends BaseMessage {
  type: 'honor_student_response';
  player_id: string;
  response: 'raise_hand' | 'none';
}

/** 大小姐第二阶段：看到拿到的牌后，选择要交给对方的牌 */
export interface RichGirlChooseGiveMessage extends BaseMessage {
  type: 'rich_girl_choose_give';
  taken_card: Card;
  your_hand: Card[];
}

/** 班长：双方各自选一张手牌交换 */
export interface ClassRepChoiceRequiredMessage extends BaseMessage {
  type: 'class_rep_choice_required';
  your_hand: Card[];
  target_player_name: string;
}

/** 优等生：仅持犯人/外星人的玩家需响应。犯人必须举手，外星人可选举手（假装犯人） */
export interface HonorStudentChoiceRequiredMessage extends BaseMessage {
  type: 'honor_student_choice_required';
  role: 'criminal' | 'alien';
}

/** 优等生：打出者等待举手结果 */
export interface HonorStudentWaitingMessage extends BaseMessage {
  type: 'honor_student_waiting';
}

/** 优等生：举手结果（仅发给打出者） */
export interface HonorStudentResultMessage extends BaseMessage {
  type: 'honor_student_result';
  raised_player_names: string[];
}

/** 优等生阶段（广播）：所有人可见等待/结束 */
export interface HonorStudentPhaseMessage extends BaseMessage {
  type: 'honor_student_phase';
  phase: 'waiting' | 'done';
}

/** 班长：打出者已选牌，等待目标选牌 */
export interface ClassRepWaitingMessage extends BaseMessage {
  type: 'class_rep_waiting';
  target_player_name: string;
}

/** 班长阶段（广播）：所有人可见等待目标/交换完成 */
export interface ClassRepPhaseMessage extends BaseMessage {
  type: 'class_rep_phase';
  phase: 'waiting_target' | 'done';
  actor_name?: string;
  target_name?: string;
}

/** 班长：交换结果（仅发给交换双方） */
export interface ClassRepResultMessage extends BaseMessage {
  type: 'class_rep_result';
  card_you_gave: Card;
  card_you_received: Card;
}

/** 新闻部进行中：提示当前谁在选牌 */
export interface NewsClubInProgressMessage extends BaseMessage {
  type: 'news_club_in_progress';
  current_player_id: string;
  order: string[];
}

/** 新闻部：你选的牌（仅发给自己） */
export interface NewsClubYouChoseMessage extends BaseMessage {
  type: 'news_club_you_chose';
  card: Card;
}

/** 风纪委员特技：服务端下发「查看目标手牌」结果，仅发给使用风纪委员的玩家 */
export interface ViewHandMessage extends BaseMessage {
  type: 'view_hand';
  target_player_id: string;
  target_player_name: string;
  hand: Card[];
}

/** 图书委员特技：服务端下发「查看调和区」结果 */
export interface ViewHarmonyMessage extends BaseMessage {
  type: 'view_harmony';
  harmony_area: Card[];
}

/** 新闻部特技：服务端要求选择一张手牌递给下家；exclude_card_id 为上家递来的牌，不可选 */
export interface NewsClubChoiceRequiredMessage extends BaseMessage {
  type: 'news_club_choice_required';
  your_hand: Card[];
  next_player_name: string;
  exclude_card_id?: string;
}

export interface NewsClubChoiceMessage extends BaseMessage {
  type: 'news_club_choice';
  player_id: string;
  card_id: string;
}

export type WebSocketMessage =
  | LoginMessage
  | LoginSuccessMessage
  | ReconnectMessage
  | ReconnectSuccessMessage
  | JoinGameMessage
  | JoinSuccessMessage
  | ErrorMessage
  | QueryGameStatusMessage
  | GameStatusMessage
  | PlayerListMessage
  | GameStateMessage
  | GetGameStateMessage
  | StartGameMessage
  | ResetGameMessage
  | PlayCardMessage
  | SkillChoiceRequiredMessage
  | SkillChoiceMessage
  | NewsClubChoiceMessage
  | ClassRepChoiceMessage
  | HonorStudentResponseMessage
  | ViewHandMessage
  | ViewHarmonyMessage
  | RichGirlChooseGiveMessage
  | ClassRepChoiceRequiredMessage
  | HonorStudentChoiceRequiredMessage
  | HonorStudentWaitingMessage
  | HonorStudentResultMessage
  | HonorStudentPhaseMessage
  | ClassRepWaitingMessage
  | ClassRepPhaseMessage
  | ClassRepResultMessage
  | NewsClubInProgressMessage
  | NewsClubYouChoseMessage
  | GameOverMessage;
