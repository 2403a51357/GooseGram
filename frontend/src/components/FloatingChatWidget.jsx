import React, { useState, useEffect, useRef } from "react";
import {
  CloseIcon,
  ChatIcon,
  FlagIcon,
  MinimizeIcon,
  MaximizeIcon,
  ArrowLeftIcon
} from "./Icons";
import { api } from "../api";
import { realtimeClient } from "../realtime";

export default function FloatingChatWidget({
  isOpen,
  onClose,
  currentUser,
  onReport,
  onOpenProfile,
  initialTargetUser = null,
  unreadConversationIds = new Set(),
  onClearUnreadConversation,
  onActiveConvChange
}) {
  const [tab, setTab] = useState("conversations"); // 'conversations' | 'requests'
  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState({ received: [], sent: [] });
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadChatData();
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Sync active conversation with parent for unread dot calculation
  useEffect(() => {
    if (onActiveConvChange) {
      onActiveConvChange(activeConv?.id || null);
    }
  }, [activeConv?.id]);

  useEffect(() => {
    if (initialTargetUser && conversations.length > 0) {
      const match = conversations.find(
        (c) =>
          c.partner_id === initialTargetUser.id ||
          c.partner_username === initialTargetUser.username
      );
      if (match) {
        setActiveConv(match);
        if (onClearUnreadConversation) {
          onClearUnreadConversation(match.id);
        }
      }
    }
  }, [initialTargetUser, conversations]);

  // 1. Fetch messages ONLY ONCE when a conversation is opened (NO setInterval polling)
  useEffect(() => {
    if (isOpen && activeConv && !isMinimized) {
      loadMessages(activeConv.id);
    }
  }, [isOpen, activeConv?.id, isMinimized]);

  // 2. Supabase Realtime postgres_changes subscription on messages table
  useEffect(() => {
    if (!activeConv?.id) return;

    const unsubscribe = realtimeClient.subscribe((newRecord) => {
      if (newRecord.conversation_id === activeConv.id) {
        setMessages((prev) => {
          // Deduplicate if already present by ID
          if (prev.some((m) => m.id === newRecord.id)) return prev;

          // Reconcile if matching our own pending optimistic message
          const tempMatchIdx = prev.findIndex(
            (m) => m.sending && m.body === newRecord.body && m.sender_id === newRecord.sender_id
          );
          if (tempMatchIdx !== -1) {
            const updated = [...prev];
            updated[tempMatchIdx] = {
              ...newRecord,
              is_mine: true,
              sending: false
            };
            return updated;
          }

          // Append new incoming message directly to state without full re-fetch
          return [
            ...prev,
            {
              ...newRecord,
              is_mine: newRecord.sender_id === currentUser?.id,
              sending: false
            }
          ];
        });

        // Update last message in active conversation and list
        setActiveConv((prev) =>
          prev
            ? { ...prev, last_message: newRecord.body, last_message_at: newRecord.created_at }
            : prev
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConv.id
              ? { ...c, last_message: newRecord.body, last_message_at: newRecord.created_at }
              : c
          )
        );
      }
    });

    return () => unsubscribe();
  }, [activeConv?.id, currentUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadChatData() {
    setLoading(true);
    try {
      const [convData, reqData] = await Promise.all([
        api.getConversations(),
        api.getChatRequests()
      ]);
      const convList = convData.conversations || [];
      setConversations(convList);
      setRequests({
        received: reqData.received || [],
        sent: reqData.sent || []
      });
      return { conversations: convList, requests: reqData };
    } catch (err) {
      console.error("Load chat error:", err);
    } finally {
      setLoading(false);
    }
  }

  // Initial load only once per opened conversation (latest 50 messages)
  async function loadMessages(convId) {
    try {
      const res = await api.getMessages(convId);
      setMessages(res.messages || []);
    } catch (err) {
      console.error("Load messages error:", err);
    }
  }

  // Instagram-style optimistic sending: immediate input clear, provisional message, zero re-fetch
  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageText.trim() || !activeConv || sendingMsg) return;

    const body = messageText.trim();
    setMessageText(""); // IMMEDIATELY clear input

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      conversation_id: activeConv.id,
      sender_id: currentUser?.id,
      body,
      is_read: false,
      is_mine: true,
      created_at: new Date().toISOString(),
      sending: true // shifted left with opacity 0.82
    };

    // Instantly append to React state
    setMessages((prev) => [...prev, optimisticMsg]);

    // Update conversation preview snippet immediately
    setActiveConv((prev) =>
      prev ? { ...prev, last_message: body, last_message_at: new Date().toISOString() } : prev
    );
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? { ...c, last_message: body, last_message_at: new Date().toISOString() }
          : c
      )
    );

    setSendingMsg(true);
    try {
      const res = await api.sendMessage(activeConv.id, body);
      const confirmed = res.created_message || res.data || res.message;
      if (confirmed && typeof confirmed === "object" && confirmed.id) {
        // Replace temp message with confirmed message: smoothly snaps flush right (sending: false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId ? { ...confirmed, is_mine: true, sending: false } : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, sending: false } : m))
        );
      }
    } catch (err) {
      alert(err.message || "Could not deliver message.");
      // Rollback optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setMessageText(body);
    } finally {
      setSendingMsg(false);
    }
  }

  async function handleRespondRequest(requestId, action) {
    try {
      await api.respondChatRequest(requestId, action);
      setActionNotice(action === "accept" ? "Chat request accepted!" : "Request declined.");
      setTimeout(() => setActionNotice(""), 3000);
      const updated = await loadChatData();
      if (action === "accept") {
        setTab("conversations");
      }
    } catch (err) {
      alert(err.message || "Failed to respond to request.");
    }
  }

  function formatTime(isoString) {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function getDateDividerLabel(isoString) {
    if (!isoString) return "";
    try {
      const msgDate = new Date(isoString);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (msgDate.toDateString() === today.toDateString()) {
        return "Today";
      }
      if (msgDate.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      }
      return msgDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: msgDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined
      });
    } catch {
      return "";
    }
  }

  if (!isOpen) return null;

  // Minimized Floating Pill Mode
  if (isMinimized) {
    return (
      <div className="floating-chat-pill" onClick={() => setIsMinimized(false)}>
        <ChatIcon size={18} />
        <span>Direct Messages</span>
        {requests.received.length > 0 && (
          <span className="chat-pill-badge">{requests.received.length}</span>
        )}
      </div>
    );
  }

  const unreadRequestsCount = requests.received.length;

  return (
    <div className={`floating-chat-window ${isExpanded ? "expanded" : ""}`}>
      {/* Widget Header */}
      <div className="floating-chat-header">
        <div className="chat-header-left">
          {activeConv ? (
            <>
              <button
                type="button"
                className="btn-chat-header-back"
                onClick={() => setActiveConv(null)}
                title="Back to conversations"
              >
                <ArrowLeftIcon size={16} />
              </button>
              <div className="chat-partner-info">
                <button
                  type="button"
                  className="chat-partner-link"
                  onClick={() => onOpenProfile && onOpenProfile(activeConv.partner_username)}
                  title="View Profile"
                >
                  u/{activeConv.partner_username}
                </button>
                <span className="chat-partner-sub">Online</span>
              </div>
            </>
          ) : (
            <div className="chat-widget-title">
              <ChatIcon size={18} />
              <span>GooseGram Direct</span>
            </div>
          )}
        </div>

        {/* Window Controls: Minimize, Scale, Close */}
        <div className="chat-header-controls">
          {activeConv && (
            <button
              type="button"
              className="chat-ctrl-btn"
              onClick={() => onReport && onReport(activeConv.partner_id, "user")}
              title="Report user"
            >
              <FlagIcon size={14} />
            </button>
          )}

          <button
            type="button"
            className="chat-ctrl-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Restore size" : "Expand size"}
          >
            <MaximizeIcon size={14} />
          </button>

          <button
            type="button"
            className="chat-ctrl-btn"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            <MinimizeIcon size={14} />
          </button>

          <button
            type="button"
            className="chat-ctrl-btn close-btn"
            onClick={onClose}
            title="Close chat"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      {actionNotice && <div className="chat-notice-banner">{actionNotice}</div>}

      {/* Main Chat Body */}
      {activeConv ? (
        /* Active Conversation Screen */
        <div className="active-chat-screen">
          <div className="chat-messages-scroll-area">
            {messages.length === 0 ? (
              <div className="chat-empty-messages">
                <p>No messages yet.</p>
                <small>Send a greeting to start chatting anonymously with u/{activeConv.partner_username}!</small>
              </div>
            ) : (
              messages.map((m, idx) => {
                if (!m) return null;
                const prevDate =
                  idx > 0 && messages[idx - 1]?.created_at
                    ? new Date(messages[idx - 1].created_at).toDateString()
                    : null;
                const currDate = m.created_at ? new Date(m.created_at).toDateString() : null;
                const showDateDivider = idx === 0 || (currDate && currDate !== prevDate);
                const dateLabel = showDateDivider ? getDateDividerLabel(m.created_at) : null;

                return (
                  <React.Fragment key={m.id || `msg-${idx}`}>
                    {/* Centered subtle calendar date divider */}
                    {showDateDivider && dateLabel && (
                      <div className="chat-date-divider">
                        <span className="chat-date-pill">{dateLabel}</span>
                      </div>
                    )}
                    <div
                      className={`chat-bubble-row ${m.is_mine ? "row-mine" : "row-partner"}`}
                    >
                      {/* Instagram-style sending state: shifted left + opacity 80 until confirmed */}
                      <div
                        className={`chat-bubble ${m.is_mine ? "bubble-mine" : "bubble-partner"} ${
                          m.sending ? "bubble-sending" : "bubble-confirmed"
                        }`}
                      >
                        <p className="bubble-text">{m.body}</p>
                        {/* Bubble timestamp untouched */}
                        <span className="bubble-time">{formatTime(m.created_at)}</span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="chat-message-input-bar">
            <input
              type="text"
              placeholder={`Message u/${activeConv.partner_username}...`}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              maxLength={2000}
            />
            <button
              type="submit"
              className="btn-send-message"
              disabled={sendingMsg || !messageText.trim()}
            >
              Send
            </button>
          </form>
        </div>
      ) : (
        /* Conversations & Requests List Screen */
        <div className="chat-list-screen">
          {/* Tabs */}
          <div className="chat-tabs-nav">
            <button
              type="button"
              className={`chat-tab-nav-btn ${tab === "conversations" ? "active" : ""}`}
              onClick={() => setTab("conversations")}
            >
              Messages ({conversations.length})
            </button>
            <button
              type="button"
              className={`chat-tab-nav-btn ${tab === "requests" ? "active" : ""}`}
              onClick={() => setTab("requests")}
            >
              Requests
              {unreadRequestsCount > 0 && (
                <span className="chat-requests-badge">{unreadRequestsCount}</span>
              )}
            </button>
          </div>

          <div className="chat-list-scroll-area">
            {tab === "conversations" ? (
              conversations.length === 0 ? (
                <div className="chat-empty-state">
                  <p>No active conversations.</p>
                  <small>Click on any student's u/username to view their profile and send a chat request.</small>
                </div>
              ) : (
                conversations.map((c) => {
                  const hasUnread = unreadConversationIds?.has(c.id);
                  return (
                    <div
                      key={c.id}
                      className={`chat-conv-item ${hasUnread ? "has-unread" : ""}`}
                      onClick={() => {
                        setActiveConv(c);
                        if (onClearUnreadConversation) {
                          onClearUnreadConversation(c.id);
                        }
                      }}
                    >
                      <div className="chat-conv-avatar">
                        {c.partner_username?.charAt(0).toUpperCase() || "S"}
                      </div>
                      <div className="chat-conv-details">
                        <div className="chat-conv-header-row">
                          <span className="chat-conv-username">
                            u/{c.partner_username}
                            {hasUnread && <span className="conv-unread-indicator-dot" />}
                          </span>
                          <span className="chat-conv-time">{formatTime(c.last_message_at)}</span>
                        </div>
                        <p className={`chat-conv-snippet ${hasUnread ? "unread-snippet" : ""}`}>
                          {c.last_message || "Start chatting..."}
                        </p>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              /* Requests Tab */
              <div className="chat-requests-list">
                <h4 className="requests-subheading">Received Requests</h4>
                {requests.received.length === 0 ? (
                  <p className="no-requests-text">No pending chat requests received.</p>
                ) : (
                  requests.received.map((req) => (
                    <div key={req.id} className="chat-request-card">
                      <div className="request-card-info">
                        <button
                          type="button"
                          className="request-sender-link"
                          onClick={() => onOpenProfile && onOpenProfile(req.sender_username)}
                        >
                          u/{req.sender_username}
                        </button>
                        {req.message && (
                          <p className="request-msg-preview">"{req.message}"</p>
                        )}
                      </div>
                      <div className="request-card-actions">
                        <button
                          type="button"
                          className="btn-req-accept"
                          onClick={() => handleRespondRequest(req.id, "accept")}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn-req-decline"
                          onClick={() => handleRespondRequest(req.id, "decline")}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}

                <h4 className="requests-subheading sent-heading">Sent Requests</h4>
                {requests.sent.length === 0 ? (
                  <p className="no-requests-text">No pending requests sent.</p>
                ) : (
                  requests.sent.map((req) => (
                    <div key={req.id} className="chat-request-card sent-card">
                      <div className="request-card-info">
                        <span className="request-recipient-name">
                          To: u/{req.recipient_username}
                        </span>
                        <span className="request-status-pill">{req.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
