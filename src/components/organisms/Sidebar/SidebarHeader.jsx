import React from 'react';
import { LogOut, Settings, PenSquare } from 'lucide-react';
import Avatar from '../../atoms/Avatar';
import IconButton from '../../atoms/IconButton';
import { useAuthStore } from '../../../store/authStore';

export const SidebarHeader = () => {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.clearAuth);

  return (
    <header className="flex items-center justify-between px-4 py-3 h-16 border-b border-border bg-surface-primary">
      <div className="flex items-center gap-3">
        <Avatar name={user?.name || 'User'} src={user?.avatar} size="md" online />
        <h2 className="font-headline-md text-[20px] text-primary">Echo</h2>
      </div>
      <div className="flex items-center gap-1">
        <IconButton icon={PenSquare} />
        <IconButton icon={Settings} />
        <IconButton icon={LogOut} onClick={logout} />
      </div>
    </header>
  );
};

export default SidebarHeader;
