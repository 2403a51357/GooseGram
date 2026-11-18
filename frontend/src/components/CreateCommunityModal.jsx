import React, { useState } from "react";
import { CloseIcon, ShieldIcon } from "./Icons";
import { api } from "../api";

const CATEGORIES = [
  "Campus Life",
  "Tech & Coding",
  "Career & Jobs",
  "Creative & Arts",
  "Gaming & Hobbies",
  "Sports & Fitness",
  "Academics",
  "General"
];

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/^c\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export default function CreateCommunityModal({ isOpen, onClose, onCreated }) {
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Campus Life");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  function handleSlugChange(e) {
    setSlug(slugify(e.target.value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanSlug = slugify(slug);
    if (!cleanSlug) {
      setError("Please enter a community handle.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.createCommunity({
        name: cleanSlug,
        slug: cleanSlug,
        description: description.trim(),
        category
      });

      setSlug("");
      setDescription("");
      setCategory("Campus Life");
      onClose();

      if (onCreated) {
        onCreated(res.community);
      }
    } catch (err) {
      setError(err.message || "Failed to create community.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-create-community" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Create a Campus Community</h3>
            <p className="modal-subtitle">Start a topic or culture hub for all students.</p>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}

        <div className="anonymity-guideline-box">
          <span className="guide-icon"><ShieldIcon size={18} /></span>
          <div>
            <strong>Strict Student Anonymity Rule:</strong>
            <p>
              To protect student identities, micro-cohort groups (e.g. <em>CSE Sec B</em>, <em>Hostel Rm 302</em>, <em>Roll numbers</em>) are forbidden.
              Keep hubs broad, cultural, and fun.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* 1. Community Handle (Only c/slug, no separate community name) */}
          <div className="form-group">
            <label>Community Handle (c/slug)</label>
            <div className="slug-input-wrapper">
              <span className="slug-prefix">c/</span>
              <input
                type="text"
                placeholder="boys-backbenchers"
                value={slug}
                onChange={handleSlugChange}
                maxLength={35}
                required
                autoFocus
              />
            </div>
            <span className="form-hint">Used for URLs and tags. Lowercase alphanumeric and hyphens only.</span>
          </div>

          {/* 2. Description */}
          <div className="form-group">
            <label>Description</label>
            <textarea
              placeholder="What is this community about? What should students post here?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          {/* 3. Open Category Selection (Chips instead of dropdown) */}
          <div className="form-group">
            <label>Select Category</label>
            <div className="category-select-pills-row">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`category-select-pill ${category === cat ? "active" : ""}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading || !slug.trim()}>
              {loading ? "Creating..." : "Create Community"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
