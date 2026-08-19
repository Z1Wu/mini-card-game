import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Card } from './Card'
import { Card as CardModel, CardType, CardUsageType } from '../../types/game'

const card: CardModel = {
  id: 'card-1',
  name: CardType.CLASS_REP,
  description: '测试技能说明',
  harmony_value: 3,
  victory_priority: 2,
  victory_condition: '测试胜利条件',
  owner_id: 'player-1',
  is_face_up: true,
  location: 'hand',
  target_player_id: null,
}

describe('Card', () => {
  it('shows only the card back accessibly when face-down', () => {
    render(<Card card={card} showAsFaceDown />)

    expect(screen.getByLabelText('牌背')).toBeInTheDocument()
    expect(screen.queryByLabelText(`卡牌：${card.name}`)).not.toBeInTheDocument()
    expect(screen.queryByText(card.name)).not.toBeInTheDocument()
  })

  it('gives a face-up card its role-based accessible name', () => {
    render(<Card card={card} />)

    expect(screen.getByLabelText(`卡牌：${card.name}`)).toBeInTheDocument()
  })

  it('sends Harmony exactly once', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    render(<Card card={card} showActions onPlay={onPlay} />)

    await user.click(screen.getByRole('button', { name: '调和' }))

    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay).toHaveBeenCalledWith(card, CardUsageType.HARMONY)
  })

  it.each([
    ['质疑', CardUsageType.DOUBT],
    ['特技', CardUsageType.SKILL],
  ] as const)('sends %s exactly once', async (label, usageType) => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    render(<Card card={card} showActions onPlay={onPlay} />)

    await user.click(screen.getByRole('button', { name: label }))

    expect(onPlay).toHaveBeenCalledTimes(1)
    expect(onPlay).toHaveBeenCalledWith(card, usageType)
  })

  it('does not submit a disabled Skill action', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    render(<Card card={card} showActions onPlay={onPlay} disabledSkill />)

    const skill = screen.getByRole('button', { name: '特技（不可用）' })
    expect(skill).toBeDisabled()
    await user.click(skill)

    expect(onPlay).not.toHaveBeenCalled()
  })

  it('opens details on a long press without also selecting the card', () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    render(<Card card={card} onClick={onClick} />)

    const cardButton = screen.getByLabelText(`卡牌：${card.name}`)
    fireEvent.touchStart(cardButton)
    act(() => vi.advanceTimersByTime(500))
    fireEvent.touchEnd(cardButton)
    fireEvent.click(cardButton)

    expect(screen.getByText(card.description)).toBeInTheDocument()
    expect(onClick).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
