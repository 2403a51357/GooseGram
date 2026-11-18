import React, { useState, useEffect } from "react";
import { CloseIcon, ChatIcon, FlagIcon, ShieldIcon } from "./Icons";
import { api } from "../api";

export default function ChatModal({
  isOpen,
  onClose,
  currentUser,
  onReport
}) {
  const [tab, setTab] = useState("conversations"); // 'conversations' | 'requests'
  const [conversations, setConversations] = useState([]);
  const [requests, setRequests] = useState({ received: [], sent: [] });
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [actionNotice, setActionNotice] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadChatData();
    }
  }, [isOpen]);

  useEffect(() => {
    let interval;
    if (isOpen && activeConv) {
      loadMessages(activeConv.id);
      interval = setInterval(() => {
        loadMessages(activeConv.id);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isOpen, activeConv]);

  async function loadChatData(targetConvId = null) {
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

      if (targetConvId) {
        const found = convList.find(c => c.id === targetConvId);
        if (found) {
          setActiveConv(found);
        } else if (convList.length > 0) {
          setActiveConv(convList[0]);
        }
      } else if (convList.length > 0 && !activeConv) {
        setActiveConv(convList[0]);
      } else if (activeConv) {
        const found = convList.find(c => c.id === activeConv.id);
        if (found) {
          setActiveConv(found);
        } else if (convList.length > 0) {
          setActiveConv(convList[0]);
        }
      }

      return { conversations: convList, requests: reqData };
    } catch (err) {
      console.error("Load chat error:", err);
      return { conversations: [], requests: { received: [], sent: [] } };
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(convId) {
    try {
      const data = await api.getMessages(convId);
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Load messages error:", err);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageText.trim() || !activeConv || sendingMsg) return;

    setSendingMsg(true);
    const text = messageText.trim();
    setMessageText("");

    try {
      await api.sendMessage(activeConv.id, text);
      await loadMessages(activeConv.id);
      await loadChatData();
    } catch (err) {
      alert(err.message || "Could not send message.");
    } finally {
      setSendingMsg(false);
    }
  }

  async function handleRespondRequest(requestId, action) {
    try {
      const res = await api.respondChatRequest(requestId, action);
      setActionNotice(res.message || `Request ${action}ed.`);
      setTimeout(() => setActionNotice(""), 3000);

      // Refresh chat data and select the conversation if accepted
      const refreshed = await loadChatData(res.conversation_id);
      if (action === "accept") {
        setTab("conversations");
        if (res.conversation_id && refreshed?.conversations) {
          const match = refreshed.conversations.find(c => c.id === res.conversation_id);
          if (match) {
            setActiveConv(match);
          }
        }
      }
    } catch (err) {
      alert(err.message || "Could not respond to request.");
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

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-chat" onClick={(e) => e.stopPropagation()}>
        {/* Chat Modal Header */}
        <div className="modal-header chat-modal-header">
          <div className="chat-header-title">
            <ChatIcon size={22} />
            <h3>CampusVoice Private Chat</h3>
          </div>
          <button className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        {actionNotice && <div className="modal-success-banner">{actionNotice}</div>}

        {/* Tab Switcher */}
        <div className="chat-tabs-bar">
          <button
            className={`chat-tab-btn ${tab === "conversations" ? "active" : ""}`}
            onClick={() => setTab("conversations")}
          >
            Conversations ({conversations.length})
          </button>
          <button
            className={`chat-tab-btn ${tab === "requests" ? "active" : ""}`}
            onClick={() => setTab("requests")}
          >
            Requests {requests.received.length > 0 && <span className="tab-badge">{requests.received.length}</span>}
          </button>
        </div>

        {/* Tab Body */}
        {tab === "conversations" ? (
          <div className="chat-layout-split">
            {/* Conversations Sidebar */}
            <div className="chat-conversations-list">
              {conversations.length === 0 ? (
                <div className="empty-chat-state">
                  <p>No active conversations.</p>
                  <small>Visit student profiles to send a chat request.</small>
                </div>
              ) : (
                conversations.map(c => (
                  <div
                    key={c.id}
                    className={`conv-item-btn ${activeConv?.id === c.id ? "active-conv" : ""}`}
                    onClick={() => setActiveConv(c)}
                  >
                    <div className="conv-avatar">
                      {c.partner_username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="conv-meta">
                      <div className="conv-name-row">
                        <span className="conv-username">u/{c.partner_username}</span>
                        <span className="conv-time">{formatTime(c.last_message_at)}</span>
                      </div>
                      <p className="conv-last-msg">{c.last_message || "Start the conversation..."}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Conversation Messages View */}
            <div className="chat-messages-view">
              {activeConv ? (
                <>
                  <div className="messages-partner-bar">
                    <div className="partner-bar-info">
                      <span className="partner-name">u/{activeConv.partner_username}</span>
                      <span className="partner-cv-id">({activeConv.partner_cv_id})</span>
                    </div>
                    <div className="partner-actions">
                      <button
                        className="btn-chat-safety"
                        onClick={() => onReport(activeConv.partner_id, "user")}
                        title="Report User"
                      >
                        <FlagIcon size={14} />
                        <span>Report</span>
                      </button>
                    </div>
                  </div>

                  <div className="messages-scroller">
                    {messages.length === 0 ? (
                      <div className="no-messages-notice">
                        <p>No messages yet. Send a greeting to start chatting!</p>
                      </div>
                    ) : (
                      messages.map(m => (
                        <div
                          key={m.id}
                          className={`message-bubble-row ${m.is_mine ? "row-mine" : "row-theirs"}`}
                        >
                          <div className={`message-bubble ${m.is_mine ? "bubble-mine" : "bubble-theirs"}`}>
                            <p className="message-content">{m.body}</p>
                            <span className="message-time">{formatTime(m.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <form className="message-input-form" onSubmit={handleSendMessage}>
                    <input
                      type="text"
                      placeholder={`Message u/${activeConv.partner_username}...`}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="btn-send-msg"
                      disabled={!messageText.trim() || sendingMsg}
                    >
                      Send
                    </button>
                  </form>
                </>
              ) : (
                <div className="select-conv-prompt">
                  <p>Select a conversation from the left to start messaging.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Requests View */
          <div className="chat-requests-view">
            <div className="requests-section">
              <h4>Received Requests ({requests.received.length})</h4>
              {requests.received.length === 0 ? (
                <p className="no-requests-msg">No pending received requests.</p>
              ) : (
                <div className="requests-cards-list">
                  {requests.received.map(req => (
                    <div key={req.id} className="chat-request-card">
                      <div className="req-sender-info">
                        <strong>u/{req.sender_username}</strong>
                        <span className="req-sender-id">{req.sender_cv_id}</span>
                      </div>
                      {req.initial_message && (
                        <p className="req-intro-msg">"{req.initial_message}"</p>
                      )}
                      <div className="req-actions-row">
                        <button
                          className="btn-accept-req"
                          onClick={() => handleRespondRequest(req.id, "accept")}
                        >
                          Accept & Chat
                        </button>
                        <button
                          className="btn-decline-req"
                          onClick={() => handleRespondRequest(req.id, "decline")}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="requests-section" style={{ marginTop: "20px" }}>
              <h4>Sent Requests ({requests.sent.length})</h4>
              {requests.sent.length === 0 ? (
                <p className="no-requests-msg">You have no pending requests sent to other students.</p>
              ) : (
                <div className="requests-cards-list">
                  {requests.sent.map(req => (
                    <div key={req.id} className="chat-request-card sent-card">
                      <div className="req-sender-info">
                        <span>Waiting for <strong>u/{req.recipient_username}</strong> to approve</span>
                      </div>
                      {req.initial_message && (
                        <p className="req-intro-msg">"{req.initial_message}"</p>
                      )}
                      <span className="req-pending-badge">Pending</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
