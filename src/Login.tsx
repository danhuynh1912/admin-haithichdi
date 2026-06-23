import { useState } from 'react';
import { useLogin } from '@refinedev/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate: login, isPending } = useLogin<{ email: string; password: string }>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111]">
      <Card className="w-[380px] bg-[#1a1a1a] border-[#222]">
        <CardHeader className="pb-2">
          <div className="text-[#d00600] font-extrabold text-2xl mb-1">Hải Thích Đi</div>
          <CardTitle className="text-base text-[#888] font-normal">Admin Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={e => { e.preventDefault(); login({ email, password }); }} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-[#aaa]">Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-[#222] border-[#333] text-white placeholder:text-[#555] focus-visible:ring-[#d00600]" />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-[#aaa]">Mật khẩu</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-[#222] border-[#333] text-white placeholder:text-[#555] focus-visible:ring-[#d00600]" />
            </div>
            <Button type="submit" disabled={isPending} className="mt-2 bg-[#d00600] hover:bg-[#b00500]">
              {isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
