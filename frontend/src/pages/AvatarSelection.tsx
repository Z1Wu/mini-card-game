import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { PlayerAvatar } from '../components/common/PlayerAvatar';
import { avatarOptions } from '../components/common/avatarOptions';
import { usePlayerStore } from '../stores/playerStore';
import { wsService } from '../services/websocket';
import { AvatarMessage } from '../types/message';
import loginPoster from '../assets/art/login-ensemble-red-v1.webp';

export function AvatarSelection() {
  const navigate = useNavigate();
  const { playerId, playerName, avatarId, setAvatarId } = usePlayerStore();
  const [selected, setSelected] = useState(avatarId ?? avatarOptions[0].id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!playerId) navigate('/', { replace: true });
    const saved = (message: AvatarMessage) => {
      setAvatarId(message.avatar_id);
      navigate('/rooms', { replace: true });
    };
    const failed = (message: { message?: string }) => {
      setSaving(false);
      setError(message.message ?? '头像保存失败，请重试');
    };
    wsService.on('avatar_saved', saved);
    wsService.on('error', failed);
    return () => { wsService.off('avatar_saved', saved); wsService.off('error', failed); };
  }, [playerId, setAvatarId, navigate]);
  return <main className="campus-shell login-poster flex items-center justify-center" style={{ backgroundImage: `linear-gradient(rgba(15,5,9,.3),rgba(15,5,9,.5)),url(${loginPoster})` }}>
    <section className="campus-panel avatar-selection" aria-labelledby="avatar-heading">
      <h1 id="avatar-heading" className="campus-title">选择你的头像</h1>
      <p className="avatar-intro">{playerName}，选择一个小伙伴作为你的头像</p>
      <div className="avatar-options" role="group" aria-label="简笔画头像">
        {avatarOptions.map(option => <button key={option.id} type="button" className="avatar-option" aria-pressed={selected === option.id} aria-label={`${option.label}头像`} onClick={() => setSelected(option.id)} disabled={saving}>
          <PlayerAvatar avatarId={option.id} name={option.label} /><span>{option.label}</span>
        </button>)}
      </div>
      {error && <p role="alert">{error}</p>}
      <Button disabled={saving} onClick={() => {
        if (!wsService.isConnected()) { setError('连接已断开，请重新登录后设置头像'); return; }
        try { wsService.send({ type: 'set_avatar', avatar_id: selected }); setSaving(true); setError(''); }
        catch { setError('连接已断开，请重新登录后设置头像'); }
      }}>{saving ? '保存中…' : '确认头像'}</Button>
    </section>
  </main>;
}
