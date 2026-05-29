import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useConversationStore } from '../../store/conversationStore';
import { useMessageStore } from '../../store/messageStore';
import { useUiStore } from '../../store/uiStore';
import { useCallStore } from '../../store/callStore';
import { useRealtime, getSocket } from '../../hooks/useRealtime';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import CallOverlay from '../../components/CallOverlay';
import api from '../../services/api';
import imageCompression from 'browser-image-compression';
import { motion, useAnimation } from 'framer-motion';

/* ── Helper: initials from name ── */
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

const initialColors = [
  'from-blue-600 to-indigo-600',
  'from-cyan-600 to-blue-600',
  'from-indigo-600 to-violet-600',
  'from-sky-600 to-indigo-600'
];
const getInitialBg = (id) => {
  if (!id) return 'bg-gradient-to-tr ' + initialColors[0];
  return 'bg-gradient-to-tr ' + initialColors[id.charCodeAt(id.length - 1) % initialColors.length];
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const groupMessagesByDate = (messages) => {
  const groups = [];
  let lastDate = null;
  
  messages.slice().forEach(msg => {
    const date = new Date(msg.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    if (date !== lastDate) {
      groups.push({ type: 'date', id: `date-${date}`, date });
      lastDate = date;
    }
    groups.push({ type: 'msg', ...msg });
  });
  return groups;
};

const AppShell = () => {
  // Global Stores
  const user = useAuthStore(state => state.user);
  const clearAuth = useAuthStore(state => state.clearAuth);
  
  const { conversations, activeConversationId, fetchConversations, setActive, addConversation } = useConversationStore();
  const { messages, fetchMessages, sendMessage } = useMessageStore();
  const { typingStatus, broadcastTyping } = useUiStore();
  const { calls, fetchCalls } = useCallStore();

  // Initialize Realtime
  useRealtime();

  // Local State
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [activeNav, setActiveNav] = useState('messages');
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  
  // WebRTC
  const webrtc = useWebRTC(getSocket());
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const fileInputRef = useRef(null);
  const { isRecording, recordingTime, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const [uploadingFile, setUploadingFile] = useState(false);
  const [replyToId, setReplyToId] = useState(null);
  
  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(null);
  
  const messagesEndRef = useRef(null);

  // Theme State (Dark by default, as per branding mockup, but users can toggle to Light)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved || 'dark';
    }
    return 'dark';
  });

  // Apply theme to document element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    fetchConversations();
    fetchCalls();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [fetchConversations, fetchCalls]);

  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
      api.patch(`/conversations/${activeConversationId}/messages/read`).catch(console.error);
    }
  }, [activeConversationId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConversationId, typingStatus]);

  // Resizer Logic
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      let newWidth = e.clientX - 320;
      if (newWidth < 250) newWidth = 250;
      if (newWidth > 600) newWidth = 600;
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const activeContact = conversations.find(c => c.id === activeConversationId);
  const activeMessages = messages[activeConversationId] || [];
  const isTyping = typingStatus[activeConversationId];
  
  const groupedMessages = groupMessagesByDate(activeMessages);

  // Handle Send Message
  
  const handleFileUpload = async (e, forcedType = null) => {
    let file = e.target.files?.[0];
    if (!file || !activeConversationId) return;
    setShowAttachMenu(false);
    
    // Image Compression
    if (file.type.startsWith('image/') && !file.type.includes('gif')) {
      try {
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: false };
        file = await imageCompression(file, options);
      } catch (err) {
        console.error('Compression error', err);
      }
    }
    
    let msgType = forcedType;
    if (!msgType) {
      if (file.type.startsWith('image/')) msgType = 'image';
      else if (file.type.startsWith('video/')) msgType = 'video';
      else if (file.type.startsWith('audio/')) msgType = 'audio';
      else msgType = 'document';
    }

    const localUrl = URL.createObjectURL(file);
    const tempId = `temp-upload-${Date.now()}`;
    const tempMsg = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: user.id,
      content: '',
      message_type: msgType,
      file_url: localUrl,
      file_name: file.name,
      file_size_bytes: file.size,
      is_deleted: false,
      sent_at: new Date().toISOString(),
      status: 'sending'
    };

    useMessageStore.getState().appendMessage(activeConversationId, tempMsg);
    // Auto scroll down immediately when temp message is appended
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const fileData = {
        url: data.data.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      };
      
      useMessageStore.setState(state => ({
        messages: {
          ...state.messages,
          [activeConversationId]: state.messages[activeConversationId].filter(m => m.id !== tempId)
        }
      }));

      await sendMessage(activeConversationId, '', user.id, msgType, fileData, replyToId);
      setReplyToId(null);
    } catch (err) {
      console.error('File upload failed', err);
      useMessageStore.getState().updateMsg(activeConversationId, tempId, { status: 'failed' });
    } finally {
      e.target.value = '';
    }
  };

  const handleVoiceNote = async () => {
    if (isRecording) {
      const audioBlob = await stopRecording();
      if (!audioBlob || !activeConversationId) return;
      
      setUploadingFile(true);
      const formData = new FormData();
      formData.append('file', audioBlob, 'voicenote.webm');
      
      try {
        const { data } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        const fileData = {
          url: data.data.url,
          fileName: 'Voice Note',
          fileSize: audioBlob.size,
          mimeType: 'audio/webm'
        };
        await sendMessage(activeConversationId, '', user.id, 'audio', fileData, replyToId);
        setReplyToId(null);
      } catch (err) {
        console.error('Voice note upload failed', err);
      } finally {
        setUploadingFile(false);
      }
    } else {
      startRecording();
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversationId) return;
    
    const content = messageInput.trim();
    setMessageInput('');
    const currentReply = replyToId;
    setReplyToId(null);
    await sendMessage(activeConversationId, content, user.id, 'text', null, currentReply);
    broadcastTyping(activeConversationId, false);
  };

  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    broadcastTyping(activeConversationId, e.target.value.length > 0, activeContact?.other_user?.id);
  };

  // Search Users API
  const handleSearchUsers = async (e) => {
    e.preventDefault();
    if (!newChatQuery.trim()) return;
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(newChatQuery)}`);
      setSearchResults(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const [isCreating, setIsCreating] = useState(false);
  const handleCreateConversation = async (participantId) => {
    setIsCreating(true);
    try {
      const { data } = await api.post('/conversations', { userId: participantId });
      await fetchConversations();
      setActive(data.data.id);
      setShowNewChat(false);
      setActiveNav('messages');
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMessage(null);
    try {
      const { data } = await api.post('/auth/email/invite', { email: inviteEmail });
      setInviteMessage({ type: 'success', text: data.data.message || 'Invitation sent successfully!' });
      setInviteEmail('');
    } catch (err) {
      console.error('Failed to send invite:', err);
      const errMsg = err.response?.data?.message || 'Failed to send invitation. Please try again.';
      setInviteMessage({ type: 'error', text: errMsg });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!activeConversationId) return;
    try {
      useMessageStore.getState().updateMsg(activeConversationId, msgId, { is_deleted: true, content: null, file_url: null, file_name: null, message_type: 'text' });
      await api.delete(`/conversations/${activeConversationId}/messages/${msgId}`);
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  };

  return (
    <div className="dark:bg-brand-bg-dark bg-brand-bg-light dark:text-slate-100 text-slate-800 overflow-hidden h-[100dvh] font-body-md text-body-md flex relative selection:bg-brand-accent/20 theme-transition duration-300">
      <div className="fixed inset-0 dot-grid z-0 pointer-events-none opacity-20 dark:opacity-40" />
      <div className="fixed inset-0 grain-overlay z-10 pointer-events-none opacity-10 dark:opacity-20" />

      {/* ── SIDE NAV BAR (Desktop) ── */}
      <aside className="hidden md:flex flex-col h-screen w-80 fixed left-0 top-0 dark:bg-brand-bg-dark bg-white border-r dark:border-brand-border border-brand-border-light py-6 z-30 transition-colors duration-300">
        <div className="px-6 mb-6">
          <div className="flex flex-col mb-6">
            <div className="flex items-center justify-between w-full">
              <span className="text-3xl font-extrabold text-brand-accent tracking-tight">Echo</span>
              <div className="flex items-center gap-2">
                {/* Theme Toggle Button */}
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
                  title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                  </span>
                </button>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Online</span>
                </div>
              </div>
            </div>
            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 tracking-[0.25em] uppercase mt-1">
              Conversations, Amplified
            </span>
          </div>
          
          <div 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-brand-active-bg transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-brand-accent/15 dark:bg-brand-accent/10 border border-brand-accent/30 flex items-center justify-center text-brand-accent font-bold shadow-sm overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="DP" className="w-full h-full object-cover" />
                ) : (
                  getInitials(user?.display_name)
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 dark:border-brand-bg-dark border-brand-bg-light rounded-full" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm truncate dark:text-slate-200 text-slate-700">{user?.display_name || 'User'}</span>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">#{user?.echo_id || '----'}</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1.5 flex-1 px-2 overflow-y-auto">
          {[
            { key: 'messages', icon: 'chat_bubble', label: 'Messages', badge: conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0) || 3 },
            { key: 'calls', icon: 'call', label: 'Calls' },
            { key: 'contacts', icon: 'group', label: 'Contacts' },
            { key: 'invite', icon: 'person_add', label: 'Invite Friend', action: () => setShowInviteModal(true) },
            { key: 'settings', icon: 'settings', label: 'Settings', action: () => setShowSettings(true) },
          ].map(item => {
            const isActive = item.key === activeNav;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveNav(item.key);
                  if(item.action) item.action();
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all border ${
                  isActive
                    ? 'dark:bg-brand-active-bg bg-brand-active-bg-light dark:text-brand-accent text-brand-accent dark:border-brand-accent/20 border-brand-accent/10 font-semibold'
                    : 'dark:text-slate-400 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/40 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-brand-accent' : 'opacity-80'}`} style={isActive ? {fontVariationSettings: "'FILL' 1"} : {}}>{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full dark:bg-brand-accent dark:text-brand-bg-dark bg-brand-accent text-white shadow-sm">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-4 mt-auto">
          <button 
            onClick={() => setShowNewChat(true)}
            className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-semibold shadow-md shadow-brand-accent/20 hover:shadow-lg hover:shadow-brand-accent/30 active:scale-[0.98] transition-all duration-200"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            New Chat
          </button>
        </div>
      </aside>

      {/* ── MAIN APP WRAPPER ── */}
      <CallOverlay {...webrtc} />
      <main className="flex flex-1 ml-0 md:ml-80 h-full relative z-20 overflow-hidden">
        {/* Navigation Content (List) */}
        <section 
          style={{ width: window.innerWidth < 768 ? '100%' : sidebarWidth }}
          className={`dark:bg-brand-bg-card bg-brand-bg-card-light border-r dark:border-brand-border border-brand-border-light flex-col h-full flex-shrink-0 transition-colors duration-300 theme-transition ${activeConversationId ? 'hidden md:flex' : 'flex w-full'}`}
        >
          {activeNav === 'messages' && (
            <>
              <div className="p-4 flex flex-col gap-3">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Inbox</h3>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-[18px]">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 dark:bg-brand-bg-dark bg-white border dark:border-brand-border border-slate-200 rounded-xl text-sm dark:text-slate-200 text-slate-700 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent transition-all theme-transition"
                    placeholder="Search conversations..."
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {conversations
                  .filter(c => (c.other_user?.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(contact => {
                    const isActive = contact.id === activeConversationId;
                    return (
                      <div
                        key={contact.id}
                        onClick={() => setActive(contact.id)}
                        className={`h-[76px] px-4 flex items-center gap-3 cursor-pointer transition-all border-l-4 border-y border-y-transparent ${
                          isActive
                            ? 'dark:bg-brand-active-bg bg-brand-active-bg-light border-l-brand-accent dark:border-y-brand-border/20 border-y-brand-accent/5'
                            : 'border-l-transparent hover:bg-slate-100/60 dark:hover:bg-slate-800/20'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <div className={`w-11 h-11 rounded-full ${getInitialBg(contact.other_user?.id)} flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-sm overflow-hidden`}>
                            {contact.other_user?.avatar_url ? (
                              <img src={contact.other_user.avatar_url} alt="dp" className="w-full h-full object-cover" />
                            ) : (
                              getInitials(contact.other_user?.display_name)
                            )}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 dark:border-brand-bg-card border-brand-bg-card-light rounded-full" />
                        </div>

                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex justify-between items-baseline">
                            <h4 className={`text-sm font-semibold truncate ${isActive ? 'dark:text-slate-100 text-slate-900 font-bold' : 'dark:text-slate-200 text-slate-700'}`}>
                              {contact.other_user?.display_name || 'Unknown'}
                            </h4>
                            <span className={`text-[11px] flex-shrink-0 ml-2 ${isActive ? 'text-brand-accent' : 'text-slate-400 dark:text-slate-500'}`}>
                              {formatTime(contact.updated_at)}
                            </span>
                          </div>
                          <p className={`text-[12px] truncate flex items-center gap-1 mt-0.5 ${isActive ? 'dark:text-slate-300 text-slate-600 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                            {typingStatus[contact.id] ? (
                              <span className="text-brand-accent font-semibold tracking-wide animate-pulse">typing...</span>
                            ) : (
                              <>
                                {(contact.last_message_preview || '').includes('Call') && (
                                  <span className="material-symbols-outlined text-[13px] opacity-80">call</span>
                                )}
                                <span className="truncate">
                                  {(contact.last_message_preview || '').replace(/^\[REPLY:[a-zA-Z0-9-]+\]/, '') || 'No messages yet'}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {activeNav === 'calls' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-3">Recent Calls</h3>
              </div>
              {calls.map(call => (
                <div key={call.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-100/60 dark:hover:bg-slate-800/20 transition-colors cursor-pointer group">
                  <div className={`w-10 h-10 rounded-full ${getInitialBg(call.other_user?.id)} flex items-center justify-center overflow-hidden flex-shrink-0 text-white text-sm font-bold shadow-sm`}>
                    {call.other_user?.avatar_url ? (
                      <img src={call.other_user.avatar_url} alt="DP" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(call.other_user?.display_name)
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={`text-sm font-semibold truncate ${call.status !== 'completed' && !call.is_caller ? 'text-rose-500' : 'dark:text-slate-200 text-slate-700'}`}>
                      {call.other_user?.display_name || 'Unknown'}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      <span className={`material-symbols-outlined text-[13px] ${call.status === 'completed' ? 'text-brand-accent' : 'text-rose-500'}`}>
                        {call.is_caller ? 'call_made' : 'call_received'}
                      </span>
                      <span>{formatTime(call.created_at)}</span>
                    </div>
                  </div>
                  <button onClick={() => webrtc.initiateCall({ id: call.other_user.id, convId: call.conversation_id, display_name: call.other_user.display_name, avatar_url: call.other_user.avatar_url }, call.call_type, call.conversation_id)} className="p-2 text-brand-accent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl hover:bg-brand-accent/10">
                    <span className="material-symbols-outlined text-[20px]">{call.call_type === 'video' ? 'videocam' : 'call'}</span>
                  </button>
                </div>
              ))}
              {calls.length === 0 && (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No recent calls
                </div>
              )}
            </div>
          )}

        </section>

        {/* Resizer Handle */}
        <div 
          className="hidden md:block w-1 cursor-col-resize hover:bg-brand-teal/50 active:bg-brand-teal transition-colors z-30"
          onMouseDown={() => setIsResizing(true)}
        />

        {/* ── ACTIVE CHAT PANEL ── */}
        <section 
          className={`relative ${activeConversationId ? 'flex' : 'hidden md:flex'} flex-col flex-1 h-full min-w-0 transition-colors duration-300 theme-transition bg-cover bg-center`}
          style={{
            backgroundImage: theme === 'dark' ? 'url(/chat_bg_dark.png)' : 'url(/chat_bg_light.png)'
          }}
        >
          {/* Overlay to ensure maximum contrast and legibility */}
          <div className="absolute inset-0 dark:bg-[#020813]/85 bg-white/92 z-0 pointer-events-none transition-colors duration-300" />

          {activeContact ? (
            <>
              {/* Background Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 select-none">
                <div className="chat-watermark">ECHO</div>
              </div>

              {/* Chat Header */}
              <header className="h-[72px] px-6 dark:bg-brand-bg-dark/95 bg-white/95 backdrop-blur-xl sticky top-0 flex justify-between items-center z-20 border-b dark:border-brand-border border-brand-border-light flex-shrink-0 shadow-sm transition-colors duration-300">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setActive(null)} className="md:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex-shrink-0 transition-colors">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                  </button>
                  <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full ${getInitialBg(activeContact.other_user?.id)} flex items-center justify-center font-bold text-white shadow-sm overflow-hidden flex-shrink-0`}>
                    {activeContact.other_user?.avatar_url ? (
                      <img src={activeContact.other_user.avatar_url} alt="DP" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(activeContact.other_user?.display_name)
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-sm md:text-base font-bold dark:text-slate-100 text-slate-800 truncate">{activeContact.other_user?.display_name}</h3>
                    {isTyping ? (
                      <span className="text-[12px] text-brand-accent font-semibold tracking-wide animate-pulse">typing...</span>
                    ) : (
                      <span className="text-[12px] dark:text-slate-400 text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                        Online
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 flex-shrink-0">
                  <button onClick={() => webrtc.initiateCall({ id: activeContact.other_user.id, convId: activeConversationId, display_name: activeContact.other_user.display_name, avatar_url: activeContact.other_user.avatar_url }, 'video', activeConversationId)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-accent rounded-xl transition-all"><span className="material-symbols-outlined text-[22px]">videocam</span></button>
                  <button onClick={() => webrtc.initiateCall({ id: activeContact.other_user.id, convId: activeConversationId, display_name: activeContact.other_user.display_name, avatar_url: activeContact.other_user.avatar_url }, 'audio', activeConversationId)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-brand-accent rounded-xl transition-all"><span className="material-symbols-outlined text-[22px]">call</span></button>
                  <button className="hidden sm:block p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><span className="material-symbols-outlined text-[22px]">search</span></button>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><span className="material-symbols-outlined text-[22px]">more_vert</span></button>
                </div>
              </header>

              {/* Message Area */}
              <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col bg-transparent z-10 pb-28 md:pb-6 relative">
                {groupedMessages.map((item, index) => {
                  if (item.type === 'date') {
                    return (
                      <div key={item.id} className="flex justify-center my-4 w-full">
                        <span className="dark:bg-slate-800/80 bg-slate-200/80 backdrop-blur-sm px-4 py-1 rounded-full text-[11px] font-bold dark:text-slate-300 text-slate-600 shadow-sm uppercase tracking-wider">
                          {item.date}
                        </span>
                      </div>
                    );
                  }

                  const msg = item;
                  const isSent = msg.sender_id === user.id;
                  
                  let displayContent = msg.content || '';
                  let replyData = null;
                  const replyMatch = displayContent.match(/^\[REPLY:([a-zA-Z0-9-]+)\](.*)$/s);
                  if (replyMatch) {
                    const rId = replyMatch[1];
                    displayContent = replyMatch[2];
                    const originalMsg = activeMessages.find(m => m.id === rId);
                    if (originalMsg) {
                       const originalSender = conversations.find(c => c.id === activeConversationId)?.other_user?.id === originalMsg.sender_id ? conversations.find(c => c.id === activeConversationId)?.other_user?.display_name : 'You';
                       replyData = {
                         sender: originalSender,
                         content: (originalMsg.content || '').replace(/^\[REPLY:[^\]]+\]/, '').substring(0, 50) || 'Attachment'
                       };
                    }
                  }
                  
                  const handleDragEnd = (e, info) => {
                    if (info.offset.x > 50) {
                      setReplyToId(msg.id);
                    }
                  };

                  // Inline Call Log Renderer
                  if (msg.file_url && msg.file_url.startsWith('CALL_LOG|')) {
                    const [, type, status, duration] = msg.file_url.split('|');
                    const didAnswer = status === 'completed';
                    const durNum = parseInt(duration) || 0;
                    const durationText = didAnswer && durNum > 0 ? `${Math.floor(durNum/60)}:${(durNum%60).toString().padStart(2, '0')}` : '';
                    
                    return (
                      <div key={msg.id} className="flex justify-center w-full my-3">
                         <div className="dark:bg-[#0c1322]/90 bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl flex items-center gap-3 border dark:border-brand-border border-slate-200 shadow-sm w-fit max-w-[320px]">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${status === 'completed' ? 'bg-brand-accent/15 text-brand-accent' : 'bg-rose-500/15 text-rose-500'}`}>
                              <span className="material-symbols-outlined text-[20px]">{type === 'video' ? 'videocam' : 'call'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold dark:text-slate-200 text-slate-700">{status === 'completed' ? `${type === 'video' ? 'Video' : 'Voice'} Call` : status === 'rejected' ? 'Declined Call' : 'Missed Call'}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{didAnswer ? durationText : (isSent ? 'Outgoing' : 'Incoming')} • {formatTime(msg.sent_at)}</span>
                            </div>
                         </div>
                      </div>
                    );
                  }

                  // Determine if we should show the tail
                  const nextMsg = groupedMessages[index + 1];
                  const showTail = !nextMsg || nextMsg.type === 'date' || nextMsg.sender_id !== msg.sender_id || (nextMsg.file_url && nextMsg.file_url.startsWith('CALL_LOG|'));

                  if (msg.is_deleted) {
                    return (
                      <div key={msg.id} className={`flex flex-col ${isSent ? 'items-end' : 'items-start'} w-full group ${showTail ? 'mb-2' : 'mb-0.5'}`}>
                        <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] md:max-w-[70%] shadow-sm w-fit flex items-center gap-2 text-slate-400 dark:text-slate-500 italic border ${isSent ? 'dark:bg-brand-active-bg/30 bg-blue-50/50 border-brand-accent/10' : 'dark:bg-slate-900 bg-slate-100 border-slate-200/50'}`}>
                           <span className="material-symbols-outlined text-[16px] opacity-80">block</span>
                           <span className="text-[13px] font-medium">This message was deleted</span>
                        </div>
                      </div>
                    );
                  }

                  return isSent ? (
                    <div key={msg.id} className={`flex flex-col items-end w-full group ${showTail ? 'mb-2' : 'mb-0.5'}`}>
                      <div className="flex items-center gap-2 max-w-[85%] md:max-w-[70%]">
                        <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all flex-shrink-0">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                        <motion.div drag="x" dragConstraints={{ left: 0, right: 80 }} onDragEnd={handleDragEnd} className="bg-brand-accent px-4 py-2.5 rounded-2xl rounded-tr-none text-white shadow-sm min-w-[80px] w-fit flex flex-col relative border border-brand-accent/20">
                        {replyData && (
                          <div className="bg-white/10 rounded-lg p-2 mb-2 border-l-4 border-white text-[12px] text-white/90">
                            <span className="font-bold block">{replyData.sender}</span>
                            <span className="truncate block">{replyData.content}</span>
                          </div>
                        )}
                        
                        {msg.message_type === 'image' || (msg.message_type === 'sticker') ? (
                          <div className="mb-1 rounded-xl overflow-hidden bg-black/10">
                            <img src={msg.file_url} alt="Attachment" className={`object-cover ${msg.message_type === 'sticker' ? 'w-32 h-32 bg-transparent' : 'w-full max-h-64'}`} />
                            {displayContent && <span className="text-sm leading-relaxed break-words px-1 mt-1.5 block font-medium">{displayContent}</span>}
                          </div>
                        ) : msg.message_type === 'video' ? (
                          <div className="mb-1 rounded-xl overflow-hidden bg-black/15">
                            <video src={msg.file_url} controls className="w-full max-h-64 object-contain" />
                            {displayContent && <span className="text-sm leading-relaxed break-words px-1 mt-1.5 block font-medium">{displayContent}</span>}
                          </div>
                        ) : msg.message_type === 'audio' ? (
                          <div className="mb-1 rounded-xl overflow-hidden flex flex-col gap-1 min-w-[200px] bg-black/10 p-2">
                            <audio src={msg.file_url} controls className="w-full h-10" />
                            {displayContent && <span className="text-sm leading-relaxed break-words px-1 mt-1.5 block font-medium">{displayContent}</span>}
                          </div>
                        ) : msg.message_type === 'document' ? (
                          <div className="mb-1 p-2.5 rounded-xl bg-white/10 flex items-center gap-3 border border-white/10 hover:bg-white/20 transition-colors cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')}>
                            <div className="w-9 h-9 rounded-xl bg-white text-brand-accent flex items-center justify-center flex-shrink-0 shadow-sm">
                               <span className="material-symbols-outlined text-[20px]">description</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                               <span className="font-semibold text-xs truncate max-w-[150px]">{msg.file_name || 'Document'}</span>
                               <span className="text-[10px] opacity-85 mt-0.5">{(msg.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm leading-relaxed break-words font-medium">{displayContent}</span>
                        )}

                        <div className="flex items-center justify-end gap-1 select-none mt-1.5 self-end opacity-75">
                          <span className="text-[10px] text-blue-100 font-medium">{formatTime(msg.sent_at)}</span>
                          {msg.status === 'sending' && <span className="material-symbols-outlined text-[13px] animate-spin text-blue-200">progress_activity</span>}
                          {msg.status === 'sent' && <span className="material-symbols-outlined text-[14px] text-blue-200">check</span>}
                          {msg.status === 'delivered' && <span className="material-symbols-outlined text-[14px] text-blue-100">done_all</span>}
                          {msg.status === 'read' && <span className="material-symbols-outlined text-[14px] text-cyan-200" style={{ fontVariationSettings: "'FILL' 1" }}>done_all</span>}
                          {!['sending', 'sent', 'delivered', 'read'].includes(msg.status) && <span className="material-symbols-outlined text-[14px] text-blue-100">done_all</span>}
                        </div>
                      </motion.div>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className={`flex flex-col items-start w-full group ${showTail ? 'mb-2' : 'mb-0.5'}`}>
                      <div className="flex items-center gap-2 max-w-[85%] md:max-w-[70%]">
                        <motion.div drag="x" dragConstraints={{ left: 0, right: 80 }} onDragEnd={handleDragEnd} className="dark:bg-[#060f1e]/90 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl rounded-tl-none dark:text-slate-100 text-slate-800 shadow-sm min-w-[80px] w-fit flex flex-col relative border dark:border-brand-border border-slate-200">
                          {replyData && (
                            <div className="bg-slate-200/50 dark:bg-slate-850/50 rounded-lg p-2 mb-2 border-l-4 border-brand-accent text-[12px]">
                              <span className="font-bold text-brand-accent block">{replyData.sender}</span>
                              <span className="truncate block dark:text-slate-200 text-slate-700">{replyData.content}</span>
                            </div>
                          )}
                          
                          {msg.message_type === 'image' || (msg.message_type === 'sticker') ? (
                            <div className="mb-1 rounded-xl overflow-hidden bg-black/5 dark:bg-white/5">
                              <img src={msg.file_url} alt="Attachment" className={`object-cover ${msg.message_type === 'sticker' ? 'w-32 h-32 bg-transparent' : 'w-full max-h-64'}`} />
                              {displayContent && <span className="text-sm leading-relaxed break-words px-1 mt-1.5 block font-medium">{displayContent}</span>}
                            </div>
                          ) : msg.message_type === 'video' ? (
                            <div className="mb-1 rounded-xl overflow-hidden bg-black/10 dark:bg-white/10">
                              <video src={msg.file_url} controls className="w-full max-h-64 object-contain" />
                              {displayContent && <span className="text-sm leading-relaxed break-words px-1 mt-1.5 block font-medium">{displayContent}</span>}
                            </div>
                          ) : msg.message_type === 'audio' ? (
                            <div className="mb-1 rounded-xl overflow-hidden flex flex-col gap-1 min-w-[200px] bg-black/5 dark:bg-white/5 p-2">
                              <audio src={msg.file_url} controls className="w-full h-10" />
                              {displayContent && <span className="text-sm leading-relaxed break-words px-1 mt-1.5 block font-medium">{displayContent}</span>}
                            </div>
                          ) : msg.message_type === 'document' ? (
                            <div className="mb-1 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 flex items-center gap-3 border dark:border-slate-800 border-slate-200 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')}>
                              <div className="w-9 h-9 rounded-xl bg-brand-accent text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                 <span className="material-symbols-outlined text-[20px]">description</span>
                              </div>
                              <div className="flex flex-col min-w-0">
                                 <span className="font-semibold text-xs truncate max-w-[150px] dark:text-slate-200 text-slate-700">{msg.file_name || 'Document'}</span>
                                 <span className="text-[10px] opacity-70 mt-0.5">{(msg.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm leading-relaxed break-words font-medium">{displayContent}</span>
                          )}

                          <div className="flex items-center justify-end mt-1.5 self-end opacity-60">
                            <span className="text-[10px] font-medium select-none">{formatTime(msg.sent_at)}</span>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  );
                })}

                {/* Bouncing Typing Indicator */}
                {isTyping && (
                  <div className="flex flex-col items-start w-full group mt-1 mb-2">
                    <div className="dark:bg-[#0c1322] bg-[#f1f5f9] px-4 py-3 rounded-2xl shadow-sm border dark:border-slate-800 border-slate-200 relative w-fit">
                      <div className="flex items-center gap-1.5 h-3">
                        <div className="w-1.5 h-1.5 dark:bg-slate-400 bg-slate-500 rounded-full animate-bounce-dot"></div>
                        <div className="w-1.5 h-1.5 dark:bg-slate-400 bg-slate-500 rounded-full animate-bounce-dot animation-delay-200"></div>
                        <div className="w-1.5 h-1.5 dark:bg-slate-400 bg-slate-500 rounded-full animate-bounce-dot animation-delay-400"></div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Banner */}
              {replyToId && (() => {
                 const originalMsg = activeMessages.find(m => m.id === replyToId);
                 if (!originalMsg) return null;
                 const senderName = originalMsg.sender_id === user.id ? 'You' : (activeContact?.other_user?.display_name || 'User');
                 return (
                   <div className="px-6 py-2.5 dark:bg-[#0c1322] bg-[#f1f5f9] border-t dark:border-brand-border border-brand-border-light flex items-center justify-between animate-fade-in-down z-20">
                     <div className="flex flex-col border-l-4 border-brand-accent pl-3">
                        <span className="text-brand-accent font-bold text-xs">{senderName}</span>
                        <span className="dark:text-slate-300 text-slate-600 text-xs truncate max-w-[250px] md:max-w-[400px] mt-0.5">{(originalMsg.content || '').replace(/^\[REPLY:[^\]]+\]/, '').substring(0,50) || 'Attachment'}</span>
                     </div>
                     <button onClick={() => setReplyToId(null)} className="p-1 text-slate-400 hover:text-rose-500 rounded-full transition-colors"><span className="material-symbols-outlined text-[18px]">close</span></button>
                   </div>
                 );
              })()}
              
              {/* Composer */}
              <footer className="px-6 py-4 dark:bg-brand-bg-dark/95 bg-white/95 backdrop-blur-xl border-t dark:border-brand-border border-brand-border-light flex items-center gap-3 relative z-30 transition-colors duration-300 theme-transition">
                
                <div className="relative">
                  <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)} className={`p-2.5 dark:text-slate-400 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-xl ${showAttachMenu ? 'bg-slate-100 dark:bg-slate-800 text-brand-accent' : ''}`}>
                    <span className="material-symbols-outlined text-[22px]">add</span>
                  </button>
                  {showAttachMenu && (
                    <div className="absolute bottom-14 left-0 dark:bg-[#0c1322] bg-white rounded-2xl shadow-xl border dark:border-brand-border border-slate-200 p-2 flex flex-col gap-1 w-48 z-50 animate-fade-in-down">
                      <button type="button" onClick={() => { fileInputRef.current.accept = 'image/*,video/*'; fileInputRef.current.click(); }} className="flex items-center gap-3 p-2.5 dark:hover:bg-slate-800 hover:bg-slate-100 rounded-xl text-left transition-colors dark:text-slate-200 text-slate-700 font-semibold text-xs">
                        <span className="material-symbols-outlined text-[#007AFF] text-[20px]">photo_library</span> Photo & Video
                      </button>
                      <button type="button" onClick={() => { fileInputRef.current.accept = '*/*'; fileInputRef.current.click(); }} className="flex items-center gap-3 p-2.5 dark:hover:bg-slate-800 hover:bg-slate-100 rounded-xl text-left transition-colors dark:text-slate-200 text-slate-700 font-semibold text-xs">
                        <span className="material-symbols-outlined text-[#5856D6] text-[20px]">description</span> Document
                      </button>
                      <button type="button" onClick={() => { fileInputRef.current.accept = 'image/webp,image/png'; fileInputRef.current.click(); }} className="flex items-center gap-3 p-2.5 dark:hover:bg-slate-800 hover:bg-slate-100 rounded-xl text-left transition-colors dark:text-slate-200 text-slate-700 font-semibold text-xs">
                        <span className="material-symbols-outlined text-[#FF2D55] text-[20px]">sticky_note_2</span> Sticker
                      </button>
                      <button type="button" onClick={() => { fileInputRef.current.accept = 'audio/*'; fileInputRef.current.click(); }} className="flex items-center gap-3 p-2.5 dark:hover:bg-slate-800 hover:bg-slate-100 rounded-xl text-left transition-colors dark:text-slate-200 text-slate-700 font-semibold text-xs">
                        <span className="material-symbols-outlined text-[#FF9500] text-[20px]">headphones</span> Audio
                      </button>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
                </div>
                <form onSubmit={handleSend} className="flex-1 flex items-center relative gap-2">
                  <div className="flex-1 dark:bg-[#0c1322] bg-[#f1f5f9] border dark:border-brand-border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2 shadow-sm transition-all focus-within:border-brand-accent/50 focus-within:ring-1 focus-within:ring-brand-accent/20">
                    {isRecording ? (
                      <div className="flex-1 flex items-center gap-3 animate-pulse text-rose-500 font-semibold text-sm">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                        Recording... {Math.floor(recordingTime/60)}:{(recordingTime%60).toString().padStart(2, '0')}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={messageInput}
                        onChange={handleTyping}
                        className="flex-1 border-none bg-transparent focus:ring-0 dark:text-slate-100 text-slate-800 font-medium text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
                        placeholder={uploadingFile ? 'Uploading...' : 'Write something warm...'}
                        disabled={uploadingFile}
                      />
                    )}
                  </div>
                  {messageInput.trim() || uploadingFile ? (
                    <button type="submit" disabled={uploadingFile} className="w-10 h-10 bg-brand-accent text-white rounded-xl flex items-center justify-center shadow-md shadow-brand-accent/10 hover:bg-brand-accent/90 transition-colors flex-shrink-0 disabled:opacity-50">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                    </button>
                  ) : (
                    <button type="button" onClick={handleVoiceNote} className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-colors flex-shrink-0 ${isRecording ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/10' : 'bg-brand-accent text-white hover:bg-brand-accent/90 shadow-brand-accent/10'}`}>
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{isRecording ? 'stop' : 'mic'}</span>
                    </button>
                  )}
                </form>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center dark:bg-brand-bg-dark bg-brand-bg-light relative">
              {/* Background Watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0 select-none">
                <div className="chat-watermark">ECHO</div>
              </div>
              <div className="max-w-md z-10 animate-fade-in flex flex-col items-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-accent/20 to-blue-500/5 dark:from-brand-accent/15 dark:to-transparent flex items-center justify-center mb-6 shadow-md border border-brand-accent/30 rotate-3">
                  <span className="material-symbols-outlined text-[36px] text-brand-accent animate-bounce-subtle">chat_bubble</span>
                </div>
                <h3 className="text-xl font-bold dark:text-slate-100 text-slate-800 mb-2">
                  Welcome to Echo, {user?.display_name ? user.display_name.split(' ')[0] : 'Friend'}! 👋
                </h3>
                <p className="text-sm dark:text-slate-400 text-slate-500 leading-relaxed max-w-sm mx-auto mb-6">
                  Select a contact from your sidebar to start exchanging clear, encrypted messages, or invite a friend to get started!
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <button 
                    onClick={() => setShowNewChat(true)}
                    className="px-4 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-accent/10 transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    New Conversation
                  </button>
                  <button 
                    onClick={() => setShowInviteModal(true)}
                    className="px-4 py-2.5 dark:bg-brand-active-bg bg-brand-active-bg-light border dark:border-brand-accent/20 border-brand-accent/10 dark:text-brand-accent text-brand-accent text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    Invite a Friend
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── NEW CHAT MODAL ── */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="dark:bg-[#0c1322] bg-white border dark:border-slate-800 border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col transition-all duration-300">
            <header className="p-5 border-b dark:border-slate-800 border-slate-100 flex justify-between items-center">
              <h2 className="text-base font-bold dark:text-slate-100 text-slate-800">New Conversation</h2>
              <button onClick={() => setShowNewChat(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>
            <div className="p-5">
              <form onSubmit={handleSearchUsers} className="flex gap-2">
                <input 
                  type="text" 
                  value={newChatQuery}
                  onChange={(e) => setNewChatQuery(e.target.value)}
                  placeholder="Search by 5-digit Echo ID or name" 
                  className="flex-1 px-4 py-2 rounded-xl dark:bg-brand-bg-dark bg-slate-50 border dark:border-slate-800 border-slate-200 focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent dark:text-slate-100 text-slate-800 placeholder-slate-450 dark:placeholder-slate-500 text-sm transition-all"
                />
                <button type="submit" className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white text-sm font-semibold rounded-xl shadow-sm transition-all">Search</button>
              </form>
              
              <div className="mt-5 space-y-2 max-h-60 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-slate-500 py-6 text-sm font-medium">No users found. Try searching by ID.</p>
                ) : (
                  searchResults.map(res => (
                    <div key={res.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-55/60 dark:hover:bg-slate-800/20 border border-transparent transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full ${getInitialBg(res.id)} flex items-center justify-center text-white text-sm font-bold overflow-hidden shadow-sm`}>
                          {res.avatar_url ? (
                            <img src={res.avatar_url} alt="DP" className="w-full h-full object-cover" />
                          ) : (
                            getInitials(res.display_name)
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold dark:text-slate-200 text-slate-700">{res.display_name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">#{res.echo_id}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleCreateConversation(res.id)}
                        disabled={isCreating}
                        className="p-2 text-brand-accent hover:bg-brand-accent/15 rounded-xl transition-all disabled:opacity-50"
                      >
                        {isCreating ? (
                           <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        ) : (
                           <span className="material-symbols-outlined text-[20px]">chat</span>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="dark:bg-[#0c1322] bg-white border dark:border-slate-800 border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col transition-all duration-300">
            <header className="p-5 border-b dark:border-slate-800 border-slate-100 flex justify-between items-center">
              <h2 className="text-base font-bold dark:text-slate-100 text-slate-800">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>
            <div className="p-6 flex flex-col items-center">
              <div className="relative group cursor-pointer">
                <div className="w-20 h-20 rounded-full bg-brand-accent/15 border border-brand-accent/30 text-brand-accent font-bold text-2xl flex items-center justify-center mb-4 shadow-md overflow-hidden">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="DP" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(user?.display_name)
                  )}
                </div>
                <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer">
                  <span className="material-symbols-outlined mb-1 text-[20px]">photo_camera</span>
                  <span className="text-[9px] uppercase tracking-wider font-bold">Change</span>
                  <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append('avatar', file);
                    try {
                      const { data } = await api.post('/users/me/avatar', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      useAuthStore.setState({ user: data.data });
                    } catch (err) {
                      console.error('Failed to upload avatar', err);
                    }
                  }} />
                </label>
              </div>
              <h3 className="text-base font-bold dark:text-slate-100 text-slate-800 mb-2">{user?.display_name}</h3>
              <div className="mt-1 px-3 py-1.5 dark:bg-slate-800 bg-slate-100 rounded-xl flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Your Echo ID:</span>
                <span className="text-xs font-bold text-brand-accent tracking-wider">{user?.echo_id}</span>
              </div>
              
              <div className="w-full mt-6 space-y-4">
                <div className="p-3.5 dark:bg-brand-bg-dark bg-slate-50 border dark:border-slate-800 border-slate-200 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Email Address</p>
                  <p className="text-sm font-semibold dark:text-slate-350 text-slate-700">{user?.email}</p>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  setShowSettings(false);
                  setShowInviteModal(true);
                }}
                className="mt-4 w-full py-2.5 dark:bg-brand-accent/15 bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 font-bold text-xs rounded-xl transition-all flex justify-center items-center gap-1.5 border border-transparent hover:border-brand-accent/20"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Invite Friend
              </button>

              <button 
                onClick={() => clearAuth()}
                className="mt-4 w-full py-2.5 dark:bg-rose-500/10 bg-rose-50 text-rose-500 hover:bg-rose-500/20 font-bold text-xs rounded-xl transition-all flex justify-center items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVITE FRIEND MODAL ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="dark:bg-[#0c1322] bg-white border dark:border-slate-800 border-slate-200 rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col transition-all duration-300">
            <header className="p-5 border-b dark:border-slate-800 border-slate-100 flex justify-between items-center">
              <h2 className="text-base font-bold dark:text-slate-100 text-slate-800">Invite a Friend</h2>
              <button 
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteMessage(null);
                }} 
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </header>
            <div className="p-5">
              <p className="text-xs dark:text-slate-400 text-slate-500 mb-4 leading-relaxed">
                Invite your friend by entering their email address. We'll send them a verification link to set up their password and automatically connect them with you on Echo.
              </p>
              
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                    Friend's Email Address
                  </label>
                  <input 
                    type="email" 
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="friend@example.com" 
                    className="w-full px-4 py-2.5 rounded-xl dark:bg-brand-bg-dark bg-slate-50 border dark:border-slate-800 border-slate-200 focus:outline-none focus:border-brand-accent dark:focus:border-brand-accent dark:text-slate-100 text-slate-800 placeholder-slate-450 dark:placeholder-slate-500 text-sm transition-all"
                  />
                </div>

                {inviteMessage && (
                  <div className={`p-3 rounded-xl text-xs font-semibold ${
                    inviteMessage.type === 'success' 
                      ? 'dark:bg-emerald-500/10 bg-emerald-50 text-emerald-600 dark:text-emerald-450 border dark:border-emerald-500/20 border-emerald-100' 
                      : 'dark:bg-rose-500/10 bg-rose-50 text-rose-600 dark:text-rose-450 border dark:border-rose-500/20 border-rose-100'
                  }`}>
                    {inviteMessage.text}
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail('');
                      setInviteMessage(null);
                    }}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold dark:text-slate-400 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={inviteLoading}
                    className="px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md shadow-brand-accent/10 transition-all flex items-center gap-1.5"
                  >
                    {inviteLoading ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        Sending...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        Send Invitation
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* ── BOTTOM NAV BAR (Mobile) ── */}
      {!activeConversationId && (
        <nav className="md:hidden fixed bottom-0 left-0 w-full dark:bg-[#0c1322]/95 bg-white/95 backdrop-blur-xl border-t dark:border-slate-800 border-slate-200 flex justify-around items-center h-[72px] z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          {[
            { key: 'messages', icon: 'chat_bubble', label: 'Chats' },
            { key: 'calls', icon: 'call', label: 'Calls' },
            { key: 'settings', icon: 'settings', label: 'Settings', action: () => setShowSettings(true) },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => {
                if(item.action) { item.action(); return; }
                setActiveNav(item.key);
              }}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${item.key === activeNav && !item.action ? 'text-brand-accent' : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <div className={`px-4 py-1 rounded-full ${item.key === activeNav && !item.action ? 'dark:bg-brand-accent/15 bg-brand-accent/10' : 'bg-transparent'}`}>
                <span className="material-symbols-outlined text-[24px]" style={item.key === activeNav && !item.action ? {fontVariationSettings: "'FILL' 1"} : {}}>{item.icon}</span>
              </div>
              <span className="text-[12px] font-medium mt-1">{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default AppShell;
