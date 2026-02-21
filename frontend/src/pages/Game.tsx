import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Card } from '../components/game/Card';
import { usePlayerStore } from '../stores/playerStore';
import { useGameStore } from '../stores/gameStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { wsService } from '../services/websocket';
import { GameStateMessage, GameOverMessage, PlayCardMessage, SkillChoiceRequiredMessage, ViewHandMessage, ViewHarmonyMessage, NewsClubChoiceRequiredMessage, RichGirlChooseGiveMessage, ClassRepChoiceRequiredMessage, HonorStudentChoiceRequiredMessage, HonorStudentResultMessage, HonorStudentPhaseMessage, ClassRepWaitingMessage, ClassRepPhaseMessage, ClassRepResultMessage, NewsClubInProgressMessage, NewsClubYouChoseMessage, SettlementSummary } from '../types/message';
import { Card as CardType, CardUsageType, GameState as GameStateEnum, CardType as CardTypeEnum } from '../types/game';

/** 使用特技时需要选择目标玩家的卡牌（班长、保健委员、风纪委员、大小姐等） */
const SKILL_CARDS_NEED_TARGET: CardTypeEnum[] = [
  CardTypeEnum.CLASS_REP,
  CardTypeEnum.HEALTH_COMMITTEE,
  CardTypeEnum.DISCIPLINE_COMMITTEE,
  CardTypeEnum.RICH_GIRL,
];

function skillNeedsTarget(card: CardType): boolean {
  return SKILL_CARDS_NEED_TARGET.includes(card.name);
}

