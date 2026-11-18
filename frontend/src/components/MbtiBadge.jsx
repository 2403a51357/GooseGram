import React, { useState, useRef, useEffect } from "react";
import { getMbtiDetails, calculateVibeMatch } from "../data/mbtiQuestions";
import { ChatIcon } from "./Icons";

/**
 * Compact Discord-style MBTI Badge & Floating Mini Vibe Card Popover
 * Rendered with zero space between emoji and 4 letters (e.g., 🐧ENTP)
 */
export default function MbtiBadge({
  mbtiType,
  username,
  currentUser,
  onOpenChat,
  showBadge = true,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState("top"); // "top" or "bottom"
  const timeoutRef = useRef(null);
  const containerRef = useRef(null);

  const details = getMbtiDetails(mbtiType);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  if (!details || showBadge === false) {
    return null;
  }

  const currentUserMbti = currentUser?.mbti_type;
  const isSelf = currentUser && username && (
    currentUser.username?.toLowerCase() === username.toLowerCase() ||
    currentUser.id === username
  );

  const vibeMatch = (!isSelf && currentUserMbti)
    ? calculateVibeMatch(details.code, currentUserMbti)
    : null;

  function handleMouseEnter() {
    clearTimeout(timeoutRef.current);
    // Measure viewport position to avoid clipping
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.top < 220) {
        setPopoverPlacement("bottom");
      } else {
        setPopoverPlacement("top");
      }
    }
    timeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, 150);
  }

  function handleMouseLeave() {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 280);
  }

  function handleClick(e) {
    e.stopPropagation();
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.top < 220) {
        setPopoverPlacement("bottom");
      } else {
        setPopoverPlacement("top");
      }
    }
    setIsOpen((prev) => !prev);
  }

  function handleMessageClick(e) {
    e.stopPropagation();
    setIsOpen(false);
    if (onOpenChat && username) {
      onOpenChat(username);
    }
  }

  return (
    <span
      ref={containerRef}
      className={`mbti-badge-container relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Compact Pill Badge: Zero space between emoji & letters (e.g. 🐧ENTP) */}
      <button
        type="button"
        className={`mbti-pill-badge ${details.pillClass}`}
        onClick={handleClick}
        title={`${details.code} — ${details.title}`}
        aria-label={`${details.code} Goose-ality badge`}
      >
        <span className="mbti-emoji-char">{details.emoji}</span>
        <span className="mbti-code-text">{details.code}</span>
      </button>

      {/* Floating Mini Vibe Card Popover */}
      {isOpen && (
        <div
          className={`mini-vibe-card-popover ${popoverPlacement === "bottom" ? "placement-bottom" : "placement-top"}`}
          onMouseEnter={() => clearTimeout(timeoutRef.current)}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Row */}
          <div className="vibe-card-header">
            <span className="vibe-card-emoji">{details.emoji}</span>
            <div className="vibe-card-title-box">
              <div className="vibe-card-name-row">
                <span className="vibe-card-code">{details.code}</span>
                <span className="vibe-card-sep">—</span>
                <span className="vibe-card-archetype">{details.title}</span>
              </div>
              <span className={`vibe-card-group-tag ${details.groupColor}`}>
                {details.group}
              </span>
            </div>
          </div>

          {/* 1-Line Campus Bio */}
          <p className="vibe-card-bio">"{details.bio}"</p>

          {/* Dynamic Vibe Match % if viewer also has an MBTI badge */}
          {vibeMatch !== null && (
            <div className="vibe-match-strip">
              <div className="vibe-match-header">
                <span className="vibe-match-icon">⚡</span>
                <span className="vibe-match-label">Vibe Match with you:</span>
                <span className="vibe-match-percentage">{vibeMatch}%</span>
              </div>
              <div className="vibe-match-bar-track">
                <div
                  className="vibe-match-bar-fill"
                  style={{ width: `${vibeMatch}%` }}
                />
              </div>
            </div>
          )}

          {/* Bottom Action: Message or Self Label */}
          <div className="vibe-card-footer">
            {isSelf ? (
              <span className="vibe-self-badge">⭐ Your Goose-ality</span>
            ) : (
              onOpenChat && (
                <button
                  type="button"
                  className="btn-vibe-message"
                  onClick={handleMessageClick}
                >
                  <ChatIcon size={14} />
                  <span>Message u/{username}</span>
                </button>
              )
            )}
          </div>
        </div>
      )}
    </span>
  );
}
