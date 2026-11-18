import React, { useState } from "react";
import {
  CommentIcon,
  BookmarkIcon,
  ShareIcon,
  TrashIcon,
  FlagIcon
} from "./Icons";
import MbtiBadge from "./MbtiBadge";

export default function PollCard({
  poll,
  results = [],
  onVote,
  onClosePoll,
  onDeletePoll,
  onToggleSave,
  isSaved = false,
  onOpenPoll,
  onOpenProfile,
  onOpenChat,
  onReportPoll,
  currentUser,
  isDetailView = false
}) {
  const [submittingOptId, setSubmittingOptId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Local optimistic state for instant click-to-vote responsiveness
  const [localVoteId, setLocalVoteId] = useState(
    poll.user_voted_option_id || null
  );

  if (!poll) return null;

  // Use results array from props or poll object
  const activeResults =
    results && results.length > 0 ? results : (poll.results || []);

  const totalVotes =
    poll.total_votes ??
    activeResults.reduce((sum, item) => sum + Number(item.vote_count || 0), 0);

  const isExpired = poll.closes_at && new Date(poll.closes_at) <= new Date();
  const isClosed = Boolean(poll.is_closed || isExpired);

  // Has voted if user voted locally or according to poll data
  const hasVoted = Boolean(localVoteId || poll.has_voted);

  // Results are displayed once the user votes or when the poll is closed
  const showResults = hasVoted || isClosed;

  const isAuthor = Boolean(
    currentUser &&
    ((poll.author_id && poll.author_id === currentUser.id) || poll.is_mine)
  );
  const canModAct = Boolean(
    isAuthor || (currentUser && ["admin", "moderator"].includes(currentUser.role))
  );

  async function handleOptionClick(optionId) {
    if (isClosed || submittingOptId) return;

    // Instant optimistic update
    setLocalVoteId(optionId);
    setSubmittingOptId(optionId);

    try {
      if (onVote) {
        await onVote(poll.id, optionId);
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

  function handleShare(e) {
    e.stopPropagation();
    const url = `${window.location.origin}/polls/${poll.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <article
      className={`poll-card-container ${isDetailView ? "is-poll-detail-view" : "is-poll-feed-card"}`}
      id={`poll-${poll.id}`}
      onClick={() => {
        if (!isDetailView && onOpenPoll) onOpenPoll(poll);
      }}
    >
      {/* 1. Post-Style Header */}
      <div className="poll-header-top-row">
        <div className="poll-header-meta">
          <span className="badge-flair-poll">POLL</span>

          {isClosed ? (
            <span className="badge-poll-state state-closed">Closed</span>
          ) : hasVoted ? (
            <span className="badge-poll-state state-voted">Voted</span>
          ) : (
            <span className="badge-poll-state state-open">Voting Open</span>
          )}

          <span className="meta-separator">•</span>

          <span className="poll-author-text">
            Posted by{" "}
            <button
              type="button"
              className="author-profile-link"
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenProfile) onOpenProfile(poll.author_username || "Goose");
              }}
            >
              u/{poll.author_username || "Goose"}
            </button>
          </span>

          {poll.author_mbti && (
            <MbtiBadge
              mbtiType={poll.author_mbti}
              username={poll.author_username}
              currentUser={currentUser}
              onOpenChat={onOpenChat}
            />
          )}

          <span className="meta-separator">•</span>
          <span className="poll-time-ago">{formatTime(poll.created_at)}</span>
        </div>

        {/* 3-dots moderation & options menu */}
        <div className="poll-mod-menu-container" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="poll-mod-dots-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            title="Poll options"
          >
            •••
          </button>
          {menuOpen && (
            <div className="poll-mod-dropdown">
              {canModAct && !isClosed && onClosePoll && (
                <button
                  type="button"
                  className="poll-mod-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onClosePoll(poll.id);
                  }}
                >
                  🔒 Close Poll
                </button>
              )}
              {canModAct && onDeletePoll && (
                <button
                  type="button"
                  className="poll-mod-item poll-item-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    onDeletePoll(poll.id);
                  }}
                >
                  <TrashIcon size={14} />
                  <span>Delete Poll</span>
                </button>
              )}
              {!isAuthor && onReportPoll && (
                <button
                  type="button"
                  className="poll-mod-item"
                  onClick={() => {
                    setMenuOpen(false);
                    onReportPoll(poll.id, "poll");
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

      {/* 2. Poll Title (Clickable in feed to open full poll comments) */}
      <h3
        className={`poll-question-title ${!isDetailView && onOpenPoll ? "clickable" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDetailView && onOpenPoll) onOpenPoll(poll);
        }}
      >
        {poll.question}
      </h3>

      {poll.description && (
        <p
          className={`poll-desc-text ${!isDetailView && onOpenPoll ? "clickable" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDetailView && onOpenPoll) onOpenPoll(poll);
          }}
        >
          {poll.description}
        </p>
      )}

      {/* 3. Modern Interactive Choice Options List */}
      <div className="poll-options-list">
        {(poll.options || []).map((option) => {
          const res = activeResults.find((item) => item.option_id === option.id);
          const count = Number(res?.vote_count || 0);
          const percentage =
            totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;

          // Choice is user's vote if matches local or server vote
          const isMyChoice =
            localVoteId === option.id ||
            Boolean(res?.my_vote) ||
            poll.user_voted_option_id === option.id;

          return (
            <div
              key={option.id}
              className={`poll-option-box ${showResults ? "is-result-mode" : "is-vote-mode"} ${isMyChoice ? "is-my-choice" : ""} ${isClosed ? "is-closed" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
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

      {/* 4. Compact Footer Line: Total Votes + Time Remaining */}
      <div className="poll-info-subtext">
        <span>{totalVotes} {totalVotes === 1 ? "total vote" : "total votes"}</span>
        <span className="meta-dot">•</span>
        <span>{getTimeRemainingText(poll.closes_at, isClosed)}</span>
      </div>

      {/* 5. Post Action Bar (Comments, Save, Share, Delete/Report — NO up/down vote arrows) */}
      <div className="poll-actions-bar">
        <button
          type="button"
          className="post-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenPoll) onOpenPoll(poll);
          }}
          title="View discussion & comments"
        >
          <CommentIcon size={16} />
          <span>{poll.comment_count ?? poll.comments_count ?? 0} Comments</span>
        </button>

        <button
          type="button"
          className={`post-action-btn ${isSaved ? "saved-active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleSave) onToggleSave(poll.id);
          }}
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
          <span>{copied ? "Copied!" : "Share"}</span>
        </button>

        {canModAct ? (
          <button
            type="button"
            className="post-action-btn delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (onDeletePoll) onDeletePoll(poll.id);
            }}
            title="Delete poll"
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
              if (onReportPoll) onReportPoll(poll.id, "poll");
            }}
            title="Report poll"
          >
            <FlagIcon size={16} />
            <span>Report</span>
          </button>
        )}
      </div>
    </article>
  );
}
