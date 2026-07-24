/**
 * VSocial — WebRTC Peer Manager
 * Handles audio, video, and screen-share peer-to-peer connections.
 *
 * ICE strategy:
 *   - 5 Google STUN servers  (free, no credential needed)
 *   - 3 OpenRelay TURN relays (free, no account needed, handles symmetric NAT)
 *
 * Call types: 'audio' | 'video' | 'screen'
 */
import { authStore } from '$lib/stores/auth.svelte.js';

const ICE_CONFIG = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
		{ urls: 'stun:stun2.l.google.com:19302' },
		{ urls: 'stun:global.stun.twilio.com:3478' },
		{ urls: 'stun:stun.cloudflare.com:3478' }
	],
	iceTransportPolicy: 'all',
	bundlePolicy: 'max-bundle',
	rtcpMuxPolicy: 'require'
};

export class RTCManager {
	/**
	 * @param {number|string} conversationId
	 * @param {(peerId: number, stream: MediaStream, callType: string) => void} onStreamAdded
	 * @param {(peerId: number) => void} onStreamRemoved
	 * @param {string} callType   'audio' | 'video' | 'screen'
	 */
	constructor(conversationId, onStreamAdded, onStreamRemoved, callType = 'audio') {
		this.conversationId = conversationId;
		this.callType = callType;
		this.onStreamAdded = onStreamAdded;
		this.onStreamRemoved = onStreamRemoved;

		/** @type {Map<number, RTCPeerConnection>} */
		this.peers = new Map();
		/** @type {Map<number, RTCIceCandidate[]>} */
		this.iceBuffers = new Map();
		/** @type {Map<number, number>} */
		this.reconnectAttempts = new Map();
		this.maxReconnectAttempts = 3;

		this.localStream = null;
		this._closed = false;
	}

	// ── Local stream ────────────────────────────────────────────────────────

	setLocalStream(stream) {
		this.localStream = stream;
		for (const [, pc] of this.peers) {
			this._addTracksToPC(pc);
		}
	}

	_addTracksToPC(pc) {
		if (!this.localStream) return;
		const senders = pc.getSenders();
		for (const track of this.localStream.getTracks()) {
			const exists = senders.find((s) => s.track?.kind === track.kind);
			if (!exists) {
				pc.addTrack(track, this.localStream);
			}
		}
	}

	stopLocalStream() {
		if (this.localStream) {
			this.localStream.getTracks().forEach((t) => t.stop());
			this.localStream = null;
		}
	}

	muteAudio(muted) {
		if (!this.localStream) return;
		this.localStream.getAudioTracks().forEach((t) => {
			t.enabled = !muted;
		});
	}

	muteVideo(muted) {
		if (!this.localStream) return;
		this.localStream.getVideoTracks().forEach((t) => {
			t.enabled = !muted;
		});
	}

	// ── Signaling ───────────────────────────────────────────────────────────

