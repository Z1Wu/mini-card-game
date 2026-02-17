from typing import List
from .models import Card, CardType

CARD_DATABASE = {
    CardType.CLASS_REP: {
        "cost": 2,
        "description": "选定一个玩家，两个人各自选定一张手牌进行交换。",
        "harmony_value": 2,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 2
    },
    CardType.LIBRARY_COMMITTEE: {
        "cost": 1,
        "description": "你可以查看放在调和区的所有卡牌。",
        "harmony_value": 1,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 2
    },
    CardType.ALIEN: {
        "cost": -1,
        "description": "当你持有这张牌时，若有人使用了优等生的特技，你可以假装是犯人来回应他。该牌正面打出的时候没有任何特殊效果。",
        "harmony_value": 1,
        "victory_priority": 1,
        "victory_condition": "1 被监禁即可获胜",
        "count": 1
    },
    CardType.HOME_CLUB: {
        "cost": 0,
        "description": "选择一张自己的手牌，和调和区的一个卡牌进行替换。",
        "harmony_value": 0,
        "victory_priority": 5,
        "victory_condition": "5 没有任何人获胜即可获胜",
        "count": 3
    },
    CardType.HEALTH_COMMITTEE: {
        "cost": 1,
        "description": "选择一张已经被正面打出的卡牌，将它归入自己的手牌。",
        "harmony_value": 2,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 2
    },
    CardType.DISCIPLINE_COMMITTEE: {
        "cost": 1,
        "description": "你可以查看一名玩家的所有手牌。",
        "harmony_value": 2,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 2
    },
    CardType.NEWS_CLUB: {
        "cost": 1,
        "description": "每个玩家选择自己的一张手牌，递给下一个玩家。",
        "harmony_value": 1,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 3
    },
    CardType.RICH_GIRL: {
        "cost": 1,
        "description": "选择一个玩家，将他的手牌中的 1 张卡牌，放到自己的手牌中，然后选择一张自己的手牌给该玩家（可以是刚从该玩家收到的牌）。",
        "harmony_value": 1,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 3
    },
    CardType.ACCOMPLICE: {
        "cost": 0,
        "description": "将一张放置再玩家面前的质疑位置的牌转移到任意一个其他玩家的质疑位置。（不可以是自己）",
        "harmony_value": 0,
        "victory_priority": 3,
        "victory_condition": "3 犯人获胜即可获胜",
        "count": 1
    },
    CardType.INFECTED: {
        "cost": 0,
        "description": "在下一个回合开始时，若这张牌仍然正面朝上摆在你面前，则可以将调和区的一张牌加到自己手牌中。",
        "harmony_value": 0,
        "victory_priority": 2,
        "victory_condition": "2 调和失败即可获胜",
        "count": 1
    },
    CardType.CRIMINAL: {
        "cost": 0,
        "description": "此卡片无法被正面朝上或者反面朝下打出，当时可以被其他卡片的效果移动。",
        "harmony_value": 0,
        "victory_priority": 3,
        "victory_condition": "3 不被监禁即可获胜",
        "count": 1
    },
    CardType.STUDENT_COUNCIL_PRESIDENT: {
        "cost": 3,
        "description": "正面打出无效果。",
        "harmony_value": 3,
        "victory_priority": 4,
        "victory_condition": "4 调和成功即可获胜",
        "count": 1
    },
    CardType.HONOR_STUDENT: {
        "cost": 2,
        "description": "正面打出该卡时，其他玩家闭上眼睛，同时持有犯人卡的玩家需要举手示意。",
        "harmony_value": 2,
        "victory_priority": 4,
        "victory_condition": "3 不被监禁即可获胜",
        "count": 2
    }
}

def create_card_deck() -> List[Card]:
    deck = []
    for i, (card_type, card_data) in enumerate(CARD_DATABASE.items()):
        for j in range(card_data["count"]):
            card = Card(
                id=f"{card_type.value}_{j}",
                name=card_type,
                cost=card_data["cost"],
                description=card_data["description"],
                harmony_value=card_data["harmony_value"],
                victory_priority=card_data["victory_priority"],
                victory_condition=card_data["victory_condition"]
            )
            deck.append(card)
    return deck
