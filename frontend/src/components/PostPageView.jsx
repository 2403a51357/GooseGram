import React, { useState, useEffect } from "react";
import {
  UpvoteIcon,
  DownvoteIcon,
  BookmarkIcon,
  ShareIcon,
  FlagIcon,
  TrashIcon,
  PinIcon
} from "./Icons";
import ThreadedComments from "./ThreadedComments";
import MbtiBadge from "./MbtiBadge";
import { api } from "../api";
import { getTeaBadge } from "../utils/teaStatus";

export default function PostPageView({
  post: initialPost,
  postId,
  currentUser,
  onVote,
  onToggleSave,
  isSaved = false,
  onOpenProfile,
  onOpenChat,
  onDeletePost,
  onReportPost,
  onPinPost,
  isCommunityMod = false,
  onSelectCommunity,
  onCommentAdded
}) {
  const [currentPost, setCurrentPost] = useState(initialPost || null);
  const [loadingPost, setLoadingPost] = useState(!initialPost && !!postId);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localVote, setLocalVote] = useState(initialPost?.my_vote || 0);
  const [localScore, setLocalScore] = useState(
    initialPost ? (initialPost.score ?? ((initialPost.upvotes || 0) - (initialPost.downvotes || 0))) : 0
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside() {
      setMenuOpen(false);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  // Sync state whenever post prop changes
  useEffect(() => {
    if (initialPost) {
      setCurrentPost(initialPost);
      setLocalVote(initialPost.my_vote || 0);
      setLocalScore(initialPost.score ?? ((initialPost.upvotes || 0) - (initialPost.downvotes || 0)));
    }
  }, [initialPost]);

  // If initialPost is missing but postId is provided (e.g. direct link or page reload)
  useEffect(() => {
    const targetId = initialPost?.id || postId;
    if (!initialPost && targetId) {
      setLoadingPost(true);
      api.getPost(targetId)
        .then((data) => {
          if (data.post) {
            setCurrentPost(data.post);
            setLocalVote(data.post.my_vote || 0);
            setLocalScore(data.post.score ?? ((data.post.upvotes || 0) - (data.post.downvotes || 0)));
          }
        })
        .catch((err) => {
          console.error("Failed to load post by id:", err);
        })
        .finally(() => {
          setLoadingPost(false);
        });
    }
  }, [postId, initialPost]);

  const activeId = currentPost?.id || postId;
  useEffect(() => {
    if (activeId) {
      loadComments(activeId);
    }
  }, [activeId]);

  async function loadComments(pid) {
    setLoadingComments(true);
    try {
      const data = await api.getComments(pid);
      setComments(data.comments || []);
    } catch (err) {
      console.error("Load comments error:", err);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleAddComment(pid, payload) {
    const res = await api.createComment(pid, payload);
    await loadComments(pid);
    if (onCommentAdded) {
      onCommentAdded(pid);
    }
    return res;
  }

  // Instant synchronous optimistic upvote/downvote handler on post page
  function handleVoteClick(voteVal) {
    if (!currentPost) return;
    const oldVote = localVote;
    const newVote = oldVote === voteVal ? 0 : voteVal;
    const delta = newVote - oldVote;

    setLocalVote(newVote);
    setLocalScore((prev) => prev + delta);
    setCurrentPost((prev) => (prev ? { ...prev, my_vote: newVote, score: (prev.score ?? 0) + delta } : prev));

    if (onVote) {
      Promise.resolve(onVote(currentPost.id, voteVal)).catch(() => {
        setLocalVote(oldVote);
        setLocalScore((prev) => prev - delta);
        setCurrentPost((prev) => (prev ? { ...prev, my_vote: oldVote, score: (prev.score ?? 0) - delta } : prev));
      });
    }
  }

  function formatTime(isoString) {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const diffSecs = Math.floor((new Date() - date) / 1000);
      if (diffSecs < 60) return "just now";
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "";
    }
  }

  function handleShare() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loadingPost) {
    return (
      <div className="post-page-view">
        <div className="feed-loading-state">
          <div className="loading-spinner" />
          <p>Waddling through the pond...</p>
        </div>
      </div>
    );
  }

  if (!currentPost) {
    return (
      <div className="post-page-view">
        <div className="feed-empty-state">
          <p>The pond is suspiciously quiet. Drop some tea.</p>
        </div>
      </div>
    );
  }

  const isAuthor = currentUser && (currentPost.author_id === currentUser.id || currentPost.is_mine);
  const canModAct = isCommunityMod || (currentUser && ["admin", "moderator"].includes(currentUser.role));
  const isReported = Boolean(currentPost.is_reported);
  const canDeleteAsMod = canModAct && isReported;
  const isPinned = Boolean(currentPost.is_pinned);
  const isAutoHidden = Boolean(currentPost.is_auto_hidden);
  const commSlug = currentPost.community_slug;

  const isGossip = (currentPost?.flair || currentPost?.category || "").toLowerCase() === "gossip";
  const teaBadge = isGossip ? getTeaBadge(localScore) : null;

  return (
    <div className="post-page-view">
      {/* Main Full Post Article - Styled like Reddit post detail (Image 2) */}
      <article className={`post-page-card ${isAutoHidden ? "is-autohidden-card" : ""}`}>
        {/* Auto-Hidden Notice (Visible to moderators & author) */}
        {isAutoHidden && (
          <div className="autohidden-post-header-badge">
            <span className="autohide-icon">⚠️</span>
            <span>Auto-Hidden: Exceeded downvote threshold ({currentPost.downvotes || 0} downvotes) — Awaiting Mod Review</span>
          </div>
        )}

        {/* Reddit-style Post Header Stack */}
        <div className="post-header-stack reddit-style-header">
          <div className="post-header-top-row">
            <div className="post-header-left-col">
              {/* Community Avatar / Icon */}
              <div
                className="post-comm-avatar"
                onClick={() => commSlug && onSelectCommunity && onSelectCommunity(commSlug)}
                title={commSlug ? `Visit c/${commSlug}` : undefined}
              >
                <span>{commSlug ? commSlug.charAt(0).toUpperCase() : "C"}</span>
              </div>

              <div className="post-header-meta-stack">
                {/* Line 1: c/community • time ago */}
                <div className="post-header-line-1">
                  {commSlug ? (
                    <button
                      type="button"
                      className="community-name-lead-btn"
                      onClick={() => onSelectCommunity && onSelectCommunity(commSlug)}
                    >
                      c/{commSlug}
                    </button>
                  ) : (
                    <span className="community-name-lead-static">Campus Life</span>
                  )}
                  <span className="meta-separator">•</span>
                  <span className="post-timestamp">{formatTime(currentPost.created_at)}</span>
                  {isPinned && (
                    <>
                      <span className="meta-separator">•</span>
                      <span className="subtle-pinned-tag" title="Pinned Announcement">
                        <PinIcon size={12} /> Pinned
                      </span>
                    </>
                  )}
                </div>

                {/* Line 2: u/username */}
                <div className="post-header-line-author">
                  {currentPost.is_anonymous ? (
                    <span className="anon-author-label">Anonymous Student</span>
                  ) : (
                    <button
                      type="button"
                      className="author-profile-link"
                      onClick={() => onOpenProfile && onOpenProfile(currentPost.author_username || currentPost.author)}
                    >
                      u/{currentPost.author_username || currentPost.author || "Student"}
                    </button>
                  )}
                  {!currentPost.is_anonymous && (currentPost.author_mbti || (currentUser?.username === (currentPost.author_username || currentPost.author) && currentUser?.mbti_type)) && (
                    <MbtiBadge
                      mbtiType={currentPost.author_mbti || currentUser?.mbti_type}
                      username={currentPost.author_username || currentPost.author}
                      currentUser={currentUser}
                      onOpenChat={onOpenChat}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 3-DOTS ACTION MENU: In-feed moderation controls & report */}
            <div className="post-mod-menu-container" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="btn-post-mod-dots"
                onClick={() => setMenuOpen((prev) => !prev)}
                title="Post Actions (•••)"
              >
                •••
              </button>

              {menuOpen && (
                <div className="post-mod-dropdown-menu">
                  {/* 1. Pin / Unpin Announcement (ONLY for Community Moderators) */}
                  {canModAct && onPinPost && (
                    <button
                      type="button"
                      className="mod-dropdown-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onPinPost(currentPost.id, commSlug);
                      }}
                    >
                      {isPinned ? "📌 Unpin Announcement" : "📌 Pin Announcement"}
                    </button>
                  )}

                  {/* 2. Delete Disruptive Post (ONLY for Community Moderators - locked unless reported) */}
                  {canModAct && (
                    canDeleteAsMod ? (
                      <button
                        type="button"
                        className="mod-dropdown-item mod-item-danger unlocked"
                        onClick={() => {
                          setMenuOpen(false);
                          onDeletePost(currentPost.id);
                        }}
                        title="Delete this reported disruptive post"
                      >
                        <TrashIcon size={14} />
                        <span>Delete Disruptive Post (Reported ⚠️)</span>
                      </button>
                    ) : (
                      <div
                        className="mod-dropdown-item mod-item-locked"
                        title="Deletion locked: Moderators can only remove disruptive posts after someone reports them."
                      >
                        <span>🔒 Delete Post (Reported only)</span>
                      </div>
                    )
                  )}

                  {/* 3. Report as Disruptive (Available to non-author users) */}
                  {!isAuthor && (
                    <button
                      type="button"
                      className="mod-dropdown-item mod-item-report"
                      onClick={() => {
                        setMenuOpen(false);
                        onReportPost(currentPost.id, "post");
                      }}
                    >
                      <span>{isReported ? "⚠️ Reported as Disruptive" : "🚩 Report as Disruptive"}</span>
                    </button>
                  )}

                  {/* 4. Delete My Post (For Post Author) */}
                  {isAuthor && (
                    <button
                      type="button"
                      className="mod-dropdown-item mod-item-danger"
                      onClick={() => {
                        setMenuOpen(false);
                        onDeletePost(currentPost.id);
                      }}
                    >
                      <TrashIcon size={14} />
                      <span>Delete My Post</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Post Title */}
        <h1 className="post-page-title">{currentPost.title}</h1>

        {/* Flair Tag (Image 2 style) */}
        <div className="post-flair-row">
          <span className={`flair-pill flair-${(currentPost.flair || currentPost.category || "General").toLowerCase().replace(/\s+/g, "-")}`}>
            {currentPost.flair || currentPost.category || "General"}
          </span>

          {isGossip && teaBadge && (
            <span className={`tea-status-pill ${teaBadge.className}`}>
              {teaBadge.label}
            </span>
          )}

          {currentPost.status && currentPost.status !== "Open" && (
            <span className={`status-badge status-${currentPost.status.toLowerCase().replace(/\s+/g, "-")}`}>
              {currentPost.status}
            </span>
          )}

          {isReported && canModAct && (
            <span className="reported-mod-flag-pill" title="Reported as disruptive">
              ⚠️ Reported Disruptive
            </span>
          )}
        </div>

        {/* Full Post Body */}
        {currentPost.body && (
          <div className="post-page-body-content">
            {currentPost.body.split("\n").map((para, i) => (
              para.trim() ? <p key={i}>{para}</p> : <br key={i} />
            ))}
          </div>
        )}

        {/* Post Actions & Voting Bar - Sleek Pill Vote Group */}
        <div className="post-page-actions-bar">
          {isGossip ? (
            <div className="gossip-vote-bubbles">
              <button
                type="button"
                className={`gossip-vote-pill honk-pill ${localVote === 1 ? "voted-honk" : ""}`}
                onClick={() => handleVoteClick(1)}
                title="Honk (Upvote)"
              >
                <span className="gossip-vote-text">Honk!</span>
                <span className="gossip-vote-count">{localScore}</span>
              </button>
              <button
                type="button"
                className={`gossip-vote-pill hiss-pill ${localVote === -1 ? "voted-hiss" : ""}`}
                onClick={() => handleVoteClick(-1)}
                title="Hiss (Downvote)"
              >
                <span className="gossip-vote-text">Hiss!</span>
              </button>
            </div>
          ) : (
            <div className="post-page-voting-group">
              <button
                type="button"
                className={`vote-btn-horizontal upvote ${localVote === 1 ? "voted-up" : ""}`}
                onClick={() => handleVoteClick(1)}
                title="Upvote"
              >
                <UpvoteIcon active={localVote === 1} size={18} />
              </button>

              <span className={`post-score-horizontal ${localVote === 1 ? "score-up" : localVote === -1 ? "score-down" : ""}`}>
                {localScore}
              </span>

              <button
                type="button"
                className={`vote-btn-horizontal downvote ${localVote === -1 ? "voted-down" : ""}`}
                onClick={() => handleVoteClick(-1)}
                title="Downvote"
              >
                <DownvoteIcon active={localVote === -1} size={18} />
              </button>
            </div>
          )}

          <button
            type="button"
            className={`post-action-btn ${isSaved ? "saved-active" : ""}`}
            onClick={() => onToggleSave(currentPost.id)}
          >
            <BookmarkIcon active={isSaved} size={16} />
            <span>{isSaved ? "Saved" : "Save"}</span>
          </button>

          <button
            type="button"
            className="post-action-btn"
            onClick={handleShare}
          >
            <ShareIcon size={16} />
            <span>{copied ? "Copied Link!" : "Share"}</span>
          </button>

          {isAuthor ? (
            <button
              type="button"
              className="post-action-btn delete-btn"
              onClick={() => onDeletePost(currentPost.id)}
              title="Delete your post"
            >
              <TrashIcon size={16} />
              <span>Delete</span>
            </button>
          ) : (
            <button
              type="button"
              className="post-action-btn"
              onClick={() => onReportPost(currentPost.id, "post")}
              title="Report content"
            >
              <FlagIcon size={16} />
              <span>Report</span>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="post-page-divider" />

        {/* Sleek Comments Section */}
        <section className="post-page-comments-section">
          <div className="comments-section-header">
            <h3 className="comments-section-title">
              Comments
              <span className="comments-count-pill">{comments.length}</span>
            </h3>
          </div>

          <ThreadedComments
            comments={comments}
            onAddComment={handleAddComment}
            postId={currentPost.id}
            onOpenProfile={onOpenProfile}
            onOpenChat={onOpenChat}
            currentUser={currentUser}
          />
        </section>
      </article>
    </div>
  );
}
