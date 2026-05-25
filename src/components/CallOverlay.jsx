import React, { useEffect, useRef } from 'react';

const CallOverlay = ({ callState, remoteUser, localStream, remoteStream, acceptCall, rejectCall, endCall, callType, isAudioEnabled, isVideoEnabled, toggleAudio, toggleVideo }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callState === 'idle') return null;

  return (
    <div className={`fixed inset-0 z-[100] transition-all duration-500 ease-out flex items-center justify-center ${
      callState !== 'idle' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
    }`}>
      {/* Background Glass */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl transition-opacity duration-500" />
      
      {/* Main Container */}
      <div className={`relative w-full max-w-sm h-full max-h-[85vh] md:max-h-[700px] md:h-[85vh] bg-surface-container-highest/20 md:rounded-[40px] shadow-2xl border border-white/10 overflow-hidden flex flex-col items-center justify-between transition-transform duration-500 ease-out ${
        callState !== 'idle' ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'
      }`}>
        
        {/* Remote Video Background (if connected and video) */}
        {callState === 'connected' && callType === 'video' && remoteStream && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}

        {/* Top Info Section */}
        <div className="relative z-20 flex flex-col items-center pt-16 w-full px-6">
          {!(callState === 'connected' && callType === 'video') && (
            <div className="flex flex-col items-center animate-fade-in-down">
              <div className="relative mb-6">
                {remoteUser?.avatar_url ? (
                  <img src={remoteUser.avatar_url} alt="Caller" className="w-28 h-28 rounded-full object-cover shadow-2xl border-4 border-white/20" />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-brand-teal/20 backdrop-blur-md flex items-center justify-center text-brand-teal mb-sm shadow-2xl border-4 border-white/20">
                     <span className="material-symbols-outlined text-[48px]">{callType === 'video' ? 'videocam' : 'call'}</span>
                  </div>
                )}
                {/* Ripples for ringing */}
                {callState === 'ringing' && (
                  <>
                    <div className="absolute inset-0 rounded-full border border-brand-teal/50 animate-ping opacity-75" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-0 rounded-full border border-brand-teal/30 animate-ping opacity-50" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                  </>
                )}
              </div>
              
              <h2 className="text-white text-display-sm font-display-sm mb-1 text-center drop-shadow-md">
                {remoteUser?.display_name || 'Unknown'}
              </h2>
              <p className="text-white/70 font-body-lg text-[17px] font-medium tracking-wide uppercase">
                {callState === 'ringing' ? `${callType} Calling...` : callState === 'incoming' ? `Incoming ${callType} Call` : `Echo ${callType === 'video' ? 'Video' : 'Audio'}`}
              </p>
            </div>
          )}
        </div>

        {/* Local PIP Video */}
        {(localStream && callState === 'connected' && callType === 'video') && (
          <div className="absolute top-6 right-6 w-28 h-40 bg-black/50 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-30 animate-fade-in">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Bottom Controls */}
        <div className="relative z-20 w-full px-8 pb-16 flex justify-around items-end">
          {callState === 'incoming' ? (
            <>
              {/* Decline */}
              <button 
                onClick={rejectCall}
                className="w-20 h-20 rounded-full bg-[#FF3B30] text-white shadow-[0_0_20px_rgba(255,59,48,0.4)] flex flex-col items-center justify-center gap-1 transition-transform hover:scale-105 active:scale-95"
              >
                <span className="material-symbols-outlined text-[32px]">call_end</span>
              </button>
              
              {/* Accept */}
              <button 
                onClick={acceptCall}
                className="w-20 h-20 rounded-full bg-[#34C759] text-white shadow-[0_0_20px_rgba(52,199,89,0.4)] flex flex-col items-center justify-center gap-1 transition-transform hover:scale-105 active:scale-95 animate-bounce-subtle"
              >
                <span className="material-symbols-outlined text-[32px]">{callType === 'video' ? 'videocam' : 'call'}</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-6 animate-fade-in-up">
              {/* Audio Toggle */}
              <button 
                onClick={toggleAudio}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${isAudioEnabled ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md' : 'bg-white text-brand-charcoal hover:bg-gray-100'}`}
              >
                <span className="material-symbols-outlined text-[28px]">{isAudioEnabled ? 'mic' : 'mic_off'}</span>
              </button>

              {/* End Call */}
              <button 
                onClick={endCall}
                className="w-20 h-20 rounded-full bg-[#FF3B30] text-white shadow-[0_0_30px_rgba(255,59,48,0.5)] flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
              >
                <span className="material-symbols-outlined text-[36px]">call_end</span> 
              </button>
              
              {/* Video Toggle (only for video calls) */}
              <button 
                onClick={toggleVideo}
                disabled={callType !== 'video'}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${callType !== 'video' ? 'opacity-50 cursor-not-allowed bg-black/20 text-white/50' : isVideoEnabled ? 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-md' : 'bg-white text-brand-charcoal hover:bg-gray-100'}`}
              >
                <span className="material-symbols-outlined text-[28px]">{isVideoEnabled ? 'videocam' : 'videocam_off'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
