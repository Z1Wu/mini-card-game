import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ActionHistory } from './ActionHistory'
import { CardType, CardUsageType, PublicAction } from '../../types/game'

const actions: PublicAction[] = [
  { sequence: 1, actor_id: 'p1', actor_name: '小王', usage_type: CardUsageType.HARMONY, target_player_id: null, target_player_name: null, card_name: null },
  { sequence: 2, actor_id: 'p2', actor_name: '小李', usage_type: CardUsageType.DOUBT, target_player_id: 'p1', target_player_name: '小王', card_name: null },
  { sequence: 3, actor_id: 'p1', actor_name: '小王', usage_type: CardUsageType.SKILL, target_player_id: null, target_player_name: null, card_name: CardType.LIBRARY_COMMITTEE },
]

describe('ActionHistory', () => {
  it('stays compact until opened and renders only public action facts', async () => {
    const user = userEvent.setup()
    render(<ActionHistory actions={actions} />)

    expect(screen.queryByText('向调和区秘密投入一张牌')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /行动记录/ }))
    expect(screen.getByText('向调和区秘密投入一张牌')).toBeInTheDocument()
    expect(screen.getByText('向 小王 放置一张质疑牌')).toBeInTheDocument()
    expect(screen.getByText('发动 图书委员')).toBeInTheDocument()
    expect(screen.queryByText('外星人')).not.toBeInTheDocument()
  })
})
