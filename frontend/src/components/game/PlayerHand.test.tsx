import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayerHand } from './PlayerHand'
import { Card, CardType, Player } from '../../types/game'

const cards: Card[] = [CardType.CLASS_REP, CardType.LIBRARY_COMMITTEE, CardType.CRIMINAL].map((name, index) => ({
  id: `card-${index}`, name, description: `${name}的完整特技效果`, harmony_value: 2,
  victory_priority: 3, victory_condition: '', owner_id: 'p1', is_face_up: false,
  location: 'hand', target_player_id: null,
}))

function Hand({ isCurrentTurn = true, hand = cards, onPlay = vi.fn() }) {
  const [selectedCard, onSelect] = useState<Card | null>(null)
  const player: Player = { id: 'p1', name: '玩家1', hand, field_cards: [], doubt_cards: [], is_connected: true, current_hand_count: hand.length }
  return <PlayerHand player={player} isCurrentTurn={isCurrentTurn} selectedCard={selectedCard} onSelect={onSelect} onPlay={onPlay} harmonyIsEmpty={false} newsClubMyChosenCard={null} turnStatusText="等待玩家2出牌" />
}

describe('hand skill preview', () => {
  it('shows the effect on click, switches cards and dismisses on a second click without playing', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    render(<Hand onPlay={onPlay} />)
    expect(screen.queryByLabelText('特技效果预览')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '卡牌：班长' }))
    expect(screen.getByLabelText('特技效果预览')).toBeVisible()
    expect(screen.getByLabelText('特技效果预览')).toHaveTextContent(cards[0].description)
    await user.click(screen.getByRole('button', { name: '卡牌：图书委员' }))
    expect(screen.getByLabelText('特技效果预览')).toHaveTextContent(cards[1].description)
    await user.click(screen.getByRole('button', { name: '卡牌：图书委员' }))
    expect(screen.queryByLabelText('特技效果预览')).not.toBeInTheDocument()
    expect(onPlay).not.toHaveBeenCalled()
  })

  it.each([
    { isCurrentTurn: false, hand: cards, name: CardType.CLASS_REP },
    { isCurrentTurn: true, hand: cards, name: CardType.CRIMINAL },
    { isCurrentTurn: true, hand: [cards[0]], name: CardType.CLASS_REP },
  ])('allows preview without granting play actions: $name', async ({ isCurrentTurn, hand, name }) => {
    render(<Hand isCurrentTurn={isCurrentTurn} hand={hand} />)
    await userEvent.setup().click(screen.getByRole('button', { name: `卡牌：${name}` }))
    expect(screen.getByLabelText('特技效果预览')).toBeVisible()
    if (name === CardType.CRIMINAL) expect(screen.getByLabelText('特技效果预览')).toHaveTextContent('不能主动打出')
    expect(screen.queryByRole('button', { name: /^调和$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^特技$/ })).not.toBeInTheDocument()
  })
})
