import { SettlementView } from '../components/game/SettlementView';
import { Card, CardType, Game, GameState } from '../types/game';

const card = (id: string, name: CardType, priority = 4): Card => ({ id, name, harmony_value: 2, victory_priority: priority, victory_condition: name === CardType.ALIEN ? '被监禁即可获胜' : '调和成功即可获胜', description: '', owner_id: null, is_face_up: true, location: 'hand', target_player_id: null });
const game: Game = { id: 'settlement-preview', state: GameState.GAME_OVER, winner: 'p1', player_count: 3, current_player_index: 0, turn_count: 15, required_harmony_value: 6,
 harmony_area: [card('h1',CardType.NEWS_CLUB),card('h2',CardType.RICH_GIRL),card('h3',CardType.HEALTH_COMMITTEE)],
 players: [CardType.ALIEN,CardType.CLASS_REP,CardType.LIBRARY_COMMITTEE].map((role,index)=>({ id:`p${index+1}`,name:`玩家${index+1}`,avatar_id:['rich-girl','library','news'][index],hand:[card(`c${index+1}`,role,index===0?1:4)],field_cards:[],doubt_cards:[],is_connected:true,current_hand_count:1 })) };
export function SettlementFixture() {
 return <SettlementView gameState={game} winnerId="p1" isHost settlementSummary={{ harmony_total:6,required_harmony_value:6,harmony_reached:true,player_doubt_totals:{p1:4,p2:2,p3:0},imprisoned_player_ids:['p1'],role_condition_results:{c1:true,c2:true,c3:true},winner_reason:{player_id:'p1',player_name:'玩家1',card_id:'c1',card_name:CardType.ALIEN,victory_priority:1,victory_condition:'被监禁即可获胜'} }} onRematch={()=>{}} onReturnToLogin={()=>{}} />;
}
