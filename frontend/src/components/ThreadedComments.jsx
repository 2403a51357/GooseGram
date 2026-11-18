import React, { useState } from "react";
import { CommentIcon } from "./Icons";
import MbtiBadge from "./MbtiBadge";

export default function ThreadedComments({
  comments = [],
  onAddComment,
  postId,
  onOpenProfile,
  onOpenChat,
  currentUser
}) {
  const [rootCommentText, setRootCommentText] = useState("");
  const [isAnonymousRoot, setIsAnonymousRoot] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [isAnonymousReply, setIsAnonymousReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [optimisticComments, setOptimisticComments] = useState([]);

  // Merge server comments with active optimistic comments
  const allComments = [
    ...comments,
    ...optimisticComments.filter((opt) => !comments.some((c) => c.id === opt.id))
  ];

  // Build comment tree
  const commentMap = {};
  const rootComments = [];

  allComments.forEach((c) => {
    commentMap[c.id] = { ...c, replies: [] };
  });

  allComments.forEach((c) => {
    if (c.parent_comment_id && commentMap[c.parent_comment_id]) {
      commentMap[c.parent_comment_id].replies.push(commentMap[c.id]);
    } else {
      rootComments.push(commentMap[c.id]);
    }
  });

  async function handleRootSubmit(e) {
    e.preventDefault();
    if (!rootCommentText.trim() || submitting) return;

    const text = rootCommentText.trim();
    const isAnon = isAnonymousRoot;
    const tempId = `temp-${Date.now()}`;
    const optimisticNode = {
      id: tempId,
      post_id: postId,
      parent_comment_id: null,
      body: text,
      is_anonymous: isAnon,
      author_username: isAnon ? null : (currentUser?.username || "You"),
      author: isAnon ? "Anonymous Student" : (currentUser?.username || "You"),
      created_at: new Date().toISOString()
    };

    // Instant optimistic UI update
    setOptimisticComments((prev) => [...prev, optimisticNode]);
    setRootCommentText("");
    setIsAnonymousRoot(false);
    setSubmitting(true);

    try {
      await onAddComment(postId, {
        body: text,
        is_anonymous: isAnon
      });
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
    } catch (err) {
      alert(err.message || "Failed to post comment.");
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
      setRootCommentText(text);
      setIsAnonymousRoot(isAnon);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReplySubmit(parentCommentId) {
    if (!replyText.trim() || submitting) return;

    const text = replyText.trim();
    const isAnon = isAnonymousReply;
    const tempId = `temp-${Date.now()}`;
    const optimisticNode = {
      id: tempId,
      post_id: postId,
      parent_comment_id: parentCommentId,
      body: text,
      is_anonymous: isAnon,
      author_username: isAnon ? null : (currentUser?.username || "You"),
      author: isAnon ? "Anonymous Student" : (currentUser?.username || "You"),
      created_at: new Date().toISOString()
    };

    // Instant optimistic UI update
    setOptimisticComments((prev) => [...prev, optimisticNode]);
    setReplyText("");
    setReplyingToId(null);
    setIsAnonymousReply(false);
    setSubmitting(true);

    try {
      await onAddComment(postId, {
        body: text,
        parent_comment_id: parentCommentId,
        is_anonymous: isAnon
      });
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
    } catch (err) {
      alert(err.message || "Failed to post reply.");
      setOptimisticComments((prev) => prev.filter((c) => c.id !== tempId));
      setReplyText(text);
      setReplyingToId(parentCommentId);
      setIsAnonymousReply(isAnon);
    } finally {
      setSubmitting(false);
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

  function renderCommentNode(node, depth = 0) {
    const isReplying = replyingToId === node.id;

    return (
      <div
        key={node.id}
        className={`comment-thread-node ${depth > 0 ? "nested-reply" : ""}`}
      >
        <div className="comment-item-flow">
          {/* Comment Author Header */}
          <div className="comment-header">
            {node.is_anonymous ? (
              <span className="comment-anon-badge">🎭 Anonymous Student</span>
            ) : (
              <button
                type="button"
                className="author-profile-link comment-author-link"
                onClick={() => onOpenProfile && onOpenProfile(node.author_username || node.author)}
              >
                u/{node.author_username || node.author || "Student"}
              </button>
            )}
            {!node.is_anonymous && (node.author_mbti || (currentUser?.username === (node.author_username || node.author) && currentUser?.mbti_type)) && (
              <MbtiBadge
                mbtiType={node.author_mbti || currentUser?.mbti_type}
                username={node.author_username || node.author}
                currentUser={currentUser}
                onOpenChat={onOpenChat}
              />
            )}
            <span className="comment-dot">·</span>
            <span className="comment-time">{formatTime(node.created_at)}</span>
          </div>

          {/* Comment Body */}
          <p className="comment-body">{node.body}</p>

          {/* Actions Bar */}
          <div className="comment-actions">
            <button
              type="button"
              className="comment-reply-trigger-btn"
              onClick={() => {
                setReplyingToId(isReplying ? null : node.id);
                setReplyText("");
                setIsAnonymousReply(false);
              }}
            >
              <CommentIcon size={13} />
              <span>{isReplying ? "Close Reply" : "Reply"}</span>
            </button>
          </div>

          {/* Inline Reply Form */}
          {isReplying && (
            <div className="inline-reply-container">
              <textarea
                placeholder={`Replying to ${node.is_anonymous ? "Anonymous Student" : "u/" + (node.author_username || "Student")}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="reply-options-row">
                <label className={`anon-attractive-pill small ${isAnonymousReply ? "active" : ""}`}>
                  <input
                    type="checkbox"
                    checked={isAnonymousReply}
                    onChange={(e) => setIsAnonymousReply(e.target.checked)}
                  />
                  <span className="anon-pill-switch">
                    <span className="anon-pill-thumb" />
                  </span>
                  <span className="anon-pill-text">
                    {isAnonymousReply ? "🎭 Anonymous" : `Public (u/${currentUser?.username || "You"})`}
                  </span>
                </label>

                <div className="reply-buttons-group">
                  <button
                    type="button"
                    className="btn-reply-cancel"
                    onClick={() => setReplyingToId(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-reply-send"
                    onClick={() => handleReplySubmit(node.id)}
                    disabled={submitting || !replyText.trim()}
                  >
                    {submitting ? "Sending..." : "Reply"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nested Replies with Vertical Connector Tree */}
        {node.replies && node.replies.length > 0 && (
          <div className="comment-replies-list">
            {node.replies.map(r => renderCommentNode(r, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="threaded-comments-container">
      {/* Root Comment Form */}
      <form onSubmit={handleRootSubmit} className="root-comment-form">
        <textarea
          id="comment-composer-textarea"
          placeholder="What are your thoughts on this discussion? Keep it respectful."
          value={rootCommentText}
          onChange={(e) => setRootCommentText(e.target.value)}
          rows={3}
        />
        <div className="root-comment-actions">
          {/* Attractive Anonymous Toggle Pill */}
          <label className={`anon-attractive-pill ${isAnonymousRoot ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={isAnonymousRoot}
              onChange={(e) => setIsAnonymousRoot(e.target.checked)}
            />
            <span className="anon-pill-switch">
              <span className="anon-pill-thumb" />
            </span>
            <span className="anon-pill-text">
              {isAnonymousRoot ? "🎭 Commenting Anonymously (Secret)" : `Public as u/${currentUser?.username || "You"}`}
            </span>
          </label>

          <button
            type="submit"
            className="btn-comment-submit"
            disabled={submitting || !rootCommentText.trim()}
          >
            {submitting ? "Posting..." : "Comment"}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="comments-tree-list">
        {rootComments.length === 0 ? (
          <div className="empty-comments-state">
            <p>Zero honks in the comments yet. Be the first goose to speak.</p>
          </div>
        ) : (
          rootComments.map(c => renderCommentNode(c, 0))
        )}
      </div>
    </div>
  );
}
