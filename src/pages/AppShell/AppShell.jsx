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

const initialColors = ['bg-tertiary-fixed', 'bg-secondary-fixed', 'bg-primary-fixed', 'bg-tertiary-container'];
const getInitialBg = (id) => {
  if (!id) return initialColors[0];
  return initialColors[id.charCodeAt(id.length - 1) % initialColors.length];
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
  
  const messagesEndRef = useRef(null);

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
    <div className="bg-background text-on-surface overflow-hidden h-[100dvh] font-body-md text-body-md flex relative selection:bg-brand-teal/20">
      <div className="fixed inset-0 dot-grid z-0 pointer-events-none opacity-50" />
      <div className="fixed inset-0 grain-overlay z-10 pointer-events-none opacity-30" />

      {/* ── SIDE NAV BAR (Desktop) ── */}
      <aside className="hidden md:flex flex-col h-screen w-80 fixed left-0 top-0 bg-surface-container-low border-r border-outline-variant/30 py-lg z-30">
        <div className="px-lg mb-lg">
          <div className="flex items-center gap-sm mb-xs">
            <span className="font-display-lg text-display-lg text-primary tracking-tight">Echo</span>
            <div className="flex items-center gap-xs ml-auto">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Online</span>
            </div>
          </div>
          
          <div 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-md mt-lg p-sm rounded-xl hover:bg-surface-container transition-all cursor-pointer"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-label-md shadow-sm overflow-hidden">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="DP" className="w-full h-full object-cover" />
                ) : (
                  getInitials(user?.display_name)
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-secondary border-2 border-surface-container-low rounded-full" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="font-headline-md text-[18px] text-on-surface truncate">{user?.display_name || 'User'}</span>
              <span className="font-label-md text-label-md text-on-surface-variant">#{user?.echo_id || '----'}</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-xs flex-1 px-sm overflow-y-auto">
          {[
            { key: 'messages', icon: 'chat_bubble', label: 'Messages' },
            { key: 'calls', icon: 'call', label: 'Calls' },
            { key: 'contacts', icon: 'group', label: 'Contacts' },
            { key: 'settings', icon: 'settings', label: 'Settings', action: () => setShowSettings(true) },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => {
                setActiveNav(item.key);
                if(item.action) item.action();
              }}
              className={
                item.key === activeNav
                  ? 'w-full flex items-center gap-md px-lg py-sm bg-surface-container-high text-secondary border-l-4 border-primary transition-transform translate-x-1'
                  : 'w-full flex items-center gap-md px-lg py-sm text-on-surface-variant hover:bg-surface-container transition-all border-l-4 border-transparent'
              }
            >
              <span className={`material-symbols-outlined ${item.key === activeNav ? 'text-primary' : ''}`}>{item.icon}</span>
              <span className="font-label-md text-label-md">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-lg mt-auto">
          <button 
            onClick={() => setShowNewChat(true)}
            className="w-full py-lg bg-brand-teal text-white rounded-full flex items-center justify-center gap-sm font-label-md text-label-md shadow-md hover:shadow-lg active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">add</span>
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
          className={`bg-white/60 backdrop-blur-md border-r border-outline-variant/20 flex-col h-full flex-shrink-0 ${activeConversationId ? 'hidden md:flex' : 'flex w-full'}`}
        >
          {activeNav === 'messages' && (
            <>
              <div className="p-lg">
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-surface-container-low border-none rounded-2xl font-label-md text-label-md focus:ring-1 focus:ring-brand-teal transition-all outline-none"
                    placeholder="Search conversations..."
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {conversations
                  .filter(c => (c.other_user?.display_name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => setActive(contact.id)}
                    className={`h-[72px] px-lg flex items-center gap-md cursor-pointer transition-colors border-l-4 ${
                      contact.id === activeConversationId
                        ? 'bg-brand-sage border-brand-teal'
                        : 'border-transparent hover:bg-surface-container'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full ${getInitialBg(contact.other_user?.id)} flex items-center justify-center font-label-md text-on-surface flex-shrink-0 shadow-sm overflow-hidden`}>
                        {contact.other_user?.avatar_url ? (
                          <img src={contact.other_user.avatar_url} alt="dp" className="w-full h-full object-cover" />
                        ) : (
                          getInitials(contact.other_user?.display_name)
                        )}
                      </div>
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-secondary border-2 border-white rounded-full" />
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex justify-between items-baseline">
                        <h4 className={`font-label-md text-[15px] truncate ${contact.id === activeConversationId ? 'text-brand-forest font-bold' : 'text-on-surface'}`}>
                          {contact.other_user?.display_name || 'Unknown'}
                        </h4>
                        <span className={`text-[11px] flex-shrink-0 ml-2 ${contact.id === activeConversationId ? 'text-brand-forest/60' : 'text-on-surface-variant'}`}>
                          {formatTime(contact.updated_at)}
                        </span>
                      </div>
                      <p className={`font-body-md text-[13px] truncate flex items-center gap-1 ${contact.id === activeConversationId ? 'text-brand-forest/80' : 'text-on-surface-variant'}`}>
                        {typingStatus[contact.id] ? (
                          <span className="text-brand-teal font-medium tracking-wide">typing...</span>
                        ) : (
                          <>
                            {(contact.last_message_preview || '').includes('Call') && (
                              <span className="material-symbols-outlined text-[14px]">call</span>
                            )}
                            {(contact.last_message_preview || '').replace(/^\[REPLY:[a-zA-Z0-9-]+\]/, '') || 'No messages yet'}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeNav === 'calls' && (
            <div className="flex-1 overflow-y-auto">
              <div className="p-lg pb-sm">
                <h3 className="font-headline-md text-on-surface mb-md">Recent Calls</h3>
              </div>
              {calls.map(call => (
                <div key={call.id} className="px-lg py-sm flex items-center gap-md hover:bg-surface-container transition-colors cursor-pointer group">
                  <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center overflow-hidden flex-shrink-0 text-primary font-bold shadow-sm">
                    {call.other_user?.avatar_url ? (
                      <img src={call.other_user.avatar_url} alt="DP" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(call.other_user?.display_name)
                    )}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className={`font-label-md truncate ${call.status !== 'completed' && !call.is_caller ? 'text-error' : 'text-on-surface'}`}>
                      {call.other_user?.display_name || 'Unknown'}
                    </span>
                    <div className="flex items-center gap-1 text-[13px] text-on-surface-variant">
                      <span className={`material-symbols-outlined text-[14px] ${call.status === 'completed' ? 'text-brand-teal' : 'text-error'}`}>
                        {call.is_caller ? 'call_made' : 'call_received'}
                      </span>
                      <span>{formatTime(call.created_at)}</span>
                    </div>
                  </div>
                  <button onClick={() => webrtc.initiateCall({ id: call.other_user.id, convId: call.conversation_id, display_name: call.other_user.display_name, avatar_url: call.other_user.avatar_url }, call.call_type, call.conversation_id)} className="p-2 text-brand-teal opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-brand-teal/10">
                    <span className="material-symbols-outlined">{call.call_type === 'video' ? 'videocam' : 'call'}</span>
                  </button>
                </div>
              ))}
              {calls.length === 0 && (
                <div className="p-lg text-center text-on-surface-variant font-body-sm">
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
        <section className={`${activeConversationId ? 'flex' : 'hidden md:flex'} flex-col flex-1 bg-surface-container-lowest/80 backdrop-blur-xl h-full shadow-[0_1px_3px_rgba(0,0,0,0.06)] min-w-0`}>
          {activeContact ? (
            <>
              {/* Chat Header */}
              <header className="h-[72px] px-lg bg-surface-container-lowest/95 backdrop-blur-xl sticky top-0 flex justify-between items-center z-20 border-b border-outline-variant/20 flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-sm md:gap-md min-w-0">
                  <button onClick={() => setActive(null)} className="md:hidden p-2 -ml-2 text-brand-charcoal hover:bg-surface-container rounded-full flex-shrink-0 transition-colors">
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                  </button>
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full ${getInitialBg(activeContact.other_user?.id)} flex items-center justify-center font-label-md text-on-surface shadow-sm overflow-hidden flex-shrink-0`}>
                    {activeContact.other_user?.avatar_url ? (
                      <img src={activeContact.other_user.avatar_url} alt="DP" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(activeContact.other_user?.display_name)
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3 className="font-headline-md text-[15px] md:text-[16px] text-on-surface truncate">{activeContact.other_user?.display_name}</h3>
                    {isTyping ? (
                      <span className="text-[12px] md:text-[13px] text-brand-teal font-medium tracking-wide">typing...</span>
                    ) : (
                      <span className="text-[12px] md:text-[13px] text-on-surface-variant flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-brand-teal inline-block"></span>
                        Online
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-sm text-outline flex-shrink-0">
                  <button onClick={() => webrtc.initiateCall({ id: activeContact.other_user.id, convId: activeConversationId, display_name: activeContact.other_user.display_name, avatar_url: activeContact.other_user.avatar_url }, 'video', activeConversationId)} className="p-2 hover:bg-surface-container hover:text-brand-teal rounded-full transition-colors"><span className="material-symbols-outlined">videocam</span></button>
                  <button onClick={() => webrtc.initiateCall({ id: activeContact.other_user.id, convId: activeConversationId, display_name: activeContact.other_user.display_name, avatar_url: activeContact.other_user.avatar_url }, 'audio', activeConversationId)} className="p-2 hover:bg-surface-container hover:text-brand-teal rounded-full transition-colors"><span className="material-symbols-outlined">call</span></button>
                  <button className="hidden sm:block p-2 hover:bg-surface-container rounded-full transition-colors"><span className="material-symbols-outlined">search</span></button>
                  <button className="p-2 hover:bg-surface-container rounded-full transition-colors"><span className="material-symbols-outlined">more_vert</span></button>
                </div>
              </header>

              {/* Message Area */}
              <div className="flex-1 overflow-y-auto px-md md:px-xl py-xl flex flex-col bg-[#F8F9FA]/80 pb-28 md:pb-xl">
                {groupedMessages.map((item, index) => {
                  if (item.type === 'date') {
                    return (
                      <div key={item.id} className="flex justify-center my-4 w-full">
                        <span className="bg-surface-container-high/60 backdrop-blur-sm px-4 py-1 rounded-full text-[12px] font-medium text-on-surface-variant shadow-sm uppercase tracking-wide">
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
                      <div key={msg.id} className="flex justify-center w-full my-md">
                         <div className="bg-surface-container-lowest/90 backdrop-blur-md px-lg py-sm rounded-2xl flex items-center gap-md border border-outline-variant/30 shadow-sm w-fit max-w-[320px]">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${status === 'completed' ? 'bg-brand-teal/15 text-brand-teal' : 'bg-error/15 text-error'}`}>
                              <span className="material-symbols-outlined">{type === 'video' ? 'videocam' : 'call'}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-label-md text-on-surface">{status === 'completed' ? `${type === 'video' ? 'Video' : 'Voice'} Call` : status === 'rejected' ? 'Declined Call' : 'Missed Call'}</span>
                              <span className="font-body-sm text-on-surface-variant text-[12px]">{didAnswer ? durationText : (isSent ? 'Outgoing' : 'Incoming')} • {formatTime(msg.sent_at)}</span>
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
                        <div className={`px-3 py-2 rounded-[20px] max-w-[85%] md:max-w-[75%] shadow-[0_1px_2px_rgba(0,0,0,0.05)] w-fit flex items-center gap-2 text-on-surface-variant/60 italic ${isSent ? 'bg-brand-sage/40 border border-brand-sage/30' : 'bg-white/40 border border-outline-variant/10'}`}>
                           <span className="material-symbols-outlined text-[16px]">block</span>
                           <span className="text-[14px]">This message was deleted</span>
                        </div>
                      </div>
                    );
                  }

                  return isSent ? (
                    <div key={msg.id} className={`flex flex-col items-end w-full group ${showTail ? 'mb-2' : 'mb-0.5'}`}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDeleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-on-surface-variant hover:text-error hover:bg-surface-container rounded-full transition-all">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                        <motion.div drag="x" dragConstraints={{ left: 0, right: 80 }} onDragEnd={handleDragEnd} className={`bg-brand-sage px-3 pt-2 pb-1.5 rounded-[20px] max-w-[85%] md:max-w-[75%] text-brand-charcoal shadow-sm min-w-[80px] w-fit flex flex-col relative ${showTail ? 'rounded-tr-sm msg-tail-sent border border-brand-sage/50' : 'border border-brand-sage/50'}`}>
                        {replyData && (
                          <div className="bg-black/5 rounded-lg p-2 mb-1 border-l-4 border-brand-teal text-[13px] opacity-80">
                            <span className="font-bold text-brand-teal block">{replyData.sender}</span>
                            <span className="truncate block">{replyData.content}</span>
                          </div>
                        )}
                        
                        {msg.message_type === 'image' || (msg.message_type === 'sticker') ? (
                          <div className="mb-1 rounded-xl overflow-hidden bg-black/5">
                            <img src={msg.file_url} alt="Attachment" className={`object-cover ${msg.message_type === 'sticker' ? 'w-32 h-32 bg-transparent' : 'w-full max-h-64'}`} />
                            {displayContent && <span className="text-[15px] leading-relaxed break-words px-1 mt-1 block">{displayContent}</span>}
                          </div>
                        ) : msg.message_type === 'video' ? (
                          <div className="mb-1 rounded-xl overflow-hidden bg-black/10">
                            <video src={msg.file_url} controls className="w-full max-h-64 object-contain" />
                            {displayContent && <span className="text-[15px] leading-relaxed break-words px-1 mt-1 block">{displayContent}</span>}
                          </div>
                        ) : msg.message_type === 'audio' ? (
                          <div className="mb-1 rounded-xl overflow-hidden flex flex-col gap-1 min-w-[200px]">
                            <audio src={msg.file_url} controls className="w-full h-10" />
                            {displayContent && <span className="text-[15px] leading-relaxed break-words px-1 mt-1 block">{displayContent}</span>}
                          </div>
                        ) : msg.message_type === 'document' ? (
                          <div className="mb-1 p-3 rounded-xl bg-black/5 flex items-center gap-3 border border-black/10 hover:bg-black/10 transition-colors cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')}>
                            <div className="w-10 h-10 rounded-full bg-brand-teal text-white flex items-center justify-center flex-shrink-0">
                               <span className="material-symbols-outlined">description</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                               <span className="font-medium text-[14px] truncate">{msg.file_name || 'Document'}</span>
                               <span className="text-[12px] opacity-70">{(msg.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[15px] leading-relaxed break-words">{displayContent}</span>
                        )}

                        <div className="flex items-center justify-end gap-1 select-none mt-1 self-end opacity-80">
                          <span className="text-[10px] text-brand-forest/60 font-medium">{formatTime(msg.sent_at)}</span>
                          {msg.status === 'sending' && <span className="material-symbols-outlined text-[14px] animate-spin text-brand-forest/60">progress_activity</span>}
                          {msg.status === 'sent' && <span className="material-symbols-outlined text-[15px] text-brand-forest/60">check</span>}
                          {msg.status === 'delivered' && <span className="material-symbols-outlined text-[15px] text-brand-forest/60">done_all</span>}
                          {msg.status === 'read' && <span className="material-symbols-outlined text-[15px] text-[#2FA4E7]" style={{ fontVariationSettings: "'FILL' 1" }}>done_all</span>}
                          {!['sending', 'sent', 'delivered', 'read'].includes(msg.status) && <span className="material-symbols-outlined text-[15px] text-[#2FA4E7]">done_all</span>}
                        </div>
                      </motion.div>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className={`flex flex-col items-start w-full group ${showTail ? 'mb-2' : 'mb-0.5'}`}>
                      <motion.div drag="x" dragConstraints={{ left: 0, right: 80 }} onDragEnd={handleDragEnd} className={`bg-white px-3 pt-2 pb-1.5 rounded-[20px] max-w-[85%] md:max-w-[75%] shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-brand-charcoal min-w-[80px] w-fit flex flex-col relative border border-outline-variant/10 ${showTail ? 'rounded-tl-sm msg-tail-received' : ''}`}>
                        {replyData && (
                          <div className="bg-black/5 rounded-lg p-2 mb-1 border-l-4 border-brand-teal text-[13px] opacity-80">
                            <span className="font-bold text-brand-teal block">{replyData.sender}</span>
                            <span className="truncate block">{replyData.content}</span>
                          </div>
                        )}
                        
                        {msg.message_type === 'image' || (msg.message_type === 'sticker') ? (
                          <div className="mb-1 rounded-xl overflow-hidden bg-black/5">
                            <img src={msg.file_url} alt="Attachment" className={`object-cover ${msg.message_type === 'sticker' ? 'w-32 h-32 bg-transparent' : 'w-full max-h-64'}`} />
                            {displayContent && <span className="text-[15px] leading-relaxed break-words px-1 mt-1 block">{displayContent}</span>}
                          </div>
                        ) : msg.message_type === 'video' ? (
                          <div className="mb-1 rounded-xl overflow-hidden bg-black/10">
                            <video src={msg.file_url} controls className="w-full max-h-64 object-contain" />
                            {displayContent && <span className="text-[15px] leading-relaxed break-words px-1 mt-1 block">{displayContent}</span>}
                          </div>
                        ) : msg.message_type === 'audio' ? (
                          <div className="mb-1 rounded-xl overflow-hidden flex flex-col gap-1 min-w-[200px]">
                            <audio src={msg.file_url} controls className="w-full h-10" />
                            {displayContent && <span className="text-[15px] leading-relaxed break-words px-1 mt-1 block">{displayContent}</span>}
                          </div>
                        ) : msg.message_type === 'document' ? (
                          <div className="mb-1 p-3 rounded-xl bg-black/5 flex items-center gap-3 border border-black/10 hover:bg-black/10 transition-colors cursor-pointer" onClick={() => window.open(msg.file_url, '_blank')}>
                            <div className="w-10 h-10 rounded-full bg-brand-teal text-white flex items-center justify-center flex-shrink-0">
                               <span className="material-symbols-outlined">description</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                               <span className="font-medium text-[14px] truncate">{msg.file_name || 'Document'}</span>
                               <span className="text-[12px] opacity-70">{(msg.file_size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[15px] leading-relaxed break-words">{displayContent}</span>
                        )}

                        <div className="flex items-center justify-end mt-1 self-end opacity-60">
                          <span className="text-[10px] text-brand-charcoal font-medium select-none">{formatTime(msg.sent_at)}</span>
                        </div>
                      </motion.div>
                    </div>
                  );
                })}

                {/* Bouncing Typing Indicator */}
                {isTyping && (
                  <div className="flex flex-col items-start w-full group mt-1 mb-2">
                    <div className="bg-white/90 backdrop-blur-sm px-4 py-3.5 rounded-[20px] rounded-tl-sm shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-outline-variant/10 msg-tail-received relative w-fit">
                      <div className="flex items-center gap-1.5 h-3">
                        <div className="w-1.5 h-1.5 bg-brand-charcoal/40 rounded-full animate-bounce-dot"></div>
                        <div className="w-1.5 h-1.5 bg-brand-charcoal/40 rounded-full animate-bounce-dot animation-delay-200"></div>
                        <div className="w-1.5 h-1.5 bg-brand-charcoal/40 rounded-full animate-bounce-dot animation-delay-400"></div>
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
                   <div className="px-lg py-2 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-between animate-fade-in-down">
                     <div className="flex flex-col border-l-4 border-brand-teal pl-3">
                        <span className="text-brand-teal font-bold text-[13px]">{senderName}</span>
                        <span className="text-on-surface-variant text-[13px] truncate max-w-[250px] md:max-w-[400px]">{(originalMsg.content || '').replace(/^\[REPLY:[^\]]+\]/, '').substring(0,50) || 'Attachment'}</span>
                     </div>
                     <button onClick={() => setReplyToId(null)} className="p-1 text-on-surface-variant hover:text-error rounded-full transition-colors"><span className="material-symbols-outlined text-[18px]">close</span></button>
                   </div>
                 );
              })()}
              
              {/* Composer */}
              <footer className="px-md md:px-lg py-sm md:py-md bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/20 flex items-center gap-2 md:gap-3 relative z-30">
                
                <div className="relative">
                  <button type="button" onClick={() => setShowAttachMenu(!showAttachMenu)} className={`p-2 text-[#54656f] hover:bg-[#d1d7db] transition-colors rounded-full ${showAttachMenu ? 'bg-[#d1d7db]' : ''}`}>
                    <span className="material-symbols-outlined">add</span>
                  </button>
                  {showAttachMenu && (
                    <div className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-xl border border-outline-variant/20 p-2 flex flex-col gap-1 w-48 z-50 animate-fade-in-down">
                      <button type="button" onClick={() => { fileInputRef.current.accept = 'image/*,video/*'; fileInputRef.current.click(); }} className="flex items-center gap-3 p-3 hover:bg-surface-container rounded-xl text-left transition-colors text-brand-charcoal">
                        <span className="material-symbols-outlined text-[#007AFF]">photo_library</span> Photo & Video
                      </button>
                      <button type="button" onClick={() => { fileInputRef.current.accept = '*/*'; fileInputRef.current.click(); }} className="flex items-center gap-3 p-3 hover:bg-surface-container rounded-xl text-left transition-colors text-brand-charcoal">
                        <span className="material-symbols-outlined text-[#5856D6]">description</span> Document
                      </button>
                      <button type="button" onClick={() => { fileInputRef.current.accept = 'image/webp,image/png'; fileInputRef.current.click(); }} className="flex items-center gap-3 p-3 hover:bg-surface-container rounded-xl text-left transition-colors text-brand-charcoal">
                        <span className="material-symbols-outlined text-[#FF2D55]">sticky_note_2</span> Sticker
                      </button>
                      <button type="button" onClick={() => { fileInputRef.current.accept = 'audio/*'; fileInputRef.current.click(); }} className="flex items-center gap-3 p-3 hover:bg-surface-container rounded-xl text-left transition-colors text-brand-charcoal">
                        <span className="material-symbols-outlined text-[#FF9500]">headphones</span> Audio
                      </button>
                    </div>
                  )}
                  <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
                </div>
                <form onSubmit={handleSend} className="flex-1 flex items-center relative gap-2">
                  <div className="flex-1 bg-white border border-[#d1d7db] rounded-[24px] px-5 py-3.5 flex items-center gap-md shadow-sm transition-all">
                    {isRecording ? (
                      <div className="flex-1 flex items-center gap-3 animate-pulse text-[#FF3B30] font-medium">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                        Recording... {Math.floor(recordingTime/60)}:{(recordingTime%60).toString().padStart(2, '0')}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={messageInput}
                        onChange={handleTyping}
                        className="flex-1 border-none bg-transparent focus:ring-0 text-brand-charcoal font-body-md text-[15px] placeholder:text-[#8696a0] outline-none"
                        placeholder={uploadingFile ? 'Uploading...' : 'Type a message'}
                        disabled={uploadingFile}
                      />
                    )}
                  </div>
                  {messageInput.trim() || uploadingFile ? (
                    <button type="submit" disabled={uploadingFile} className="w-12 h-12 bg-[#00a884] text-white rounded-full flex items-center justify-center shadow-md hover:bg-[#008f6f] transition-colors flex-shrink-0 disabled:opacity-50">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                    </button>
                  ) : (
                    <button type="button" onClick={handleVoiceNote} className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-colors flex-shrink-0 ${isRecording ? 'bg-[#FF3B30] text-white hover:bg-[#d32f2f]' : 'bg-[#00a884] text-white hover:bg-[#008f6f]'}`}>
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{isRecording ? 'stop' : 'mic'}</span>
                    </button>
                  )}
                </form>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5]">
              <div className="text-center max-w-md p-8 bg-white/50 backdrop-blur-sm rounded-3xl shadow-sm border border-outline-variant/10">
                <span className="material-symbols-outlined text-[80px] text-brand-teal/40 mb-4 block">lock</span>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Echo for Web</h3>
                <p className="font-body-md text-[15px] text-on-surface-variant leading-relaxed">
                  Send and receive messages securely. Echo uses end-to-end encryption to keep your personal conversations private.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── NEW CHAT MODAL ── */}
      {showNewChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-charcoal/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <header className="p-lg border-b border-outline-variant/20 flex justify-between items-center">
              <h2 className="font-headline-md text-headline-md">New Conversation</h2>
              <button onClick={() => setShowNewChat(false)} className="p-sm hover:bg-surface-container rounded-full">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="p-lg">
              <form onSubmit={handleSearchUsers} className="flex gap-sm">
                <input 
                  type="text" 
                  value={newChatQuery}
                  onChange={(e) => setNewChatQuery(e.target.value)}
                  placeholder="Search by 5-digit Echo ID or name" 
                  className="flex-1 px-lg py-sm rounded-full bg-surface-container border border-outline-variant/30 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                />
                <button type="submit" className="px-lg py-sm bg-brand-teal text-white rounded-full shadow-sm hover:shadow-md transition-all">Search</button>
              </form>
              
              <div className="mt-lg space-y-sm max-h-60 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <p className="text-center text-on-surface-variant py-md font-body-sm text-body-sm">No users found. Try searching by ID.</p>
                ) : (
                  searchResults.map(res => (
                    <div key={res.id} className="flex items-center justify-between p-sm rounded-lg hover:bg-surface-container transition-colors">
                      <div className="flex items-center gap-md">
                        <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-primary font-bold overflow-hidden">
                          {res.avatar_url ? (
                            <img src={res.avatar_url} alt="DP" className="w-full h-full object-cover" />
                          ) : (
                            getInitials(res.display_name)
                          )}
                        </div>
                        <div>
                          <p className="font-label-md text-on-surface">{res.display_name}</p>
                          <p className="font-body-sm text-xs text-on-surface-variant">#{res.echo_id}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleCreateConversation(res.id)}
                        disabled={isCreating}
                        className="p-sm text-brand-teal hover:bg-brand-teal/10 rounded-full transition-colors disabled:opacity-50"
                      >
                        {isCreating ? (
                           <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                        ) : (
                           <span className="material-symbols-outlined">chat</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-charcoal/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <header className="p-lg border-b border-outline-variant/20 flex justify-between items-center">
              <h2 className="font-headline-md text-headline-md">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-sm hover:bg-surface-container rounded-full">
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>
            <div className="p-xl flex flex-col items-center">
              <div className="relative group cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-primary-container text-primary font-display-lg text-headline-lg flex items-center justify-center mb-md shadow-md overflow-hidden">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="DP" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(user?.display_name)
                  )}
                </div>
                <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded-full transition-opacity cursor-pointer">
                  <span className="material-symbols-outlined mb-1">photo_camera</span>
                  <span className="text-[10px] uppercase tracking-wider font-bold">Change</span>
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
              <h3 className="font-headline-md text-headline-md">{user?.display_name}</h3>
              <div className="mt-xs px-md py-1 bg-surface-container rounded-full flex items-center gap-xs">
                <span className="font-label-sm text-on-surface-variant">Your Echo ID:</span>
                <span className="font-label-md text-primary tracking-widest">{user?.echo_id}</span>
              </div>
              
              <div className="w-full mt-xl space-y-md">
                <div className="p-md bg-surface-container-low rounded-xl">
                  <p className="font-label-sm text-on-surface-variant mb-xs">Email Address</p>
                  <p className="font-body-md">{user?.email}</p>
                </div>
              </div>
              
              <button 
                onClick={() => clearAuth()}
                className="mt-xl w-full py-sm bg-error/10 text-error hover:bg-error/20 font-label-md rounded-full transition-colors flex justify-center items-center gap-xs"
              >
                <span className="material-symbols-outlined">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── BOTTOM NAV BAR (Mobile) ── */}
      {!activeConversationId && (
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface-container-highest/90 backdrop-blur-xl border-t border-outline-variant/30 flex justify-around items-center h-[72px] z-40 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
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
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${item.key === activeNav && !item.action ? 'text-brand-teal' : 'text-outline hover:text-on-surface'}`}
            >
              <div className={`px-4 py-1 rounded-full ${item.key === activeNav && !item.action ? 'bg-brand-teal/15' : 'bg-transparent'}`}>
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
