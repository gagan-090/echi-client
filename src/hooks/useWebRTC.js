import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';

export const useWebRTC = (socketInstance) => {
  const user = useAuthStore(state => state.user);
  const logCall = useCallStore(state => state.logCall);
  
  const [callState, setCallState] = useState('idle'); // idle, ringing, incoming, connected
  const [remoteUser, setRemoteUser] = useState(null);
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Call tracking refs
  const callStartTimeRef = useRef(null);
  const isCallerRef = useRef(false);

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const initLocalStream = async (type) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true
      });
      localStreamRef.current = stream;
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
    callStartTimeRef.current = null;
    isCallerRef.current = false;
    setCallState('idle');
    setRemoteUser(null);
  };

  useEffect(() => {
    if (!socketInstance) return;

    const handleSignal = async ({ senderId, signalData, type, conversationId }) => {
      if (type === 'offer') {
        const incomingMediaType = signalData.mediaType || 'video';
        setRemoteUser({ 
          id: senderId, 
          convId: conversationId,
          display_name: signalData.callerInfo?.display_name || 'Unknown',
          avatar_url: signalData.callerInfo?.avatar_url || null
        });
        setCallType(incomingMediaType);
        setCallState('incoming');
        isCallerRef.current = false;
        
        const pc = createPeerConnection(senderId, incomingMediaType, conversationId);
        await pc.setRemoteDescription(new RTCSessionDescription({ type: signalData.type, sdp: signalData.sdp }));
      } 
      else if (type === 'answer') {
        const pc = peerConnectionRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData));
          setCallState('connected');
          callStartTimeRef.current = Date.now();
        }
      } 
      else if (type === 'ice-candidate') {
        const pc = peerConnectionRef.current;
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData));
        }
      } 
      else if (type === 'rejected') {
        handleCallEnd('rejected', true);
      }
      else if (type === 'ended') {
        handleCallEnd('completed', false); // The caller logs it, receiver just closes
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
    localStream: localStreamRef.current,
    remoteStream: remoteStreamRef.current,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    callType
  };
};