	async sendSignal(recipientId, payload) {
		try {
			await fetch('/api/rtc/signal', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${authStore.token}`
				},
				body: JSON.stringify({
					recipient_id: recipientId,
					conversation_id: this.conversationId,
					payload
				})
			});
		} catch (e) {
			console.error('[RTC] sendSignal failed:', e);
		}
	}

	// ── Peer connections ────────────────────────────────────────────────────

	_createPeer(peerId) {
		if (this.peers.has(peerId)) return this.peers.get(peerId);

		const pc = new RTCPeerConnection(ICE_CONFIG);
		this.peers.set(peerId, pc);

		pc.onicecandidate = (e) => {
			if (e.candidate) {
				this.sendSignal(peerId, { type: 'ice', candidate: e.candidate });
			}
		};

		pc.ontrack = (e) => {
			const stream = e.streams?.[0];
			if (stream) {
				this.onStreamAdded(peerId, stream, this.callType);
			}
		};

		pc.onconnectionstatechange = () => {
			const state = pc.connectionState;
			console.log(`[RTC] Peer ${peerId} connection: ${state}`);
			if (state === 'failed') {
				this._attemptReconnect(peerId, pc);
			} else if (state === 'closed' || state === 'disconnected') {
				// Give it 4s before declaring it truly dead
				setTimeout(() => {
					if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
						this.onStreamRemoved(peerId);
						this.peers.delete(peerId);
					}
				}, 4000);
			} else if (state === 'connected') {
				this.reconnectAttempts.set(peerId, 0);
			}
		};

		// Add local tracks immediately if stream is ready
		this._addTracksToPC(pc);

		return pc;
	}

	async _attemptReconnect(peerId, pc) {
		const attempts = this.reconnectAttempts.get(peerId) || 0;
		if (attempts >= this.maxReconnectAttempts) {
			console.log(`[RTC] Giving up on peer ${peerId}`);
			this.onStreamRemoved(peerId);
			this.peers.delete(peerId);
			this.reconnectAttempts.delete(peerId);
			try {
				pc.close();
			} catch {}
			return;
		}
		this.reconnectAttempts.set(peerId, attempts + 1);
		try {
			const offer = await pc.createOffer({ iceRestart: true });
			await pc.setLocalDescription(offer);
			await this.sendSignal(peerId, { type: 'offer', sdp: offer, callType: this.callType });
		} catch (err) {
			console.error(`[RTC] Reconnect offer failed for ${peerId}:`, err);
			setTimeout(() => this._attemptReconnect(peerId, pc), 2000 * (attempts + 1));
		}
	}

	// ── Call initiation ─────────────────────────────────────────────────────

	/**
	 * Caller sends an offer to each peer.
	 * @param {number[]} peerIds
	 */
	async initiateCall(peerIds) {
		for (const peerId of peerIds) {
			const pc = this._createPeer(peerId);
			try {
				const offer = await pc.createOffer({
					offerToReceiveAudio: true,
					offerToReceiveVideo: this.callType !== 'audio'
				});
				await pc.setLocalDescription(offer);
				await this.sendSignal(peerId, { type: 'offer', sdp: offer, callType: this.callType });
			} catch (e) {
				console.error(`[RTC] createOffer failed for peer ${peerId}:`, e);
			}
		}
	}

	// ── Signal handling ─────────────────────────────────────────────────────

	async handleSignal(senderId, payload) {
		if (this._closed) return;

		if (payload.type === 'offer') {
			// Update callType from the offer payload (so answerer knows what they're receiving)
			if (payload.callType) this.callType = payload.callType;

			const pc = this._createPeer(senderId);
			try {
				await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
				const answer = await pc.createAnswer();
				await pc.setLocalDescription(answer);
				await this.sendSignal(senderId, { type: 'answer', sdp: answer });
				await this._drainIceBuffer(senderId, pc);
			} catch (e) {
				console.error('[RTC] handleSignal offer error:', e);
			}
		} else if (payload.type === 'answer') {
			const pc = this.peers.get(senderId);
			if (!pc) return;
			try {
				await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
				await this._drainIceBuffer(senderId, pc);
			} catch (e) {
				console.error('[RTC] handleSignal answer error:', e);
			}
		} else if (payload.type === 'ice') {
			const pc = this.peers.get(senderId);
			if (!pc) return;
			const candidate = new RTCIceCandidate(payload.candidate);
			if (pc.remoteDescription) {
				try {
					await pc.addIceCandidate(candidate);
				} catch (e) {
					console.warn('[RTC] addIceCandidate error:', e);
				}
			} else {
				if (!this.iceBuffers.has(senderId)) this.iceBuffers.set(senderId, []);
				this.iceBuffers.get(senderId).push(candidate);
			}
		} else if (payload.type === 'hangup') {
			const pc = this.peers.get(senderId);
			if (pc) {
				try {
					pc.close();
				} catch {}
			}
			this.peers.delete(senderId);
			this.iceBuffers.delete(senderId);
			this.onStreamRemoved(senderId);
		}
	}

	async _drainIceBuffer(peerId, pc) {
		if (!this.iceBuffers.has(peerId)) return;
		for (const candidate of this.iceBuffers.get(peerId)) {
			try {
				await pc.addIceCandidate(candidate);
			} catch (e) {
				console.warn('[RTC] buffered ICE error:', e);
			}
		}
		this.iceBuffers.delete(peerId);
	}

	// ── Cleanup ─────────────────────────────────────────────────────────────

	/**
	 * Send hangup signals to all connected peers, then close everything.
	 * NOTE: sendSignal is called BEFORE closing so the fetch can go through.
	 */
	async sendHangupAndClose(peerIds = []) {
		this._closed = true;
		// Signal peers first
		await Promise.allSettled(peerIds.map((id) => this.sendSignal(id, { type: 'hangup' })));
		// Then close
		this.stopLocalStream();
		for (const [, pc] of this.peers) {
			try {
				pc.close();
			} catch {}
		}
		this.peers.clear();
		this.iceBuffers.clear();
	}

	close() {
		this._closed = true;
		this.stopLocalStream();
		for (const [peerId, pc] of this.peers) {
			this.onStreamRemoved(peerId);
			try {
				pc.close();
			} catch {}
		}
		this.peers.clear();
		this.iceBuffers.clear();
	}
}
