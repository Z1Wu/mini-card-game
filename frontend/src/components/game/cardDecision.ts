import { Card, CardType } from '../../types/game';

const skillPreview: Record<CardType, string> = {
  [CardType.CLASS_REP]: '正面发动；选择一名玩家，双方各交换一张手牌',
  [CardType.LIBRARY_COMMITTEE]: '正面发动；仅你查看调和区全部牌面',
  [CardType.ALIEN]: '正面打出；不触发额外效果',
  [CardType.HOME_CLUB]: '正面发动；用一张手牌替换一张调和牌',
  [CardType.HEALTH_COMMITTEE]: '正面发动；选择一张场上牌收回手中',
  [CardType.DISCIPLINE_COMMITTEE]: '正面发动；仅你查看一名玩家的手牌',
  [CardType.NEWS_CLUB]: '正面发动；所有玩家依次传一张牌给下家',
  [CardType.RICH_GIRL]: '正面发动；与一名玩家秘密交换一张手牌',
  [CardType.ACCOMPLICE]: '正面发动；把一张质疑牌移动到新的目标',
  [CardType.INFECTED]: '正面发动；下个自己的回合可拿取一张调和牌',
  [CardType.CRIMINAL]: '不能主动打出，只能保留或被其他特技移动',
  [CardType.STUDENT_COUNCIL_PRESIDENT]: '正面打出；不触发额外效果',
  [CardType.HONOR_STUDENT]: '正面发动；触发其他玩家的秘密举手阶段',
};

const signed = (value: number) => value > 0 ? `+${value}` : `${value}`;
export const cleanVictoryCondition = (condition: string) => condition.replace(/^\d+\s*/, '');

export function getCardDecision(card: Card, harmonyIsEmpty: boolean) {
  const skillUnavailable = card.name === CardType.HOME_CLUB && harmonyIsEmpty;
  return {
    harmony: `秘密投入调和区，结算贡献 ${signed(card.harmony_value)}`,
    doubt: `秘密压向一名玩家，结算计入其质疑值 ${signed(card.harmony_value)}`,
    skill: skillUnavailable ? '调和区为空，当前不能发动替换' : skillPreview[card.name],
    skillUnavailable,
    victory: cleanVictoryCondition(card.victory_condition),
  };
}
