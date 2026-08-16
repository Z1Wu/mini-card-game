import React, { useState, useEffect, useCallback } from 'react';
import { adminApi, AdminUser } from '../../services/adminApi';
import { useAdminStore } from '../../stores/adminStore';

interface EditForm {
  username: string;
  name: string;
  role: string;
  password: string;
}

const emptyForm: EditForm = { username: '', name: '', role: 'player', password: '' };

export const UserManagement: React.FC = () => {
  const { username: currentUser } = useAdminStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<EditForm>(emptyForm);
  const [busy, setBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await adminApi.listUsers();
      setUsers(data.users);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async () => {
    if (!form.username || !form.password) {
      setError('用户名和密码不能为空');
      return;
    }
    setBusy(true);
    try {
      await adminApi.createUser(form.username, form.name, form.password, form.role);
      setShowCreate(false);
      setForm(emptyForm);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    setBusy(true);
    try {
      await adminApi.updateUser(editTarget.username, {
        name: form.name,
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      });
      setEditTarget(null);
      setForm(emptyForm);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteUser(deleteTarget.username);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (user: AdminUser) => {
    setEditTarget(user);
    setForm({ username: user.username, name: user.name, role: user.role, password: '' });
  };

  const roleBadge = (role: string) => (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        role === 'admin'
          ? 'bg-[#c66b5d]/20 text-[#c66b5d] border border-[#c66b5d]/30'
          : 'bg-slate-700 text-slate-300'
      }`}
    >
      {role === 'admin' ? '管理员' : '玩家'}
    </span>
  );

  const inputClass =
    'w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#c66b5d]';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">用户管理</h1>
        <button
          onClick={() => {
            setForm(emptyForm);
            setShowCreate(true);
          }}
          className="px-4 py-2 bg-[#c66b5d] text-white rounded-lg text-sm font-medium hover:bg-[#b85a4d] transition-colors"
        >
          + 新建用户
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400">加载中...</p>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400">
                <th className="text-left px-4 py-3 font-medium">用户名</th>
                <th className="text-left px-4 py-3 font-medium">显示名</th>
                <th className="text-left px-4 py-3 font-medium">角色</th>
                <th className="text-right px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.username} className="border-t border-slate-700/50">
                  <td className="px-4 py-3 text-slate-200 font-mono">{user.username}</td>
                  <td className="px-4 py-3 text-slate-300">{user.name}</td>
                  <td className="px-4 py-3">{roleBadge(user.role)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => openEdit(user)}
                      className="px-3 py-1 text-xs bg-slate-700 text-slate-200 rounded hover:bg-slate-600"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => setDeleteTarget(user)}
                      disabled={user.username === currentUser}
                      className="px-3 py-1 text-xs bg-red-900/50 text-red-300 rounded hover:bg-red-800/50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">新建用户</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">用户名</label>
                <input className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">显示名</label>
                <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">密码</label>
                <input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">角色</label>
                <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="player">玩家</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleCreate} disabled={busy} className="flex-1 px-4 py-2 bg-[#c66b5d] text-white rounded-lg text-sm font-medium hover:bg-[#b85a4d] disabled:opacity-50">
                {busy ? '创建中...' : '创建'}
              </button>
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditTarget(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">编辑用户: {editTarget.username}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">显示名</label>
                <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">新密码（留空不修改）</label>
                <input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">角色</label>
                <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="player">玩家</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleUpdate} disabled={busy} className="flex-1 px-4 py-2 bg-[#c66b5d] text-white rounded-lg text-sm font-medium hover:bg-[#b85a4d] disabled:opacity-50">
                {busy ? '保存中...' : '保存'}
              </button>
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteTarget(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">确认删除</h2>
            <p className="text-sm text-slate-400 mb-5">确定要删除用户「{deleteTarget.name}（{deleteTarget.username}）」吗？此操作不可撤销。</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={busy} className="flex-1 px-4 py-2 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                {busy ? '删除中...' : '删除'}
              </button>
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
