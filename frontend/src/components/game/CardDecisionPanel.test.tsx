import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card, CardType } from '../../types/game'
import { CardDecisionPanel } from './CardDecisionPanel'

const card = (name: CardType): Card => ({
  id: 'card-1', name, description: '测试特技', harmony_value: -1, victory_priority: 1,
  victory_condition: '1 被监禁即可获胜', owner_id: 'p1', is_face_up: false,
  location: 'hand', target_player_id: null,
})

describe('CardDecisionPanel', () => {
  it('shows the selected card strategy and all three outcomes without a long press', () => {
    render(<CardDecisionPanel card={card(CardType.ALIEN)} harmonyIsEmpty={false} isCurrentTurn isSettlement={false} />)

    expect(screen.getByLabelText('外星人 决策说明')).toHaveTextContent('被监禁即可获胜')
    expect(screen.getByLabelText('出牌结果预览')).toHaveTextContent('秘密投入调和区，结算贡献 -1')
    expect(screen.getByLabelText('出牌结果预览')).toHaveTextContent('秘密压向一名玩家')
    expect(screen.getByLabelText('出牌结果预览')).toHaveTextContent('正面打出；不触发额外效果')
  })

  it('explains that Criminal cannot be actively played', () => {
    render(<CardDecisionPanel card={card(CardType.CRIMINAL)} harmonyIsEmpty={false} isCurrentTurn isSettlement={false} />)
    expect(screen.getByLabelText('犯人 决策说明')).toHaveTextContent('不能主动打出')
    expect(screen.queryByLabelText('出牌结果预览')).not.toBeInTheDocument()
  })

  it('explains why Home Club skill is unavailable when harmony is empty', () => {
    render(<CardDecisionPanel card={card(CardType.HOME_CLUB)} harmonyIsEmpty isCurrentTurn isSettlement={false} />)
    expect(screen.getByLabelText('归宅部 决策说明')).toHaveTextContent('调和区为空，当前不能发动替换')
  })
})
