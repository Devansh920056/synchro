/**
 * @synchro/backend — WebRTC Audio Signaling Handlers
 *
 * Direct relay for P2P signaling. The server does not inspect or manipulate
 * SDP or ICE data. It simply forwards it to the intended recipient to
 * establish a mesh network.
 */

import { Server, Socket } from "socket.io";
import { SOCKET_EVENTS, WebRTCSignalingPayload } from "@synchro/shared";

export function registerAudioSignalingHandlers(io: Server, socket: Socket) {
  // Relay an SDP Offer
  socket.on(SOCKET_EVENTS.WEBRTC_OFFER, (payload: WebRTCSignalingPayload) => {
    io.to(payload.targetSocketId).emit(SOCKET_EVENTS.WEBRTC_OFFER, payload);
  });

  // Relay an SDP Answer
  socket.on(SOCKET_EVENTS.WEBRTC_ANSWER, (payload: WebRTCSignalingPayload) => {
    io.to(payload.targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ANSWER, payload);
  });

  // Relay an ICE Candidate
  socket.on(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, (payload: WebRTCSignalingPayload) => {
    io.to(payload.targetSocketId).emit(SOCKET_EVENTS.WEBRTC_ICE_CANDIDATE, payload);
  });
}
