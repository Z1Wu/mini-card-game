import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettlementView } from './SettlementView'
import { Card, CardType, Game, GameState } from '../../types/game'
import { SettlementSummary } from '../../types/message'

const role = (id: string, name: CardType, priority: number): Card => ({
  id, name, victory_priority: priority, victory_condition: '测试胜利条件', harmony_value: 2,
  description: '测试', owner_id: id, is_face_up: true, location: 'hand', target_player_id: null,
})

const game: Game = {
  id: 'game-1', state: GameState.GAME_OVER, winner: 'p1', player_count: 2,
  harmony_area: [], current_player_index: 0, turn_count: 1, required_harmony_value: 5,
  players: [
    { id: 'p1', name: '小王', hand: [role('c1', CardType.CLASS_REP, 2)], field_cards: [], doubt_cards: [], is_connected: true, current_hand_count: 1 },
    { id: 'p2', name: '小李', hand: [role('c2', CardType.ALIEN, 1)], field_cards: [], doubt_cards: [], is_connected: true, current_hand_count: 1 },
  ],
}

const summary: SettlementSummary = { harmony_total: 5, required_harmony_value: 5, harmony_reached: true, imprisoned_player_ids: ['p1', 'p2'], player_doubt_totals: { p1: 3, p2: 3 } }
const renderView = (overrides: Partial<React.ComponentProps<typeof SettlementView>> = {}) => render(<SettlementView gameState={game} winnerId="p1" settlementSummary={summary} isHost onRematch={vi.fn()} onReturnToLogin={vi.fn()} {...overrides} />)

describe('SettlementView', () => {
  it('reveals the four stages in order and moves focus to each heading', async () => {
    const user = userEvent.setup()
    renderView()
    expect(screen.getByRole('heading', { name: '调和揭晓' })).toHaveFocus()
    for (const title of ['质疑揭晓', '最终身份揭晓', '胜者揭晓']) {
      await user.click(screen.getByRole('button', { name: '下一步' }))
      expect(screen.getByRole('heading', { name: title })).toHaveFocus()
    }
    expect(screen.getByText('第 4 / 4 阶段：胜者揭晓')).toBeInTheDocument()
  })

  it('shows all tied imprisoned players and says nobody is imprisoned when there are none', async () => {
    const user = userEvent.setup()
    const { rerender } = renderView()
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByText('被监禁：小王、小李（并列）')).toBeInTheDocument()
    rerender(<SettlementView gameState={game} winnerId="p1" settlementSummary={{ ...summary, imprisoned_player_ids: [] }} isHost onRematch={vi.fn()} onReturnToLogin={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByText('无人被监禁')).toBeInTheDocument()
  })

  it('does not invent a winner when the supplied id is absent', async () => {
    const user = userEvent.setup()
    renderView({ winnerId: 'missing' })
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByText('本局没有可确认的胜者')).toBeInTheDocument()
    expect(screen.getByText('结算资料未提供可匹配的胜者，未显示推测结果。')).toBeInTheDocument()
  })

  it('keeps the selected stage immediately visible with reduced motion enabled', async () => {
    const original = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: query === '(prefers-reduced-motion: reduce)', media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    const user = userEvent.setup()
    renderView()
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('heading', { name: '质疑揭晓' })).toBeVisible()
    window.matchMedia = original
  })
})