export const Game: React.FC = () => {
  const navigate = useNavigate();
  const { playerId, playerName } = usePlayerStore();
  const { gameState, setGameState } = useGameStore();
  const { send } = useWebSocket();
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  /** 结算摘要（game_over 时下发），用于完整结算展示 */
  const [settlementSummary, setSettlementSummary] = useState<SettlementSummary | null>(null);
  /** 质疑/特技需选目标：选完目标后再发 play_card */
  const [pendingTargetAction, setPendingTargetAction] = useState<{ card: CardType; usageType: CardUsageType.DOUBT | CardUsageType.SKILL } | null>(null);
  /** 大小姐特技：服务端要求选「从目标拿哪张、自己给哪张」 */
  const [pendingSkillChoice, setPendingSkillChoice] = useState<{
    skill_type: 'rich_girl';
    target_player_id: string;
    target_player_name: string;
    target_hand: { id: string }[];
    your_hand: CardType[];
  } | null>(null);
  const [richGirlTakeId, setRichGirlTakeId] = useState<string | null>(null);
  const [richGirlGiveId, setRichGirlGiveId] = useState<string | null>(null);
  /** 保健委员：所选场上正面牌（目标玩家 id + 场牌 id） */
  const [selectedFieldCard, setSelectedFieldCard] = useState<{ target_player_id: string; target_card_id: string } | null>(null);
  /** 风纪委员：查看目标手牌结果（仅展示，只读） */
  const [viewHandResult, setViewHandResult] = useState<{ target_player_name: string; hand: CardType[] } | null>(null);
  /** 归宅部：选择手牌+调和区一张交换 */
  const [pendingHomeClub, setPendingHomeClub] = useState<{ card: CardType } | null>(null);
  const [homeClubHandId, setHomeClubHandId] = useState<string | null>(null);
  const [homeClubHarmonyId, setHomeClubHarmonyId] = useState<string | null>(null);
  /** 图书委员：查看调和区结果 */
  const [viewHarmonyResult, setViewHarmonyResult] = useState<CardType[] | null>(null);
  /** 新闻部：选择一张手牌递给下家；exclude_card_id 为上家递来的牌不可选 */
  const [pendingNewsClubChoice, setPendingNewsClubChoice] = useState<{ your_hand: CardType[]; next_player_name: string; exclude_card_id?: string } | null>(null);
  const [newsClubSelectedCardId, setNewsClubSelectedCardId] = useState<string | null>(null);
  /** 新闻部进行中：当前选牌玩家 id，用于提示 */
  const [newsClubCurrentChooserId, setNewsClubCurrentChooserId] = useState<string | null>(null);
  /** 新闻部：我选的牌（展示用） */
  const [newsClubMyChosenCard, setNewsClubMyChosenCard] = useState<CardType | null>(null);
  /** 班长：选一张手牌与目标交换 */
  const [pendingClassRepChoice, setPendingClassRepChoice] = useState<{ your_hand: CardType[]; target_player_name: string } | null>(null);
  const [classRepSelectedCardId, setClassRepSelectedCardId] = useState<string | null>(null);
  /** 优等生：仅持犯人/外星人时需响应。criminal=必须举手，alien=可选举手 */
  const [pendingHonorStudentChoice, setPendingHonorStudentChoice] = useState<'criminal' | 'alien' | null>(null);
  /** 优等生：打出者等待举手结果 */
  const [honorStudentWaiting, setHonorStudentWaiting] = useState(false);
  /** 优等生：举手结果（仅打出者可见） */
  const [honorStudentResult, setHonorStudentResult] = useState<string[] | null>(null);
  /** 大小姐第二阶段：看到拿到的牌后选要给的牌 */
  const [richGirlGivePhase, setRichGirlGivePhase] = useState<{ taken_card: CardType; your_hand: CardType[] } | null>(null);
  /** 服务器下发的错误提示（如调和区为空时出归宅部） */
  const [gameError, setGameError] = useState<string | null>(null);
  /** 优等生阶段（广播）：无关玩家显示「正在等待其他人举手」 */
  const [honorStudentPhase, setHonorStudentPhase] = useState<'waiting' | null>(null);
  /** 班长：打出者已选，等待目标选牌 */
  const [classRepWaitingTarget, setClassRepWaitingTarget] = useState<string | null>(null);
  /** 班长阶段（广播）：所有人显示等待/交换完成 */
  const [classRepPhase, setClassRepPhase] = useState<{ phase: 'waiting_target' | 'done'; actor_name?: string; target_name?: string } | null>(null);
  /** 班长：交换结果（双方可见） */
  const [classRepResult, setClassRepResult] = useState<{ card_you_gave: CardType; card_you_received: CardType } | null>(null);
  /** 回合切换提示（几秒后消失） */
  const [turnChangeToast, setTurnChangeToast] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      navigate('/', { replace: true });
    }
  }, [playerId, navigate]);

  useEffect(() => {
    if (!turnChangeToast) return;
    const t = setTimeout(() => setTurnChangeToast(null), 3000);
    return () => clearTimeout(t);
  }, [turnChangeToast]);

  useEffect(() => {
    if (classRepPhase?.phase !== 'done') return;
    const t = setTimeout(() => setClassRepPhase(null), 3000);
    return () => clearTimeout(t);
  }, [classRepPhase?.phase]);

  useEffect(() => {
    if (!classRepResult) return;
    const t = setTimeout(() => setClassRepResult(null), 4000);
    return () => clearTimeout(t);
  }, [classRepResult]);

  useEffect(() => {
    const handleGameState = (message: GameStateMessage) => {
      const next = message.game_state;
      if (next?.state === GameStateEnum.WAITING || next?.state === 'waiting') {
        setWinnerId(null);
        setSettlementSummary(null);
        setGameState(next);
        navigate('/lobby');
        return;
      }
      if (next?.state === GameStateEnum.GAME_OVER && next?.winner) {
        setWinnerId(next.winner);
      }
      setGameState(prev => {
        if (prev?.state === GameStateEnum.PLAYING && next?.state === GameStateEnum.PLAYING &&
            (prev.turn_count !== next.turn_count || prev.current_player_index !== next.current_player_index)) {
          const idx = next.current_player_index;
          const nextPlayer = next.players[idx];
          setTurnChangeToast(nextPlayer ? `轮到 ${nextPlayer.name} 出牌` : '下一回合');
        }
        return next;
      });
    };

    const handleGameOver = (message: GameOverMessage) => {
      setWinnerId(message.winner_id);
      setSettlementSummary(message.settlement ?? null);
    };

    const handleSkillChoiceRequired = (message: SkillChoiceRequiredMessage) => {
      if (message.skill_type === 'rich_girl') {
        setPendingSkillChoice({
          skill_type: 'rich_girl',
          target_player_id: message.target_player_id,
          target_player_name: message.target_player_name,
          target_hand: message.target_hand,
          your_hand: message.your_hand,
        });
        setRichGirlTakeId(null);
        setRichGirlGiveId(null);
      }
    };

    const handleViewHand = (message: ViewHandMessage) => {
      setViewHandResult({
        target_player_name: message.target_player_name,
        hand: message.hand,
      });
    };
    const handleViewHarmony = (message: ViewHarmonyMessage) => {
      setViewHarmonyResult(message.harmony_area);
    };
    const handleNewsClubChoiceRequired = (message: NewsClubChoiceRequiredMessage) => {
      setPendingNewsClubChoice({
        your_hand: message.your_hand,
        next_player_name: message.next_player_name,
        exclude_card_id: message.exclude_card_id,
      });
      setNewsClubSelectedCardId(null);
    };
    const handleRichGirlChooseGive = (message: RichGirlChooseGiveMessage) => {
      setRichGirlGivePhase({ taken_card: message.taken_card, your_hand: message.your_hand });
      setRichGirlGiveId(null);
    };
    const handleClassRepChoiceRequired = (message: ClassRepChoiceRequiredMessage) => {
      setPendingClassRepChoice({ your_hand: message.your_hand, target_player_name: message.target_player_name });
      setClassRepSelectedCardId(null);
    };
    const handleHonorStudentChoiceRequired = (message: HonorStudentChoiceRequiredMessage) => {
      setPendingHonorStudentChoice(message.role);
    };
    const handleHonorStudentWaiting = () => setHonorStudentWaiting(true);
    const handleHonorStudentResult = (message: HonorStudentResultMessage) => {
      setHonorStudentWaiting(false);
      setHonorStudentResult(message.raised_player_names);
      setHonorStudentPhase(null);
    };
    const handleHonorStudentPhase = (message: HonorStudentPhaseMessage) => {
      setHonorStudentPhase(message.phase === 'waiting' ? 'waiting' : null);
    };
    const handleClassRepWaiting = (message: ClassRepWaitingMessage) => {
      setClassRepWaitingTarget(message.target_player_name);
    };
    const handleClassRepPhase = (message: ClassRepPhaseMessage) => {
      setClassRepPhase(message.phase ? { phase: message.phase, actor_name: message.actor_name, target_name: message.target_name } : null);
      if (message.phase === 'done') {
        setClassRepWaitingTarget(null);
      }
    };
    const handleClassRepResult = (message: ClassRepResultMessage) => {
      setClassRepResult({ card_you_gave: message.card_you_gave, card_you_received: message.card_you_received });
      setClassRepPhase(null);
      setClassRepWaitingTarget(null);
      setPendingClassRepChoice(null);
      setClassRepSelectedCardId(null);
    };
    const handleNewsClubInProgress = (message: NewsClubInProgressMessage) => {
      setNewsClubCurrentChooserId(message.current_player_id);
    };
    const handleNewsClubYouChose = (message: NewsClubYouChoseMessage) => {
      setNewsClubMyChosenCard(message.card);
    };
    const handleNewsClubEnded = () => {
      setNewsClubCurrentChooserId(null);
      setNewsClubMyChosenCard(null);
    };
    const handleError = (message: { type: string; message?: string }) => {
      setGameError(message.message || '操作失败');
    };

    wsService.on('game_state', handleGameState);
    wsService.on('error', handleError);
    wsService.on('game_over', handleGameOver);
    wsService.on('skill_choice_required', handleSkillChoiceRequired);
    wsService.on('rich_girl_choose_give', handleRichGirlChooseGive);
    wsService.on('view_hand', handleViewHand);
    wsService.on('view_harmony', handleViewHarmony);
    wsService.on('news_club_choice_required', handleNewsClubChoiceRequired);
    wsService.on('news_club_in_progress', handleNewsClubInProgress);
    wsService.on('news_club_you_chose', handleNewsClubYouChose);
    wsService.on('news_club_ended', handleNewsClubEnded);
    wsService.on('class_rep_choice_required', handleClassRepChoiceRequired);
    wsService.on('honor_student_choice_required', handleHonorStudentChoiceRequired);
    wsService.on('honor_student_waiting', handleHonorStudentWaiting);
    wsService.on('honor_student_result', handleHonorStudentResult);
    wsService.on('honor_student_phase', handleHonorStudentPhase);
    wsService.on('class_rep_waiting', handleClassRepWaiting);
    wsService.on('class_rep_phase', handleClassRepPhase);
    wsService.on('class_rep_result', handleClassRepResult);

    return () => {
      wsService.off('game_state');
      wsService.off('game_over');
      wsService.off('skill_choice_required');
      wsService.off('rich_girl_choose_give');
      wsService.off('view_hand');
      wsService.off('view_harmony');
      wsService.off('news_club_choice_required');
      wsService.off('news_club_in_progress');
      wsService.off('news_club_you_chose');
      wsService.off('news_club_ended');
      wsService.off('error');
      wsService.off('class_rep_choice_required');
      wsService.off('honor_student_choice_required');
      wsService.off('honor_student_waiting');
      wsService.off('honor_student_result');
      wsService.off('honor_student_phase');
      wsService.off('class_rep_waiting');
      wsService.off('class_rep_phase');
      wsService.off('class_rep_result');
    };
  }, [setGameState, navigate]);

  const handlePlayCard = (card: CardType, usageType: CardUsageType, targetPlayerId?: string, targetCardId?: string, handCardId?: string, harmonyCardId?: string) => {
    if (usageType === CardUsageType.DOUBT && targetPlayerId == null) {
      setPendingTargetAction({ card, usageType: CardUsageType.DOUBT });
      return;
    }
    if (usageType === CardUsageType.SKILL && card.name === CardTypeEnum.HOME_CLUB) {
      if (handCardId != null && harmonyCardId != null) {
        // 已选好手牌与调和区牌，继续往下发送 play_card
      } else {
        if (!gameState?.harmony_area?.length) return;
        setPendingHomeClub({ card });
        setHomeClubHandId(null);
        setHomeClubHarmonyId(null);
        return;
      }
    }
    if (usageType === CardUsageType.SKILL && skillNeedsTarget(card) && targetPlayerId == null && card.name !== CardTypeEnum.HEALTH_COMMITTEE) {
      setPendingTargetAction({ card, usageType: CardUsageType.SKILL });
      return;
    }
    if (usageType === CardUsageType.SKILL && card.name === CardTypeEnum.HEALTH_COMMITTEE && (targetPlayerId == null || targetCardId == null)) {
      setPendingTargetAction({ card, usageType: CardUsageType.SKILL });
      setSelectedFieldCard(null);
      return;
    }

    const message: PlayCardMessage = {
      type: 'play_card',
      player_id: playerId!,
      card_id: card.id,
      usage_type: usageType,
      ...(targetPlayerId != null ? { target_player_id: targetPlayerId } : {}),
      ...(targetCardId != null ? { target_card_id: targetCardId } : {}),
      ...(handCardId != null ? { hand_card_id: handCardId } : {}),
      ...(harmonyCardId != null ? { harmony_card_id: harmonyCardId } : {}),
    };
    send(message);
    setSelectedCard(null);
    setPendingTargetAction(null);
    setSelectedFieldCard(null);
    setPendingHomeClub(null);
    setHomeClubHandId(null);
    setHomeClubHarmonyId(null);
  };

  const handleConfirmTarget = (targetPlayerId: string) => {
    if (!pendingTargetAction) return;
    handlePlayCard(pendingTargetAction.card, pendingTargetAction.usageType, targetPlayerId);
  };

  const handleConfirmHealthCommitteeFieldCard = () => {
    if (!pendingTargetAction || pendingTargetAction.card.name !== CardTypeEnum.HEALTH_COMMITTEE || pendingTargetAction.usageType !== CardUsageType.SKILL || !selectedFieldCard) return;
    handlePlayCard(
      pendingTargetAction.card,
      CardUsageType.SKILL,
      selectedFieldCard.target_player_id,
      selectedFieldCard.target_card_id
    );
  };

  const handleConfirmHomeClub = () => {
    if (!pendingHomeClub || !homeClubHandId || !homeClubHarmonyId) return;
    handlePlayCard(pendingHomeClub.card, CardUsageType.SKILL, undefined, undefined, homeClubHandId, homeClubHarmonyId);
  };

  const handleConfirmNewsClubChoice = () => {
    if (!pendingNewsClubChoice || !newsClubSelectedCardId || !playerId) return;
    send({ type: 'news_club_choice', player_id: playerId, card_id: newsClubSelectedCardId });
    setPendingNewsClubChoice(null);
    setNewsClubSelectedCardId(null);
  };

  const handleConfirmSkillChoice = () => {
    if (!pendingSkillChoice || pendingSkillChoice.skill_type !== 'rich_girl' || !richGirlTakeId || !playerId) return;
    if (richGirlGivePhase) {
      if (!richGirlGiveId) return;
      send({
        type: 'skill_choice',
        player_id: playerId,
        target_player_id: pendingSkillChoice.target_player_id,
        take_card_id: richGirlTakeId,
        give_card_id: richGirlGiveId,
      });
      setPendingSkillChoice(null);
      setRichGirlGivePhase(null);
      setRichGirlTakeId(null);
      setRichGirlGiveId(null);
    } else {
      send({
        type: 'skill_choice',
        player_id: playerId,
        target_player_id: pendingSkillChoice.target_player_id,
        take_card_id: richGirlTakeId,
      });
      setRichGirlGiveId(null);
    }
  };

  const handleConfirmClassRepChoice = () => {
    if (!pendingClassRepChoice || !classRepSelectedCardId || !playerId) return;
    send({ type: 'class_rep_choice', player_id: playerId, card_id: classRepSelectedCardId });
    setPendingClassRepChoice(null);
    setClassRepSelectedCardId(null);
  };

  const handleHonorStudentResponse = (response: 'raise_hand' | 'none') => {
    if (!playerId) return;
    send({ type: 'honor_student_response', player_id: playerId, response });
    setPendingHonorStudentChoice(null);
  };

  const handleLeave = () => {
    wsService.disconnect();
    navigate('/');
  };

  const handleResetGame = () => {
    send({ type: 'reset_game' });
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find(p => p.id === playerId);
  const isCurrentPlayer = gameState.current_player_index === gameState.players.findIndex(p => p.id === playerId);
  const isGameOver = gameState.state === GameStateEnum.GAME_OVER || winnerId != null;
  const resolvedWinnerId = winnerId ?? gameState.winner ?? null;
  const winner = resolvedWinnerId ? gameState.players.find(p => p.id === resolvedWinnerId) : null;

  // 顶层横幅文案：等待他人 / 轮到你，统一在固定顶部显示，无需滚到最上方
  const topBannerMessage = ((): { text: string; type: 'waiting' | 'your-turn' } | null => {
    if (honorStudentPhase === 'waiting') return { text: '正在等待其他人举手', type: 'waiting' };
    if (honorStudentWaiting) return { text: '优等生：正在等待其他人举手…', type: 'waiting' };
    if (classRepWaitingTarget) return { text: `正在等待 ${classRepWaitingTarget} 选牌`, type: 'waiting' };
    if (classRepPhase?.phase === 'waiting_target') return { text: `班长：${classRepPhase.actor_name ?? ''} 与 ${classRepPhase.target_name ?? ''} 正在选牌`, type: 'waiting' };
    if (classRepPhase?.phase === 'done') return { text: `班长：${classRepPhase.actor_name ?? ''} 与 ${classRepPhase.target_name ?? ''} 交换完成`, type: 'waiting' };
    if (newsClubCurrentChooserId) {
      const name = gameState.players.find(p => p.id === newsClubCurrentChooserId)?.name ?? '某玩家';
      return newsClubCurrentChooserId === playerId
        ? { text: '新闻部：请选择一张手牌递给下家', type: 'your-turn' }
        : { text: `新闻部：${name} 正在选牌…`, type: 'waiting' };
    }
    if (isCurrentPlayer) return { text: '轮到你出牌！', type: 'your-turn' };
    const idx = gameState.current_player_index;
    const who = gameState.players[idx]?.name ?? '某玩家';
    return { text: `轮到 ${who} 出牌`, type: 'waiting' };
  })();

  if (isGameOver) {
    const harmonyTotal = settlementSummary?.harmony_total ?? gameState.harmony_area.reduce((s, c) => s + c.harmony_value, 0);
    const requiredHarmony = settlementSummary?.required_harmony_value ?? gameState.required_harmony_value ?? 0;
    const harmonyReached = settlementSummary?.harmony_reached ?? (harmonyTotal >= requiredHarmony);
    const doubtTotals = settlementSummary?.player_doubt_totals ?? Object.fromEntries(
      gameState.players.map(p => [p.id, p.doubt_cards.reduce((s, c) => s + c.harmony_value, 0)])
    );
    const imprisonedIds = settlementSummary?.imprisoned_player_ids ?? [];

    return (
      <div className="min-h-screen bg-slate-900 text-slate-200 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-8 pb-24">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h1 className="text-2xl font-bold text-white">游戏结束 · 完整结算</h1>
            <div className="flex gap-2">
              <Button onClick={handleResetGame} variant="secondary" size="sm">重新开始一局</Button>
              <Button onClick={handleLeave} variant="primary" size="sm">返回登录</Button>
            </div>
          </div>

          {/* 判定 1：调和值 */}
          <section className="bg-slate-800 rounded-xl p-4 border border-slate-600">
            <h2 className="text-lg font-semibold text-amber-200 mb-3">判定 1：调和值</h2>
            <p className="text-slate-400 text-sm mb-2">调和区卡牌（正面）及数值总和</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {gameState.harmony_area.length === 0 ? (
                <span className="text-slate-500">无</span>
              ) : (
                gameState.harmony_area.map((c) => (
                  <div key={c.id} className="w-16">
                    <Card card={c} showAsFaceDown={false} />
                  </div>
                ))
              )}
            </div>
            <p className="text-slate-300">
              总和 = <strong className="text-white">{harmonyTotal}</strong>
              {' '}/ 要求 <strong className="text-white">{requiredHarmony}</strong>
              {' '}
              <span className={harmonyReached ? 'text-emerald-400' : 'text-red-400'}>
                {harmonyReached ? '达成' : '未达成'}
              </span>
            </p>
          </section>

          {/* 已出卡片区（正面出牌） */}
          <section className="bg-slate-800 rounded-xl p-4 border border-slate-600">
            <h2 className="text-lg font-semibold text-slate-300 mb-3">已出卡片区 · 正面出牌</h2>
            <div className="flex flex-wrap gap-3">
              {gameState.players.flatMap((p) =>
                (p.field_cards ?? []).map((c) => (
                  <div key={c.id} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-slate-500">{p.name}</span>
                    <div className="w-16">
                      <Card card={c} showAsFaceDown={false} />
                    </div>
                  </div>
                ))
              )}
              {gameState.players.every((p) => !(p.field_cards?.length)) && (
                <span className="text-slate-500">无</span>
              )}
            </div>
          </section>

          {/* 判定 2：质疑结算 */}
          <section className="bg-slate-800 rounded-xl p-4 border border-slate-600">
            <h2 className="text-lg font-semibold text-amber-200 mb-3">判定 2：质疑结算</h2>
            <p className="text-slate-400 text-sm mb-3">各玩家被质疑的牌（正面）及数值总和，数值最大且唯一者被监禁</p>
            <div className="space-y-4">
              {gameState.players.map((p) => {
                const total = doubtTotals[p.id] ?? 0;
                const isImprisoned = imprisonedIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg p-3 border-2 ${isImprisoned ? 'border-red-500 bg-red-900/20' : 'border-slate-600 bg-slate-700/50'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-white">{p.name}</span>
                      <span className="text-slate-400 text-sm">质疑区总和 = {total}</span>
                      {isImprisoned && (
                        <span className="text-xs font-medium text-red-400 bg-red-900/50 px-2 py-0.5 rounded">被监禁</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {(p.doubt_cards ?? []).length === 0 ? (
                        <span className="text-slate-500 text-sm">无</span>
                      ) : (
                        (p.doubt_cards ?? []).map((c) => (
                          <div key={c.id} className="w-24 min-w-[5rem]">
                            <Card card={c} showAsFaceDown={false} showVictoryPriority={false} />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 判定 3：最终手牌与胜者 */}
          <section className="bg-slate-800 rounded-xl p-4 border border-slate-600">
            <h2 className="text-lg font-semibold text-amber-200 mb-3">判定 3：最终手牌与胜者</h2>
            <p className="text-slate-400 text-sm mb-3">按胜利优先级依次公开手牌，先满足条件者胜</p>
            <div className="space-y-4">
              {gameState.players.map((p) => {
                const hand = p.hand ?? [];
                const isWinner = resolvedWinnerId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg p-3 border-2 ${isWinner ? 'border-primary-500 bg-primary-900/20' : 'border-slate-600 bg-slate-700/50'}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-white">{p.name}</span>
                      {isWinner && (
                        <span className="text-primary-400 font-bold">获胜</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {hand.length === 0 ? (
                        <span className="text-slate-500 text-sm">无</span>
                      ) : (
                        hand.map((c) => (
                          <div key={c.id} className="w-24 min-w-[5rem] flex flex-col items-center gap-0.5">
                            <Card card={c} showAsFaceDown={false} showVictoryPriority={true} />
                            {typeof c.victory_priority === 'number' && (
                              <span className="text-[10px] text-slate-500">胜利优先级 {c.victory_priority}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="text-center pt-4">
            <p className="text-primary-400 text-xl font-semibold mb-4">
              {winner ? `${winner.name} 获胜！` : '本局无人达成胜利条件'}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={handleResetGame} variant="secondary">重新开始一局</Button>
              <Button onClick={handleLeave} variant="primary">返回登录</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-800 border-b border-slate-700">
        <div className="p-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              {playerName && <span className="text-slate-300">{playerName}</span>}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-300">回合: {gameState.turn_count}</span>
              <Button onClick={handleResetGame} variant="secondary" size="sm">重新开始</Button>
              <Button onClick={handleLeave} variant="danger" size="sm">离开</Button>
            </div>
          </div>
        </div>
        {topBannerMessage && (
          <div
            className={`px-4 py-2.5 text-center text-sm font-medium ${
              topBannerMessage.type === 'your-turn'
                ? 'bg-primary-600/90 text-white border-t border-primary-500'
                : 'bg-slate-700/95 text-slate-200 border-t border-slate-600'
            }`}
          >
            {topBannerMessage.type === 'your-turn' && <span className="mr-1">▶</span>}
            {topBannerMessage.text}
            {topBannerMessage.type === 'your-turn' && topBannerMessage.text === '轮到你出牌！' && (
              <span className="block text-xs text-primary-100 mt-0.5 font-normal">请选择一张手牌并选择出牌方式（调和 / 质疑 / 特技）</span>
            )}
          </div>
        )}
      </div>

      <div className={`flex-1 max-w-6xl mx-auto w-full p-4 space-y-6 ${topBannerMessage ? 'pt-28' : 'pt-24'}`}>
        {gameError && (
          <div className="bg-red-900/50 border border-red-600 rounded-xl p-3 flex items-center justify-between">
            <span className="text-red-200">{gameError}</span>
            <Button variant="danger" size="sm" onClick={() => setGameError(null)}>关闭</Button>
          </div>
        )}
        {pendingTargetAction && (pendingTargetAction.card.name !== CardTypeEnum.HEALTH_COMMITTEE || pendingTargetAction.usageType === CardUsageType.DOUBT) && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setPendingTargetAction(null)}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
              <p className="text-amber-200 font-medium mb-2">
                {pendingTargetAction.usageType === CardUsageType.DOUBT ? '选择要质疑的玩家' : '选择目标玩家'}
              </p>
              {pendingTargetAction.usageType === CardUsageType.SKILL && (
                <p className="text-slate-400 text-xs mb-4">手牌剩一张的玩家处于等待结算阶段，不可选为特技目标</p>
              )}
              <div className="flex flex-wrap gap-2">
                {gameState.players
                  .filter(p => p.id !== playerId && (pendingTargetAction.usageType === CardUsageType.DOUBT || p.current_hand_count > 1))
                  .map((player) => (
                    <Button key={player.id} variant="secondary" size="sm" onClick={() => handleConfirmTarget(player.id)}>{player.name}</Button>
                  ))}
                {pendingTargetAction.usageType === CardUsageType.SKILL && gameState.players.filter(p => p.id !== playerId && p.current_hand_count <= 1).length > 0 && (
                  <span className="text-slate-500 text-xs w-full">（部分玩家手牌已剩一张，已排除）</span>
                )}
                <Button variant="danger" size="sm" onClick={() => setPendingTargetAction(null)}>取消</Button>
              </div>
            </div>
          </div>
        )}

        {pendingHomeClub && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setPendingHomeClub(null); setHomeClubHandId(null); setHomeClubHarmonyId(null); }}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-lg w-full shadow-xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <p className="text-emerald-200 font-medium mb-4">归宅部：选择一张手牌与调和区的一张牌进行替换</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-slate-300 text-sm mb-2">选择一张手牌</p>
                  {currentPlayer && (
                    <div className="flex flex-wrap gap-2">
                      {currentPlayer.hand.filter(c => c.id !== pendingHomeClub.card.id).map((c) => (
                        <div key={c.id} className={`w-24 cursor-pointer rounded-lg border-2 p-1 ${homeClubHandId === c.id ? 'border-emerald-400 bg-emerald-900/50' : 'border-slate-600 hover:border-emerald-500'}`} onClick={() => setHomeClubHandId(c.id)}>
                          <Card card={c} showAsFaceDown={false} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-slate-300 text-sm mb-2">选择调和区一张牌</p>
                  {gameState.harmony_area.length === 0 ? (
                    <p className="text-slate-500 text-sm">调和区为空</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {gameState.harmony_area.map((c) => (
                        <div key={c.id} className={`w-24 cursor-pointer rounded-lg border-2 p-1 ${homeClubHarmonyId === c.id ? 'border-emerald-400 bg-emerald-900/50' : 'border-slate-600 hover:border-emerald-500'}`} onClick={() => setHomeClubHarmonyId(c.id)}>
                          <Card card={c} showAsFaceDown />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleConfirmHomeClub} disabled={!homeClubHandId || !homeClubHarmonyId}>确认替换</Button>
                <Button variant="danger" size="sm" onClick={() => { setPendingHomeClub(null); setHomeClubHandId(null); setHomeClubHarmonyId(null); }}>取消</Button>
              </div>
            </div>
          </div>
        )}

        {pendingTargetAction && pendingTargetAction.card.name === CardTypeEnum.HEALTH_COMMITTEE && pendingTargetAction.usageType === CardUsageType.SKILL && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setPendingTargetAction(null); setSelectedFieldCard(null); }}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <p className="text-amber-200 font-medium mb-2">保健委员：选择一张场上正面朝上的卡牌，归入自己的手牌</p>
              <p className="text-slate-400 text-xs mb-4">手牌剩一张的玩家处于等待结算阶段，其场牌不可选</p>
              {!gameState.players.some(p => p.current_hand_count > 1 && p.field_cards.length > 0) ? (
                <p className="text-slate-400 text-sm">场上暂无可选正面朝上的卡牌（手牌剩一张的玩家场牌不可选）</p>
              ) : (
                <div className="flex flex-wrap gap-4 mb-4">
                  {gameState.players
                    .filter((player) => player.current_hand_count > 1)
                    .map((player) =>
                      player.field_cards.map((card) => (
                        <div key={card.id} className={`w-28 cursor-pointer rounded-lg border-2 p-1 ${selectedFieldCard?.target_card_id === card.id ? 'border-amber-400 bg-amber-900/50' : 'border-slate-600 hover:border-amber-500'}`} onClick={() => setSelectedFieldCard({ target_player_id: player.id, target_card_id: card.id })}>
                          <div className="text-slate-400 text-xs mb-1">{player.name} 的场牌</div>
                          <Card card={card} showAsFaceDown={false} />
                        </div>
                      ))
                    )}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleConfirmHealthCommitteeFieldCard} disabled={!selectedFieldCard}>确认选择</Button>
                <Button variant="danger" size="sm" onClick={() => { setPendingTargetAction(null); setSelectedFieldCard(null); }}>取消</Button>
              </div>
            </div>
          </div>
        )}

        {pendingSkillChoice && pendingSkillChoice.skill_type === 'rich_girl' && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setPendingSkillChoice(null); setRichGirlTakeId(null); setRichGirlGiveId(null); setRichGirlGivePhase(null); }}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-lg w-full shadow-xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
              {!richGirlGivePhase ? (
                <>
                  <p className="text-violet-200 font-medium mb-4">大小姐：从 {pendingSkillChoice.target_player_name} 手牌选一张拿取（牌背），确认后再选要还给对方的牌</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {pendingSkillChoice.target_hand.map((c) => (
                      <div key={c.id} className={`w-24 cursor-pointer rounded-lg border-2 p-1 ${richGirlTakeId === c.id ? 'border-violet-400 bg-violet-900/50' : 'border-slate-600 hover:border-violet-500'}`} onClick={() => setRichGirlTakeId(c.id)}>
                        <div className="rounded-lg border-2 border-slate-600 bg-gradient-to-br from-slate-600 to-slate-700 aspect-[2/3] min-h-[100px] flex items-center justify-center">
                          <span className="text-slate-500 text-xs">牌背</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={handleConfirmSkillChoice} disabled={!richGirlTakeId}>确认（查看拿到的牌）</Button>
                    <Button variant="danger" size="sm" onClick={() => { setPendingSkillChoice(null); setRichGirlTakeId(null); setRichGirlGiveId(null); setRichGirlGivePhase(null); }}>取消</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-violet-200 font-medium mb-4">选择要交给 {pendingSkillChoice.target_player_name} 的牌（可还回刚拿的牌或选自己手牌）</p>
                  <div className="mb-2">
                    <p className="text-slate-300 text-sm mb-1">拿到的牌</p>
                    <div className="w-24"><Card card={richGirlGivePhase.taken_card} showAsFaceDown={false} /></div>
                  </div>
                  <div className="mb-4">
                    <p className="text-slate-300 text-sm mb-2">选择要交给对方的牌</p>
                    <div className="flex flex-wrap gap-2">
                      <div className={`w-24 cursor-pointer rounded-lg border-2 p-1 ${richGirlGiveId === richGirlGivePhase.taken_card.id ? 'border-violet-400 bg-violet-900/50' : 'border-slate-600 hover:border-violet-500'}`} onClick={() => setRichGirlGiveId(richGirlGivePhase.taken_card.id)}>
                        <div className="rounded-lg border-2 border-violet-600 bg-violet-900/50 aspect-[2/3] min-h-[100px] flex items-center justify-center"><span className="text-violet-200 text-xs px-1">刚拿的牌</span></div>
                      </div>
                      {richGirlGivePhase.your_hand.map((c) => (
                        <div key={c.id} className={`w-24 cursor-pointer rounded-lg border-2 p-1 ${richGirlGiveId === c.id ? 'border-violet-400 bg-violet-900/50' : 'border-slate-600 hover:border-violet-500'}`} onClick={() => setRichGirlGiveId(c.id)}>
                          <Card card={c} showAsFaceDown={false} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={handleConfirmSkillChoice} disabled={!richGirlGiveId}>确认交换</Button>
                    <Button variant="danger" size="sm" onClick={() => { setRichGirlGivePhase(null); setRichGirlGiveId(null); }}>取消</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {pendingClassRepChoice && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setPendingClassRepChoice(null); setClassRepSelectedCardId(null); }}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
              <p className="text-amber-200 font-medium mb-4">班长：选一张手牌与 {pendingClassRepChoice.target_player_name} 交换</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {pendingClassRepChoice.your_hand.map((c) => (
                  <div key={c.id} className={`w-24 cursor-pointer rounded-lg border-2 p-1 ${classRepSelectedCardId === c.id ? 'border-amber-400 bg-amber-900/50' : 'border-slate-600 hover:border-amber-500'}`} onClick={() => setClassRepSelectedCardId(c.id)}>
                    <Card card={c} showAsFaceDown={false} />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleConfirmClassRepChoice} disabled={!classRepSelectedCardId}>确认</Button>
                <Button variant="danger" size="sm" onClick={() => { setPendingClassRepChoice(null); setClassRepSelectedCardId(null); }}>取消</Button>
              </div>
            </div>
          </div>
        )}

        {honorStudentResult !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setHonorStudentResult(null)}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-2">优等生：举手结果</h3>
              <p className="text-slate-300 mb-4">
                {honorStudentResult.length > 0 ? `举手的人：${honorStudentResult.join('、')}` : '无人举手'}
              </p>
              <Button variant="primary" onClick={() => setHonorStudentResult(null)}>关闭</Button>
            </div>
          </div>
        )}

        {pendingHonorStudentChoice === 'criminal' && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-sm w-full shadow-xl">
              <p className="text-sky-200 font-medium mb-4">优等生特技：你持有犯人卡，必须举手示意</p>
              <Button variant="primary" onClick={() => handleHonorStudentResponse('raise_hand')}>举手</Button>
            </div>
          </div>
        )}

        {pendingHonorStudentChoice === 'alien' && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-sm w-full shadow-xl">
              <p className="text-sky-200 font-medium mb-4">优等生特技：你持有外星人卡，可以假装犯人举手</p>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => handleHonorStudentResponse('raise_hand')}>举手（假装犯人）</Button>
                <Button variant="secondary" onClick={() => handleHonorStudentResponse('none')}>不举手</Button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <h2 className="text-base font-semibold text-slate-300 mb-2">其他玩家</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {gameState.players
              .filter(p => p.id !== playerId)
              .map((player) => {
                const isWaitingSettlement = player.current_hand_count === 1;
                const isTheirTurn = gameState.current_player_index === gameState.players.findIndex(p => p.id === player.id);
                return (
                  <div
                    key={player.id}
                    className={`bg-slate-700 rounded-lg p-2 border-2 transition-all ${
                      isWaitingSettlement
                        ? 'border-red-500 ring-2 ring-red-400 ring-offset-2 ring-offset-slate-800 shadow-lg shadow-red-900/20'
                        : isTheirTurn
                          ? 'border-primary-500'
                          : 'border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-white font-medium text-sm">{player.name}</span>
                      {isWaitingSettlement && (
                        <span className="text-[10px] font-medium text-red-300 bg-red-900/50 px-1.5 py-0.5 rounded">等待结算</span>
                      )}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">手牌: {player.current_hand_count} 质疑: {(player.doubt_cards?.length ?? 0)}</div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h2 className="text-lg font-semibold text-slate-300 mb-3">已出卡片区</h2>
          <div className="space-y-3">
            <div>
              <div className="text-slate-400 text-sm mb-2">正面出牌</div>
              <div className="flex flex-wrap gap-2 items-end">
                {gameState.players.flatMap((p) =>
                  (p.field_cards ?? []).map((c) => (
                    <div key={c.id} className="flex flex-col items-center gap-0.5">
                      <span className="text-xs text-slate-500">{p.name}</span>
                      <div className="w-16">
                        <Card card={c} showAsFaceDown={false} />
                      </div>
                    </div>
                  ))
                )}
                {gameState.players.every((p) => !p.field_cards?.length) && (
                  <span className="text-slate-500 text-sm">暂无</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-slate-400 text-sm mb-2">质疑牌（背面，结算时揭晓）</div>
              <div className="flex flex-wrap gap-2 items-end">
                {gameState.players.flatMap((p) =>
                  (p.doubt_cards ?? []).map((c) => (
                    <div key={`${p.id}-${c.id}`} className="flex flex-col items-center gap-0.5">
                      <span className="text-xs text-slate-500">→ {p.name}</span>
                      <div className="w-12">
                        <Card
                          card={c}
                          showAsFaceDown={gameState.state !== GameStateEnum.GAME_OVER}
                        />
                      </div>
                    </div>
                  ))
                )}
                {gameState.players.every((p) => !p.doubt_cards?.length) && (
                  <span className="text-slate-500 text-sm">暂无</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
          <h2 className="text-base font-semibold text-slate-300 mb-2">调和区（背面朝上，有顺序）</h2>
          <div className="flex flex-wrap gap-2">
            {gameState.harmony_area.length === 0 ? (
              <p className="text-slate-500 text-sm">调和区为空</p>
            ) : (
              gameState.harmony_area.map((card) => (
                <div key={card.id} className="w-14">
                  <Card card={card} showAsFaceDown />
                </div>
              ))
            )}
          </div>
        </div>

        {viewHandResult && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setViewHandResult(null)}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-2">风纪委员：{viewHandResult.target_player_name} 的手牌</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {viewHandResult.hand.map((card) => (
                  <div key={card.id} className="w-28">
                    <Card card={card} showAsFaceDown={false} />
                  </div>
                ))}
              </div>
              <Button variant="primary" onClick={() => setViewHandResult(null)}>关闭</Button>
            </div>
          </div>
        )}

        {viewHarmonyResult && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setViewHarmonyResult(null)}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-2xl w-full shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-2">图书委员：调和区所有卡牌</h3>
              {viewHarmonyResult.length === 0 ? (
                <p className="text-slate-400 mb-4">当前调和区无牌</p>
              ) : (
                <div className="flex flex-wrap gap-2 mb-4">
                  {viewHarmonyResult.map((card) => (
                    <div key={card.id} className="w-28">
                      <Card card={card} showAsFaceDown={false} />
                    </div>
                  ))}
                </div>
              )}
              <Button variant="primary" onClick={() => setViewHarmonyResult(null)}>关闭</Button>
            </div>
          </div>
        )}

        {classRepResult && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setClassRepResult(null)}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-white mb-4">班长：交换结果</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-slate-400 text-sm mb-2">你给出的牌</p>
                  <div className="w-28">
                    <Card card={classRepResult.card_you_gave} showAsFaceDown={false} />
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 text-sm mb-2">你收到的牌</p>
                  <div className="w-28">
                    <Card card={classRepResult.card_you_received} showAsFaceDown={false} />
                  </div>
                </div>
              </div>
              <Button variant="primary" onClick={() => setClassRepResult(null)}>关闭</Button>
            </div>
          </div>
        )}

        {pendingNewsClubChoice && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setPendingNewsClubChoice(null); setNewsClubSelectedCardId(null); }}>
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-600 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
              <p className="text-sky-200 font-medium mb-4">新闻部：选择一张手牌递给 {pendingNewsClubChoice.next_player_name}（上家递来的牌不可选）</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {pendingNewsClubChoice.your_hand
                  .filter((c) => c.id !== pendingNewsClubChoice.exclude_card_id)
                  .map((c) => (
                    <div key={c.id} className={`w-24 cursor-pointer rounded-lg border-2 p-1 ${newsClubSelectedCardId === c.id ? 'border-sky-400 bg-sky-900/50' : 'border-slate-600 hover:border-sky-500'}`} onClick={() => setNewsClubSelectedCardId(c.id)}>
                      <Card card={c} showAsFaceDown={false} />
                    </div>
                  ))}
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleConfirmNewsClubChoice} disabled={!newsClubSelectedCardId}>确认递给下家</Button>
                <Button variant="danger" size="sm" onClick={() => { setPendingNewsClubChoice(null); setNewsClubSelectedCardId(null); }}>取消</Button>
              </div>
            </div>
          </div>
        )}

        {currentPlayer && (
          <div
            className={`rounded-xl p-4 border-2 transition-all ${
              currentPlayer.current_hand_count === 1
                ? 'bg-slate-800 ring-2 ring-red-400 ring-offset-2 ring-offset-slate-900 border-red-500 shadow-lg shadow-red-900/20'
                : isCurrentPlayer
                  ? 'bg-slate-800 ring-2 ring-primary-400 ring-offset-2 ring-offset-slate-900 border-primary-500 shadow-lg shadow-primary-900/20'
                  : 'bg-slate-800 border border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-300">
                我的卡牌
                {currentPlayer.current_hand_count === 1 && <span className="ml-2 text-red-400 font-bold">(等待结算)</span>}
                {isCurrentPlayer && currentPlayer.current_hand_count > 1 && <span className="ml-2 text-primary-400 font-bold">(当前回合)</span>}
              </h2>
              <div className="text-slate-400 flex gap-4">
                <span>手牌: {currentPlayer.hand.length}</span>
                <span>质疑: {currentPlayer.doubt_cards?.length ?? 0}</span>
              </div>
            </div>
            {newsClubMyChosenCard && (
              <div className="mb-4">
                <div className="text-sky-400 text-sm mb-2">新闻部：我选的牌（递给下家）</div>
                <div className="w-20">
                  <Card card={newsClubMyChosenCard} showAsFaceDown={false} />
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              {currentPlayer.hand.map((card) => (
                <div key={card.id} className="w-32">
                  <Card
                    card={card}
                    isPlayable={isCurrentPlayer && card.name !== CardTypeEnum.CRIMINAL && currentPlayer.hand.length > 1}
                    isSelected={selectedCard?.id === card.id}
                    onClick={() => setSelectedCard(card)}
                    showActions={selectedCard?.id === card.id && isCurrentPlayer && card.name !== CardTypeEnum.CRIMINAL}
                    onPlay={handlePlayCard}
                    disabledSkill={card.name === CardTypeEnum.HOME_CLUB && (!gameState.harmony_area || gameState.harmony_area.length === 0)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
