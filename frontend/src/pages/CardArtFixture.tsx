import { Card as CardView } from '../components/game/Card';
import { Card, CardType } from '../types/game';

const stats: Record<CardType, [number, number]> = {
  班长: [2, 4], 图书委员: [1, 4], 外星人: [-1, 1], 归宅部: [0, 5],
  保健委员: [1, 4], 风纪委员: [2, 4], 新闻部: [1, 4], 大小姐: [1, 4],
  共犯: [0, 3], 感染者: [0, 2], 犯人: [0, 3], 学生会长: [3, 4], 优等生: [2, 3],
};

/** Transport-free art review; never uses player or room state. */
export function CardArtFixture() {
  return (
    <main className="horror-art-review">
      <header>
        <h1>旧校舍 · 角色档案</h1>
        <p>一年级：深蓝领巾 · 二年级：墨绿领巾 · 三年级：酒红领巾</p>
      <p>学生：灰绿 · 犯人/共犯：暗红 · 感染者：灰紫 · 外星人：灰蓝 · 归宅部：赭黄</p>
      </header>
      <div className="horror-art-grid">
        {Object.values(CardType).map((name, index) => {
          const card: Card = {
            id: `art-${index}`, name, description: '', harmony_value: stats[name][0],
            victory_priority: stats[name][1], victory_condition: '', owner_id: null,
            is_face_up: true, location: 'hand', target_player_id: null,
          };
          return <figure key={name}><CardView card={card} /><figcaption>{name}</figcaption></figure>;
        })}
      </div>
    </main>
  );
}
