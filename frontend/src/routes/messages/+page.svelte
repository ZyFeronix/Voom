<script>
  import { fade, scale } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import { onMount, tick } from 'svelte';
  import { messages as messagesApi, users as usersApi, posts as postsApi } from '$lib/api.js';
  import { authStore } from '$lib/stores/auth.svelte.js';
  import { notificationsStore } from '$lib/stores/notifications.svelte.js';
  import TwemojiPicker from '$lib/components/TwemojiPicker.svelte';
  import { twemojiAction } from '$lib/actions/twemoji.js';
  import VoiceRecorder from '$lib/components/VoiceRecorder.svelte';
  import MediaPlayer from '$lib/components/MediaPlayer.svelte';

  import { RTCManager } from '$lib/rtc.js';

  // ── Runes State ──────────────────────────────────────────────────────────
  let conversations = $state([]);
  let activeConvId = $state(null);
  let activeConv = $derived(conversations.find(c => c.id === activeConvId));
  let messages = $state([]);
  let chatSessionKey = $state(0); // Increments on every chat load — triggers {#key} even for same conv
  let hasMoreMessages = $state(true);
  let loadingMoreMessages = $state(false);
  
  let searchQuery = $state('');
  let messageText = $state('');
  let loadingConvs = $state(true);
  let loadingMsgs = $state(false);
  let sending = $state(false);
  
  // Mobile UI Helper
  let mobileView = $state('list'); // 'list' or 'chat'
  
  // Typing state
  let isPeerTyping = $state(false);
  let typingTimeout = null;

  // Modals & Pickers
  let showNewDMModal = $state(false);
  let showEmojiPicker = $state(false);
  let activeReactionMsgId = $state(null);
  let reactionPickerDirection = $state('up');
  let selectedMsgId = $state(null);
  let newDMSearch = $state('');
  let userSearchResults = $state([]);
  let searchingUsers = $state(false);

  // Chat message container ref for auto scroll
  let scrollContainer = $state(null);

  // File Attachments
  let fileInput = $state(null);
  let attachedFileUrl = $state(null);
  let attachedFileType = $state(null);
  let uploadingFile = $state(false);
  let showVoiceRecorder = $state(false);
  let attachedVoiceNote = $state(null);

  // WebRTC State
  let rtcManager = $state(null);
  let inCall = $state(false);
  let callType = $state('audio');      // 'audio' | 'video' | 'screen'
  let localStream = $state(null);
  let remoteStreams = $state([]);       // { peerId, stream, callType }
  let showCallModal = $state(false);
  let incomingCallOffer = $state(null); // { sender_id, payload, callerName, callType }
  let pendingSignals = $state([]);
  let processedSignalIds = new Set();
  let micMuted = $state(false);
  let camMuted = $state(false);
  let callDurationSecs = $state(0);
  let callTimer = null;

  // Device Selection State
  let showDeviceSetup = $state(false);
  let availableCams = $state([]);
  let availableMics = $state([]);
  let selectedCamId = $state('');
  let selectedMicId = $state('');
  let previewStream = $state(null);
  let pendingCallType = $state(null);

  // Derived
  let filteredConversations = $derived(
    conversations.filter(c => {
      const name = c.name || c.peer_display_name || c.peer_username || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    })
  );

  // Track processed message IDs to prevent duplicates (not reactive, just a Set)
  let processedMessageIds = new Set();
  let deletingMessageId = $state(null);

  // Watch notificationsStore for real-time messages via SSE
  $effect(() => {
    const newMsgs = notificationsStore.newMessages;
    if (newMsgs.length > 0) {
      let needsScroll = false;
      let shouldReload = false;
      const isNearBottom = scrollContainer ? (scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 150) : true;

      newMsgs.forEach(msg => {
        if (Number(msg.conversation_id) === Number(activeConvId)) {
          if (!messages.some(m => Number(m.id) === Number(msg.id))) {
            const tempIndex = messages.findIndex(m => m.pending && m.body === msg.body && Number(m.sender_id) === Number(msg.sender_id));
            if (tempIndex !== -1) {
              messages[tempIndex] = { ...msg, pending: false };
              messages = [...messages];
            } else {
              messages = [...messages, msg];
            }
            needsScroll = true;
            // Mark read immediately since we are viewing it
            if (Number(msg.sender_id) !== Number(authStore.user?.id)) {
              messagesApi.markRead(activeConvId, msg.id).then(() => {
                 notificationsStore.fetchUnreadMessageCount();
              }).catch(()=>{});
            }
          }
        }
        shouldReload = true;
      });

      if (needsScroll && isNearBottom) scrollToBottom();
      if (shouldReload) loadConversations(false, true);
    }
  });

  // Reset RTC when active conversation changes
  $effect(() => {
    if (activeConvId) {
      if (rtcManager && rtcManager.conversationId !== activeConvId) {
        endCall();
      }
    }
  });

  // Watch for RTC signals
  $effect(() => {
    const signals = notificationsStore.rtcSignals;
    if (signals.length > 0) {
      signals.forEach(async (sig) => {
        if (!processedSignalIds.has(sig.id)) {
          processedSignalIds.add(sig.id);
          try {
            const payload = JSON.parse(sig.payload);

            if (payload.type === 'offer' && !inCall) {
              // Si la llamada es de otra conversación, podemos buscar el nombre del remitente
              let callerName = 'Alguien';
              const conv = conversations.find(c => Number(c.id) === Number(sig.conversation_id));
              if (conv) {
                callerName = conv.peer_display_name || conv.peer_username || callerName;
              }
              
              incomingCallOffer = {
                sender_id: sig.sender_id,
                conversation_id: sig.conversation_id, // Guardamos la conv_id correcta
                payload,
                callerName,
                callType: payload.callType || 'audio'
              };
            } else if (rtcManager && Number(sig.conversation_id) === Number(rtcManager.conversationId)) {
              rtcManager.handleSignal(sig.sender_id, payload);
            } else if (Number(sig.conversation_id) === Number(activeConvId) || incomingCallOffer?.conversation_id === sig.conversation_id) {
              pendingSignals = [...pendingSignals, { sender_id: sig.sender_id, payload }];
            }
          } catch(e) {}
        }
      });
    }
  });

  // Lifecycle
  onMount(async () => {
    await loadConversations(true);

    const handleMessageReaction = (e) => {
      const { messageId, emoji } = e.detail;
      messages = messages.map(m => {
        if (Number(m.id) === Number(messageId)) {
          const reactions = m.reactions || {};
          reactions[emoji] = (reactions[emoji] || 0) + 1;
          return { ...m, reactions };
        }
        return m;
      });
    };
    
    window.addEventListener('message_reaction', handleMessageReaction);
    
    return () => {
      window.removeEventListener('message_reaction', handleMessageReaction);
    };
  });

  // Functions
  async function loadConversations(setFirstActive = false, isBackground = false) {
    if (!isBackground) loadingConvs = true;
    try {
      const data = await messagesApi.conversations.list();
      let newConvs = data.conversations || [];
      
      // Clear unread count for the currently active conversation
      if (activeConvId) {
        newConvs = newConvs.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c);
      }
      conversations = newConvs;
      
      if (setFirstActive && conversations.length > 0 && window.innerWidth >= 768) {
        selectConversation(conversations[0].id);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      if (!isBackground) loadingConvs = false;
    }
  }

  async function selectConversation(id) {
    // Step 1: Wipe immediately and bump session key to reset {#key} transition
    messages = [];
    chatSessionKey++;
    activeConvId = id;
    mobileView = 'chat';
    loadingMsgs = true;
    removeAttachment();
    processedMessageIds.clear();

    // Clear local unread count immediately
    conversations = conversations.map(c => c.id === id ? { ...c, unread_count: 0 } : c);

    try {
      const data = await messagesApi.list(id, { limit: 50 });
      const loadedMessages = data.messages || [];
      hasMoreMessages = data.pagination?.has_more ?? (loadedMessages.length === 50);
      loadedMessages.forEach(m => processedMessageIds.add(m.id));
      messages = loadedMessages;
      await tick();
      scrollToBottom();
      
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1];
        messagesApi.markRead(id, lastMsg.id).then(() => {
          notificationsStore.fetchUnreadMessageCount();
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      loadingMsgs = false;
    }
  }

  async function loadMoreMessages() {
    if (loadingMoreMessages || !hasMoreMessages || messages.length === 0) return;
    loadingMoreMessages = true;
    
    try {
      const oldestMsgId = messages[0]?.id;
      const data = await messagesApi.list(activeConvId, { before: oldestMsgId, limit: 50 });
      // API returns older messages in correct order (oldest first)
      const olderMessages = data.messages || [];
      
      if (olderMessages.length === 0) {
        hasMoreMessages = false;
      } else {
        hasMoreMessages = data.pagination?.has_more ?? (olderMessages.length === 50);
        const scrollContainerEl = scrollContainer;
        const prevScrollHeight = scrollContainerEl?.scrollHeight || 0;
        
        // Add older messages at the beginning
        messages = [...olderMessages, ...messages];
        // Mark loaded messages as processed
        olderMessages.forEach(m => processedMessageIds.add(m.id));
        
        await tick();
        
        if (scrollContainerEl) {
          const newScrollHeight = scrollContainerEl.scrollHeight;
          scrollContainerEl.scrollTop = newScrollHeight - prevScrollHeight;
        }
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      loadingMoreMessages = false;
    }
  }

  async function sendMessage(e) {
    if (e) e.preventDefault();
    if ((!messageText.trim() && !attachedFileUrl && !attachedVoiceNote) || sending || !activeConvId) return;

    sending = true;
    const textToSend = messageText.trim();
    const mediaUrl = attachedFileUrl;
    const mediaType = attachedFileType;
    const voiceNoteToUpload = attachedVoiceNote;

    messageText = '';
    removeAttachment();

    const tempId = 'temp_' + Date.now();
    let optimisticMsg = {
      id: tempId,
      conversation_id: activeConvId,
      sender_id: authStore.user?.id,
      body: textToSend,
      media_url: mediaUrl,
      media_type: mediaType,
      created_at: new Date().toISOString(),
      pending: true
    };
    
    if (voiceNoteToUpload) {
      optimisticMsg.media_type = 'audio';
      try {
        optimisticMsg.media_url = URL.createObjectURL(voiceNoteToUpload);
      } catch(err) {}
    }

    messages = [...messages, optimisticMsg];
    await tick();
    scrollToBottom();

    try {
      let payload = {
        body: textToSend,
        media_url: mediaUrl,
        media_type: mediaType
      };
      
      if (voiceNoteToUpload) {
        const fd = new FormData();
        fd.append('media', voiceNoteToUpload, 'voice_note.webm');
        const uploadRes = await postsApi.uploadMedia(fd);
        if (uploadRes.media && uploadRes.media.length > 0) {
           payload.media_url = uploadRes.media[0].media_url || uploadRes.media[0].url;
           payload.media_type = 'audio';
        } else if (uploadRes.url) {
           payload.media_url = uploadRes.url;
           payload.media_type = 'audio';
        }
      }

      const result = await messagesApi.send(activeConvId, payload);
      
      const newMsg = result.message;
      
      // Reemplazar mensaje temporal con el real
      if (messages.some(m => Number(m.id) === Number(newMsg.id))) {
        messages = messages.filter(m => m.id !== tempId);
      } else {
        messages = messages.map(m => m.id === tempId ? newMsg : m);
      }
      
      // No re-hacer scroll, ya lo hicimos de forma optimista
      loadConversations(false);
    } catch (err) {
      console.error('Error sending message:', err);
      messageText = textToSend;
      attachedFileUrl = mediaUrl;
      attachedFileType = mediaType;
    } finally {
      sending = false;
      attachedVoiceNote = null;
    }
  }

  function handleKeydown(e) {
    if (e.key !== 'Enter' && activeConvId) {
      messagesApi.typing(activeConvId).catch(() => {});
    }
  }

  function showTypingIndicator() {
    isPeerTyping = true;
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isPeerTyping = false;
    }, 3000);
  }

  async function scrollToBottom() {
    await tick();
    requestAnimationFrame(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    });
  }

  function handleScroll() {
    if (!scrollContainer || !activeConvId || !hasMoreMessages || loadingMoreMessages) return;
    if (scrollContainer.scrollTop < 100) {
      loadMoreMessages();
    }
  }

  function handleBubbleClick(e, msgId) {
    const tag = e.target.tagName;
    if (tag === 'A' || tag === 'IMG' || tag === 'VIDEO') return;
    
    // Si el usuario está seleccionando texto, no abrir el picker
    if (window.getSelection().toString().length > 0) return;

    selectedMsgId = selectedMsgId === msgId ? null : msgId;
  }

  async function searchUsersForDM() {
    if (!newDMSearch.trim()) {
      userSearchResults = [];
      return;
    }
    searchingUsers = true;
    try {
      const res = await usersApi.search(newDMSearch.trim());
      userSearchResults = (res.users || []).filter(u => u.id !== authStore.user?.id);
    } catch (err) {
      console.error(err);
    } finally {
      searchingUsers = false;
    }
  }

  async function startDMWithUser(user) {
    showNewDMModal = false;
    newDMSearch = '';
    userSearchResults = [];

    try {
      const existing = conversations.find(c => c.peer_id === user.id);
      if (existing) {
        selectConversation(existing.id);
        return;
      }

      const res = await messagesApi.conversations.create({ user_id: user.id });
      await loadConversations(false);
      selectConversation(res.conversation_id || user.id);
    } catch (err) {
      console.error('Failed to start DM:', err);
    }
  }

  async function handleReact(msgId, emoji) {
    activeReactionMsgId = null;
    try {
      const res = await messagesApi.react(msgId, emoji);
      if (!res.success) throw new Error('API request failed');
      const action = res.action; // 'added' or 'removed'
      messages = messages.map(m => {
        if (m.id === msgId) {
          const reactions = { ...(m.reactions || {}) };
          if (action === 'removed') {
             if (reactions[emoji]) {
                 reactions[emoji].count = Math.max(0, reactions[emoji].count - 1);
                 reactions[emoji].reacted = false;
                 if (reactions[emoji].count === 0) {
                     delete reactions[emoji];
                 }
             }
          } else {
             if (!reactions[emoji]) reactions[emoji] = { count: 0, reacted: false };
             reactions[emoji].count += 1;
             reactions[emoji].reacted = true;
          }
          return { ...m, reactions };
        }
        return m;
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('message_reaction_local', {
          detail: { message_id: msgId, emoji, action }
        }));
      }
    } catch (err) {
      console.error('Failed to react:', err);
    }
  }

  function openReactionMenu(e, msgId) {
    if (activeReactionMsgId === msgId) {
      activeReactionMsgId = null;
      return;
    }
    activeReactionMsgId = msgId;
    
    // Determine direction dynamically
    if (scrollContainer && e.currentTarget) {
      const btnRect = e.currentTarget.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      
      // If button is close to the top of the container (e.g. within 200px), open downwards
      if (btnRect.top - containerRect.top < 200) {
        reactionPickerDirection = 'down';
      } else {
        reactionPickerDirection = 'up';
      }
    } else {
      reactionPickerDirection = 'up';
    }
  }

  function getInitials(name) {
    return (name || '?')[0].toUpperCase();
  }

  function isEmojiOnly(text) {
    if (!text) return false;
    const stripped = text.replace(/[\s\uFE0F]/g, '');
    if (!stripped) return false;
    if (!/^(\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u200D)+$/u.test(stripped)) return false;
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(stripped)].length <= 3;
    }
    return Array.from(stripped).length <= 5;
  }

  function handleAttachClick() {
    if (fileInput) fileInput.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    uploadingFile = true;
    try {
      const fd = new FormData();
      fd.append('media', file);
      const res = await postsApi.uploadMedia(fd);
      if (res.success && res.media && res.media.length > 0) {
        attachedFileUrl = res.media[0].url;
        attachedFileType = res.media[0].type;
      }
    } catch (err) {
      console.error('Failed to upload attachment:', err);
      alert('Error al subir archivo');
    } finally {
      uploadingFile = false;
      if (e.target) e.target.value = '';
    }
  }

  function removeAttachment() {
    attachedFileUrl = null;
    attachedFileType = null;
    attachedVoiceNote = null;
    showVoiceRecorder = false;
  }

  async function deleteMessage(msgId) {
    try {
      await messagesApi.delete(msgId);
      messages = messages.map(m => m.id === msgId ? { ...m, body: 'Este mensaje fue eliminado', voice_url: null, media_url: null, media_type: null, is_deleted: 1 } : m);
    } catch (err) {
      console.error('Error deleting message:', err);
    } finally {
      deletingMessageId = null;
    }
  }

  // twemojiAction is a no-op stub — emoji rendered by Noto Color Emoji font

  // Click outside to close picker
  function handleClickOutside(e) {
    if (showEmojiPicker && !e.target.closest('.emoji-picker-wrapper') && !e.target.closest('.composer-emoji-btn')) {
      showEmojiPicker = false;
    }
  }

  function initRTC(type = 'audio') {
    callType = type;
    rtcManager = new RTCManager(
      activeConvId,
      (peerId, stream, ct) => {
        remoteStreams = [
          ...remoteStreams.filter(s => s.peerId !== peerId),
          { peerId, stream, callType: ct || type }
        ];
        showCallModal = true;
      },
      (peerId) => {
        remoteStreams = remoteStreams.filter(s => s.peerId !== peerId);
        if (remoteStreams.length === 0) {
          // Peer ended the call
          _cleanupCallState();
        }
      },
      type
    );
  }

  function _startCallTimer() {
    callDurationSecs = 0;
    callTimer = setInterval(() => { callDurationSecs++; }, 1000);
  }
  function _stopCallTimer() {
    if (callTimer) { clearInterval(callTimer); callTimer = null; }
    callDurationSecs = 0;
  }
  function _formatDuration(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }
  function _cleanupCallState() {
    _stopCallTimer();
    if (localStream) { localStream.getTracks().forEach(t => t.stop()); }
    localStream = null;
    remoteStreams = [];
    inCall = false;
    callType = 'audio';
    micMuted = false;
    camMuted = false;
    showCallModal = false;
    incomingCallOffer = null;
    pendingSignals = [];
    closeDeviceSetup();
  }

  async function openDeviceSetup(type) {
    if (inCall) return;
    if (!activeConv?.peer_id && !incomingCallOffer) return;

    pendingCallType = type;
    showDeviceSetup = true;

    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      availableCams = devices.filter(d => d.kind === 'videoinput');
      availableMics = devices.filter(d => d.kind === 'audioinput');

      if (availableCams.length > 0) selectedCamId = availableCams[0].deviceId;
      if (availableMics.length > 0) selectedMicId = availableMics[0].deviceId;

      await updatePreview();

      tempStream.getTracks().forEach(t => t.stop());
    } catch (e) {
      console.error('Device access denied:', e);
      alert('Debes conceder permisos de cámara/micrófono para continuar.');
      showDeviceSetup = false;
    }
  }

  async function updatePreview() {
    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
    }
    try {
      const constraints = {
        audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true,
        video: pendingCallType === 'video' ? (selectedCamId ? { deviceId: { exact: selectedCamId }, width: { ideal: 1280 }, height: { ideal: 720 } } : true) : false
      };
      previewStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      console.error('Error updating preview:', e);
    }
  }

  function closeDeviceSetup() {
    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
      previewStream = null;
    }
    showDeviceSetup = false;
    pendingCallType = null;
  }

  async function confirmDeviceSetup() {
    const type = pendingCallType;
    let stream = previewStream; 
    previewStream = null;
    showDeviceSetup = false;
    pendingCallType = null;
    
    if (type === 'screen') {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStream.getVideoTracks()[0].addEventListener('ended', () => endCall());
        
        if (stream && stream.getAudioTracks().length > 0) {
          const micTrack = stream.getAudioTracks()[0];
          screenStream.addTrack(micTrack);
        }
        stream = screenStream;
      } catch (e) {
        console.error('Screen share denied:', e);
        if (stream) stream.getTracks().forEach(t => t.stop());
        return;
      }
    }
    
    _startCallWithStream(type, stream);
  }

  async function _startCallWithStream(type, stream) {
    if (inCall) return;
    if (!activeConv?.peer_id && !incomingCallOffer) return;
    
    initRTC(type);
    localStream = stream;
    rtcManager.setLocalStream(stream);
    inCall = true;
    showCallModal = true;
    _startCallTimer();

    if (incomingCallOffer) {
      const offer = incomingCallOffer;
      incomingCallOffer = null;
      await rtcManager.handleSignal(offer.sender_id, offer.payload);
      for (const sig of pendingSignals) {
        await rtcManager.handleSignal(sig.sender_id, sig.payload);
      }
      pendingSignals = [];
    } else {
      await rtcManager.initiateCall([activeConv.peer_id]);
    }
  }

  const startAudioCall  = () => openDeviceSetup('audio');
  const startVideoCall  = () => openDeviceSetup('video');
  const startScreenShare = () => openDeviceSetup('screen');

  async function endCall() {
    if (!rtcManager && !inCall) return;
    const peerIds = activeConv?.peer_id ? [activeConv.peer_id] : [];
    if (rtcManager) {
      await rtcManager.sendHangupAndClose(peerIds);
      rtcManager = null;
    }
    _cleanupCallState();
  }

  async function acceptCall() {
    if (!incomingCallOffer) return;
    const offer = incomingCallOffer;
    
    if (Number(activeConvId) !== Number(offer.conversation_id)) {
      await selectConversation(offer.conversation_id);
    }

    const responseType = offer.callType === 'screen' ? 'audio' : (offer.callType || 'audio');
    await openDeviceSetup(responseType);
  }

  function declineCallDirect(senderId) {
    fetch('/api/rtc/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.token}` },
      body: JSON.stringify({ recipient_id: senderId, conversation_id: activeConvId, payload: { type: 'hangup' } })
    });
  }

  function declineCall() {
    const offer = incomingCallOffer;
    incomingCallOffer = null;
    pendingSignals = [];
    if (offer) declineCallDirect(offer.sender_id);
  }

  function toggleMic() {
    micMuted = !micMuted;
    rtcManager?.muteAudio(micMuted);
  }
  function toggleCam() {
    camMuted = !camMuted;
    rtcManager?.muteVideo(camMuted);
  }

  function srcObject(node, stream) {
    node.srcObject = stream;
    return { update(s) { node.srcObject = s; } };
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<svelte:head>
  <title>Mensajes  EVSocial</title>
</svelte:head>

<div class="messages-container">
  <div class="glass-card chat-window">
    
    <!-- Left Column: Conversations List -->
    <div class="conversations-sidebar" class:hidden-mobile={mobileView === 'chat'}>
      
      <!-- Top header with DM button -->
      <div class="sidebar-header">
        <div class="sidebar-title-row">
          <h1 class="sidebar-title">Mensajes</h1>
          <button
            onclick={() => showNewDMModal = true}
            class="aero-icon-btn"
            aria-label="Nuevo Mensaje"
          >
            <span class="material-icons-round">chat</span>
          </button>
        </div>

        <!-- Search input -->
        <div class="search-wrapper">
          <span class="material-icons-round">search</span>
          <input
            id="chat_search_input"
            name="chat_search"
            type="text"
            placeholder="Buscar chats..."
            bind:value={searchQuery}
            class="aero-input"
            style="padding-top: 6px; padding-bottom: 6px; font-size: 0.8rem;"
          />
        </div>
      </div>

      <!-- Conversations list container -->
      <div
        class="conversations-list"
        style="overflow-y: scroll; scrollbar-width: thin; scrollbar-color: rgba(46,134,232,0.7) rgba(0,0,0,0.2);"
      >
        {#if loadingConvs}
          {#each Array(4) as _}
            <div class="skeleton-item">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-lines">
                <div class="skeleton-line short"></div>
                <div class="skeleton-line"></div>
              </div>
            </div>
          {/each}
        {:else if filteredConversations.length === 0}
          <div class="empty-conversations">
            <span class="material-icons-round">question_answer</span>
            <p>No hay conversaciones</p>
          </div>
        {:else}
          {#each filteredConversations as conv}
            <button
              onclick={() => selectConversation(conv.id)}
              class="conv-item"
              class:active={activeConvId === conv.id}
            >
              <div class="conv-avatar-wrapper">
                <div class="conv-avatar">
                  {#if conv.peer_avatar}
                    <img src={conv.peer_avatar} alt={conv.name || conv.peer_display_name} />
                  {:else}
                    <span>{getInitials(conv.name || conv.peer_display_name || conv.peer_username)}</span>
                  {/if}
                </div>
                {#if conv.peer_online}
                  <span class="online-indicator"></span>
                {/if}
              </div>
              <div class="conv-details">
                <div class="conv-meta">
                  <h3 class="conv-name">
                    {conv.name || conv.peer_display_name || conv.peer_username}
                  </h3>
                  {#if conv.last_message_time}
                    <span class="conv-time">
                      {new Date(conv.last_message_time).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  {/if}
                </div>
              <p class="conv-preview">
                {conv.last_message_body || 'Empezar conversación...'}
              </p>
              </div>
              {#if conv.unread_count > 0}
                <span class="unread-badge">
                  {conv.unread_count}
                </span>
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Right Column: Active Chat Panel -->
    <div class="chat-pane" class:hidden-mobile={mobileView === 'list'}>
      
      {#if activeConvId}
        <!-- Active Chat Header -->
        <div class="chat-header">
          <div class="peer-profile-info">
            <!-- Mobile back button -->
            <button
              onclick={() => mobileView = 'list'}
              class="back-mobile-btn md:hidden"
            >
              <span class="material-icons-round">arrow_back</span>
            </button>

            <!-- Peer Info -->
            <div class="conv-avatar-wrapper">
              <div class="conv-avatar" style="width: 38px; height: 38px;">
                {#if activeConv.peer_avatar}
                  <img src={activeConv.peer_avatar} alt={activeConv.name || activeConv.peer_display_name} />
                {:else}
                  <span style="font-size: 0.85rem;">{getInitials(activeConv.name || activeConv.peer_display_name || activeConv.peer_username)}</span>
                {/if}
              </div>
              {#if activeConv.peer_online}
                <span class="online-indicator"></span>
              {/if}
            </div>

            <div style="min-width: 0;">
              <h2 class="peer-name">
                {activeConv.name || activeConv.peer_display_name || activeConv.peer_username}
              </h2>
              <p class="peer-status" class:typing-status={isPeerTyping}>
                {#if isPeerTyping}
                  Escribiendo...
                {:else if activeConv.peer_online}
                  Activo ahora
                {:else}
                  Desconectado
                {/if}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            {#if inCall}
              <!-- Hang up (always visible during call) -->
              <button class="aero-icon-btn !w-9 !h-9" style="background: linear-gradient(135deg,#ef4444,#dc2626); color:#fff; border-color:rgba(255,255,255,.15);" title="Colgar" onclick={endCall}>
                <span class="material-icons-round text-[18px]">call_end</span>
              </button>
            {:else}
              <!-- Audio Call -->
              <button class="aero-icon-btn !w-9 !h-9 text-main bg-transparent hover:bg-white/10" title="Llamada de audio" onclick={startAudioCall}>
                <span class="material-icons-round text-[18px]">call</span>
              </button>
              <!-- Video Call -->
              <button class="aero-icon-btn !w-9 !h-9 text-main bg-transparent hover:bg-white/10" title="Videollamada" onclick={startVideoCall}>
                <span class="material-icons-round text-[18px]">videocam</span>
              </button>
              <!-- Screen Share -->
              <button class="aero-icon-btn !w-9 !h-9 text-main bg-transparent hover:bg-white/10" title="Compartir pantalla" onclick={startScreenShare}>
                <span class="material-icons-round text-[18px]">present_to_all</span>
              </button>
            {/if}

            {#if activeConv.peer_username}
              <a href="/u/{activeConv.peer_username}" class="btn-aero-secondary" style="padding: 6px 12px; font-size: 0.75rem; text-decoration: none;" aria-label="Link">Ver Perfil</a>
            {/if}
          </div>
        </div>

        <!-- Chat Messages Area -->
        <div
          bind:this={scrollContainer}
          class="messages-area"
          style="overflow-y: scroll; scrollbar-width: thin; scrollbar-color: rgba(46,134,232,0.7) rgba(0,0,0,0.2);"
          onscroll={handleScroll}
        >
          {#if hasMoreMessages && !loadingMoreMessages}
            <button 
              class="load-more-btn"
              onclick={loadMoreMessages}
             aria-label="Action button">
              Cargar mensajes anteriores
            </button>
          {/if}
          {#if loadingMoreMessages}
            <div class="loading-more">
              <span class="loading loading-spinner text-primary"></span>
            </div>
          {/if}

          {#key chatSessionKey}
            <div class="chat-content-frame" in:fade={{ duration: 280, delay: 60 }}>
              {#if messages.length === 0 && !loadingMsgs}
                <div class="empty-chat">
                  <span class="material-icons-round">forum</span>
                  <p class="empty-chat-title">El inicio de algo genial</p>
                  <p class="empty-chat-subtitle">Envía un mensaje para comenzar a chatear con {activeConv.peer_display_name || activeConv.peer_username}.</p>
                </div>
              {:else}
                <div class="messages-transition-group">
                  {#each messages as msg, i}
                    {@const isMe = Number(msg.sender_id) === Number(authStore.user?.id)}
                    {@const ANIM_WINDOW = 15}
                    {@const posFromEnd = messages.length - 1 - i}
                    {@const animated = posFromEnd < ANIM_WINDOW}
                    {@const animIndex = animated ? (ANIM_WINDOW - 1 - posFromEnd) : -1}
                    {@const staggerDelay = animated ? animIndex * 90 : 0}
                    <div
                      class="message-group {isMe ? 'me' : 'peer'}"
                      class:no-anim={!animated}
                      style="--stagger-delay: {staggerDelay}ms"
                    >
                    
                    <div class="message-bubble-row">
                      {#if !isMe}
                        <div class="peer-mini-avatar">
                          {#if activeConv.peer_avatar}
                            <img src={activeConv.peer_avatar} alt={activeConv.peer_display_name} />
                          {:else}
                            <span>{getInitials(activeConv.peer_display_name || activeConv.peer_username)}</span>
                          {/if}
                        </div>
                      {/if}

                        <div class="bubble-wrapper">
                          <!-- svelte-ignore a11y_click_events_have_key_events -->
                          <!-- svelte-ignore a11y_no_static_element_interactions -->
                          <div class="message-bubble" class:emoji-only-bubble={!msg.is_deleted && isEmojiOnly(msg.body || msg.content) && !msg.media_url} class:deleted-bubble={msg.is_deleted} onclick={(e) => handleBubbleClick(e, msg.id)}>
                            {#if msg.is_deleted}
                              <p class="deleted-text-p"><span class="material-icons-round" style="font-size: 16px; margin-right: 4px; vertical-align: middle;">block</span>Este mensaje fue eliminado</p>
                            {:else}
                              {#if msg.media_url}
                                <div class="message-media-container">
                                  {#if msg.media_type === 'video'}
                                    <MediaPlayer src={msg.media_url} type="video" class="message-media-video" />
                                  {:else if msg.media_type === 'audio'}
                                    <MediaPlayer src={msg.media_url} type="audio" />
                                  {:else}
                                    <img src={msg.media_url} alt="Attached media" class="message-media-img" />
                                  {/if}
                                </div>
                              {/if}
                              {#if msg.body || msg.content}
                                <!-- Message Actions (Delete & React) -->
                                <div class="message-actions-wrapper {isMe ? 'actions-right' : 'actions-left'}">
                                  {#if isMe && !msg.is_deleted}
                                    <button class="action-btn-mini delete-btn" onclick={() => deletingMessageId = msg.id} aria-label="Eliminar" title="Eliminar mensaje">
                                      <span class="material-icons-round" style="font-size: 16px;">delete</span>
                                    </button>
                                  {/if}
                                  
                                  <div style="position: relative;">
                                    <button class="action-btn-mini react-btn" onclick={(e) => openReactionMenu(e, msg.id)}>
                                      <span class="material-icons-round" style="font-size: 18px;">add_reaction</span>
                                    </button>
                                    
                                    {#if activeReactionMsgId === msg.id}
                                      <div class="floating-picker-wrapper {isMe ? 'picker-right' : 'picker-left'} picker-{reactionPickerDirection}">
                                        <TwemojiPicker 
                                          variant="inline"
                                          onSelect={(emoji) => handleReact(msg.id, emoji)} 
                                          onClose={() => activeReactionMsgId = null}
                                        />
                                      </div>
                                    {/if}
                                  </div>
                                </div>
                                <p class="message-text-p" use:twemojiAction>{msg.body || msg.content}</p>
                              {/if}
                            {/if}
                          </div>

                          {#if deletingMessageId === msg.id}
                            <div class="delete-confirm-inline" in:fade={{ duration: 150 }}>
                              <span style="font-weight: 600; opacity: 0.9;">¿Eliminar mensaje?</span>
                              <div class="flex gap-2">
                                <button class="btn-confirm-del" onclick={() => deleteMessage(msg.id)}>Sí, borrar</button>
                                <button class="btn-cancel-del" onclick={() => deletingMessageId = null}>Cancelar</button>
                              </div>
                            </div>
                          {/if}
                        <!-- Reactions show below bubble -->
                        {#if msg.reactions && Object.keys(msg.reactions).length > 0}
                          <div class="reactions-list">
                            {#each Object.entries(msg.reactions) as [emoji, data]}
                              <button 
                                class="reaction-tag {data.reacted ? 'user-reacted' : ''}"
                                onclick={() => handleReact(msg.id, emoji)}
                                aria-label="{data.reacted ? 'Quitar reacción' : 'Reaccionar con'} {emoji}"
                              >
                                <span use:twemojiAction>{emoji}</span>
                                <span style="opacity: 0.6;">{data.count}</span>
                              </button>
                            {/each}
                          </div>
                        {/if}
                        
                        <span class="msg-time">
                          {new Date(msg.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          {#if isMe && msg.read_at}
                            <span class="read-indicator" title="Visto {new Date(msg.read_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}">
                              <span class="material-icons-round">done_all</span>
                            </span>
                          {/if}
                        </span>
                      </div>
                    </div>
                  </div>
                {/each}

                {#if isPeerTyping}
                  <div class="message-group peer">
                    <div class="message-bubble-row">
                      <div class="peer-mini-avatar">
                        {#if activeConv.peer_avatar}
                          <img src={activeConv.peer_avatar} alt={activeConv.peer_display_name} />
                        {:else}
                          <span>{getInitials(activeConv.peer_display_name || activeConv.peer_username)}</span>
                        {/if}
                      </div>
                      <div class="typing-bubble">
                        <div class="dot"></div>
                        <div class="dot"></div>
                        <div class="dot"></div>
                      </div>
                    </div>
                  </div>
                {/if}
                </div>
              {/if}
            </div>
          {/key}
        </div>

        <!-- Attachment Preview Bar -->
        {#if attachedFileUrl || uploadingFile}
          <div class="attachment-preview-bar">
            {#if uploadingFile}
              <div class="attachment-loading">
                <span class="loading loading-spinner text-primary loading-xs"></span>
                <span>Subiendo archivo...</span>
              </div>
            {:else}
              <div class="attachment-preview-card">
                {#if attachedFileType === 'video'}
                  <span class="material-icons-round">videocam</span>
                {:else}
                  <img src={attachedFileUrl} alt="Preview" />
                {/if}
                <button type="button" class="remove-attachment-btn" onclick={removeAttachment} aria-label="Action button">
                  <span class="material-icons-round">close</span>
                </button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Chat Input Area -->
        <div class="input-pane">
          <form onsubmit={sendMessage} class="input-form">
            <input
              id="message_file_input"
              name="message_file"
              type="file"
              accept="image/*,video/*"
              bind:this={fileInput}
              onchange={handleFileSelected}
              style="display: none"
            />
            
            {#if showVoiceRecorder}
              <div class="voice-recorder-wrapper" transition:scale={{duration: 300, start: 0.95, easing: backOut}} style="grid-area: composer; display: flex; align-items: center; min-height: 44px; width: 100%;">
                <VoiceRecorder 
                  onrecorded={(blob) => { attachedVoiceNote = blob; sendMessage(); }}
                  oncancel={() => showVoiceRecorder = false} 
                />
              </div>
            {:else}
              <div class="composer-group" transition:fade={{duration: 150}} style="grid-area: composer; display: flex; gap: 10px; align-items: center; width: 100%;">
                <div class="chat-composer" class:has-attachment={attachedFileUrl}>
                <button
                  type="button"
                  onclick={handleAttachClick}
                  class="composer-icon-btn"
                  aria-label="Agregar archivo"
                  title="Adjuntar archivo"
                >
                  <span class="material-icons-round">add_circle</span>
                </button>
                <input
                  id="message_text_input"
                  name="message_text"
                  type="text"
                  placeholder="Escribe tu mensaje..."
                  bind:value={messageText}
                  onkeydown={handleKeydown}
                  class="composer-input"
                  autocomplete="off"
                />
                <div class="emoji-picker-wrapper" style="position: relative;">
                  <button
                    type="button"
                    class="composer-icon-btn composer-emoji-btn"
                    aria-label="Emojis"
                    title="Emojis"
                    onclick={() => showEmojiPicker = !showEmojiPicker}
                  >
                    <span class="material-icons-round">mood</span>
                  </button>
                  {#if showEmojiPicker}
                    <div style="position: absolute; bottom: 44px; right: 0;">
                      <TwemojiPicker onSelect={(e) => { messageText += e; showEmojiPicker = false; }} />
                    </div>
                  {/if}
                </div>
              </div>
              {#if !messageText.trim() && !attachedFileUrl}
                <button
                  type="button"
                  class="composer-icon-btn"
                  style="flex: 0 0 44px; margin-left: 8px; border-radius: 50%; background: rgba(255,255,255,0.05);"
                  aria-label="Grabar audio"
                  title="Grabar audio"
                  onclick={() => showVoiceRecorder = true}
                >
                  <span class="material-icons-round" style="color: var(--aero-sky);">mic</span>
                </button>
              {:else}
                <button
                  type="submit"
                  disabled={sending}
                  class="composer-send-btn"
                  aria-label="Enviar mensaje"
                >
                  {#if sending}
                    <span class="material-icons-round spin">progress_activity</span>
                  {:else}
                    <span class="material-icons-round">send</span>
                  {/if}
                </button>
              {/if}
              </div>
            {/if}
          </form>
        </div>
      {:else}
        <!-- No Active Conversation Select -->
        <div class="no-chat-selected">
          <span class="material-icons-round no-chat-icon">chat_bubble_outline</span>
          <h2 class="sidebar-title" style="font-size: 1.5rem; margin-bottom: 8px;">Tus Mensajes</h2>
          <p class="peer-status" style="max-w: 280px; margin: 0 auto 16px auto;">Selecciona un chat de la lista izquierda o crea uno nuevo para empezar a hablar en tiempo real.</p>
          <button
            onclick={() => showNewDMModal = true}
            class="btn-aero-primary"
            style="padding: 10px 24px;"
          >
            Nuevo DM
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- New DM Modal -->
{#if showNewDMModal}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" onclick={(e) => { if(e.target === e.currentTarget) { showNewDMModal = false; newDMSearch = ''; userSearchResults = []; } }} transition:fade={{ duration: 150 }}>
    <div class="glass-card aero-modal" style="max-width: 360px; width: 100%; padding: 20px;" transition:scale={{ duration: 250, start: 0.95, easing: backOut }}>
      <div class="modal-header">
        <h3 class="modal-title">Nuevo chat</h3>
        <button
          onclick={() => { showNewDMModal = false; newDMSearch = ''; userSearchResults = []; }}
          class="close-btn"
        >
          <span class="material-icons-round">close</span>
        </button>
      </div>

      <div class="search-wrapper" style="margin-top: 16px;">
        <span class="material-icons-round">search</span>
        <input
          id="new_dm_search"
          name="new_dm_search"
          type="text"
          placeholder="Buscar usuarios por @tag..."
          bind:value={newDMSearch}
          oninput={searchUsersForDM}
          class="aero-input"
          style="padding-left: 32px;"
          autocomplete="off"
        />
      </div>

      <!-- Results list -->
      <div class="modal-results">
        {#if searchingUsers}
          <div class="modal-loading">
            <span class="loading loading-spinner text-primary"></span>
          </div>
        {:else if userSearchResults.length === 0 && newDMSearch.trim()}
          <p class="modal-empty-text">No se encontraron usuarios.</p>
        {:else if userSearchResults.length === 0}
          <p class="modal-empty-text">Busca a alguien para empezar a chatear.</p>
        {:else}
          {#each userSearchResults as user}
            <button
              onclick={() => startDMWithUser(user)}
              class="modal-user-item"
            >
              <div class="conv-avatar" style="width: 34px; height: 34px;">
                {#if user.avatar_url}
                  <img src={user.avatar_url} alt={user.display_name} />
                {:else}
                  <span>{getInitials(user.display_name)}</span>
                {/if}
              </div>
              <div class="user-details-mini">
                <h4 class="user-name-mini">{user.display_name}</h4>
                <p class="user-username-mini">@{user.username}</p>
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- Device Setup Modal                                                   -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  {#if showDeviceSetup}
    <div class="rtc-modal-overlay" style="z-index: 10000;" transition:fade={{duration:200}}>
      <div class="rtc-modal-glass" style="max-width: 400px; padding: 24px;" transition:scale={{duration:300, easing:backOut, start:0.9}}>
        <div class="rtc-header" style="padding: 0; margin-bottom: 16px; border-bottom: none;">
          <h2 style="font-size: 1.25rem; margin:0;">Configuración de llamada</h2>
          <button class="aero-icon-btn text-white/70 hover:text-white" onclick={closeDeviceSetup} title="Cancelar"><span class="material-icons-round">close</span></button>
        </div>
        
        <div class="flex flex-col gap-4">
          <!-- Preview -->
          <div class="relative w-full rounded-2xl overflow-hidden bg-black/50 aspect-video flex items-center justify-center border border-white/10 shadow-inner">
            {#if previewStream && pendingCallType === 'video'}
              <!-- svelte-ignore a11y_media_has_caption -->
              <video use:srcObject={previewStream} autoplay muted playsinline class="w-full h-full object-cover"></video>
            {:else}
              <div class="flex flex-col items-center justify-center text-white/50">
                <span class="material-icons-round text-4xl mb-2">{pendingCallType === 'video' ? 'videocam_off' : (pendingCallType === 'screen' ? 'present_to_all' : 'mic')}</span>
                <span class="text-sm">{pendingCallType === 'video' ? 'Cámara no disponible' : 'Solo Audio / Presentación'}</span>
              </div>
            {/if}
          </div>

          <!-- Selectors -->
          <div class="flex flex-col gap-3">
            {#if availableCams.length > 0 && pendingCallType === 'video'}
              <div class="flex flex-col gap-1">
                <label for="cam-select" class="text-xs text-white/70 font-medium">Cámara</label>
                <select id="cam-select" class="aero-input w-full !bg-black/20 !border-white/10 !text-white" bind:value={selectedCamId} onchange={updatePreview}>
                  {#each availableCams as cam}
                    <option class="text-black" value={cam.deviceId}>{cam.label || `Cámara ${cam.deviceId.slice(0,5)}`}</option>
                  {/each}
                </select>
              </div>
            {/if}

            {#if availableMics.length > 0}
              <div class="flex flex-col gap-1">
                <label for="mic-select" class="text-xs text-white/70 font-medium">Micrófono</label>
                <select id="mic-select" class="aero-input w-full !bg-black/20 !border-white/10 !text-white" bind:value={selectedMicId} onchange={updatePreview}>
                  {#each availableMics as mic}
                    <option class="text-black" value={mic.deviceId}>{mic.label || `Micrófono ${mic.deviceId.slice(0,5)}`}</option>
                  {/each}
                </select>
              </div>
            {/if}
          </div>

          <div class="mt-2">
            <button class="btn-aero-primary w-full py-3 flex items-center justify-center gap-2" onclick={confirmDeviceSetup} aria-label="Action button">
              <span class="material-icons-round text-[20px]">{pendingCallType === 'screen' ? 'present_to_all' : (pendingCallType === 'video' ? 'videocam' : 'call')}</span>
              Unirse a la llamada
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- WebRTC Call Modal Overlay                                          -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  {#if showCallModal}
    <div class="rtc-modal-overlay" transition:fade={{duration:200}}>
      <div class="rtc-modal-glass" transition:scale={{duration:300, easing:backOut, start:0.9}}>

        <!-- Header -->
        <div class="rtc-header">
          <div class="flex items-center gap-2">
            <span class="material-icons-round text-sm" style="color: var(--aero-sky)">
              {callType === 'screen' ? 'present_to_all' : callType === 'video' ? 'videocam' : 'call'}
            </span>
            <h3 class="font-bold text-sm m-0">
              {callType === 'screen' ? 'Compartiendo pantalla' : callType === 'video' ? 'Videollamada' : 'Llamada de audio'}
            </h3>
            <span class="rtc-duration">{_formatDuration(callDurationSecs)}</span>
          </div>
          <button class="aero-icon-btn !w-7 !h-7 bg-transparent hover:bg-white/10 text-main" title="Minimizar" onclick={() => showCallModal = false}>
            <span class="material-icons-round text-sm">minimize</span>
          </button>
        </div>

        <!-- Video Grid -->
        <div class="rtc-video-grid" class:multi={remoteStreams.length > 0 && callType !== 'audio'}>

          <!-- Local feed -->
          {#if callType === 'screen' && localStream}
            <div class="rtc-video-wrapper">
              <!-- svelte-ignore a11y_media_has_caption -->
              <video use:srcObject={localStream} autoplay muted playsinline class="rtc-video"></video>
              <span class="rtc-label">Tu pantalla</span>
            </div>
          {:else if callType === 'video' && localStream}
            <div class="rtc-video-wrapper rtc-self-cam">
              <!-- svelte-ignore a11y_media_has_caption -->
              <video use:srcObject={localStream} autoplay muted playsinline class="rtc-video" style={camMuted?'filter:brightness(0.2)':''}></video>
              <span class="rtc-label">Tú</span>
              {#if camMuted}<div class="rtc-cam-off-overlay"><span class="material-icons-round">videocam_off</span></div>{/if}
            </div>
          {:else}
            <!-- Audio-only placeholder -->
            <div class="rtc-audio-pulse">
              <div class="rtc-avatar-ring" style={micMuted?'border-color:rgba(255,100,100,.4)':''}>
                {#if activeConv?.peer_avatar}
                  <img src={activeConv.peer_avatar} alt={activeConv.peer_display_name} class="w-full h-full object-cover rounded-full" />
                {:else}
                  <span class="material-icons-round" style="font-size:2.5rem;">{micMuted ? 'mic_off' : 'mic'}</span>
                {/if}
              </div>
              <p class="text-sm font-semibold text-main mt-2">{activeConv?.peer_display_name || activeConv?.peer_username || 'Participante'}</p>
              {#if remoteStreams.length === 0}
                <p class="text-xs text-muted">Llamando...</p>
              {:else}
                <p class="text-xs" style="color:var(--aero-sky);">Conectado ✓</p>
              {/if}
            </div>
          {/if}

          <!-- Remote feeds -->
          {#each remoteStreams as rs (rs.peerId)}
            <div class="rtc-video-wrapper">
              <!-- svelte-ignore a11y_media_has_caption -->
              <video use:srcObject={rs.stream} autoplay playsinline class="rtc-video"></video>
              <span class="rtc-label">{activeConv?.peer_display_name || activeConv?.peer_username || 'Participante'}</span>
            </div>
          {/each}
        </div>

        <!-- Controls -->
        <div class="rtc-controls">
          <!-- Mic toggle -->
          <button class="rtc-btn" class:rtc-btn-active={micMuted} onclick={toggleMic} title={micMuted ? 'Activar micro' : 'Silenciar micro'}>
            <span class="material-icons-round">{micMuted ? 'mic_off' : 'mic'}</span>
          </button>

          {#if callType === 'video'}
            <!-- Cam toggle -->
            <button class="rtc-btn" class:rtc-btn-active={camMuted} onclick={toggleCam} title={camMuted ? 'Activar cámara' : 'Apagar cámara'}>
              <span class="material-icons-round">{camMuted ? 'videocam_off' : 'videocam'}</span>
            </button>
          {/if}

          {#if callType !== 'screen'}
            <!-- Share screen (start from within call) -->
            <button class="rtc-btn" title="Compartir pantalla" onclick={startScreenShare}>
              <span class="material-icons-round">present_to_all</span>
            </button>
          {:else}
            <!-- Stop sharing -->
            <button class="rtc-btn" style="background:#3b82f6;" title="Dejar de compartir" onclick={endCall}>
              <span class="material-icons-round">stop_screen_share</span>
            </button>
          {/if}

          <!-- Hang up -->
          <button class="rtc-btn hangup" onclick={endCall} title="Colgar">
            <span class="material-icons-round">call_end</span>
          </button>
        </div>

      </div>
    </div>
  {/if}

  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- Incoming Call Toast                                                -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  {#if incomingCallOffer && !inCall}
    {@const ct = incomingCallOffer.callType || 'audio'}
    <div class="incoming-call-toast" transition:fade={{duration:200}}>
      <div class="flex items-center gap-3">
        <div class="incoming-call-icon" style="animation: ring-bounce 0.5s ease infinite alternate;">
          <span class="material-icons-round" style="color:#fff; font-size:1.2rem;">
            {ct === 'video' ? 'videocam' : ct === 'screen' ? 'present_to_all' : 'call'}
          </span>
        </div>
        <div style="flex:1; min-width:0;">
          <h4 class="text-sm font-bold m-0 text-main">
            {ct === 'video' ? 'Videollamada entrante' : ct === 'screen' ? 'Compartición de pantalla' : 'Llamada de audio'}
          </h4>
          <p class="text-xs text-muted m-0 truncate">
            {incomingCallOffer.callerName || activeConv?.peer_display_name || activeConv?.peer_username || 'Alguien'} te llama
          </p>
        </div>
      </div>
      <div class="flex gap-2 mt-3">
        <button class="rtc-answer-btn accept" onclick={acceptCall} aria-label="Action button">
          <span class="material-icons-round text-[16px]">call</span> Contestar
        </button>
        <button class="rtc-answer-btn decline" onclick={declineCall} aria-label="Action button">
          <span class="material-icons-round text-[16px]">call_end</span> Rechazar
        </button>
      </div>
    </div>
  {/if}

  <!-- Minimized call badge (shown when modal is closed but call is active) -->
  {#if inCall && !showCallModal}
    <button class="rtc-minimized-badge" onclick={() => showCallModal = true} transition:fade={{duration:200}}>
      <span class="material-icons-round" style="font-size:1rem; color:#4ade80;">fiber_manual_record</span>
      <span>{_formatDuration(callDurationSecs)}</span>
      <span class="material-icons-round text-sm">open_in_full</span>
    </button>
  {/if}

<style>
  .messages-container {
    /* Fixed geometry: anchored to viewport, below topnav (58px), right of sidenav (16rem on desktop) */
    position: fixed;
    top: 58px;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .messages-container {
      left: 16rem; /* Width of expanded sidenav */
    }
    
    /* When sidebar is collapsed (JS adds class to vs-shell) */
    :global(.vs-shell--collapsed) .messages-container {
      left: 5rem;
    }
  }

  .chat-window {
    display: flex;
    flex: 1;
    min-height: 0;
    width: 100%;
    height: 100%;
    border-radius: 0;
    overflow: visible; /* Do not clip child scrollbars */
    background: transparent;
    border: none;
    border-top: 1px solid var(--glass-border-t);
  }

  .conversations-sidebar {
    width: 340px;
    flex-shrink: 0;
    border-right: 1px solid rgba(0, 119, 255, 0.1);
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    background: rgba(0, 229, 255, 0.04);
  }

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid rgba(0, 119, 255, 0.1);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sidebar-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .sidebar-title {
    font-size: 1.25rem;
    font-weight: 900;
    color: var(--text-main);
    margin: 0;
    text-shadow: 0 2px 10px rgba(0, 119, 255, 0.1);
  }

  /* ── WebRTC call UI styling ── */
  .rtc-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal-backdrop);
    background: rgba(10, 25, 47, 0.65);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .rtc-modal-glass {
    position: relative;
    width: 520px;
    max-width: 100%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 28px;
    padding: 24px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15);
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow: hidden;
  }
  .rtc-modal-glass::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--noise-texture);
    opacity: 0.02;
    pointer-events: none;
    z-index: 1;
  }

  .rtc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-main);
    z-index: 2;
  }

  .rtc-video-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    width: 100%;
    z-index: 2;
  }
  .rtc-video-grid.multi {
    grid-template-columns: 1fr 1fr;
  }

  .rtc-video-wrapper {
    position: relative;
    aspect-ratio: 16/9;
    border-radius: 18px;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.3);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    box-shadow: var(--depth-2);
  }

  .rtc-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .rtc-label {
    position: absolute;
    bottom: 10px;
    left: 10px;
    background: rgba(10, 25, 47, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: #fff;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 0.72rem;
    font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .rtc-audio-pulse {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 32px 24px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: var(--aero-sky);
    position: relative;
    z-index: 2;
  }

  .rtc-avatar-ring {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 3px solid rgba(0, 229, 255, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--aero-sky);
    overflow: hidden;
    animation: pulseGlow 2s ease-in-out infinite;
    box-shadow: 0 0 0 8px rgba(0, 229, 255, 0.08), 0 0 0 16px rgba(0, 229, 255, 0.03);
  }

  .rtc-duration {
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    color: var(--aero-sky);
    background: rgba(0, 229, 255, 0.1);
    border: 1px solid rgba(0, 229, 255, 0.2);
    border-radius: 8px;
    padding: 2px 8px;
    font-weight: 600;
  }

  .rtc-self-cam {
    position: relative;
  }
  .rtc-cam-off-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.5);
    color: rgba(255,255,255,0.6);
    font-size: 2rem;
    border-radius: inherit;
  }

  @keyframes pulseGlow {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 8px rgba(0,229,255,0.08), 0 0 0 16px rgba(0,229,255,0.03); }
    50%       { transform: scale(1.04); box-shadow: 0 0 0 12px rgba(0,229,255,0.12), 0 0 0 22px rgba(0,229,255,0.05); }
  }

  .rtc-controls {
    display: flex;
    justify-content: center;
    gap: 16px;
    z-index: 2;
  }

  .rtc-btn {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.12);
    cursor: pointer;
    transition: transform var(--t-spring), background var(--t-base), box-shadow var(--t-base);
  }
  .rtc-btn:hover {
    transform: translateY(-2px) scale(1.06);
    background: rgba(255, 255, 255, 0.15);
  }
  .rtc-btn:active { transform: scale(0.95); }
  .rtc-btn.rtc-btn-active {
    background: rgba(239, 68, 68, 0.25) !important;
    border-color: rgba(239, 68, 68, 0.5);
    color: #fca5a5;
  }
  .rtc-btn.hangup {
    background: linear-gradient(135deg, #ef4444, #dc2626) !important;
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4);
    border-color: rgba(255,255,255,0.15);
  }
  .rtc-btn.hangup:hover { box-shadow: 0 8px 24px rgba(239, 68, 68, 0.55); }

  .incoming-call-toast {
    position: fixed;
    bottom: 90px;
    right: 20px;
    background: rgba(8, 20, 40, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(0, 229, 255, 0.2);
    border-radius: 20px;
    padding: 18px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0,229,255,0.08);
    z-index: var(--z-critical);
    width: 290px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .incoming-call-icon {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 16px rgba(34, 197, 94, 0.4);
  }

  @keyframes ring-bounce {
    from { transform: scale(1) rotate(-8deg); }
    to   { transform: scale(1.08) rotate(8deg); }
  }

  .rtc-answer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    flex: 1;
    padding: 8px 12px;
    border-radius: 12px;
    font-size: 0.78rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    color: #fff;
    transition: transform var(--t-spring), box-shadow var(--t-base);
  }
  .rtc-answer-btn.accept {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
  }
  .rtc-answer-btn.decline {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
  }
  .rtc-answer-btn:hover { transform: translateY(-1px) scale(1.03); }
  .rtc-answer-btn:active { transform: scale(0.97); }

  .rtc-minimized-badge {
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: rgba(8, 20, 40, 0.92);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(74, 222, 128, 0.3);
    border-radius: 50px;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-main);
    cursor: pointer;
    z-index: var(--z-critical);
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    transition: transform var(--t-spring), box-shadow var(--t-base);
  }
  .rtc-minimized-badge:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(0,0,0,0.5);
  }

  .search-wrapper {
    position: relative;
  }

  .search-wrapper .material-icons-round {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 1.1rem;
    pointer-events: none;
  }

  .search-wrapper input {
    padding-left: 36px;
    width: 100%;
  }

  .conversations-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .conv-item {
    width: 100%;
    padding: 14px 16px;
    display: flex;
    gap: 12px;
    align-items: center;
    background: none;
    border: none;
    border-left: 3px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .conv-item:hover {
    background: var(--bg-overlay);
  }

  .conv-item.active {
    background: var(--bg-overlay);
    border-left-color: var(--aero-sky);
  }

  .conv-avatar-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .conv-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--grad-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    overflow: hidden;
  }

  .conv-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .online-indicator {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    background: var(--aero-mint);
    border: 2px solid var(--bg-surface);
    border-radius: 50%;
  }

  .conv-details {
    flex: 1;
    min-width: 0;
  }

  .conv-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .conv-name {
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--text-primary);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conv-time {
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .conv-preview {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 2px 0 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .unread-badge {
    padding: 2px 6px;
    border-radius: 10px;
    background: var(--aero-sky);
    color: white;
    font-weight: 900;
    font-size: 0.7rem;
    box-shadow: 0 0 8px rgba(74, 171, 223, 0.3);
  }

  .skeleton-item {
    padding: 16px;
    display: flex;
    gap: 12px;
    align-items: center;
    opacity: 0.6;
  }

  .skeleton-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--border-subtle);
    animation: skeleton-pulse 1.5s infinite ease-in-out;
  }

  .skeleton-lines {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .skeleton-line {
    height: 10px;
    background: rgba(0, 229, 255, 0.06);
    border-radius: 4px;
    animation: skeleton-pulse 1.5s infinite ease-in-out;
  }

  .skeleton-line.short {
    width: 40%;
  }

  @keyframes skeleton-pulse {
    0% { opacity: 0.5; }
    50% { opacity: 0.2; }
    100% { opacity: 0.5; }
  }

  .empty-conversations {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 16px;
    text-align: center;
    color: var(--text-muted);
  }

  .empty-conversations .material-icons-round {
    font-size: 2.5rem;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .empty-conversations p {
    font-size: 0.8rem;
    margin: 0;
  }

  .chat-pane {
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: rgba(0, 229, 255, 0.02);
    /* No overflow:hidden — let scrollbar render inside messages-area */
  }

  .chat-header {
    padding: 14px 16px;
    border-bottom: 1px solid rgba(0, 119, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 229, 255, 0.04);
  }

  .peer-profile-info {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .back-mobile-btn {
    background: none;
    border: none;
    padding: 4px;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .back-mobile-btn:hover {
    color: var(--text-main);
  }

  .peer-name {
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text-primary);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .peer-status {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 2px 0 0 0;
  }

  .typing-status {
    color: var(--aero-sky);
    font-weight: 600;
    animation: status-pulse 1.5s infinite;
  }

  @keyframes status-pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
  }

  .messages-area {
    flex: 1;
    min-height: 0;
    overflow-y: scroll; /* Always show scrollbar track */
    padding: 20px 14px 20px 20px; /* Right padding leaves room for scrollbar */
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .load-more-btn {
    padding: 10px 20px;
    margin: 0 auto 10px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 20px;
    color: var(--primary);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .load-more-btn:hover {
    background: var(--primary);
    color: white;
    transform: translateY(-2px);
  }

  .loading-more {
    display: flex;
    justify-content: center;
    padding: 10px;
    margin-bottom: 10px;
  }

  .loading-messages {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 10px;
    height: 100%;
    color: var(--text-muted);
    font-size: 0.8rem;
  }

  .empty-chat {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 32px;
    color: var(--text-muted);
  }

  .empty-chat .material-icons-round {
    font-size: 3.5rem;
    margin-bottom: 12px;
    color: rgba(0, 119, 255, 0.12);
  }

  .empty-chat-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-main);
    margin: 0 0 4px 0;
  }

  .empty-chat-subtitle {
    font-size: 0.75rem;
    max-width: 260px;
    margin: 0;
  }

  @keyframes bubble-in-me {
    from {
      opacity: 0;
      transform: translateY(-12px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes bubble-in-peer {
    from {
      opacity: 0;
      transform: translateY(-12px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .message-group {
    display: flex;
    flex-direction: column;
    max-width: 75%;
    /* Invisible until animation fires — fill-mode: both holds the 'from' state */
    animation-fill-mode: both;
    animation-duration: 120ms;
    animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94); /* ease-out smooth */
    animation-delay: var(--stagger-delay, 0ms);
  }

  /* Old messages outside the animation window — skip animation entirely */
  .message-group.no-anim {
    animation: none !important;
    opacity: 1;
  }

  .message-group.me {
    align-self: flex-end;
    align-items: flex-end;
    animation-name: bubble-in-me;
  }

  .message-group.peer {
    align-self: flex-start;
    align-items: flex-start;
    animation-name: bubble-in-peer;
  }

  .message-bubble-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  .peer-mini-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--grad-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 700;
    font-size: 0.75rem;
    overflow: hidden;
    flex-shrink: 0;
  }

  .peer-mini-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bubble-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .message-group.me .bubble-wrapper {
    align-items: flex-end;
  }

  .message-group.peer .bubble-wrapper {
    align-items: flex-start;
  }

  .message-bubble {
    position: relative;
    padding: 10px 16px;
    border-radius: 18px;
    font-size: 0.85rem;
    line-height: 1.4;
    word-break: break-word;
  }

  /* Frame wrapper for {#key} transition — fills the scroll area */
  .chat-content-frame {
    display: flex;
    flex-direction: column;
    flex: 1 0 auto; /* Grows to fill, but can also shrink */
    justify-content: flex-start;
    /* Push messages to bottom when there are few of them */
    padding-top: max(0px, calc(100% - 9999px));
  }

  .messages-transition-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .message-group.me .message-bubble {
    background: var(--grad-primary);
    color: var(--text-on-accent);
    border-bottom-right-radius: 2px;
    box-shadow: 0 4px 12px rgba(46, 134, 232, 0.16);
  }

  .message-group.peer .message-bubble {
    background: var(--glass-bg);
    color: var(--text-primary);
    border-bottom-left-radius: 2px;
    border: 1px solid var(--glass-border);
  }

  .emoji-only-bubble {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .emoji-only-bubble .message-text-p {
    font-size: 3.5rem !important;
    line-height: 1.1;
    margin: 0;
  }

  .message-media-container {
    max-width: 280px;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 6px;
  }

  .message-media-img, .message-media-video {
    width: 100%;
    max-height: 200px;
    object-fit: cover;
    border-radius: 12px;
    display: block;
  }

  .message-text-p {
    margin: 0;
    line-height: 1.5;
  }

  /* Noto Color Emoji renders via font — no img tags needed */

  .msg-time {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin-top: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .read-indicator {
    display: inline-flex;
    align-items: center;
    color: var(--primary);
    opacity: 0.8;
  }

  .read-indicator .material-icons-round {
    font-size: 0.85rem;
  }

  .reactions-list {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .reaction-tag {
    padding: 2px 6px;
    border-radius: 10px;
    background: rgba(0, 229, 255, 0.06);
    border: 1px solid rgba(0, 119, 255, 0.1);
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    gap: 2px;
    cursor: pointer;
    transition: all var(--t-fast);
  }

  .reaction-tag:hover {
    background: rgba(0, 119, 255, 0.15);
    border-color: rgba(0, 119, 255, 0.3);
  }

  .reaction-tag.user-reacted {
    background: rgba(0, 119, 255, 0.2);
    border-color: var(--primary);
  }

  .message-actions-wrapper {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 20;
    user-select: none;
    -webkit-user-select: none;
  }
  .bubble-wrapper:hover .message-actions-wrapper {
    opacity: 1;
  }
  .actions-right {
    right: 100%;
    margin-right: 8px;
    flex-direction: row;
  }
  .actions-left {
    left: 100%;
    margin-left: 8px;
    flex-direction: row-reverse;
  }
  .action-btn-mini {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
  }
  .action-btn-mini.react-btn:hover {
    background: rgba(255,255,255,0.1);
    color: var(--aero-blue);
  }
  .action-btn-mini.delete-btn:hover {
    background: rgba(244, 63, 94, 0.1);
    color: var(--rose-500, #f43f5e);
  }

  .floating-picker-wrapper {
    position: absolute;
    z-index: 50;
  }
  
  .floating-picker-wrapper.picker-up {
    bottom: 100%;
    margin-bottom: 8px;
  }

  .floating-picker-wrapper.picker-down {
    top: 100%;
    margin-top: 8px;
  }
  
  .floating-picker-wrapper.picker-right {
    right: 0;
  }
  
  .floating-picker-wrapper.picker-left {
    left: 0;
  }

  .typing-bubble {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 10px 16px;
    border-radius: 18px;
    border-bottom-left-radius: 2px;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--aero-sky);
    animation: wave 1.3s linear infinite;
  }

  .dot:nth-child(2) { animation-delay: -1.1s; }
  .dot:nth-child(3) { animation-delay: -0.9s; }

  @keyframes wave {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-4px); }
  }

  .attachment-preview-bar {
    padding: 8px 12px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    background: rgba(0, 229, 255, 0.04);
  }

  .attachment-loading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .attachment-preview-card {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(0, 119, 255, 0.18);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 119, 255, 0.04);
  }

  .attachment-preview-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .attachment-preview-card .material-icons-round {
    color: var(--text-main);
    font-size: 1.5rem;
  }

  .remove-attachment-btn {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(11, 58, 90, 0.7);
    border: none;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    z-index: 10;
  }

  .remove-attachment-btn .material-icons-round {
    font-size: 0.75rem;
    color: var(--text-primary);
  }

  .input-pane {
    padding: 12px 16px 16px 16px;
    border-top: 1px solid var(--glass-border);
    background: var(--glass-bg);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }

  .input-form {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-areas: "composer";
    align-items: center;
  }

  /* ── Unified Composer (attach + input + emoji in one pill) ── */
  .chat-composer {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 4px;
    background: var(--bg-input-tint);
    border: 1.5px solid var(--glass-border);
    border-radius: 22px;
    padding: 4px 6px 4px 4px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }
  .chat-composer:focus-within {
    border-color: var(--aero-sky);
    box-shadow: 0 0 0 4px rgba(46, 134, 232, 0.10);
    background: var(--bg-surface-hover);
  }
  .chat-composer.has-attachment {
    border-color: var(--aero-amber);
    box-shadow: 0 0 0 3px rgba(245, 166, 35, 0.12);
  }

  .composer-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    min-width: 44px;
    min-height: 44px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.18s ease;
    flex-shrink: 0;
  }
  .composer-icon-btn .material-icons-round {
    font-size: 20px;
  }
  .composer-icon-btn:hover {
    background: rgba(46, 134, 232, 0.10);
    color: var(--aero-sky);
    transform: scale(1.08);
  }
  .composer-emoji-btn:hover {
    background: rgba(245, 166, 35, 0.12);
    color: var(--aero-amber);
  }

  .composer-input {
    flex: 1;
    min-width: 0;
    padding: 9px 6px;
    background: transparent;
    border: none;
    outline: none;
    font-size: 0.92rem;
    line-height: 1.4;
    font-family: var(--font-sans);
    color: var(--text-primary);
  }
  .composer-input::placeholder {
    color: var(--text-muted);
    opacity: 0.55;
  }

  /* ── Send Button ── */
  .composer-send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex: 0 0 44px;
    min-width: 44px;
    min-height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--aero-sky), var(--aero-blue));
    border: none;
    color: #fff;
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, opacity 0.2s ease;
    flex-shrink: 0;
    box-shadow: 0 4px 14px rgba(27, 133, 243, 0.35);
  }
  .composer-send-btn .material-icons-round {
    font-size: 1.2rem;
    line-height: 1;
    display: block;
    transition: transform 0.18s ease;
  }
  .composer-send-btn:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 8px 22px rgba(27, 133, 243, 0.50);
  }
  .composer-send-btn:hover:not(:disabled) .material-icons-round {
    transform: translateX(2px);
  }
  .composer-send-btn:active:not(:disabled) {
    transform: scale(0.92);
    box-shadow: 0 2px 8px rgba(27, 133, 243, 0.3);
  }
  .composer-send-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
    background: var(--bg-overlay);
    color: var(--text-muted);
  }
  .composer-send-btn .spin {
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .no-chat-selected {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    text-align: center;
  }

  .no-chat-icon {
    font-size: 4.5rem;
    color: rgba(0, 119, 255, 0.12);
    margin-bottom: 16px;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-main);
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
  }

  .close-btn:hover {
    color: var(--text-main);
  }

  .modal-results {
    max-height: 240px;
    overflow-y: auto;
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .modal-loading {
    display: flex;
    justify-content: center;
    padding: 24px;
  }

  .modal-empty-text {
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
    padding: 24px;
    margin: 0;
  }

  .modal-user-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    border-radius: 12px;
    background: rgba(0, 229, 255, 0.03);
    border: 1px solid rgba(0, 119, 255, 0.08);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
  }

  .modal-user-item:hover {
    background: rgba(0, 229, 255, 0.08);
    border-color: rgba(0, 229, 255, 0.2);
  }

  .user-details-mini {
    flex: 1;
    min-width: 0;
  }

  .user-name-mini {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-main);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-username-mini {
    font-size: 0.7rem;
    color: var(--text-muted);
    margin: 2px 0 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 768px) {
    .conversations-sidebar.hidden-mobile {
      display: none;
    }
    .chat-pane.hidden-mobile {
      display: none;
    }
    .messages-container {
      bottom: 0;
      height: auto;
      padding-bottom: 90px; /* Leave space for MobileNav */
      border-radius: 0;
      border: none;
    }
    .conversations-sidebar {
      width: 100%;
      border-right: none;
    }
    .composer-area {
      border-radius: 0;
      margin-bottom: 0;
    }
  }


  .deleted-text-p {
    font-style: italic;
    opacity: 0.6;
    display: flex;
    align-items: center;
    margin: 0;
  }
  .message-bubble.deleted-bubble {
    background: rgba(255, 255, 255, 0.05) !important;
    border: 1px dashed rgba(255, 255, 255, 0.2) !important;
    color: var(--text-muted) !important;
    box-shadow: none !important;
  }
  .delete-confirm-inline {
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid var(--rose-500, #f43f5e);
    border-radius: 8px;
    padding: 10px;
    margin-top: 4px;
    font-size: 0.8rem;
    color: #fff;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .btn-confirm-del {
    background: rgba(244, 63, 94, 0.2);
    color: var(--rose-400, #fb7185);
    border: 1px solid rgba(244, 63, 94, 0.3);
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
    flex: 1;
  }
  .btn-confirm-del:hover { background: rgba(244, 63, 94, 0.4); }
  .btn-cancel-del {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-secondary);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
    flex: 1;
  }
  .btn-cancel-del:hover { background: rgba(255, 255, 255, 0.2); }

  /* ─── SCROLLBAR VISIBLE OVERRIDE ─────────────────── */
  /* Using :global() so Svelte does NOT scope these — they apply directly to the elements */
  :global(.messages-area::-webkit-scrollbar),
  :global(.conversations-list::-webkit-scrollbar) {
    width: 6px !important;
    background: rgba(0, 0, 0, 0.2) !important;
  }
  :global(.messages-area::-webkit-scrollbar-track),
  :global(.conversations-list::-webkit-scrollbar-track) {
    background: rgba(0, 0, 0, 0.2) !important;
    border: none !important;
  }
  :global(.messages-area::-webkit-scrollbar-thumb),
  :global(.conversations-list::-webkit-scrollbar-thumb) {
    background: rgba(46, 134, 232, 0.8) !important;
    border-radius: 6px !important;
    border: none !important;
  }
  :global(.messages-area::-webkit-scrollbar-thumb:hover),
  :global(.conversations-list::-webkit-scrollbar-thumb:hover) {
    background: rgba(46, 134, 232, 1) !important;
  }
</style>
