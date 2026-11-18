import React, { useState, useEffect } from "react";
import { CloseIcon, ChatIcon } from "./Icons";
import { api } from "../api";

export default function UserProfileModal({
  username,
  isOpen,
  onClose,
  currentUser,
  onChatInitiated
}) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSentNotice, setRequestSentNotice] = useState("");

  useEffect(() => {
    if (isOpen) {
      const isSelf = username === "me" || !username || username === currentUser?.username || username === currentUser?.id;
      if (isSelf && currentUser) {
        setProfileData({
          username: currentUser.username || "Student",
          campus_voice_id: currentUser.campus_voice_id || "CV-UNKNOWN",
          created_at: currentUser.created_at,
          post_count: 0,
          posts: [],
          is_self: true,
          chat_status: "none",
          target_id: currentUser.id
        });
      }
      loadProfile(isSelf);
    } else {
      setProfileData(null);
      setError("");
      setChatMessage("");
      setRequestSentNotice("");
    }
  }, [isOpen, username]);

  async function loadProfile(isSelf) {
    if (!isSelf) {
      setLoading(true);
    }
    setError("");
    try {
      const target = isSelf ? "me" : (username || "me");
      const data = await api.getPublicProfile(target);
      if (data && data.profile) {
        setProfileData(data.profile);
      }
    } catch (err) {
      if (!isSelf) {
        setError(err.message || "Could not load user profile.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendChatRequest(e) {
    e.preventDefault();
    if (!profileData || sendingRequest) return;

    setSendingRequest(true);
    try {
      const res = await api.sendChatRequest(profileData.target_id, chatMessage.trim());
      setRequestSentNotice(res.message || "Chat request sent!");
      setProfileData(prev => ({ ...prev, chat_status: "pending_sent" }));
      if (onChatInitiated) onChatInitiated();
    } catch (err) {
      setError(err.message || "Failed to send chat request.");
    } finally {
      setSendingRequest(false);
    }
  }

  function formatJoinDate(isoString) {
    if (!isoString) return "Recently joined";
    try {
      const d = new Date(isoString);
      return `Member since ${d.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
    } catch {
      return "Member of CampusVoice";
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-profile" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Student Profile</h3>
          <button className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        {loading ? (
          <div className="modal-loading-state">Loading student profile...</div>
        ) : error ? (
          <div className="modal-error-banner">{error}</div>
        ) : profileData ? (
          <div className="profile-content">
            {/* Profile Header Card */}
            <div className="profile-banner-card">
              <div className="profile-avatar-large">
                {(profileData.username || "Student").charAt(0).toUpperCase()}
              </div>
              <div className="profile-details-main">
                <h2 className="profile-username">u/{profileData.username || "Student"}</h2>
                <div className="profile-meta-chips">
                  <span className="cv-id-chip">ID: {profileData.campus_voice_id}</span>
                  <span className="cv-age-chip">{formatJoinDate(profileData.created_at)}</span>
                  <span className="cv-posts-chip">{profileData.post_count} Discussions</span>
                </div>
              </div>
            </div>

            {/* Chat Connection Box */}
            {!profileData.is_self && (
              <div className="profile-chat-box">
                {profileData.chat_status === "connected" ? (
                  <div className="chat-status-connected">
                    <span>Connected via private chat</span>
                  </div>
                ) : profileData.chat_status === "pending_sent" ? (
                  <div className="chat-status-pending">
                    <span>Chat request pending recipient approval</span>
                  </div>
                ) : profileData.chat_status === "pending_received" ? (
                  <div className="chat-status-received">
                    <span>This student sent you a chat request! Check your chat inbox to accept.</span>
                  </div>
                ) : (
                  <form onSubmit={handleSendChatRequest} className="chat-request-form">
                    <h4>Request 1-on-1 Chat</h4>
                    <p className="chat-request-desc">
                      Messaging begins after <strong>u/{profileData.username}</strong> accepts your request.
                    </p>
                    <input
                      type="text"
                      placeholder="Include a brief reason (e.g. 'Help with Python project')"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      maxLength={150}
                    />
                    <button
                      type="submit"
                      className="btn-send-chat-req"
                      disabled={sendingRequest}
                    >
                      <ChatIcon size={16} />
                      <span>{sendingRequest ? "Sending..." : "Send Chat Request"}</span>
                    </button>
                    {requestSentNotice && (
                      <p className="request-sent-msg">{requestSentNotice}</p>
                    )}
                  </form>
                )}
              </div>
            )}

            {/* Public Posts Tab */}
            <div className="profile-posts-section">
              <h4>Public Discussions ({profileData.posts?.length || 0})</h4>
              {(profileData.posts || []).length === 0 ? (
                <p className="no-profile-posts">This student has not published any public discussions yet.</p>
              ) : (
                <div className="profile-posts-list">
                  {profileData.posts.map(p => (
                    <div key={p.id} className="profile-post-snippet">
                      <div className="snippet-meta">
                        <span className="snippet-flair">{p.flair || p.category || "General"}</span>
                        <span className="snippet-date">{new Date(p.created_at).toLocaleDateString()}</span>
                      </div>
                      <h5>{p.title}</h5>
                      <p>{p.body.slice(0, 140)}...</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
