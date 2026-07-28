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
      <aside className="w-56 shrink-0 flex flex-col gap-1 p-4 bg-sidebar border-r border-sidebar-border">
        <div className="px-2 py-3 mb-2 text-lg font-extrabold tracking-tight text-sidebar-primary">
          Hải Thích Đi
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm no-underline transition-colors ${
              isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold'
                : 'text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
            }`
          }>
            <Icon size={15} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => logout()}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/50 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors bg-transparent cursor-pointer border-none"
        >
          <LogOut size={15} strokeWidth={1.75} />
          Đăng xuất
        </button>
      </aside>
      <main className="flex-1 overflow-auto bg-background">
        <Outlet />
      </main>
    </div>
  );
}
