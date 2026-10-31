"use client";

/**
 * useWebRTCAudio — peer-to-peer voice chat between the three players.
 *
 * - The player with the "smaller" socket ID sends the offer, so both sides
 *   never offer at once.
 * - Offers and ICE candidates that arrive early are held until the
 *   microphone question is settled, so no connection is silently dropped.
 * - Voice activity is checked on a light timer, and React state only changes
 *   when someone starts or stops talking.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  SOCKET_EVENTS,
  type GameStartedPayload,
  type OperatorRole,
  type WebRTCSignalingPayload,
} from "@synchro/shared";

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/** Average volume (0-255) above which we treat someone as speaking */
const SPEAKING_THRESHOLD = 12;
const VOICE_POLL_MS = 120;
const OFFER_RETRY_MS = 4000;
const MAX_OFFER_RETRIES = 3;

export type MicStatus = "pending" | "on" | "blocked";

type SpeakerMap = Record<OperatorRole, boolean>;
const NOBODY_SPEAKING: SpeakerMap = {
  operator_1: false,
  operator_2: false,
  operator_3: false,
};

interface Peer {
  pc: RTCPeerConnection;
  queuedCandidates: RTCIceCandidateInit[];
  retryTimer?: ReturnType<typeof setTimeout>;
}

interface Meter {
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
}

