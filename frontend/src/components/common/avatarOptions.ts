import cat from '../../assets/art/avatars/cat.svg';
import bunny from '../../assets/art/avatars/bunny.svg';
import ghost from '../../assets/art/avatars/ghost.svg';
import bear from '../../assets/art/avatars/bear.svg';
import chick from '../../assets/art/avatars/chick.svg';
import panda from '../../assets/art/avatars/panda.svg';
import fox from '../../assets/art/avatars/fox.svg';
import mushroom from '../../assets/art/avatars/mushroom.svg';

/** Stable IDs preserve existing account selections when artwork changes. */
export const avatarOptions = [
  { id: 'class-rep', label: '小猫', art: cat },
  { id: 'library', label: '小兔子', art: bunny },
  { id: 'alien', label: '小幽灵', art: ghost },
  { id: 'rich-girl', label: '小熊', art: bear },
  { id: 'news', label: '小鸡', art: chick },
  { id: 'honor', label: '小熊猫', art: panda },
  { id: 'discipline', label: '小狐狸', art: fox },
  { id: 'infected', label: '小蘑菇', art: mushroom },
];
