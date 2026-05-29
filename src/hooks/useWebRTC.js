import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';

export const useWebRTC = (socketInstance) => {
  const user = useAuthStore(state => state.user);
  const logCall = useCallStore(state => state.logCall);
  
  const [callState, setCallState] = useState('idle'); // idle, ringing, incoming, connected
  const [remoteUser, setRemoteUser] = useState(null);
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const [localStreamState, setLocalStreamState] = useState(null);
  const [remoteStreamState, setRemoteStreamState] = useState(null);

  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Call tracking refs
  const callStartTimeRef = useRef(null);
  const isCallerRef = useRef(false);
  const pendingCandidates = useRef({}); // { [peerId]: RTCIceCandidate[] }
  const isRemoteDescriptionSet = useRef(false);

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

    const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const initLocalStream = async (type) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      localStreamRef.current = stream;
      setLocalStreamState(stream);
      return stream;
    } catch (err) {
      console.error('Failed to get local stream', err);
      return null;
    }
  };

  const stopLocalStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStreamState(null);
    }
  };

  const createPeerConnection = (receiverId, type, convId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0];
      setRemoteStreamState(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketInstance) {
        socketInstance.emit('webrtc_signal', {
          receiverId,
          type: 'ice-candidate',
          signalData: event.candidate,
          conversationId: convId
        });
      }
    };

    return pc;
  };

  const initiateCall = async (receiver, type, convId) => {
    const stream = await initLocalStream(type);
    if (!stream) return;

    setRemoteUser({ ...receiver, convId });
    setCallType(type);
    setCallState('ringing');
    isCallerRef.current = true;

    const pc = createPeerConnection(receiver.id, type, convId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketInstance.emit('webrtc_signal', {
      receiverId: receiver.id,
      type: 'offer',
      signalData: { 
        sdp: offer.sdp, 
        type: offer.type, 
        mediaType: type,
        callerInfo: {
          display_name: user?.display_name,
          avatar_url: user?.avatar_url
        }
      },
      conversationId: convId
    });
  };

  const acceptCall = async () => {
    if (!remoteUser) return;
    const stream = await initLocalStream(callType);
    if (!stream) return;

    const pc = peerConnectionRef.current;
    if (localStreamRef.current && pc) {
       localStreamRef.current.getTracks().forEach(track => {
         pc.addTrack(track, localStreamRef.current);
       });
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    socketInstance.emit('webrtc_signal', {
      receiverId: remoteUser.id,
      type: 'answer',
      signalData: answer,
      conversationId: remoteUser.convId
    });

    setCallState('connected');
    callStartTimeRef.current = Date.now();
  };

  const rejectCall = () => {
    if (remoteUser && socketInstance) {
      socketInstance.emit('webrtc_signal', {
        receiverId: remoteUser.id,
        type: 'rejected',
        conversationId: remoteUser.convId
      });
    }
    handleCallEnd('rejected', false);
  };

  const endCall = () => {
    if (remoteUser && socketInstance && callState === 'connected') {
      socketInstance.emit('webrtc_signal', {
        receiverId: remoteUser.id,
        type: 'ended',
        conversationId: remoteUser.convId
      });
      handleCallEnd('completed', true);
    } else {
      // Caller hung up before answer
      if (isCallerRef.current) {
        socketInstance.emit('webrtc_signal', {
          receiverId: remoteUser?.id,
          type: 'ended_early',
          conversationId: remoteUser?.convId
        });
        handleCallEnd('missed', true);
      } else {
        handleCallEnd('completed', false);
      }
    }
  };

  const handleCallEnd = (status, shouldLog = false) => {
    if (shouldLog && remoteUser && isCallerRef.current) {
      let durationSeconds = 0;
      if (status === 'completed' && callStartTimeRef.current) {
        durationSeconds = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      }
      logCall({
        conversationId: remoteUser.convId,
        callType,
        status,
        durationSeconds
      });
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    stopLocalStream();
    remoteStreamRef.current = null;
    setRemoteStreamState(null);
    callStartTimeRef.current = null;
    isCallerRef.current = false;
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    isRemoteDescriptionSet.current = false;
    pendingCandidates.current = {};
    setCallState('idle');
    setRemoteUser(null);
  };

  useEffect(() => {
    if (!socketInstance) return;

    const handleSignal = async ({ senderId, signalData, type, conversationId }) => {
      if (type === 'offer') {
        const incomingMediaType = signalData.mediaType || 'video';
        
        // Ensure callerInfo fallback works even if it's stringified differently
        let dName = 'Unknown';
        let aUrl = null;
        if (signalData.callerInfo) {
           dName = signalData.callerInfo.display_name || 'Unknown';
           aUrl = signalData.callerInfo.avatar_url || null;
        }

        setRemoteUser({ 
          id: senderId, 
          convId: conversationId,
          display_name: dName,
          avatar_url: aUrl
        });
        setCallType(incomingMediaType);
        setCallState('incoming');
        isCallerRef.current = false;
        
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
           new Notification(`Incoming ${incomingMediaType} call`, { body: `from ${dName}` });
        }
        
        const pc = createPeerConnection(senderId, incomingMediaType, conversationId);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: signalData.type, sdp: signalData.sdp }));
          isRemoteDescriptionSet.current = true;
          // Apply pending candidates
          if (pendingCandidates.current[senderId]) {
            for (const c of pendingCandidates.current[senderId]) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidates.current[senderId] = [];
          }
        } catch (err) {
          console.error("Failed to set remote offer", err);
        }
      } 
      else if (type === 'answer') {
        const pc = peerConnectionRef.current;
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signalData));
            isRemoteDescriptionSet.current = true;
            setCallState('connected');
            callStartTimeRef.current = Date.now();
            
            // Apply pending candidates
            if (pendingCandidates.current[senderId]) {
              for (const c of pendingCandidates.current[senderId]) {
                await pc.addIceCandidate(new RTCIceCandidate(c));
              }
              pendingCandidates.current[senderId] = [];
            }
          } catch (err) {
            console.error("Failed to set remote answer", err);
          }
        }
      } 
      else if (type === 'ice-candidate') {
        const pc = peerConnectionRef.current;
        if (pc) {
          if (isRemoteDescriptionSet.current) {
             try {
               await pc.addIceCandidate(new RTCIceCandidate(signalData));
             } catch (err) {
               console.error("Error adding ice candidate", err);
             }
          } else {
             if (!pendingCandidates.current[senderId]) pendingCandidates.current[senderId] = [];
             pendingCandidates.current[senderId].push(signalData);
          }
        }
      } 
      else if (type === 'rejected') {
        handleCallEnd('rejected', true);
      }
      else if (type === 'ended') {
        handleCallEnd('completed', false);
      }
      else if (type === 'ended_early') {
        handleCallEnd('missed', false);
      }
    };

    socketInstance.on('webrtc_signal', handleSignal);
    return () => {
      socketInstance.off('webrtc_signal', handleSignal);
    };
  }, [socketInstance, callType]);

  return {
    callState,
    remoteUser,
    localStream: localStreamState,
    remoteStream: remoteStreamState,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    callType,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo
  };
};
