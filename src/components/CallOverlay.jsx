import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CallOverlay = ({ callState, remoteUser, localStream, remoteStream, acceptCall, rejectCall, endCall, callType, isAudioEnabled, isVideoEnabled, toggleAudio, toggleVideo }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const containerRef = useRef(null);
  
  const [showControls, setShowControls] = useState(true);

  // Hide controls after 3 seconds of inactivity in connected video call
  useEffect(() => {
    let timeout;
    if (callState === 'connected' && callType === 'video') {
      const resetTimer = () => {
        setShowControls(true);
        clearTimeout(timeout);
        timeout = setTimeout(() => setShowControls(false), 3000);
      };
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('touchstart', resetTimer);
      timeout = setTimeout(() => setShowControls(false), 3000);
      return () => {
        window.removeEventListener('mousemove', resetTimer);
        window.removeEventListener('touchstart', resetTimer);
        clearTimeout(timeout);
      };
    } else {
      setShowControls(true);
    }
  }, [callState, callType]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      if (callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      // Always attach to audio ref to ensure voice comes through even in video mode (though video tag also plays audio)
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, callType, callState]);

  if (callState === 'idle') return null;

  const isVideo = callType === 'video';

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[100] bg-brand-charcoal overflow-hidden flex items-center justify-center font-body-md"
        ref={containerRef}
      >
        {/* Remote Audio Track (Crucial for Audio Calls) */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Remote Video Background */}
        {callState === 'connected' && isVideo && remoteStream && (
          <motion.video
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}

        {/* Blurred Background for Audio / Incoming Calls */}
        {!(callState === 'connected' && isVideo) && (
          <>
            {remoteUser?.avatar_url ? (
              <div 
                className="absolute inset-0 bg-cover bg-center bg-no-repeat blur-3xl opacity-30 scale-110" 
                style={{ backgroundImage: `url(${remoteUser.avatar_url})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand-teal/20 to-brand-charcoal opacity-50" />
            )}
            <div className="absolute inset-0 bg-black/40" />
          </>
        )}

        {/* Top Info / Ringing State */}
        <AnimatePresence>
          {!(callState === 'connected' && isVideo) && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className="relative z-20 flex flex-col items-center pt-24 w-full px-6 text-white"
            >
              <div className="relative mb-8">
                {remoteUser?.avatar_url ? (
                  <img src={remoteUser.avatar_url} alt="Caller" className="w-32 h-32 rounded-full object-cover shadow-2xl border-4 border-white/10" />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-brand-teal/30 backdrop-blur-md flex items-center justify-center text-brand-teal mb-sm shadow-2xl border-4 border-white/10">
                     <span className="material-symbols-outlined text-[64px]">{isVideo ? 'videocam' : 'call'}</span>
                  </div>
                )}
                {/* Ripples */}
                {callState === 'ringing' && (
                  <>
                    <div className="absolute inset-0 rounded-full border-[3px] border-brand-teal/50 animate-ping opacity-75" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-0 rounded-full border-[3px] border-brand-teal/30 animate-ping opacity-50" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                  </>
                )}
              </div>
              
              <h2 className="text-display-md font-display-md font-bold mb-2 tracking-tight drop-shadow-lg text-center">
                {remoteUser?.display_name || 'Unknown'}
              </h2>
              <p className="text-white/70 font-body-lg text-[18px] uppercase tracking-widest font-medium">
                {callState === 'ringing' ? `Calling...` : callState === 'incoming' ? `Incoming ${callType} Call` : `Echo ${isVideo ? 'Video' : 'Audio'}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Local PIP Video (Draggable) */}
        <AnimatePresence>
          {(localStream && callState === 'connected' && isVideo) && (
            <motion.div
              drag
              dragConstraints={containerRef}
              dragElastic={0.1}
              dragMomentum={false}
              initial={{ scale: 0, opacity: 0, x: 20, y: 20 }}
              animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
              className="absolute bottom-32 right-6 w-32 h-48 md:w-40 md:h-60 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-30 cursor-grab"
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted // Always mute local video
                className={`w-full h-full object-cover ${!isVideoEnabled ? 'opacity-0' : 'opacity-100'}`}
              />
              {!isVideoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <span className="material-symbols-outlined text-white/50 text-4xl">videocam_off</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Controls */}
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: showControls ? 0 : 100, opacity: showControls ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-0 inset-x-0 z-40 pb-12 pt-24 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-6 md:gap-8 px-8 py-4 rounded-[40px] bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl">
            {callState === 'incoming' ? (
              <>
                <button 
                  onClick={rejectCall}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#FF3B30] text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,59,48,0.3)] hover:shadow-[0_0_40px_rgba(255,59,48,0.5)]"
                >
                  <span className="material-symbols-outlined text-[32px] md:text-[36px]">call_end</span>
                </button>
                
                <button 
                  onClick={acceptCall}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#34C759] text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(52,199,89,0.3)] hover:shadow-[0_0_40px_rgba(52,199,89,0.5)] animate-bounce-subtle"
                >
                  <span className="material-symbols-outlined text-[32px] md:text-[36px]">{isVideo ? 'videocam' : 'call'}</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={toggleAudio}
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all ${isAudioEnabled ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white text-brand-charcoal'}`}
                >
                  <span className="material-symbols-outlined text-[24px] md:text-[28px]">{isAudioEnabled ? 'mic' : 'mic_off'}</span>
                </button>

                <button 
                  onClick={endCall}
                  className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#FF3B30] text-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,59,48,0.3)]"
                >
                  <span className="material-symbols-outlined text-[32px] md:text-[40px]">call_end</span> 
                </button>
                
                <button 
                  onClick={toggleVideo}
                  disabled={!isVideo}
                  className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all ${!isVideo ? 'opacity-30 cursor-not-allowed bg-white/10 text-white' : isVideoEnabled ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white text-brand-charcoal'}`}
                >
                  <span className="material-symbols-outlined text-[24px] md:text-[28px]">{isVideoEnabled ? 'videocam' : 'videocam_off'}</span>
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallOverlay;