export function useWebRTCAudio(
  socket: Socket | null,
  gameData: GameStartedPayload | null,
  enabled: boolean
) {
  const [activeSpeakers, setActiveSpeakers] = useState<SpeakerMap>(NOBODY_SPEAKING);
  const [micStatus, setMicStatus] = useState<MicStatus>("pending");
  const [isMuted, setIsMuted] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(false);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setIsMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  }, []);

  useEffect(() => {
    if (!socket || !gameData || !enabled) return;

    const roomId = gameData.session.roomId;
    const localRole = gameData.assignment.role;
    const mySocketId = socket.id;
    const roleBySocket = new Map(gameData.crew.map((c) => [c.socketId, c.role]));
    const teammateIds = gameData.crew.filter((c) => c.role !== localRole).map((c) => c.socketId);

    const peers = new Map<string, Peer>();
    const meters = new Map<OperatorRole, Meter>();
    const audioElements: HTMLAudioElement[] = [];
    let audioContext: AudioContext | null = null;
    let localStream: MediaStream | null = null;
    let stopped = false;

    // ── Helpers ────────────────────────────────────────────────────
    const signal = (event: string, targetSocketId: string, data: unknown) => {
      const payload: WebRTCSignalingPayload = {
        roomId,
        targetSocketId,
        senderSocketId: socket.id ?? "",
        data,
      };
      socket.emit(event, payload);
    };

    const addMeter = (stream: MediaStream, role: OperatorRole) => {
      try {
        audioContext ??= new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        audioContext.createMediaStreamSource(stream).connect(analyser);
        meters.set(role, { analyser, data: new Uint8Array(analyser.frequencyBinCount) });
      } catch (err) {
        console.warn("[AUDIO] Voice indicator unavailable:", err);
      }
    };

    const getPeer = (remoteSocketId: string): Peer => {
      const existing = peers.get(remoteSocketId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      const peer: Peer = { pc, queuedCandidates: [] };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          signal(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, remoteSocketId, event.candidate.toJSON());
        }
      };

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        void audio.play().catch(() => undefined);
        audioElements.push(audio);

        const role = roleBySocket.get(remoteSocketId);
        if (role) addMeter(stream, role);
      };

      localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream!));
      peers.set(remoteSocketId, peer);
      return peer;
    };

    const flushCandidates = async (peer: Peer) => {
      const queued = peer.queuedCandidates.splice(0);
      for (const candidate of queued) {
        try {
          await peer.pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn("[AUDIO] Bad ICE candidate:", err);
        }
      }
    };

    const sendOffer = async (remoteSocketId: string, attempt = 0) => {
      if (stopped) return;
      try {
        const peer = getPeer(remoteSocketId);
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        signal(SOCKET_EVENTS.WEBRTC_OFFER, remoteSocketId, peer.pc.localDescription);

        // If the other side wasn't listening yet, try again a few times
        peer.retryTimer = setTimeout(() => {
          if (!stopped && peer.pc.signalingState === "have-local-offer" && attempt < MAX_OFFER_RETRIES) {
            void sendOffer(remoteSocketId, attempt + 1);
          }
        }, OFFER_RETRY_MS);
      } catch (err) {
        console.warn("[AUDIO] Could not send offer:", err);
      }
    };

    // ── Microphone ─────────────────────────────────────────────────
    const ready = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !mutedRef.current;
        });
        localStream = stream;
        localStreamRef.current = stream;
        addMeter(stream, localRole);
        setMicStatus("on");
      } catch (err) {
        console.warn("[AUDIO] Microphone unavailable:", err);
        if (!stopped) setMicStatus("blocked");
      }
      if (stopped) return;

      // Even without a mic we can still listen to teammates
      for (const id of teammateIds) {
        getPeer(id);
        if (mySocketId && mySocketId < id) void sendOffer(id);
      }
    })();

    // ── Signaling listeners ────────────────────────────────────────
    const isForMe = (p: WebRTCSignalingPayload) =>
      p.targetSocketId === socket.id && roleBySocket.has(p.senderSocketId);

    const onOffer = async (p: WebRTCSignalingPayload) => {
      if (!isForMe(p)) return;
      await ready;
      if (stopped) return;
      try {
        const peer = getPeer(p.senderSocketId);
        await peer.pc.setRemoteDescription(p.data as RTCSessionDescriptionInit);
        await flushCandidates(peer);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        signal(SOCKET_EVENTS.WEBRTC_ANSWER, p.senderSocketId, peer.pc.localDescription);
      } catch (err) {
        console.warn("[AUDIO] Could not answer offer:", err);
      }
    };

    const onAnswer = async (p: WebRTCSignalingPayload) => {
      if (!isForMe(p)) return;
      const peer = peers.get(p.senderSocketId);
      if (!peer || peer.pc.signalingState !== "have-local-offer") return;
      try {
        clearTimeout(peer.retryTimer);
        await peer.pc.setRemoteDescription(p.data as RTCSessionDescriptionInit);
        await flushCandidates(peer);
      } catch (err) {
        console.warn("[AUDIO] Could not apply answer:", err);
      }
    };

    const onIceCandidate = async (p: WebRTCSignalingPayload) => {
      if (!isForMe(p) || !p.data) return;
      await ready;
      if (stopped) return;
      const peer = getPeer(p.senderSocketId);
      const candidate = p.data as RTCIceCandidateInit;
      if (peer.pc.remoteDescription) {
        try {
          await peer.pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn("[AUDIO] Bad ICE candidate:", err);
        }
      } else {
        peer.queuedCandidates.push(candidate);
      }
    };

    socket.on(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
    socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
    socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);

    // ── Voice activity ─────────────────────────────────────────────
    const poll = setInterval(() => {
      const next: SpeakerMap = { ...NOBODY_SPEAKING };
      meters.forEach(({ analyser, data }, role) => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        next[role] = sum / data.length > SPEAKING_THRESHOLD;
      });
      setActiveSpeakers((prev) =>
        prev.operator_1 === next.operator_1 &&
        prev.operator_2 === next.operator_2 &&
        prev.operator_3 === next.operator_3
          ? prev
          : next
      );
    }, VOICE_POLL_MS);

    // ── Cleanup ────────────────────────────────────────────────────
    return () => {
      stopped = true;
      clearInterval(poll);
      socket.off(SOCKET_EVENTS.WEBRTC_OFFER, onOffer);
      socket.off(SOCKET_EVENTS.WEBRTC_ANSWER, onAnswer);
      socket.off(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, onIceCandidate);

      peers.forEach((peer) => {
        clearTimeout(peer.retryTimer);
        peer.pc.close();
      });
      peers.clear();

      localStream?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;

      audioElements.forEach((a) => {
        a.pause();
        a.srcObject = null;
      });
      void audioContext?.close();
    };
  }, [socket, gameData, enabled]);

  return { activeSpeakers, micStatus, isMuted, toggleMute };
}
