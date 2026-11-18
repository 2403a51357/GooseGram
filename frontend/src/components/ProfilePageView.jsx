import React, { useState, useEffect } from "react";
import { ChatIcon, FlagIcon, BookmarkIcon, DocumentIcon } from "./Icons";
import { api } from "../api";
import PostCard from "./PostCard";
import MbtiBadge from "./MbtiBadge";

export default function ProfilePageView({
  username,
  currentUser,
  onOpenPost,
  onOpenChatWith,
  onOpenChat,
  onReport,
  onVotePost,
  onToggleSave,
  savedPostIds = new Set(),
  onDeletePost,
  onSelectCommunity
}) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("discussions"); // 'discussions' | 'saved'
  const [savedPosts, setSavedPosts] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [chatRequestMsg, setChatRequestMsg] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestStatus, setRequestStatus] = useState("none"); // none | sent | connected

  const cleanTargetUser = String(username || "").replace(/^(u\/|@)/, "").trim();

  useEffect(() => {
    if (cleanTargetUser) {
      loadProfile(cleanTargetUser);
    }
  }, [cleanTargetUser]);

  useEffect(() => {
    if (activeTab === "saved" && profileData?.is_self) {
      loadSavedPosts();
    }
  }, [activeTab, profileData?.is_self]);

  async function loadProfile(targetUser) {
    setLoading(true);
    setError("");
    try {
      const data = await api.getPublicProfile(targetUser);
      setProfileData(data.profile);
      setRequestStatus(data.profile?.chat_status || "none");
    } catch (err) {
      setError(err.message || "Failed to load student profile.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedPosts() {
    setLoadingSaved(true);
    try {
      const res = await api.getSavedPosts();
      setSavedPosts(res.posts || []);
    } catch (err) {
      console.error("Failed to load saved posts:", err);
    } finally {
      setLoadingSaved(false);
    }
  }

  async function handleSendChatRequest(e) {
    e.preventDefault();
    if (!profileData?.target_id) return;
    setSendingRequest(true);
    try {
      await api.sendChatRequest(profileData.target_id, chatRequestMsg.trim());
      setRequestStatus("pending_sent");
      setChatRequestMsg("");
    } catch (err) {
      alert(err.message || "Could not send chat request.");
    } finally {
      setSendingRequest(false);
    }
  }

  async function handleVote(postId, voteValue) {
    setProfileData((prev) => {
      if (!prev || !prev.posts) return prev;
      return {
        ...prev,
        posts: prev.posts.map((p) => {
          if (p.id === postId) {
            const currentScore = p.score ?? ((p.upvotes || 0) - (p.downvotes || 0));
            const oldVote = p.my_vote || 0;
            const newVote = oldVote === voteValue ? 0 : voteValue;
            const scoreDelta = newVote - oldVote;
            return {
              ...p,
              my_vote: newVote,
              score: currentScore + scoreDelta,
              upvotes: (p.upvotes || 0) + (newVote === 1 ? 1 : (oldVote === 1 ? -1 : 0)),
              downvotes: (p.downvotes || 0) + (newVote === -1 ? 1 : (oldVote === -1 ? -1 : 0))
            };
          }
          return p;
        })
      };
    });

    setSavedPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const currentScore = p.score ?? ((p.upvotes || 0) - (p.downvotes || 0));
          const oldVote = p.my_vote || 0;
          const newVote = oldVote === voteValue ? 0 : voteValue;
          const scoreDelta = newVote - oldVote;
          return {
            ...p,
            my_vote: newVote,
            score: currentScore + scoreDelta,
            upvotes: (p.upvotes || 0) + (newVote === 1 ? 1 : (oldVote === 1 ? -1 : 0)),
            downvotes: (p.downvotes || 0) + (newVote === -1 ? 1 : (oldVote === -1 ? -1 : 0))
          };
        }
        return p;
      })
    );

    if (onVotePost) {
      await onVotePost(postId, voteValue);
    }
  }

  function formatTime(isoString) {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch {
      return "";
    }
  }

  if (loading) {
    return (
      <div className="profile-page-view">
        <div className="profile-loading-state">
          <div className="loading-spinner" />
          <p>Waddling through the pond...</p>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="profile-page-view">
        <div className="profile-error-state">{error || "Profile not found."}</div>
      </div>
    );
  }

  const isSelf = profileData.is_self;

  return (
    <div className="profile-page-view">
      {/* Profile Header Hero */}
      <div className="profile-hero-card">
        <div className="profile-hero-banner" />
        <div className="profile-hero-content">
          <div className="profile-avatar-large">
            <span>{profileData.username?.charAt(0).toUpperCase()}</span>
          </div>

          <div className="profile-hero-details">
            <div className="profile-hero-title-row">
              <h2 className="profile-hero-username">u/{profileData.username}</h2>
              {profileData.mbti_type && (
                <MbtiBadge
                  mbtiType={profileData.mbti_type}
                  username={profileData.username}
                  currentUser={currentUser}
                  onOpenChat={onOpenChat || (onOpenChatWith ? () => onOpenChatWith(profileData) : null)}
                  showBadge={profileData.show_mbti_badge ?? true}
                />
              )}
              <span className="profile-id-pill">{profileData.campus_voice_id}</span>
              {profileData.role === "admin" && (
                <span className="profile-role-pill admin">Campus Admin</span>
              )}
              {profileData.role === "moderator" && (
                <span className="profile-role-pill mod">Moderator</span>
              )}
            </div>

            <p className="profile-meta-text">
              <span>Member since {formatTime(profileData.created_at)}</span>
              <span className="meta-dot">·</span>
              <span><strong>{profileData.post_count || 0}</strong> discussions published</span>
            </p>
          </div>

          {/* Action on other profile: Direct Chat Request */}
          {!isSelf && (
            <div className="profile-hero-actions">
              {requestStatus === "connected" ? (
                <button
                  type="button"
                  className="btn-profile-chat"
                  onClick={() => onOpenChatWith && onOpenChatWith(profileData)}
                >
                  <ChatIcon size={16} />
                  <span>Open Direct Chat</span>
                </button>
              ) : requestStatus === "pending_sent" ? (
                <span className="badge-request-pending">Chat Request Sent ✓</span>
              ) : requestStatus === "pending_received" ? (
                <button
                  type="button"
                  className="btn-profile-chat"
                  onClick={() => onOpenChatWith && onOpenChatWith(profileData)}
                >
                  <ChatIcon size={16} />
                  <span>Respond to Request</span>
                </button>
              ) : (
                <form onSubmit={handleSendChatRequest} className="chat-request-inline-form">
                  <input
                    type="text"
                    placeholder="Say hello (optional note)..."
                    value={chatRequestMsg}
                    onChange={(e) => setChatRequestMsg(e.target.value)}
                    maxLength={140}
                  />
                  <button
                    type="submit"
                    className="btn-send-chat-request"
                    disabled={sendingRequest}
                  >
                    {sendingRequest ? "Sending..." : "Request Chat"}
                  </button>
                </form>
              )}

              <button
                type="button"
                className="btn-report-profile"
                onClick={() => onReport && onReport(profileData.target_id, "user")}
                title="Report User"
              >
                <FlagIcon size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation (Saved Posts only visible to self) */}
      <div className="profile-tabs-bar">
        <button
          type="button"
          className={`profile-tab-btn ${activeTab === "discussions" ? "active" : ""}`}
          onClick={() => setActiveTab("discussions")}
        >
          <DocumentIcon size={16} />
          <span>{isSelf ? "My Discussions" : `Discussions by u/${profileData.username}`} ({profileData.posts?.length || 0})</span>
        </button>

        {isSelf && (
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === "saved" ? "active" : ""}`}
            onClick={() => setActiveTab("saved")}
          >
            <BookmarkIcon size={16} />
            <span>Saved Posts</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="profile-tab-content">
        {activeTab === "discussions" ? (
          (!profileData.posts || profileData.posts.length === 0) ? (
            <div className="profile-empty-posts">
              <p>Nothing stashed in your nest yet.</p>
            </div>
          ) : (
            <div className="profile-posts-list">
              {profileData.posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onOpenPost={onOpenPost}
                  onVote={handleVote}
                  onToggleSave={onToggleSave}
                  isSaved={savedPostIds.has(post.id)}
                  onDeletePost={onDeletePost}
                  onSelectCommunity={onSelectCommunity}
                  onOpenChat={onOpenChat || (onOpenChatWith ? (userObj) => onOpenChatWith(userObj) : null)}
                />
              ))}
            </div>
          )
        ) : (
          loadingSaved ? (
            <div className="profile-loading-state">
              <div className="loading-spinner" />
              <p>Waddling through the pond...</p>
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="profile-empty-posts">
              <p>Nothing stashed in your nest yet.</p>
            </div>
          ) : (
            <div className="profile-posts-list">
              {savedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onOpenPost={onOpenPost}
                  onVote={handleVote}
                  onToggleSave={onToggleSave}
                  isSaved={true}
                  onDeletePost={onDeletePost}
                  onSelectCommunity={onSelectCommunity}
                  onOpenChat={onOpenChat || (onOpenChatWith ? (userObj) => onOpenChatWith(userObj) : null)}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
