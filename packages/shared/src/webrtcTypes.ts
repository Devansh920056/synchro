/**
 * @synchro/shared — WebRTC & Timer Types
 *
 * Strongly typed payloads for P2P audio signaling and server-authoritative timers.
 */

export interface WebRTCSignalingPayload {
  roomId: string;
  targetSocketId: string;
  senderSocketId: string;
  /** SDP for offer/answer, or ICE candidate payload */
  data: any;
}

export interface TimerTickPayload {
  timeRemaining: number;
}
