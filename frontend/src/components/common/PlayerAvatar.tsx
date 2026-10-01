import { avatarOptions } from './avatarOptions';

export function PlayerAvatar({ avatarId, name }: { avatarId?: string | null; name: string }) {
  const option = avatarOptions.find(item => item.id === avatarId);
  return option ? <img className="player-character-avatar" src={option.art} alt={`${name}的头像`} /> : <span className="table-seat-icon" role="img" aria-label={`${name}的头像`}>{name.charAt(0)}</span>;
}
