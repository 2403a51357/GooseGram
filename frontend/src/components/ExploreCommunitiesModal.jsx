import React, { useState, useEffect } from "react";
import { CloseIcon } from "./Icons";
import { api } from "../api";

const CATEGORIES = [
  "All",
  "Campus Life",
  "Tech & Coding",
  "Career & Jobs",
  "Creative & Arts",
  "Gaming & Hobbies",
  "Sports & Fitness",
  "Academics",
  "General"
];

export default function ExploreCommunitiesModal({
  isOpen,
  onClose,
  onSelectCommunity,
  onOpenCreate
}) {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [joiningId, setJoiningId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadCommunities();
    }
  }, [isOpen, selectedCategory, search]);

  if (!isOpen) return null;

  async function loadCommunities() {
    setLoading(true);
    try {
      const data = await api.getCommunities({
        category: selectedCategory === "All" ? undefined : selectedCategory,
        search: search.trim() || undefined
      });
      setCommunities(data.communities || []);
    } catch (err) {
      console.error("Explore communities error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleJoin(e, comm) {
    e.stopPropagation();
    setJoiningId(comm.id);
    try {
      const res = await api.toggleJoinCommunity(comm.slug || comm.id);
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === comm.id
            ? { ...c, is_member: res.joined, member_count: res.member_count }
            : c
        )
      );
    } catch (err) {
      alert(err.message || "Failed to update membership.");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-explore-communities" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Campus Communities</h3>
            <p className="modal-subtitle">Discover student hubs, clubs, and interest groups.</p>
          </div>
          <div className="modal-header-actions">
            <button
              className="btn-create-community-header"
              onClick={() => {
                onClose();
                if (onOpenCreate) onOpenCreate();
              }}
            >
              + Create Hub
            </button>
            <button className="btn-modal-close" onClick={onClose}>
              <CloseIcon size={20} />
            </button>
          </div>
        </div>

        {/* Search & Categories Bar */}
        <div className="explore-filters-bar">
          <input
            type="text"
            className="explore-search-input"
            placeholder="Search communities by name or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="category-pills-row">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`category-pill-btn ${selectedCategory === cat ? "active-cat" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Communities List */}
        <div className="explore-communities-list">
          {loading ? (
            <div className="explore-loading">Loading campus hubs...</div>
          ) : communities.length === 0 ? (
            <div className="explore-empty">
              <p>No communities found matching your search.</p>
              <button
                className="btn-create-community-prompt"
                onClick={() => {
                  onClose();
                  if (onOpenCreate) onOpenCreate();
                }}
              >
                Create this community now
              </button>
            </div>
          ) : (
            communities.map((c) => (
              <div
                key={c.id}
                className="community-row-card"
                onClick={() => {
                  onSelectCommunity(c);
                  onClose();
                }}
              >
                <div className="community-row-avatar">
                  <span>c/</span>
                </div>

                <div className="community-row-info">
                  <div className="community-row-title">
                    <span className="community-name-text">c/{c.slug || c.name}</span>
                    <span className="community-category-tag">{c.category}</span>
                  </div>
                  {c.description && (
                    <p className="community-row-desc">{c.description}</p>
                  )}
                  <span className="community-row-members">
                    {c.member_count} {c.member_count === 1 ? "member" : "members"}
                  </span>
                </div>

                <div className="community-row-action">
                  <button
                    className={`btn-row-join ${c.is_member ? "joined" : ""}`}
                    onClick={(e) => handleToggleJoin(e, c)}
                    disabled={joiningId === c.id}
                  >
                    {joiningId === c.id
                      ? "..."
                      : c.is_member
                      ? "Joined ✓"
                      : "Join"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
