import { useState } from 'react';
import { useLogin } from '@refinedev/core';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { mutate: login, isPending: isLoading } = useLogin<{ username: string; password: string }>();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login({ username, password });
  }

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
      <form
        onSubmit={handleSubmit}
        style={{ background: '#1a1a1a', padding: 40, borderRadius: 16, width: 360, display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid #222' }}
      >
        <h1 style={{ color: '#d00600', margin: 0, fontSize: 24, fontWeight: 800 }}>Hải Thích Đi</h1>
        <p style={{ color: '#666', margin: 0, fontSize: 14 }}>Admin Panel</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#aaa', fontSize: 13 }}>Tên đăng nhập</label>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff', fontSize: 14 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: '#aaa', fontSize: 13 }}>Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff', fontSize: 14 }}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          style={{ padding: '12px', background: '#d00600', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
