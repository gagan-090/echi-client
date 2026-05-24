import React from 'react';
import { Menu, Phone, Video, MoreVertical, Search } from 'lucide-react';
import Avatar from '../../atoms/Avatar';
import IconButton from '../../atoms/IconButton';
import { useUiStore } from '../../../store/uiStore';

export const ChatHeader = ({ contact, isTyping }) => {
  const setSidebarOpen = useUiStore(state => state.setSidebarOpen);

  if (!contact) return <div className="h-16 border-b border-border bg-surface-primary" />;

  return (
    <header className="flex items-center justify-between px-4 py-3 h-16 border-b border-border bg-surface-primary flex-shrink-0 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <IconButton 
          icon={Menu} 
          className="md:hidden mr-1" 
          onClick={() => setSidebarOpen(true)} 
        />
        <Avatar 
          name={contact.name} 
          src={contact.avatar} 
          userId={contact.id} 
          online={contact.isOnline} 
        />
        <div className="flex flex-col">
          <h2 className="font-headline-md text-[16px] leading-tight">{contact.name}</h2>
          <span className="text-label-sm text-text-secondary">
            {isTyping ? (
              <span className="text-accent animate-pulse">Typing...</span>
            ) : contact.isOnline ? (
              <span className="text-online">Online</span>
            ) : (
              'Offline'
            )}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-primary">
        <IconButton icon={Video} className="hidden sm:flex" />
        <IconButton icon={Phone} className="hidden sm:flex" />
        <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
        <IconButton icon={Search} />
        <IconButton icon={MoreVertical} />
      </div>
    </header>
  );
};

export default ChatHeader;
