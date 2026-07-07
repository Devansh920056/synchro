import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { SOCKET_EVENTS, WebRTCSignalingPayload, OperatorRole, GameStartedPayload } from "@synchro/shared";

// Simple STUN server configuration for NAT traversal
const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export interface AudioLevel {
  operatorRole: OperatorRole;
  isActive: boolean;
}

export function useWebRTCAudio(
  socket: Socket | null,
  gameData: GameStartedPayload | null,
  isActiveApp: boolean // e.g. appState === "active"
) {
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [activeSpeakers, setActiveSpeakers] = useState<Record<OperatorRole, boolean>>({
    operator_1: false,
    operator_2: false,
    operator_3: false,
  });

  useEffect(() => {
    if (!socket || !gameData || !isActiveApp) return;

    let isUnmounted = false;
    const roomId = gameData.session.roomId;
    const localRole = gameData.assignment.role;
    const teammates = gameData.crew.filter(c => c.role !== localRole);

    async function initLocalAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (isUnmounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        
        // Initiate connections to teammates
        teammates.forEach(teammate => {
          const pc = createPeerConnection(teammate.socketId, teammate.role);
          peersRef.current.set(teammate.socketId, pc);
          
          // Add our local audio track to the peer connection
          stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
          });
          
          // Create an offer. (In a full mesh, to avoid race conditions, usually a designated 'caller' initiates.
          // For simplicity, we can have both try, but WebRTC requires polite/impolite peers or a stable ordering.
          // We will use socketId string comparison to deterministically decide who creates the offer.)
          if (socket && socket.id && socket.id < teammate.socketId) {
            createAndSendOffer(pc, teammate.socketId);
          }
        });
      } catch (err) {
        console.warn("Microphone access denied or unavailable:", err);
      }
    }

    // Initialize
    initLocalAudio();

    // ─── Socket.IO Signaling Listeners ──────────────────────────────
    const onOffer = async (payload: WebRTCSignalingPayload) => {
      if (payload.targetSocketId !== socket.id) return;
      const pc = peersRef.current.get(payload.senderSocketId);
      if (!pc) return;
      
      await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit(SOCKET_EVENTS.WEBRTC_ANSWER, {
        roomId,
        targetSocketId: payload.senderSocketId,
        senderSocketId: socket.id,
        data: pc.localDescription
      });
    };

    const onAnswer = async (payload: WebRTCSignalingPayload) => {
      if (payload.targetSocketId !== socket.id) return;
      const pc = peersRef.current.get(payload.senderSocketId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
      }
    };

    const onIceCandidate = async (payload: WebRTCSignalingPayload) => {
      if (payload.targetSocketId !== socket.id) return;
      const pc = peersRef.current.get(payload.senderSocketId);
      if (pc && payload.data) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.data));
        } catch (e) {
          console.error("Error adding received ice candidate", e);
        }
      }
    };

    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);

    // ─── WebRTC Helper Functions ────────────────────────────────────
    function createPeerConnection(targetSocketId: string, role: OperatorRole): RTCPeerConnection {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket!.emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, {
            roomId,
            targetSocketId,
            senderSocketId: socket!.id,
            data: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        // Create an invisible audio element to play the remote stream
        const audioElement = document.createElement("audio");
        audioElement.srcObject = event.streams[0];
        audioElement.autoplay = true;
        // Optionally append to body to ensure it plays, though not strictly required in modern browsers
        document.body.appendChild(audioElement);
        
        // Cleanup when stream ends
        event.streams[0].onremovetrack = () => {
          audioElement.remove();
        };

        // Initialize AudioContext Analyser for voice activity
        setupVoiceActivityDetection(event.streams[0], role);
      };

      return pc;
    }

    async function createAndSendOffer(pc: RTCPeerConnection, targetSocketId: string) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket!.emit(SOCKET_EVENTS.WEBRTC_OFFER, {
        roomId,
        targetSocketId,
        senderSocketId: socket!.id,
        data: pc.localDescription
      });
    }

    function setupVoiceActivityDetection(stream: MediaStream, role: OperatorRole) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkAudioLevel = () => {
          if (isUnmounted) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          // Set active if volume is above a threshold
          setActiveSpeakers(prev => ({
            ...prev,
            [role]: average > 10
          }));
          requestAnimationFrame(checkAudioLevel);
        };
        checkAudioLevel();
      } catch (e) {
        console.error("Audio analyser failed:", e);
      }
    }

    return () => {
      isUnmounted = true;
      socket.off(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
      socket.off(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
      socket.off(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      // Remove any injected audio elements
      document.querySelectorAll('audio').forEach(a => a.remove());
    };
  }, [socket, gameData, isActiveApp]);

  return { activeSpeakers };
}
