import React, { useState, useEffect } from "react";
import { api } from "../api";
import { CloseIcon } from "./Icons";
import { ALL_FLAIRS } from "./LeftSidebar";

export default function CreatePostModal({
  isOpen,
  onClose,
  onSubmit,
  myCommunities = [],
  defaultCommunity = null
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [flair, setFlair] = useState("General");
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [communityRules, setCommunityRules] = useState([]);
  const [activeCommSlug, setActiveCommSlug] = useState("");

  useEffect(() => {
    if (defaultCommunity) {
      setSelectedCommunityId(defaultCommunity.id || "");
      setActiveCommSlug(defaultCommunity.slug || "");
      if (defaultCommunity.rules && defaultCommunity.rules.length > 0) {
        setCommunityRules(defaultCommunity.rules);
      } else if (defaultCommunity.slug) {
        fetchRules(defaultCommunity.slug);
      }
    } else {
      setSelectedCommunityId("");
      setActiveCommSlug("");
      setCommunityRules([]);
    }
  }, [defaultCommunity, isOpen]);

  // When selected community changes
  useEffect(() => {
    if (selectedCommunityId) {
      const match = myCommunities.find((c) => String(c.id) === String(selectedCommunityId));
      if (match) {
        setActiveCommSlug(match.slug);
        fetchRules(match.slug);
      } else {
        setCommunityRules([]);
        setActiveCommSlug("");
      }
    } else {
      setCommunityRules([]);
      setActiveCommSlug("");
    }
  }, [selectedCommunityId, myCommunities]);

  async function fetchRules(slug) {
    try {
      const res = await api.getCommunitySettings(slug);
      setCommunityRules(res.settings?.rules || []);
    } catch {
      setCommunityRules([]);
    }
  }

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError("Please provide both a title and description.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        flair,
        category: flair,
        is_anonymous: isAnonymous,
        community_id: selectedCommunityId || undefined,
        community_slug: activeCommSlug || undefined
      });
      setTitle("");
      setBody("");
      setFlair("General");
      setIsAnonymous(false);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to publish post.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-create-post" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create a Discussion</h3>
          <button className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}

        {/* Community Rules Notice: Pops up before posting to a community */}
        {communityRules && communityRules.length > 0 && (
          <div className="community-rules-notice-banner">
            <div className="rules-notice-header">
              <span className="rules-notice-icon">📋</span>
              <strong>c/{activeCommSlug} Community Rules:</strong>
            </div>
            <ul className="modal-rules-pill-list">
              {communityRules.map((rule, idx) => (
                <li key={rule.id || idx}>
                  <span className="rule-pill-num">{idx + 1}</span>
                  <span className="rule-pill-title">{rule.title}</span>
                  {rule.desc && <span className="rule-pill-desc"> — {rule.desc}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Post Destination */}
          <div className="form-group">
            <label>Post Destination</label>
            <select
              value={selectedCommunityId}
              onChange={(e) => setSelectedCommunityId(e.target.value)}
              className="select-flair"
            >
              <option value="">General Campus Feed</option>
              {myCommunities.map((c) => (
                <option key={c.id} value={c.id}>
                  c/{c.slug} ({c.name})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Select a Flair / Topic</label>
            <select
              value={flair}
              onChange={(e) => setFlair(e.target.value)}
              className="select-flair"
            >
              {ALL_FLAIRS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              placeholder="Discussion title or question..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={250}
              required
            />
          </div>

          <div className="form-group">
            <label>Content</label>
            <textarea
              placeholder="Provide background, details, or questions..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              required
            />
          </div>

          <div className="form-group-checkbox">
            <label className="anon-toggle-label">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              <div className="anon-toggle-text">
                <span className="anon-title">Post anonymously</span>
                <span className="anon-desc">
                  Your platform username will be hidden and replaced with "Anonymous Student". Accountability is preserved privately for college safety.
                </span>
              </div>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? "Publishing..." : "Publish Discussion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
