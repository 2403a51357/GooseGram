import React, { useState, useEffect } from "react";
import { api } from "../api";
import { ShieldIcon } from "./Icons";
import { useRouter } from "../router";
import MbtiBadge from "./MbtiBadge";
import { getMbtiDetails } from "../data/mbtiQuestions";

function sameId(a, b) {
  if (!a || !b) return false;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

export default function RightSidebar({
  currentView = "feed",
  currentCommunity = null,
  activePost = null,
  currentUser = null,
  onOpenCreatePost,
  onOpenCreatePoll,
  onSelectCommunity,
  onCommunityMembershipChanged,
  onOpenProfile,
  onOpenCommunitySettings
}) {
  const { route, navigate } = useRouter();

  const [popularCommunities, setPopularCommunities] = useState([]);
  const [joiningId, setJoiningId] = useState(null);

  // Local community cache & members state
  const [localCommunity, setLocalCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isCurrentUserMod, setIsCurrentUserMod] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState(null);

  // Dynamic Route Classification
  const isCommRoute =
    route.view === "community" ||
    route.view === "community-settings" ||
    (route.view === "post" && Boolean(route.communitySlug || activePost?.community_slug));

  const isVibeOrProfileRoute =
    route.view === "vibe-check" ||
    route.view === "profile";

  const isGlobalFeedRoute = !isCommRoute && !isVibeOrProfileRoute;

  const rawSlug = isCommRoute
    ? (route.communitySlug || currentCommunity?.slug || activePost?.community_slug || "")
    : null;

  const commSlug = rawSlug ? String(rawSlug).replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim() : null;

  // Load popular communities once on mount (used on global feeds)
  useEffect(() => {
    loadPopularCommunities();
  }, []);

  // Sync and fetch active community data and members whenever commSlug changes
  useEffect(() => {
    if (isCommRoute && commSlug) {
      loadMembers(commSlug);

      if (currentCommunity && currentCommunity.slug?.toLowerCase() === commSlug.toLowerCase()) {
        setLocalCommunity(currentCommunity);
      } else {
        api.getCommunity(commSlug)
          .then((res) => {
            if (res.community) {
              setLocalCommunity(res.community);
            }
          })
          .catch((err) => {
            console.error("RightSidebar getCommunity error:", err);
          });
      }
    } else {
      setLocalCommunity(null);
      setMembers([]);
      setIsCurrentUserMod(false);
    }
  }, [isCommRoute, commSlug, currentCommunity]);

  async function loadPopularCommunities() {
    try {
      const res = await api.getCommunities();
      const all = res.communities || [];
      const sorted = [...all].sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
      setPopularCommunities(sorted);
    } catch {
      // Fallback
    }
  }

  async function loadMembers(slug) {
    if (!slug) return;
    setLoadingMembers(true);
    try {
      const res = await api.getCommunityMembers(slug);
      setMembers(res.members || []);
      setIsCurrentUserMod(res.is_current_user_mod || false);
    } catch (err) {
      console.error("Load community members error:", err);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleToggleModRole(targetUserId, currentRole) {
    if (!commSlug) return;
    const newRole = currentRole === "moderator" ? "member" : "moderator";
    setRoleUpdatingId(targetUserId);
    try {
      await api.updateCommunityMemberRole(commSlug, targetUserId, newRole);
      setMembers((prev) => {
        const updated = prev.map((m) =>
          m.user_id === targetUserId ? { ...m, role: newRole } : m
        );
        return updated.sort((a, b) => {
          const scoreA = a.is_creator ? 0 : a.role === "moderator" ? 1 : 2;
          const scoreB = b.is_creator ? 0 : b.role === "moderator" ? 1 : 2;
          if (scoreA !== scoreB) return scoreA - scoreB;
          return (a.username || "").localeCompare(b.username || "");
        });
      });
    } catch (err) {
      alert(err.message || "Failed to update member role.");
    } finally {
      setRoleUpdatingId(null);
    }
  }

  async function handleToggleJoin(e, comm) {
    e.stopPropagation();
    setJoiningId(comm.id);
    try {
      const res = await api.toggleJoinCommunity(comm.slug || comm.id);
      setPopularCommunities((prev) =>
        prev.map((c) =>
          c.id === comm.id
            ? { ...c, is_member: res.joined, member_count: res.member_count }
            : c
        )
      );
      if (onCommunityMembershipChanged) {
        onCommunityMembershipChanged(comm.id, res.joined, res.member_count);
      }
      if (isCommRoute && commSlug === (comm.slug || comm.id)) {
        loadMembers(commSlug);
      }
    } catch (err) {
      alert(err.message || "Failed to update membership.");
    } finally {
      setJoiningId(null);
    }
  }

  // Active community context
  const effectiveCommunity =
    (currentCommunity && currentCommunity.slug?.toLowerCase() === commSlug?.toLowerCase()
      ? currentCommunity
      : localCommunity) ||
    (commSlug
      ? {
          slug: commSlug,
          name: commSlug,
          description: `Campus community for c/${commSlug} discussions.`,
          category: "Campus Life",
          member_count: members.length || 1,
          is_member: false,
          is_moderator: false,
          rules: []
        }
      : null);

  const moderatorCount = members.filter((m) => m.role === "moderator" || m.is_creator).length;

  const isMod = Boolean(
    effectiveCommunity?.is_moderator ||
    isCurrentUserMod ||
    (currentUser && ["admin", "moderator"].includes(currentUser.role)) ||
    (currentUser && effectiveCommunity && sameId(currentUser.id, effectiveCommunity.creator_id))
  );

  const visiblePopular = popularCommunities
    .filter((c) => !effectiveCommunity || (c.id !== effectiveCommunity.id && c.slug !== effectiveCommunity.slug))
    .slice(0, 4);

  // Vibe Check progress for unhatched users
  const progressCount = Object.keys(currentUser?.mbti_progress || {}).length;

  // 14-day retake cooldown status
  let lockDaysRemaining = 0;
  if (currentUser?.mbti_completed_at) {
    const completedDate = new Date(currentUser.mbti_completed_at);
    const cooldownMs = 14 * 24 * 60 * 60 * 1000;
    const timeRemaining = cooldownMs - (Date.now() - completedDate.getTime());
    if (timeRemaining > 0) {
      lockDaysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
    }
  }

  return (
    <aside className="right-sidebar">
      <div className="sidebar-unified-panel">

        {/* ====================================================================
            VIEW A: COMMUNITY & COMMUNITY-SETTINGS ROUTES (/c/:community)
            Hides Global Campus Hub and Popular Communities completely.
            Shows Community Hero, Members & Moderators list, Community Rules,
            and Community Settings button for moderators.
            ==================================================================== */}
        {isCommRoute && effectiveCommunity && (
          <>
            {/* Section 1: Community Header & About */}
            <div className="sidebar-panel-section banner-section">
              <div
                className="community-banner"
                style={{
                  background:
                    effectiveCommunity.banner_color ||
                    "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)"
                }}
              />
              <div className="community-content-padded">
                <div className="community-header-stacked">
                  <span className="community-sidebar-handle">c/{effectiveCommunity.slug}</span>
                  <span className="community-sidebar-category-tag">
                    {effectiveCommunity.category || "Campus Life"}
                  </span>
                </div>

                {(effectiveCommunity.bio || effectiveCommunity.description) && (
                  <p className="community-sidebar-desc-text">
                    {effectiveCommunity.bio || effectiveCommunity.description}
                  </p>
                )}

                <div className="community-stats-row">
                  <div className="stat-pill-item">
                    <span className="stat-pill-num">
                      {effectiveCommunity.member_count || members.length || 1}
                    </span>
                    <span className="stat-pill-label">
                      {(effectiveCommunity.member_count || members.length) === 1
                        ? "Member"
                        : "Members"}
                    </span>
                  </div>
                  <div className="stat-pill-item">
                    <span className="stat-pill-num">{moderatorCount || 1}</span>
                    <span className="stat-pill-label">
                      {moderatorCount === 1 ? "Moderator" : "Moderators"}
                    </span>
                  </div>
                </div>

                <div className="sidebar-action-buttons">
                  <button
                    type="button"
                    className="btn-sidebar-create"
                    onClick={onOpenCreatePost}
                  >
                    Post in c/{effectiveCommunity.slug}
                  </button>

                  {isMod && (
                    <button
                      type="button"
                      className="btn-sidebar-mod-settings"
                      onClick={() => navigate(`/c/${effectiveCommunity.slug}/settings`)}
                      title="Community Moderator Settings"
                    >
                      ⚙ Community Settings
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="panel-section-divider" />

            {/* Section 2: Joined Members & Community Moderators */}
            <div className="sidebar-panel-section members-section">
              <div className="section-header-title">
                <span>COMMUNITY MEMBERS ({members.length})</span>
                <span className="mod-count-badge">
                  <ShieldIcon size={12} />
                  <span>
                    {moderatorCount} {moderatorCount === 1 ? "Mod" : "Mods"}
                  </span>
                </span>
              </div>

              {loadingMembers ? (
                <div className="members-loading-state">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="members-empty-state">
                  <p>No members joined yet.</p>
                </div>
              ) : (
                <div className="community-members-list">
                  {members.map((member) => {
                    const isMemberMod = member.role === "moderator" || member.is_creator;
                    const canManage =
                      isMod &&
                      !member.is_creator &&
                      member.user_id !== currentUser?.id;

                    return (
                      <div key={member.user_id || member.id} className="community-member-row">
                        <div
                          className="member-info-col"
                          onClick={() => onOpenProfile && onOpenProfile(member.username)}
                          title={`View u/${member.username}'s profile`}
                        >
                          <div className={`member-avatar-circle ${isMemberMod ? "mod-avatar" : ""}`}>
                            {member.username?.charAt(0).toUpperCase() || "S"}
                          </div>

                          <div className="member-name-stack">
                            <span className="member-username-text">u/{member.username}</span>
                            <div className="member-role-tags-row">
                              {member.is_creator ? (
                                <span className="role-tag-badge creator" title="Creator & Default Moderator">
                                  Creator · Mod
                                </span>
                              ) : isMemberMod ? (
                                <span className="role-tag-badge mod" title="Community Moderator">
                                  Moderator
                                </span>
                              ) : (
                                <span className="role-tag-badge member">Member</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {canManage && (
                          <button
                            type="button"
                            className={`btn-toggle-mod-role ${isMemberMod ? "demote" : "promote"}`}
                            onClick={() => handleToggleModRole(member.user_id, member.role)}
                            disabled={roleUpdatingId === member.user_id}
                            title={isMemberMod ? "Revoke moderator role" : "Assign moderator role in this community"}
                          >
                            {roleUpdatingId === member.user_id ? "..." : isMemberMod ? "Remove Mod" : "+ Make Mod"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel-section-divider" />

            {/* Section 3: Community Rules */}
            <div className="sidebar-panel-section rules-section">
              <div className="section-header-title">
                <span>c/{effectiveCommunity.slug} Rules</span>
              </div>
              {effectiveCommunity.rules && effectiveCommunity.rules.length > 0 ? (
                <ol className="rules-list compact">
                  {effectiveCommunity.rules.map((rule, idx) => (
                    <li key={rule.id || idx}>
                      <strong>{rule.title}:</strong> {rule.desc || "Follow community safety standards."}
                    </li>
                  ))}
                </ol>
              ) : (
                <ol className="rules-list compact">
                  <li><strong>Zero Doxxing:</strong> Never reveal student names, branches, or phone numbers.</li>
                  <li><strong>Safe & Fun:</strong> Keep discussions helpful, entertaining, and respectful.</li>
                  <li><strong>Campus Relevance:</strong> Share gossips, memes, and university topics.</li>
                </ol>
              )}
            </div>
          </>
        )}

        {/* ====================================================================
            VIEW B: VIBE-CHECK & PROFILE ROUTES (/vibe-check, /u/:username)
            Hides Global Hub and Popular Communities.
            Shows user's Goose-ality MBTI Card & Campus Voice Guidelines.
            ==================================================================== */}
        {isVibeOrProfileRoute && (
          <>
            {/* Goose-ality MBTI Card */}
            {currentUser && currentUser.mbti_type ? (
              <div className="sidebar-panel-section vibe-badge-sidebar-summary">
                <div className="sidebar-section-header-compact">
                  <span className="summary-label">YOUR GOOSE-ALITY</span>
                  <button
                    type="button"
                    className="link-vibe-view"
                    onClick={() => navigate("/vibe-check")}
                  >
                    View Card ↗
                  </button>
                </div>
                <div className="user-mbti-summary-row" style={{ marginTop: "4px" }}>
                  <MbtiBadge
                    mbtiType={currentUser.mbti_type}
                    username={currentUser.username}
                    currentUser={currentUser}
                    showBadge={true}
                  />
                  <span className="user-mbti-archetype-name">
                    {getMbtiDetails(currentUser.mbti_type)?.title}
                  </span>
                </div>
                {getMbtiDetails(currentUser.mbti_type)?.animal && (
                  <p className="community-sidebar-desc-text" style={{ marginTop: "8px", marginBottom: "8px" }}>
                    {getMbtiDetails(currentUser.mbti_type)?.animal} · "{getMbtiDetails(currentUser.mbti_type)?.quote || getMbtiDetails(currentUser.mbti_type)?.tagline || ''}"
                  </p>
                )}
                {lockDaysRemaining > 0 ? (
                  <div className="vibe-lock-status-pill">
                    🔒 Locked for 14-day cycle ({lockDaysRemaining} {lockDaysRemaining === 1 ? "day" : "days"} left)
                  </div>
                ) : (
                  <div className="vibe-lock-status-pill eligible">
                    ✨ Eligible to retake Vibe Check
                  </div>
                )}
                <button
                  type="button"
                  className="btn-vibe-callout-action"
                  style={{ marginTop: "8px" }}
                  onClick={() => navigate("/vibe-check")}
                >
                  {route.view === "vibe-check" ? "Review Vibe Breakdown ↗" : "View Full Vibe Card ↗"}
                </button>
              </div>
            ) : currentUser && !currentUser.mbti_type ? (
              <div className="sidebar-panel-section vibe-check-sidebar-callout">
                <div className="vibe-callout-header">
                  <span className="egg-icon">🥚</span>
                  <div className="vibe-callout-text-wrap">
                    <h4 className="vibe-callout-title">
                      {progressCount > 0
                        ? `Resume Vibe Check (${progressCount}/30)`
                        : "Hatch Your Campus Badge 🥚"}
                    </h4>
                    <p className="vibe-callout-desc">
                      {progressCount > 0
                        ? "Pick up where you left off to calculate your 4-letter Goose-ality badge."
                        : "Answer 30 campus scenarios to earn your campus badge & unlock student vibe matching."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-vibe-callout-action"
                  onClick={() => navigate("/vibe-check")}
                >
                  {progressCount > 0 ? "Resume Quiz →" : "Hatch Campus Badge →"}
                </button>
              </div>
            ) : null}

            <div className="panel-section-divider" />

            {/* Campus Guidelines */}
            <div className="sidebar-panel-section rules-section">
              <div className="section-header-title">
                <span>Campus Voice Guidelines</span>
              </div>
              <ol className="rules-list compact">
                <li><strong>Zero Doxxing:</strong> Keep student identities safe and private.</li>
                <li><strong>Authentic Goose-ality:</strong> Badges are earned through honest quiz answers.</li>
                <li><strong>Safe & Fun:</strong> Keep discussions helpful, entertaining, and respectful.</li>
              </ol>
            </div>
          </>
        )}

        {/* ====================================================================
            VIEW C: GLOBAL HOME & FEEDS (/, /popular, /latest, /polls, /saved)
            Shows Vibe Check Callout if unhatched, GooseGram Campus Hub,
            Popular Communities, and Campus Rules.
            ==================================================================== */}
        {isGlobalFeedRoute && (
          <>
            {/* Top Widget 1: Hatch Egg Callout for Unhatched Students */}
            {currentUser && !currentUser.mbti_type && (
              <div className="sidebar-panel-section vibe-check-sidebar-callout">
                <div className="vibe-callout-header">
                  <span className="egg-icon">🥚</span>
                  <div className="vibe-callout-text-wrap">
                    <h4 className="vibe-callout-title">
                      {progressCount > 0
                        ? `Resume Vibe Check (${progressCount}/30) 🥚`
                        : "Hatch Your Campus Badge 🥚"}
                    </h4>
                    <p className="vibe-callout-desc">
                      {progressCount > 0
                        ? "Pick up where you left off to earn your campus badge."
                        : "Answer 30 campus scenarios to calculate your 4-letter personality badge and unlock student vibe matching."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-vibe-callout-action"
                  onClick={() => navigate("/vibe-check")}
                >
                  {progressCount > 0 ? "Resume Vibe Check →" : "Hatch Your Badge →"}
                </button>
              </div>
            )}

            {/* Top Widget 2: Compact Goose-ality Summary for Hatched Students */}
            {currentUser && currentUser.mbti_type && (
              <div className="sidebar-panel-section vibe-badge-sidebar-summary">
                <div className="sidebar-section-header-compact">
                  <span className="summary-label">YOUR GOOSE-ALITY</span>
                  <button
                    type="button"
                    className="link-vibe-view"
                    onClick={() => navigate("/vibe-check")}
                  >
                    View Card ↗
                  </button>
                </div>
                <div className="user-mbti-summary-row">
                  <MbtiBadge
                    mbtiType={currentUser.mbti_type}
                    username={currentUser.username}
                    currentUser={currentUser}
                    showBadge={true}
                  />
                  <span className="user-mbti-archetype-name">
                    {getMbtiDetails(currentUser.mbti_type)?.title}
                  </span>
                </div>
              </div>
            )}

            {/* Section 1: GooseGram Campus Hub */}
            <div className="sidebar-panel-section banner-section">
              <div className="community-banner" />
              <div className="community-content-padded">
                <div className="community-header">
                  <h3>GooseGram Campus Hub</h3>
                </div>
                <p className="community-desc">
                  The university-wide student pulse. Real campus gossips, memes, tech talk, college life, and honest reviews with 100% verified student pseudonymity.
                </p>

                <div className="community-stats">
                  <div className="stat-col">
                    <span className="stat-value">College Verified</span>
                    <span className="stat-label">Students Only</span>
                  </div>
                  <div className="stat-col">
                    <span className="stat-value">100%</span>
                    <span className="stat-label">Pseudonymous</span>
                  </div>
                </div>

                <div className="sidebar-action-buttons">
                  <button
                    type="button"
                    className="btn-sidebar-create"
                    onClick={onOpenCreatePost}
                  >
                    Create Discussion
                  </button>
                  <button
                    type="button"
                    className="btn-sidebar-poll"
                    onClick={onOpenCreatePoll}
                  >
                    + Start a Poll
                  </button>
                </div>
              </div>
            </div>

            <div className="panel-section-divider" />

            {/* Section 2: Popular Communities */}
            {visiblePopular.length > 0 && (
              <>
                <div className="sidebar-panel-section popular-section">
                  <div className="section-header-title">
                    <span>POPULAR COMMUNITIES</span>
                  </div>
                  <div className="popular-hubs-list">
                    {visiblePopular.map((c) => (
                      <div
                        key={c.id}
                        className="popular-hub-row"
                        onClick={() => onSelectCommunity && onSelectCommunity(c)}
                      >
                        <div className="popular-hub-info">
                          <span className="popular-hub-name">c/{c.slug || c.name}</span>
                          <span className="popular-hub-count">{c.member_count || 0} members</span>
                        </div>
                        <button
                          type="button"
                          className={`btn-hub-quick-join ${c.is_member ? "joined" : ""}`}
                          onClick={(e) => handleToggleJoin(e, c)}
                          disabled={joiningId === c.id}
                        >
                          {joiningId === c.id ? "..." : c.is_member ? "Joined" : "+ Join"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel-section-divider" />
              </>
            )}

            {/* Section 3: Campus Rules */}
            <div className="sidebar-panel-section rules-section">
              <div className="section-header-title">
                <span>Campus Voice Rules</span>
              </div>
              <ol className="rules-list compact">
                <li><strong>Zero Doxxing:</strong> Never reveal student names, branches, or rooms.</li>
                <li><strong>Safe & Fun:</strong> Keep discussions helpful, entertaining, and respectful.</li>
                <li><strong>No Targeted Harassment:</strong> Keep complaints institutional, not personal.</li>
              </ol>
            </div>
          </>
        )}

      </div>
    </aside>
  );
}
