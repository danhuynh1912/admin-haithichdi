import { useLogout } from '@refinedev/core';
import { NavLink, Outlet } from 'react-router-dom';
import { MapPin, Mountain, ClipboardList, Users, LogOut } from 'lucide-react';

const NAV = [
  { to: '/locations', label: 'Locations', icon: MapPin },
  { to: '/tours', label: 'Tours', icon: Mountain },
  { to: '/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/leaders', label: 'Leaders', icon: Users },
];

export function Layout() {
  const { mutate: logout } = useLogout();
  return (
    <div className="flex h-screen font-sans">
      <aside className="w-56 bg-[#111] flex flex-col p-4 gap-1 shrink-0">
        <div className="text-[#d00600] font-extrabold text-lg px-2 py-3 mb-2 tracking-tight">
          Hải Thích Đi
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm no-underline transition-colors ${isActive ? 'bg-[#d00600] text-white font-semibold' : 'text-[#888] hover:text-white hover:bg-white/10'}`
          }>
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => logout()}
          className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[#555] rounded-lg hover:text-[#aaa] transition-colors bg-transparent cursor-pointer border-none"
        >
          <LogOut size={15} strokeWidth={1.75} />
          Đăng xuất
        </button>
      </aside>
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
