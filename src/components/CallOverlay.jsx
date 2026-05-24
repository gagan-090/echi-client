import React, { useEffect, useRef } from 'react';

const CallOverlay = ({ callState, remoteUser, localStream, remoteStream, acceptCall, rejectCall, endCall, callType }) => {
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
    <div className={`fixed z-[100] transition-all duration-300 shadow-2xl overflow-hidden ${
      callState === 'connected' && callType === 'video'
        ? 'top-20 right-8 w-80 h-[400px] rounded-3xl bg-black border-2 border-outline-variant/30'
        : 'top-8 right-8 w-80 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 p-lg flex flex-col items-center gap-md backdrop-blur-md'
    }`}>
      {/* Background / Caller Info (when not connected in video) */}
      {!(callState === 'connected' && callType === 'video') && (
        <div className="text-center w-full flex flex-col items-center">
          {remoteUser?.avatar_url ? (
            <img src={remoteUser.avatar_url} alt="Caller" className="w-20 h-20 rounded-full object-cover mb-sm shadow-md border-2 border-brand-teal/30" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal animate-pulse mb-sm">
               <span className="material-symbols-outlined text-[32px]">{callType === 'video' ? 'videocam' : 'call'}</span>
            </div>
          )}
          <h2 className="text-on-surface text-headline-md font-headline-md mb-1 capitalize">
            {callState === 'ringing' ? `Calling...` : callState === 'incoming' ? `Incoming Call` : `Call in Progress`}
          </h2>
          <p className="text-on-surface-variant font-body-lg text-[15px] font-medium">{remoteUser?.display_name || 'Unknown'}</p>
        </div>
      )}

      {/* Video Streams */}
      <div className={`relative w-full h-full flex items-center justify-center ${callState === 'connected' && callType === 'video' ? '' : 'hidden'}`}>
        {callState === 'connected' && remoteStream && callType === 'video' && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}
        
        {/* PIP Local Video */}
        {(localStream && callState === 'connected' && callType === 'video') && (
          <div className="absolute bottom-4 right-4 w-20 h-28 bg-black rounded-xl overflow-hidden shadow-xl border-2 border-surface-container-low/30 z-10">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className={`flex justify-center items-center gap-md w-full ${callState === 'connected' && callType === 'video' ? 'absolute bottom-4 left-0 right-0 z-20' : 'mt-2'}`}>
        {callState === 'incoming' && (
          <button 
            onClick={acceptCall}
            className="flex-1 py-sm rounded-full bg-brand-teal text-white shadow-md hover:shadow-lg transition-all font-label-md flex justify-center items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">call</span> Accept
          </button>
        )}
        
        <button 
          onClick={callState === 'incoming' ? rejectCall : endCall}
          className={`py-sm rounded-full bg-error text-white shadow-md hover:shadow-lg transition-all font-label-md flex justify-center items-center gap-2 ${callState === 'incoming' ? 'flex-1 bg-error/10 text-error shadow-none hover:bg-error/20' : callState === 'connected' && callType === 'video' ? 'w-12 h-12 rounded-full !p-0 shadow-[0_0_15px_rgba(255,84,73,0.4)]' : 'flex-1'}`}
        >
          <span className="material-symbols-outlined text-[20px]">call_end</span> 
          {!(callState === 'connected' && callType === 'video') && (callState === 'incoming' ? 'Decline' : 'End Call')}
        </button>
      </div>
    </div>
  );
};

export default CallOverlay;
