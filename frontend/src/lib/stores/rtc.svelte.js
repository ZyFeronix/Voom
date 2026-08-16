export function createRTCStore() {
	let rtcManager = $state(null);
	let inCall = $state(false);
	let callType = $state('audio'); // 'audio' | 'video' | 'screen'
	let localStream = $state(null);
	let remoteStreams = $state([]); // { peerId, stream, callType }
	let showCallModal = $state(false);
	let incomingCallOffer = $state(null); // { sender_id, payload, callerName, callType, conversation_id }
	let pendingSignals = $state([]);
	let processedSignalIds = new Set();
	let micMuted = $state(false);
	let camMuted = $state(false);
	let callDurationSecs = $state(0);

	// Device Selection
	let showDeviceSetup = $state(false);
	let availableCams = $state([]);
	let availableMics = $state([]);
	let selectedCamId = $state('');
	let selectedMicId = $state('');
	let previewStream = $state(null);
	let pendingCallType = $state(null);

	return {
		get rtcManager() {
			return rtcManager;
		},
		set rtcManager(v) {
			rtcManager = v;
		},
		get inCall() {
			return inCall;
		},
		set inCall(v) {
			inCall = v;
		},
		get callType() {
			return callType;
		},
		set callType(v) {
			callType = v;
		},
		get localStream() {
			return localStream;
		},
		set localStream(v) {
			localStream = v;
		},
		get remoteStreams() {
			return remoteStreams;
		},
		set remoteStreams(v) {
			remoteStreams = v;
		},
		get showCallModal() {
			return showCallModal;
		},
		set showCallModal(v) {
			showCallModal = v;
		},
		get incomingCallOffer() {
			return incomingCallOffer;
		},
		set incomingCallOffer(v) {
			incomingCallOffer = v;
		},
		get pendingSignals() {
			return pendingSignals;
		},
		set pendingSignals(v) {
			pendingSignals = v;
		},
		get processedSignalIds() {
			return processedSignalIds;
		},
		get micMuted() {
			return micMuted;
		},
		set micMuted(v) {
			micMuted = v;
		},
		get camMuted() {
			return camMuted;
		},
		set camMuted(v) {
			camMuted = v;
		},
		get callDurationSecs() {
			return callDurationSecs;
		},
		set callDurationSecs(v) {
			callDurationSecs = v;
		},

		get showDeviceSetup() {
			return showDeviceSetup;
		},
		set showDeviceSetup(v) {
			showDeviceSetup = v;
		},
		get availableCams() {
			return availableCams;
		},
		set availableCams(v) {
			availableCams = v;
		},
		get availableMics() {
			return availableMics;
		},
		set availableMics(v) {
			availableMics = v;
		},
		get selectedCamId() {
			return selectedCamId;
		},
		set selectedCamId(v) {
			selectedCamId = v;
		},
		get selectedMicId() {
			return selectedMicId;
		},
		set selectedMicId(v) {
			selectedMicId = v;
		},
		get previewStream() {
			return previewStream;
		},
		set previewStream(v) {
			previewStream = v;
		},
		get pendingCallType() {
			return pendingCallType;
		},
		set pendingCallType(v) {
			pendingCallType = v;
		}
	};
}
