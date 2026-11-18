import React, { useState, useEffect } from "react";
import { api } from "../api";
import CommunityHeader from "./CommunityHeader";
import PostCard from "./PostCard";
import { ClockIcon, TrendingIcon, SparklesIcon, SearchIcon, PinIcon } from "./Icons";

export default function CommunityPageView({
  slug,
  currentUser,
  onOpenCreatePost,
  onOpenSettings,
  onOpenPost,
  onOpenProfile,
  onVotePost,
  onToggleSave,
  savedPostIds = new Set(),
  onDeletePost,
  onReportPost,
  onPinPost,
  onMembershipChanged,
  onSelectCommunity,
  onOpenChat
}) {
  const [community, setCommunity] = useState(null);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [communityError, setCommunityError] = useState("");

  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [sortBy, setSortBy] = useState("newest");
  const [selectedFlair, setSelectedFlair] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const cleanSlug = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();

  // Load Community Details
  useEffect(() => {
    if (!cleanSlug) return;
    loadCommunityData(cleanSlug);
  }, [cleanSlug]);

  // Load Posts when community, sort, flair, or search changes
  useEffect(() => {
    if (!cleanSlug) return;
    loadCommunityPosts(cleanSlug);
  }, [cleanSlug, sortBy, selectedFlair, searchQuery]);

  async function loadCommunityData(targetSlug) {
    setLoadingCommunity(true);
    setCommunityError("");
    try {
      const res = await api.getCommunity(targetSlug);
      if (res.community) {
        setCommunity(res.community);
      } else {
        setCommunityError(`Community c/${targetSlug} not found.`);
      }
    } catch (err) {
      console.error("Community load error:", err);
      // Fallback display so the user doesn't lose the community page
      setCommunity({
        slug: targetSlug,
        name: targetSlug,
        description: `Welcome to the c/${targetSlug} campus community.`,
        member_count: 1,
        is_member: false,
        is_moderator: false,
        banner_color: "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)",
        rules: [],
        pinned_post_ids: []
      });
    } finally {
      setLoadingCommunity(false);
    }
  }

  async function loadCommunityPosts(targetSlug) {
    setLoadingPosts(true);
    try {
      const res = await api.getPosts({
        community: targetSlug,
        sort: sortBy,
        flair: selectedFlair || undefined,
        search: searchQuery || undefined
      });
      let commPosts = res.posts || [];
      // Inside community page, sort pinned posts to top:
      commPosts.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1;
        }
        if (sortBy === "popular") return (b.score || 0) - (a.score || 0);
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
      setPosts(commPosts);
    } catch (err) {
      console.error("Community posts load error:", err);
    } finally {
      setLoadingPosts(false);
    }
  }

  async function handleLocalPinPost(postId, commSlug) {
    if (onPinPost) {
      await onPinPost(postId, commSlug);
      await loadCommunityPosts(cleanSlug);
      await loadCommunityData(cleanSlug);
    }
  }

  function handleCommunityMembership(commId, joined, count) {
    setCommunity((prev) =>
      prev ? { ...prev, is_member: joined, member_count: count } : prev
    );
    if (onMembershipChanged) {
      onMembershipChanged(commId, joined, count);
    }
  }

  // Pinned Posts (Community Highlights)
  const pinnedPostIds = new Set(community?.pinned_post_ids || []);
  const pinnedPosts = posts.filter(
    (p) => pinnedPostIds.has(String(p.id)) || p.is_pinned
  );

  const isMod = Boolean(community?.is_moderator || currentUser?.role === "admin");

  if (loadingCommunity) {
    return (
      <div className="community-page-view loading-view">
        <div className="community-page-loading-skeleton">
          <div className="skeleton-banner" />
          <div className="skeleton-info-row">
            <div className="skeleton-avatar" />
            <div className="skeleton-text-group">
              <div className="skeleton-line title" />
              <div className="skeleton-line sub" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (communityError && !community) {
    return (
      <div className="community-page-view error-view">
        <div className="community-not-found-card">
          <h2>Community Not Found</h2>
          <p>The community <strong>c/{cleanSlug}</strong> does not exist yet on CampusVoice.</p>
          <div className="not-found-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={onOpenCreatePost}
            >
              Start this Community
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="community-page-view">
      {/* 1. Community Hero Header (Reddit Banner Style) */}
      <CommunityHeader
        community={community}
        onOpenCreatePost={onOpenCreatePost}
        onOpenSettings={onOpenSettings}
        onMembershipChanged={handleCommunityMembership}
      />

      {/* 2. Reddit-style Quick Create Post Bar */}
      <div
        className="community-quick-create-bar"
        onClick={onOpenCreatePost}
        role="button"
        tabIndex={0}
      >
        <div className="quick-avatar">
          {currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : "U"}
        </div>
        <div className="quick-input-placeholder">
          <span>Create a post in c/{community.slug || cleanSlug}...</span>
        </div>
        <button type="button" className="quick-create-btn">
          + Create Post
        </button>
      </div>

      {/* 3. Community Highlights / Pinned Announcements (Image 1 Style) */}
      {pinnedPosts.length > 0 && (
        <section className="community-highlights-section">
          <div className="highlights-header">
            <PinIcon size={14} className="highlights-icon" />
            <h4>Community Highlights & Announcements</h4>
          </div>
          <div className="highlights-cards-grid">
            {pinnedPosts.map((p) => (
              <div
                key={`highlight-${p.id}`}
                className="highlight-card"
                onClick={() => onOpenPost && onOpenPost(p)}
              >
                <div className="highlight-tag">📌 Announcement</div>
                <h5 className="highlight-title">{p.title}</h5>
                <div className="highlight-meta">
                  <span>u/{p.author_username}</span>
                  <span>•</span>
                  <span>{p.upvotes || 0} upvotes</span>
                  <span>•</span>
                  <span>{p.comment_count || 0} comments</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. Filter & Sort Bar */}
      <div className="feed-sort-bar community-sort-bar">
        <div className="sort-buttons-group">
          <button
            type="button"
            className={`sort-pill ${sortBy === "newest" ? "active-sort" : ""}`}
            onClick={() => setSortBy("newest")}
          >
            <ClockIcon size={14} />
            <span>Newest</span>
          </button>
          <button
            type="button"
            className={`sort-pill ${sortBy === "popular" ? "active-sort" : ""}`}
            onClick={() => setSortBy("popular")}
          >
            <TrendingIcon size={14} />
            <span>Popular</span>
          </button>
          <button
            type="button"
            className={`sort-pill ${sortBy === "top" ? "active-sort" : ""}`}
            onClick={() => setSortBy("top")}
          >
            <SparklesIcon size={14} />
            <span>Top</span>
          </button>
        </div>

        {selectedFlair && (
          <div className="active-filter-badge">
            <span>Topic: <strong>{selectedFlair}</strong></span>
            <button onClick={() => setSelectedFlair(null)}>✕</button>
          </div>
        )}
      </div>

      {searchQuery && (
        <div className="search-results-banner">
          <span>Searching c/{community.slug} for: "<strong>{searchQuery}</strong>"</span>
          <button onClick={() => setSearchQuery("")}>Clear Search</button>
        </div>
      )}

      {/* 5. Posts Feed */}
      <section className="community-posts-feed">
        {loadingPosts ? (
          <div className="feed-loading-state">
            <div className="loading-spinner" />
            <p>Waddling through the pond...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="feed-empty-state community-empty-state">
            <p>The pond is suspiciously quiet. Drop some tea.</p>
            <button
              type="button"
              className="btn-primary"
              onClick={onOpenCreatePost}
            >
              Spill Some Tea
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onVote={onVotePost}
              onToggleSave={onToggleSave}
              isSaved={savedPostIds.has(post.id)}
              onOpenProfile={onOpenProfile}
              onDeletePost={onDeletePost}
              onReportPost={onReportPost}
              onPinPost={handleLocalPinPost}
              isCommunityMod={isMod}
              onSelectCommunity={onSelectCommunity}
              onOpenPost={onOpenPost}
              onOpenChat={onOpenChat}
              inCommunity={true}
            />
          ))
        )}
      </section>
    </div>
  );
}
