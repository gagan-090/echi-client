import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SidebarHeader from './SidebarHeader';
import SearchBar from './SearchBar';
import ConversationList from './ConversationList';
import { useUiStore } from '../../../store/uiStore';
import { useConversationStore } from '../../../store/conversationStore';
import { cn } from '../../../lib/utils';

export const Sidebar = ({ className }) => {
  const sidebarOpen = useUiStore(state => state.sidebarOpen);
  const conversations = useConversationStore(state => state.conversations);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn("hidden md:flex flex-col w-[320px] h-full border-r border-border bg-surface-primary flex-shrink-0", className)}>
        <SidebarHeader />
        <SearchBar />
        <ConversationList conversations={conversations} loadMore={() => {}} hasNextPage={false} />
      </div>

      {/* Mobile Sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="md:hidden fixed inset-0 z-40 w-[320px] bg-surface-primary border-r border-border h-full shadow-modal flex flex-col"
          >
            <SidebarHeader />
            <SearchBar />
            <ConversationList conversations={conversations} loadMore={() => {}} hasNextPage={false} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
