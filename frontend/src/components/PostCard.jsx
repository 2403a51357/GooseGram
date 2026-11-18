import React, { useState, useEffect } from "react";
import {
  UpvoteIcon,
  DownvoteIcon,
  CommentIcon,
  BookmarkIcon,
  ShareIcon,
  FlagIcon,
  TrashIcon,
  PinIcon
} from "./Icons";
import MbtiBadge from "./MbtiBadge";
import { getTeaBadge } from "../utils/teaStatus";

export default function PostCard({
  post,
  onVote,
  onToggleSave,
  isSaved = false,
  onOpenProfile,
  onOpenChat,
  onDeletePost,
  onReportPost,
  onPinPost,
  isCommunityMod = false,
  currentUser,
  onSelectCommunity,
  onOpenPost,
  inCommunity = false
}) {
  const [copied, setCopied] = useState(false);
  const [localVote, setLocalVote] = useState(post?.my_vote || 0);
  const [localScore, setLocalScore] = useState(
    post ? (post.score ?? ((post.upvotes || 0) - (post.downvotes || 0))) : 0
  );
  const [menuOpen, setMenuOpen] = useState(false);

  // Close 3-dots menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside() {
      setMenuOpen(false);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  // Keep local vote in sync with parent post updates
  useEffect(() => {
    if (!post) return;
    setLocalVote(post.my_vote || 0);
    setLocalScore(post.score ?? ((post.upvotes || 0) - (post.downvotes || 0)));
  }, [post?.my_vote, post?.score, post?.upvotes, post?.downvotes]);

  if (!post) return null;

  // Instant synchronous optimistic vote handler
  function handleVoteClick(e, voteVal) {
    e.stopPropagation();
    const oldVote = localVote;
    const newVote = oldVote === voteVal ? 0 : voteVal;
    const delta = newVote - oldVote;

    setLocalVote(newVote);
    setLocalScore((prev) => prev + delta);

    if (onVote) {
      Promise.resolve(onVote(post.id, voteVal)).catch(() => {
        setLocalVote(oldVote);
        setLocalScore((prev) => prev - delta);
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

  function handleShare(e) {
    e.stopPropagation();
    const url = `${window.location.origin}/#post-${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isAuthor = currentUser && (post.author_id === currentUser.id || post.is_mine);
  const canModAct = isCommunityMod || (currentUser && ["admin", "moderator"].includes(currentUser.role));
  const isReported = Boolean(post.is_reported);
  const canDeleteAsMod = canModAct && isReported;
  const isPinned = inCommunity && Boolean(post.is_pinned);
  const isAutoHidden = Boolean(post.is_auto_hidden);

  const isGossip = (post.flair || post.category || "").toLowerCase() === "gossip";
  const teaBadge = isGossip ? getTeaBadge(localScore) : null;

  return (
    <article className={`post-card ${isAutoHidden ? "is-autohidden-card" : ""} ${isGossip ? "is-gossip-card" : ""}`} id={`post-${post.id}`}>
      {/* Auto-Hidden Notice (Visible to moderators & author) */}
      {isAutoHidden && (
        <div className="autohidden-post-header-badge">
          <span className="autohide-icon">⚠️</span>
          <span>Auto-Hidden: Exceeded downvote threshold ({post.downvotes || 0} downvotes) — Awaiting Mod Review</span>
        </div>
      )}

      <div className="post-card-inner-flex">
        {/* Left Vote Column: Standard up/down arrows for normal posts */}
        {!isGossip && (
          <div className="post-vote-column">
            <button
              type="button"
              className={`vote-btn upvote ${localVote === 1 ? "voted-up" : ""}`}
              onClick={(e) => handleVoteClick(e, 1)}
              title="Upvote"
            >
              <UpvoteIcon active={localVote === 1} size={18} />
            </button>

            <span className={`post-score ${localVote === 1 ? "score-up" : localVote === -1 ? "score-down" : ""}`}>
              {localScore}
            </span>

            <button
              type="button"
              className={`vote-btn downvote ${localVote === -1 ? "voted-down" : ""}`}
              onClick={(e) => handleVoteClick(e, -1)}
              title="Downvote"
            >
              <DownvoteIcon active={localVote === -1} size={18} />
            </button>
          </div>
        )}

        {/* Main Post Column */}
        <div className="post-main-column">
          {/* Header Stack */}
          <div className="post-header-stack">
            <div className="post-header-top-row-flex">
              {!inCommunity && post.community_slug ? (
                /* Community Post: Importance is on community name, then diminished author */
                <div className="post-header-line-1 community-priority">
                  <button
                    type="button"
                    className="community-name-lead-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectCommunity) onSelectCommunity(post.community_slug);
                    }}
                    title={`Visit c/${post.community_slug}`}
                  >
                    c/{post.community_slug}
                  </button>
                  <span className="meta-separator">·</span>
                  <span className="post-author-diminished">
                    Posted by{" "}
                    {post.is_anonymous ? (
                      <span className="anon-author-label">Anonymous Student</span>
                    ) : (
                      <button
                        type="button"
                        className="author-profile-link diminished"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenProfile) onOpenProfile(post.author_username || post.author);
                        }}
                      >
                        u/{post.author_username || post.author || "Student"}
                      </button>
                    )}
                    {!post.is_anonymous && (post.author_mbti || (currentUser?.username === (post.author_username || post.author) && currentUser?.mbti_type)) && (
                      <MbtiBadge
                        mbtiType={post.author_mbti || currentUser?.mbti_type}
                        username={post.author_username || post.author}
                        currentUser={currentUser}
                        onOpenChat={onOpenChat}
                      />
                    )}
                    <span className="meta-separator">·</span>
                    <span className="post-timestamp">{formatTime(post.created_at)}</span>
                    {isPinned && (
                      <>
                        <span className="meta-separator">·</span>
                        <span className="subtle-pinned-tag" title="Pinned Announcement">
                          <PinIcon size={12} /> Pinned
                        </span>
                      </>
                    )}
                  </span>
                </div>
              ) : (
                /* Normal Post */
                <div className="post-header-line-1 standard-author">
                  <span className="post-author-diminished">
                    Posted by{" "}
                    {post.is_anonymous ? (
                      <span className="anon-author-label">Anonymous Student</span>
                    ) : (
                      <button
                        type="button"
                        className="author-profile-link diminished"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenProfile) onOpenProfile(post.author_username || post.author);
                        }}
                      >
                        u/{post.author_username || post.author || "Student"}
                      </button>
                    )}
                    {!post.is_anonymous && (post.author_mbti || (currentUser?.username === (post.author_username || post.author) && currentUser?.mbti_type)) && (
                      <MbtiBadge
                        mbtiType={post.author_mbti || currentUser?.mbti_type}
                        username={post.author_username || post.author}
                        currentUser={currentUser}
                        onOpenChat={onOpenChat}
                      />
                    )}
                    <span className="meta-separator">·</span>
                    <span className="post-timestamp">{formatTime(post.created_at)}</span>
                    {isPinned && (
                      <>
                        <span className="meta-separator">·</span>
                        <span className="subtle-pinned-tag" title="Pinned Announcement">
                          <PinIcon size={12} /> Pinned
                        </span>
                      </>
                    )}
                  </span>
                </div>
              )}

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
                          onPinPost(post.id, post.community_slug);
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
                            onDeletePost(post.id);
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
                          onReportPost(post.id, "post");
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
                          onDeletePost(post.id);
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

            {/* Line 2: Tag cleanly placed UNDER the line above */}
            <div className="post-header-line-2 tags-row">
              <span className={`flair-pill flair-${(post.flair || post.category || "General").toLowerCase().replace(/\s+/g, "-")}`}>
                {post.flair || post.category || "General"}
              </span>

              {isGossip && teaBadge && (
                <span className={`tea-status-pill ${teaBadge.className}`}>
                  {teaBadge.label}
                </span>
              )}

              {post.status && post.status !== "Open" && (
                <span className={`status-badge status-${post.status.toLowerCase().replace(/\s+/g, "-")}`}>
                  {post.status}
                </span>
              )}

              {isReported && canModAct && (
                <span className="reported-mod-flag-pill" title="Reported as disruptive">
                  ⚠️ Reported Disruptive
                </span>
              )}
            </div>
          </div>

          {/* Title: Clickable -> Opens Post Page */}
          <h3
            className="post-card-title clickable"
            onClick={() => onOpenPost && onOpenPost(post)}
          >
            {post.title}
          </h3>

          {/* Body Text Snippet */}
          <p
            className="post-card-body-snippet clickable"
            onClick={() => onOpenPost && onOpenPost(post)}
          >
            {post.body}
          </p>

          {/* Action Bar */}
          <div className="post-actions-bar">
            {isGossip && (
              <div className="gossip-vote-bubbles" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`gossip-vote-pill honk-pill ${localVote === 1 ? "voted-honk" : ""}`}
                  onClick={(e) => handleVoteClick(e, 1)}
                  title="Honk (Upvote)"
                >
                  <span className="gossip-vote-text">Honk!</span>
                  <span className="gossip-vote-count">{localScore}</span>
                </button>
                <button
                  type="button"
                  className={`gossip-vote-pill hiss-pill ${localVote === -1 ? "voted-hiss" : ""}`}
                  onClick={(e) => handleVoteClick(e, -1)}
                  title="Hiss (Downvote)"
                >
                  <span className="gossip-vote-text">Hiss!</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className="post-action-btn"
              onClick={() => onOpenPost && onOpenPost(post)}
              title="View discussion & comments"
            >
              <CommentIcon size={16} />
              <span>{post.comment_count ?? post.comments_count ?? 0} Comments</span>
            </button>

            <button
              type="button"
              className={`post-action-btn ${isSaved ? "saved-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(post.id);
              }}
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
              <span>{copied ? "Copied!" : "Share"}</span>
            </button>

            {isAuthor ? (
              <button
                type="button"
                className="post-action-btn delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePost(post.id);
                }}
                title="Delete your post"
              >
                <TrashIcon size={16} />
                <span>Delete</span>
              </button>
            ) : (
              <button
                type="button"
                className="post-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onReportPost(post.id, "post");
                }}
                title="Report content"
              >
                <FlagIcon size={16} />
                <span>Report</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
