import React, { useState, useEffect } from "react";
import { ArrowLeftIcon, SearchIcon, PlusIcon, CompassIcon } from "./Icons";
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

export default function ExploreCommunitiesPageView({
  onBack,
  onSelectCommunity,
  onOpenCreateCommunity,
  onCommunityMembershipChanged
}) {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [joiningId, setJoiningId] = useState(null);

  useEffect(() => {
    loadCommunities();
  }, [selectedCategory, search]);

  async function loadCommunities() {
    setLoading(true);
    try {
      const data = await api.getCommunities({
        category: selectedCategory === "All" ? undefined : selectedCategory,
        search: search.trim() || undefined
      });
      setCommunities(data.communities || []);
    } catch (err) {
      console.error("Explore communities load error:", err);
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
      if (onCommunityMembershipChanged) {
        onCommunityMembershipChanged(comm.id, res.joined, res.member_count);
      }
    } catch (err) {
      alert(err.message || "Failed to update membership.");
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="explore-page-view">
      {/* Hero Header */}
      <div className="explore-page-header">
        <div className="explore-header-left">
          <div className="explore-title-row">
            <CompassIcon size={24} className="explore-title-icon" />
            <h2>Explore Campus Communities</h2>
          </div>
          <p className="explore-subtitle">
            Discover student hubs, coding clubs, backbenchers circles, and university cultural groups.
          </p>
        </div>

        <button
          type="button"
          className="btn-explore-create-community"
          onClick={onOpenCreateCommunity}
        >
          <PlusIcon size={16} />
          <span>Start a Community</span>
        </button>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="explore-controls-card">
        <div className="explore-search-box">
          <SearchIcon size={18} />
          <input
            type="text"
            placeholder="Search communities by name, topic, or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch("")}
            >
              ✕
            </button>
          )}
        </div>

        <div className="explore-category-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`explore-cat-pill ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Communities Grid */}
      {loading ? (
        <div className="explore-page-loading">
          <div className="loading-spinner" />
          <p>Loading campus communities...</p>
        </div>
      ) : communities.length === 0 ? (
        <div className="explore-page-empty">
          <p>No campus communities found matching "{search || selectedCategory}".</p>
          <button
            type="button"
            className="btn-explore-create-community"
            onClick={onOpenCreateCommunity}
          >
            Create this community now
          </button>
        </div>
      ) : (
        <div className="explore-communities-grid">
          {communities.map((c) => (
            <div
              key={c.id}
              className="explore-community-card"
              onClick={() => onSelectCommunity && onSelectCommunity(c)}
            >
              <div className="card-top-row">
                <div className="community-card-avatar">
                  <span>c/</span>
                </div>
                <div className="community-card-info">
                  <h3 className="community-card-title">c/{c.slug || c.name}</h3>
                </div>
                <button
                  type="button"
                  className={`btn-community-join-pill ${c.is_member ? "joined" : ""}`}
                  onClick={(e) => handleToggleJoin(e, c)}
                  disabled={joiningId === c.id}
                >
                  {joiningId === c.id
                    ? "..."
                    : c.is_member
                    ? "Joined ✓"
                    : "+ Join"}
                </button>
              </div>

              <p className="community-card-desc">
                {c.description || "Campus student hub for discussion, fun, and connection."}
              </p>

              <div className="community-card-footer">
                <span className="community-card-members">
                  <strong>{c.member_count}</strong> {c.member_count === 1 ? "member" : "members"}
                </span>
                <span className="community-category-badge">{c.category || "General"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
