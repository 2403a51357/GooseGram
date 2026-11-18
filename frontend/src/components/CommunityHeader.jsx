import React, { useState, useEffect } from "react";
import { api } from "../api";
import { ShieldIcon } from "./Icons";

export default function CommunityHeader({
  community,
  onOpenCreatePost,
  onOpenSettings,
  onMembershipChanged
}) {
  const [isJoining, setIsJoining] = useState(false);
  const [isMember, setIsMember] = useState(community?.is_member || false);
  const [memberCount, setMemberCount] = useState(community?.member_count || 1);

  // Sync state if community prop changes
  useEffect(() => {
    if (community) {
      setIsMember(community.is_member || false);
      setMemberCount(community.member_count || 1);
    }
  }, [community]);

  if (!community) return null;

  async function handleToggleJoin() {
    setIsJoining(true);
    try {
      const res = await api.toggleJoinCommunity(community.slug || community.id);
      setIsMember(res.joined);
      setMemberCount(res.member_count);
      if (onMembershipChanged) {
        onMembershipChanged(community.id, res.joined, res.member_count);
      }
    } catch (err) {
      alert(err.message || "Could not update membership.");
    } finally {
      setIsJoining(false);
    }
  }

  const bannerBg = community.banner_color || "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)";
  const iconContent = community.slug ? community.slug.charAt(0).toUpperCase() : "C";

  return (
    <div className="community-header-card reddit-banner-style">
      {/* Community Banner (matches Image 1) */}
      <div className="community-header-banner" style={{ background: bannerBg }} />

      <div className="community-header-main">
        <div className="community-avatar-bubble">
          <span>{iconContent}</span>
        </div>

        <div className="community-info">
          <div className="community-title-row">
            <h2>c/{community.slug || community.name}</h2>
            {community.is_verified && (
              <span className="verified-badge-icon" title="Official Campus Community">✓</span>
            )}
            {community.is_moderator && (
              <span className="mod-status-tag" title="You are a moderator of this community">
                <ShieldIcon size={12} /> Mod
              </span>
            )}
          </div>

          <p className="community-meta-counts">
            <span><strong>{memberCount}</strong> {memberCount === 1 ? "member" : "members"}</span>
            <span className="meta-dot">·</span>
            <span className="community-category-tag">{community.category || "General"}</span>
          </p>

          {(community.bio || community.description) && (
            <p className="community-description-text">{community.bio || community.description}</p>
          )}
        </div>

        <div className="community-actions">
          <button
            type="button"
            className="btn-community-post"
            onClick={onOpenCreatePost}
          >
            + Create Post
          </button>

          <button
            type="button"
            className={`btn-community-join ${isMember ? "joined" : ""}`}
            onClick={handleToggleJoin}
            disabled={isJoining}
          >
            {isJoining ? "..." : isMember ? "Joined ✓" : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}
