import React, { useState, useEffect } from "react";
import {
  CommentIcon,
  BookmarkIcon,
  ShareIcon,
  FlagIcon,
  TrashIcon
} from "./Icons";
import ThreadedComments from "./ThreadedComments";
import MbtiBadge from "./MbtiBadge";
import { api } from "../api";

export default function PollPageView({
  pollId,
  initialPoll = null,
  currentUser,
  onVotePoll,
  onClosePoll,
  onDeletePoll,
  onToggleSave,
  savedPostIds = new Set(),
  onOpenProfile,
  onOpenChat,
  onReportPoll,
  onGoBack
}) {
  const [currentPoll, setCurrentPoll] = useState(initialPoll || null);
  const [loadingPoll, setLoadingPoll] = useState(!initialPoll && !!pollId);
  const [pollError, setPollError] = useState("");

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submittingOptId, setSubmittingOptId] = useState(null);

  // Local optimistic vote tracking
  const [localVoteId, setLocalVoteId] = useState(
    initialPoll?.user_voted_option_id || null
  );

  // Close 3-dots menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside() {
      setMenuOpen(false);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  // Sync state whenever initialPoll prop changes
  useEffect(() => {
    if (initialPoll) {
      setCurrentPoll(initialPoll);
      setLocalVoteId(initialPoll.user_voted_option_id || null);
    }
  }, [initialPoll]);

  // Load poll details if initialPoll not available or direct URL navigation
  useEffect(() => {
    const targetId = initialPoll?.id || pollId;
    if (!initialPoll && targetId) {
      setLoadingPoll(true);
      api
        .getPoll(targetId)
        .then((data) => {
          if (data.poll) {
            setCurrentPoll(data.poll);
            setLocalVoteId(data.poll.user_voted_option_id || null);
          }
        })
        .catch((err) => {
          console.error("Failed to load poll:", err);
          setPollError("Poll not found or may have been deleted.");
        })
        .finally(() => {
          setLoadingPoll(false);
        });
    }
  }, [pollId, initialPoll]);

  // Load comments for this poll
  const activePollId = currentPoll?.id || pollId;
  useEffect(() => {
    if (activePollId) {
      loadComments(activePollId);
    }
  }, [activePollId]);

  async function loadComments(pid) {
    setLoadingComments(true);
    try {
      const data = await api.getComments(pid);
      setComments(data.comments || []);
    } catch (err) {
      console.error("Load poll comments error:", err);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleAddComment(pid, payload) {
    const res = await api.createComment(pid, payload);
    await loadComments(pid);
    setCurrentPoll((prev) =>
      prev
        ? {
            ...prev,
            comments_count: (prev.comments_count || 0) + 1,
            comment_count: (prev.comment_count || 0) + 1
          }
        : prev
    );
    return res;
  }

  async function handleOptionClick(optionId) {
    if (!currentPoll || currentPoll.is_closed || submittingOptId) return;

    setLocalVoteId(optionId);
    setSubmittingOptId(optionId);

    try {
      if (onVotePoll) {
        const res = await onVotePoll(currentPoll.id, optionId);
        if (res && res.results) {
          setCurrentPoll((prev) =>
            prev
              ? {
                  ...prev,
                  results: res.results,
                  total_votes: res.total_votes,
                  user_voted_option_id: res.my_vote_option_id || optionId,
                  has_voted: true
                }
              : prev
          );
        }
      }
    } catch (err) {
      console.error("Poll vote error:", err);
    } finally {
      setSubmittingOptId(null);
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

  function getTimeRemainingText(closesAt, closed) {
    if (closed) return "Poll closed";
    if (!closesAt) return "Voting open";
    try {
      const target = new Date(closesAt);
      const diffSecs = Math.floor((target - new Date()) / 1000);
      if (diffSecs <= 0) return "Poll ended";
      const diffDays = Math.floor(diffSecs / 86400);
      if (diffDays > 0) return `Closes in ${diffDays}d`;
      const diffHours = Math.floor(diffSecs / 3600);
      if (diffHours > 0) return `Closes in ${diffHours}h`;
      const diffMins = Math.floor(diffSecs / 60);
      return `Closes in ${diffMins}m`;
    } catch {
      return "Voting open";
    }
  }

  function handleShare() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loadingPoll) {
    return (
      <div className="post-page-view">
        <div className="feed-loading-state">
          <div className="loading-spinner" />
          <p>Waddling through the pond...</p>
        </div>
      </div>
    );
  }

  if (pollError || !currentPoll) {
    return (
      <div className="post-page-view">
        <div className="feed-empty-state">
          <p>{pollError || "Poll not found or may have been deleted."}</p>
          {onGoBack && (
            <button type="button" className="btn-back-nav" onClick={onGoBack}>
              ← Back to Campus Polls
            </button>
          )}
        </div>
      </div>
    );
  }

  const activeResults = currentPoll.results || [];
  const totalVotes =
    currentPoll.total_votes ??
    activeResults.reduce((sum, item) => sum + Number(item.vote_count || 0), 0);

  const isExpired = currentPoll.closes_at && new Date(currentPoll.closes_at) <= new Date();
  const isClosed = Boolean(currentPoll.is_closed || isExpired);
  const hasVoted = Boolean(localVoteId || currentPoll.has_voted);
  const showResults = hasVoted || isClosed;

  const isAuthor = Boolean(
    currentUser &&
    ((currentPoll.author_id && currentPoll.author_id === currentUser.id) || currentPoll.is_mine)
  );
  const canModAct = Boolean(
    isAuthor || (currentUser && ["admin", "moderator"].includes(currentUser.role))
  );
  const isSaved = savedPostIds.has(currentPoll.id) || Boolean(currentPoll.is_saved);

  return (
    <div className="post-page-view poll-page-view">
      {/* Top Back Navigation (Matches Post Page View style) */}
      {onGoBack && (
        <div className="post-page-nav">
          <button
            type="button"
            className="btn-back-nav"
            onClick={onGoBack}
            title="Back to all polls"
          >
            ← Back to Campus Polls
          </button>
        </div>
      )}

      {/* Main Full Poll Article - Exact Same Card Container as PostPageView */}
      <article className="post-page-card poll-page-card">
        {/* Reddit-style Post Header Stack */}
        <div className="post-header-stack reddit-style-header">
          <div className="post-header-top-row">
            <div className="post-header-left-col">
              {/* Poll Category Avatar */}
              <div
                className="post-comm-avatar"
                title="Campus Polls"
              >
                <span>📊</span>
              </div>

              <div className="post-header-meta-stack">
                {/* Line 1: Campus Polls • time ago */}
                <div className="post-header-line-1">
                  <span className="community-name-lead-static">Campus Polls</span>
                  <span className="meta-separator">•</span>
                  <span className="post-timestamp">{formatTime(currentPoll.created_at)}</span>
                </div>

                {/* Line 2: u/username */}
                <div className="post-header-line-author">
                  <span className="post-author-diminished">Posted by </span>
                  <button
                    type="button"
                    className="author-profile-link"
                    onClick={() => onOpenProfile && onOpenProfile(currentPoll.author_username || "Goose")}
                  >
                    u/{currentPoll.author_username || "Goose"}
                  </button>

                  {currentPoll.author_mbti && (
                    <MbtiBadge
                      mbtiType={currentPoll.author_mbti}
                      username={currentPoll.author_username}
                      currentUser={currentUser}
                      onOpenChat={onOpenChat}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 3-DOTS ACTION MENU: Moderation & options */}
            <div className="post-mod-menu-container" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="btn-post-mod-dots"
                onClick={() => setMenuOpen((prev) => !prev)}
                title="Poll Actions (•••)"
              >
                •••
              </button>

              {menuOpen && (
                <div className="post-mod-dropdown-menu">
                  {canModAct && !isClosed && onClosePoll && (
                    <button
                      type="button"
                      className="mod-dropdown-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onClosePoll(currentPoll.id);
                      }}
                    >
                      🔒 Close Poll
                    </button>
                  )}
                  {canModAct && onDeletePoll && (
                    <button
                      type="button"
                      className="mod-dropdown-item mod-item-danger"
                      onClick={() => {
                        setMenuOpen(false);
                        onDeletePoll(currentPoll.id);
                      }}
                    >
                      <TrashIcon size={14} />
                      <span>Delete Poll</span>
                    </button>
                  )}
                  {!isAuthor && onReportPoll && (
                    <button
                      type="button"
                      className="mod-dropdown-item mod-item-report"
                      onClick={() => {
                        setMenuOpen(false);
                        onReportPoll(currentPoll.id, "poll");
                      }}
                    >
                      <FlagIcon size={14} />
                      <span>Report Poll</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Poll Title */}
        <h1 className="post-page-title">{currentPoll.question}</h1>

        {/* Flair & Status Badges Row (Matches Post Page View style) */}
        <div className="post-flair-row">
          <span className="badge-flair-poll">POLL</span>

          {isClosed ? (
            <span className="badge-poll-state state-closed">Closed</span>
          ) : hasVoted ? (
            <span className="badge-poll-state state-voted">Voted</span>
          ) : (
            <span className="badge-poll-state state-open">Voting Open</span>
          )}
        </div>

        {/* Full Poll Description / Body */}
        {currentPoll.description && (
          <div className="post-page-body-content">
            {currentPoll.description.split("\n").map((para, i) =>
              para.trim() ? <p key={i}>{para}</p> : <br key={i} />
            )}
          </div>
        )}

        {/* Interactive Choice Options List with animated fill bars */}
        <div className="poll-options-list" style={{ margin: "16px 0 10px" }}>
          {(currentPoll.options || []).map((option) => {
            const res = activeResults.find((item) => item.option_id === option.id);
            const count = Number(res?.vote_count || 0);
            const percentage =
              totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

            const isMyChoice =
              localVoteId === option.id ||
              Boolean(res?.my_vote) ||
              currentPoll.user_voted_option_id === option.id;

            return (
              <div
                key={option.id}
                className={`poll-option-box ${showResults ? "is-result-mode" : "is-vote-mode"} ${isMyChoice ? "is-my-choice" : ""} ${isClosed ? "is-closed" : ""}`}
                onClick={() => {
                  if (!isClosed) {
                    handleOptionClick(option.id);
                  }
                }}
                title={
                  isClosed
                    ? "Voting closed"
                    : hasVoted
                    ? isMyChoice
                      ? "Your current vote"
                      : "Click to change your vote"
                    : "Click to cast your vote"
                }
              >
                {/* Proportional background progress bar */}
                {showResults && (
                  <div
                    className={`poll-option-fill-bar ${isMyChoice ? "fill-my-choice" : "fill-neutral"}`}
                    style={{ width: `${percentage}%` }}
                  />
                )}

                <div className="poll-option-content">
                  <div className="poll-option-label-group">
                    <span className="poll-option-text">{option.option_text}</span>
                    {isMyChoice && (
                      <span className="poll-choice-check" title="Your vote">
                        ✓
                      </span>
                    )}
                  </div>

                  {showResults && (
                    <div className="poll-option-stats">
                      <span className="poll-option-percent">{percentage}%</span>
                      <span className="poll-option-count">
                        ({count} {count === 1 ? "vote" : "votes"})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Meta Info Subtext: Total Votes + Time Remaining */}
        <div className="poll-info-subtext" style={{ marginBottom: "14px" }}>
          <span>{totalVotes} {totalVotes === 1 ? "total vote" : "total votes"}</span>
          <span className="meta-dot">•</span>
          <span>{getTimeRemainingText(currentPoll.closes_at, isClosed)}</span>
        </div>

        {/* Post Actions Bar (Comments, Save, Share, Delete/Report — NO up/down vote arrows) */}
        <div className="post-page-actions-bar">
          <button
            type="button"
            className="post-action-btn"
            onClick={() => {
              const composer = document.getElementById("comment-composer-textarea");
              if (composer) {
                composer.focus();
                composer.scrollIntoView({ behavior: "smooth", block: "center" });
              }
            }}
            title="Jump to comments"
          >
            <CommentIcon size={16} />
            <span>{comments.length} Comments</span>
          </button>

          <button
            type="button"
            className={`post-action-btn ${isSaved ? "saved-active" : ""}`}
            onClick={() => onToggleSave && onToggleSave(currentPoll.id)}
            title={isSaved ? "Remove from saved" : "Save poll"}
          >
            <BookmarkIcon active={isSaved} size={16} />
            <span>{isSaved ? "Saved" : "Save"}</span>
          </button>

          <button
            type="button"
            className="post-action-btn"
            onClick={handleShare}
            title="Share poll link"
          >
            <ShareIcon size={16} />
            <span>{copied ? "Copied Link!" : "Share"}</span>
          </button>

          {canModAct ? (
            <button
              type="button"
              className="post-action-btn delete-btn"
              onClick={() => onDeletePoll && onDeletePoll(currentPoll.id)}
              title="Delete poll"
            >
              <TrashIcon size={16} />
              <span>Delete</span>
            </button>
          ) : (
            <button
              type="button"
              className="post-action-btn"
              onClick={() => onReportPoll && onReportPoll(currentPoll.id, "poll")}
              title="Report poll"
            >
              <FlagIcon size={16} />
              <span>Report</span>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="post-page-divider" />

        {/* Sleek Comments Section (Exact Same as PostPageView) */}
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
            postId={currentPoll.id}
            onOpenProfile={onOpenProfile}
            onOpenChat={onOpenChat}
            currentUser={currentUser}
          />
        </section>
      </article>
    </div>
  );
}
