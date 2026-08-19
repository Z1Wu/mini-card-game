import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card, CardType, Player } from '../../types/game';
import { GameTable } from './GameTable';

const makeCard = (id: string, ownerId: string): Card => ({
  id,
  name: CardType.CLASS_REP,
  description: '',
  harmony_value: 2,
  victory_priority: 3,
  victory_condition: '',
  owner_id: ownerId,
  is_face_up: false,
  location: 'harmony',
  target_player_id: null,
  hidden: true,
});

const local: Player = { id: 'p1', name: '我', hand: [makeCard('hand', 'p1')], field_cards: [], doubt_cards: [makeCard('my-doubt', 'p1')], is_connected: true, current_hand_count: 2 };
const opponent: Player = { id: 'p2', name: '小王', hand: [], field_cards: [], doubt_cards: [makeCard('doubt', 'p2')], is_connected: true, current_hand_count: 3 };

describe('GameTable information hierarchy', () => {
  it('labels hidden harmony truthfully and does not create a central doubt pile', () => {
    render(
      <GameTable
        players={[local, opponent]}
        localPlayer={local}
        localPlayerId="p1"
        currentPlayerIndex={0}
        harmonyArea={[makeCard('harmony', 'p1')]}
        requiredHarmonyValue={6}
        selectedCard={null}
        onSelectCard={vi.fn()}
        onPlayCard={() => undefined}
        newsClubMyChosenCard={null}
        turnStatusText="轮到你出牌"
      />,
    );

    expect(screen.getByLabelText('调和目标 6，已投入 1 张，当前总值未知')).toBeInTheDocument();
    expect(screen.getByText('当前总值未知')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '质疑牌' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('小王 有 1 张质疑牌')).toBeInTheDocument();
    expect(screen.getByLabelText('你有 1 张质疑牌')).toBeInTheDocument();
    expect(screen.getByText('请选择一张手牌')).toBeInTheDocument();
  });

  it('keeps a server-driven multi-player wait visible to the current actor', () => {
    render(
      <GameTable
        players={[local, opponent]}
        localPlayer={local}
        localPlayerId="p1"
        currentPlayerIndex={0}
        harmonyArea={[]}
        requiredHarmonyValue={6}
        selectedCard={null}
        onSelectCard={vi.fn()}
        onPlayCard={() => undefined}
        newsClubMyChosenCard={null}
        turnStatusText="正在等待 小王 选牌"
      />,
    );

    expect(screen.getByText('正在等待 小王 选牌')).toBeInTheDocument();
    expect(screen.getByText('等待其他玩家完成操作')).toBeInTheDocument();
    expect(screen.queryByText('请选择一张手牌')).not.toBeInTheDocument();
  });
});
