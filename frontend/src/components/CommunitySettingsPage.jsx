import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "../router";
import { api } from "../api";
import { ShieldIcon, TrashIcon, CheckIcon } from "./Icons";

export default function CommunitySettingsPage({
  slug: propSlug,
  currentUser
}) {
  const { route, navigate, getCommunityUrl } = useRouter();
  const slug = propSlug || route.communitySlug;
  const cleanSlug = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isModerator, setIsModerator] = useState(false);

  // Settings State (Original & Dirty)
  const [communityData, setCommunityData] = useState(null);
  const [bio, setBio] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [rules, setRules] = useState([]);
  const [downvoteThreshold, setDownvoteThreshold] = useState(10);

  // Snapshot for dirty check
  const [originalSnapshot, setOriginalSnapshot] = useState(null);

  // Muted users & Review queue state
  const [mutes, setMutes] = useState([]);
  const [muteUsername, setMuteUsername] = useState("");
  const [muteDuration, setMuteDuration] = useState("24h");
  const [muteReason, setMuteReason] = useState("");
  const [membersList, setMembersList] = useState([]);
  const [hiddenPosts, setHiddenPosts] = useState([]);

  // In-flight action states
  const [savingSettings, setSavingSettings] = useState(false);
  const [applyingMute, setApplyingMute] = useState(false);
  const [reviewActionPostId, setReviewActionPostId] = useState(null);

  // New Rule inputs
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleDesc, setNewRuleDesc] = useState("");

  useEffect(() => {
    if (!cleanSlug) return;
    loadAll();
  }, [cleanSlug]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      // 1. Verify community and moderator status
      const commRes = await api.getCommunity(cleanSlug);
      const comm = commRes.community;
      if (!comm) {
        setError(`Community c/${cleanSlug} not found.`);
        setLoading(false);
        return;
      }

      const userIsMod = Boolean(comm.is_moderator || currentUser?.role === "admin");
      if (!userIsMod) {
        // Route Guard: immediately redirect back to community page if not a moderator
        navigate(getCommunityUrl(cleanSlug));
        return;
      }

      setIsModerator(true);
      setCommunityData(comm);

      // 2. Load settings, mutes, and review queue
      const setRes = await api.getCommunitySettings(cleanSlug);
      const st = setRes.settings || {};

      const loadedBio = st.bio || comm.bio || comm.description || "";
      const loadedIcon = st.icon_url || comm.icon_url || "";
      const loadedRules = st.rules || comm.rules || [];
      const loadedThreshold = st.downvote_threshold ?? comm.downvote_threshold ?? 10;

      setBio(loadedBio);
      setIconUrl(loadedIcon);
      setRules(loadedRules);
      setDownvoteThreshold(loadedThreshold);
      setMutes(st.timeouts || st.mutes || []);
      setHiddenPosts(st.hidden_posts || []);

      setOriginalSnapshot(JSON.stringify({
        bio: loadedBio,
        icon_url: loadedIcon,
        rules: loadedRules,
        downvote_threshold: loadedThreshold
      }));

      // 3. Load members list for muting autocomplete
      try {
        const memRes = await api.getCommunityMembers(cleanSlug);
        setMembersList(memRes.members || []);
      } catch {
        // Ignore members lookup failure
      }

    } catch (err) {
      console.error("Failed to load community settings:", err);
      setError(err.message || "Failed to load community settings.");
    } finally {
      setLoading(false);
    }
  }

  // Dirty state checking
  const currentSnapshot = JSON.stringify({
    bio,
    icon_url: iconUrl,
    rules,
    downvote_threshold: downvoteThreshold
  });
  const hasUnsavedChanges = originalSnapshot !== null && currentSnapshot !== originalSnapshot;

  function handleResetChanges() {
    if (!originalSnapshot) return;
    const parsed = JSON.parse(originalSnapshot);
    setBio(parsed.bio);
    setIconUrl(parsed.icon_url);
    setRules(parsed.rules);
    setDownvoteThreshold(parsed.downvote_threshold);
    setError("");
    setSuccessMsg("");
  }

  async function handleSaveSettings(e) {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setError("");
    setSuccessMsg("");

    try {
      const payload = {
        bio: bio.trim(),
        icon_url: iconUrl.trim(),
        rules,
        downvote_threshold: Number(downvoteThreshold)
      };

      const res = await api.updateCommunitySettings(cleanSlug, payload);
      const updated = res.settings || payload;

      setOriginalSnapshot(JSON.stringify({
        bio: updated.bio ?? payload.bio,
        icon_url: updated.icon_url ?? payload.icon_url,
        rules: updated.rules ?? payload.rules,
        downvote_threshold: updated.downvote_threshold ?? payload.downvote_threshold
      }));

      setSuccessMsg("Community settings saved successfully to Supabase.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  // Rule additions, reordering, deletions
  function handleAddRule(e) {
    e.preventDefault();
    if (!newRuleTitle.trim()) return;
    if (rules.length >= 5) {
      setError("Maximum limit of 5 community rules allowed.");
      return;
    }
    const updated = [
      ...rules,
      {
        id: `rule-${Date.now()}`,
        title: newRuleTitle.trim(),
        description: newRuleDesc.trim()
      }
    ];
    setRules(updated);
    setNewRuleTitle("");
    setNewRuleDesc("");
  }

  function handleDeleteRule(ruleId) {
    setRules(rules.filter((r) => r.id !== ruleId));
  }

  function handleMoveRule(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= rules.length) return;
    const next = [...rules];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setRules(next);
  }

  // Review Queue actions (Approve & Restore / Delete)
  async function handleRestorePost(postId) {
    setReviewActionPostId(postId);
    try {
      await api.restoreCommunityPost(cleanSlug, postId);
      setHiddenPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)));
      setSuccessMsg("Post restored back to community feed.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to restore post.");
    } finally {
      setReviewActionPostId(null);
    }
  }

  async function handleDeleteReviewPost(postId) {
    if (!window.confirm("Are you sure you want to permanently delete this disruptive post?")) return;
    setReviewActionPostId(postId);
    try {
      await api.deletePost(postId);
      setHiddenPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)));
      setSuccessMsg("Disruptive post permanently deleted.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to delete post.");
    } finally {
      setReviewActionPostId(null);
    }
  }

  // Mute / Pond Timeout handlers
  async function handleApplyMute(e) {
    e.preventDefault();
    const cleanUser = muteUsername.replace(/^(u\/|@)/, "").trim();
    if (!cleanUser) {
      setError("Please specify a student's pseudonymous handle (u/username) to mute.");
      return;
    }

    setApplyingMute(true);
    setError("");
    try {
      const res = await api.createCommunityMute(cleanSlug, {
        username: cleanUser,
        duration: muteDuration,
        reason: muteReason.trim() || "Violating community rules"
      });
      setMutes(res.timeouts || res.mutes || []);
      setMuteUsername("");
      setMuteReason("");
      setSuccessMsg(`u/${cleanUser} has been muted (${muteDuration}).`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to apply pond mute.");
    } finally {
      setApplyingMute(false);
    }
  }

  async function handleUnmute(muteId) {
    try {
      const res = await api.removeCommunityMute(cleanSlug, muteId);
      setMutes(res.timeouts || res.mutes || []);
      setSuccessMsg("Student unmuted.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to unmute student.");
    }
  }

  if (loading) {
    return (
      <div className="community-settings-route-page loading">
        <div className="settings-page-spinner" />
        <p>Verifying moderator credentials and loading settings...</p>
      </div>
    );
  }

  return (
    <div className="community-settings-route-page">
      {/* Page Heading (Classic flat single-column) */}
      <div className="settings-route-header">
        <div className="settings-route-title-group">
          <div className="settings-mod-shield-badge">
            <ShieldIcon size={14} />
            <span>Moderator Control Center</span>
          </div>
          <h1 className="settings-route-main-title">c/{cleanSlug} Settings</h1>
          <p className="settings-route-desc">
            Configure community guidelines, public appearance, review queue thresholds, and student mutes.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && <div className="settings-route-alert error">{error}</div>}
      {successMsg && <div className="settings-route-alert success">{successMsg}</div>}

      {/* Stacked Vertical Settings Sections (Divided by full-width 1px border lines) */}
      <div className="settings-stacked-sections">

        {/* ===================================================================
            SECTION 1: COMMUNITY APPEARANCE & BIO
            =================================================================== */}
        <section className="settings-section-row">
          <div className="section-meta-left">
            <h3 className="section-label-heading">Community Appearance & Bio</h3>
            <p className="section-label-sub">
              Customize public info and profile icon. Community name and URL slug remain immutable to preserve links.
            </p>
          </div>

          <div className="section-inputs-right">
            {/* Immutable Community Handle */}
            <div className="settings-input-block">
              <label className="input-field-label">Community Handle & Slug</label>
              <div className="immutable-slug-field">
                <span className="immutable-prefix">c/</span>
                <input type="text" value={cleanSlug} disabled readOnly className="immutable-input" />
                <span className="immutable-lock-pill">🔒 Immutable</span>
              </div>
              <span className="input-hint-note">The URL slug cannot be altered after creation.</span>
            </div>

            {/* Community Icon URL & Preview */}
            <div className="settings-input-block">
              <label className="input-field-label" htmlFor="comm-icon-input">Community Icon URL</label>
              <div className="icon-input-with-preview">
                <div className="icon-preview-circle">
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={`c/${cleanSlug} icon`}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <span>{cleanSlug.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <input
                  id="comm-icon-input"
                  type="url"
                  placeholder="https://example.com/community-icon.png"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  className="flat-settings-input flex-1"
                />
              </div>
              <span className="input-hint-note">Enter an image URL for the community avatar.</span>
            </div>

            {/* Community Bio */}
            <div className="settings-input-block">
              <label className="input-field-label" htmlFor="comm-bio-input">Community Bio</label>
              <textarea
                id="comm-bio-input"
                rows={3}
                placeholder="Describe your community topic, scope, and student guidelines..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                className="flat-settings-textarea"
              />
              <span className="input-hint-note">Displayed on the community header, sidebar, and search results.</span>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 2: COMMUNITY RULES (MAX 5)
            =================================================================== */}
        <section className="settings-section-row">
          <div className="section-meta-left">
            <div className="section-label-with-badge">
              <h3 className="section-label-heading">Community Rules</h3>
              <span className="rule-count-pill">{rules.length} / 5</span>
            </div>
            <p className="section-label-sub">
              Clear student conduct rules. These appear in the community right sidebar and pop up in a confirmation dialog before posting.
            </p>
          </div>

          <div className="section-inputs-right">
            {/* Rules List */}
            <div className="rules-sortable-list">
              {rules.length === 0 ? (
                <div className="rules-empty-card">
                  No community rules defined yet. Add up to 5 clear rules below.
                </div>
              ) : (
                rules.map((rule, idx) => (
                  <div key={rule.id || idx} className="rule-native-item">
                    <div className="rule-order-col">
                      <button
                        type="button"
                        onClick={() => handleMoveRule(idx, -1)}
                        disabled={idx === 0}
                        className="btn-order-arrow"
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <span className="rule-number-index">{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleMoveRule(idx, 1)}
                        disabled={idx === rules.length - 1}
                        className="btn-order-arrow"
                        title="Move Down"
                      >
                        ▼
                      </button>
                    </div>

                    <div className="rule-text-content">
                      <strong className="rule-item-title">{rule.title}</strong>
                      {rule.description && (
                        <p className="rule-item-desc">{rule.description}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="btn-delete-rule-icon"
                      title="Delete rule"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Rule Form */}
            {rules.length < 5 ? (
              <form onSubmit={handleAddRule} className="rule-add-inline-box">
                <h4 className="inline-box-title">+ Add New Rule ({rules.length}/5)</h4>
                <div className="settings-input-block">
                  <input
                    type="text"
                    placeholder="Rule title (e.g. No real names or phone numbers)"
                    value={newRuleTitle}
                    onChange={(e) => setNewRuleTitle(e.target.value)}
                    maxLength={80}
                    className="flat-settings-input"
                    required
                  />
                </div>
                <div className="settings-input-block">
                  <textarea
                    rows={2}
                    placeholder="Explanation / Description (optional detail for students)"
                    value={newRuleDesc}
                    onChange={(e) => setNewRuleDesc(e.target.value)}
                    maxLength={200}
                    className="flat-settings-textarea"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newRuleTitle.trim()}
                  className="btn-add-rule-flat"
                >
                  + Add Rule
                </button>
              </form>
            ) : (
              <div className="rule-limit-reached-notice">
                ✓ Maximum of 5 community rules reached. Delete a rule to add another.
              </div>
            )}
          </div>
        </section>

        {/* ===================================================================
            SECTION 3: DOWNVOTE THRESHOLD & REVIEW QUEUE
            =================================================================== */}
        <section className="settings-section-row">
          <div className="section-meta-left">
            <h3 className="section-label-heading">Downvote Threshold & Review Queue</h3>
            <p className="section-label-sub">
              Protect students from disruptive trolls. When downvotes reach this threshold, the post automatically hides from the community feed.
            </p>
          </div>

          <div className="section-inputs-right">
            {/* Threshold Input */}
            <div className="settings-input-block">
              <label className="input-field-label" htmlFor="threshold-num-input">
                Auto-Hide Downvote Threshold
              </label>
              <div className="threshold-input-row">
                <input
                  id="threshold-num-input"
                  type="number"
                  min={0}
                  max={100}
                  value={downvoteThreshold}
                  onChange={(e) => setDownvoteThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="flat-settings-input threshold-number-field"
                />
                <span className="threshold-helper-tag">
                  {downvoteThreshold === 0 ? "Disabled (posts are never auto-hidden)" : `Downvotes to trigger auto-hide`}
                </span>
              </div>
              <span className="input-hint-note">Default campus standard is 10 downvotes. Set to 0 to disable.</span>
            </div>

            {/* Review Queue (Auto-Hidden Posts) */}
            <div className="review-queue-container">
              <h4 className="review-queue-title">
                Moderation Review Queue ({hiddenPosts.length})
              </h4>
              {hiddenPosts.length === 0 ? (
                <div className="review-queue-clean">
                  <CheckIcon size={18} />
                  <span>The review queue is clean. No posts are currently auto-hidden.</span>
                </div>
              ) : (
                <div className="review-posts-list">
                  {hiddenPosts.map((hp) => (
                    <div key={hp.id} className="review-post-card">
                      <div className="review-post-meta">
                        <span className="review-hidden-badge">⚠️ Auto-Hidden</span>
                        <h5 className="review-post-title">{hp.title}</h5>
                        <p className="review-post-snippet">{hp.body}</p>
                      </div>

                      <div className="review-post-actions">
                        <button
                          type="button"
                          className="btn-review-approve"
                          onClick={() => handleRestorePost(hp.id)}
                          disabled={reviewActionPostId === hp.id}
                        >
                          {reviewActionPostId === hp.id ? "Restoring..." : "✓ Approve & Restore"}
                        </button>
                        <button
                          type="button"
                          className="btn-review-delete"
                          onClick={() => handleDeleteReviewPost(hp.id)}
                          disabled={reviewActionPostId === hp.id}
                        >
                          {reviewActionPostId === hp.id ? "Deleting..." : "🗑 Delete Post"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 4: POND TIMEOUT (MUTED USERS)
            =================================================================== */}
        <section className="settings-section-row">
          <div className="section-meta-left">
            <h3 className="section-label-heading">Pond Timeout (Muted Members)</h3>
            <p className="section-label-sub">
              Mute a disruptive user from creating posts in c/{cleanSlug} without exposing student real identities (preserving u/username).
            </p>
          </div>

          <div className="section-inputs-right">
            {/* Apply Mute Form */}
            <form onSubmit={handleApplyMute} className="mute-apply-form-block">
              <h4 className="inline-box-title">Mute a Disruptive Student</h4>
              <div className="mute-form-grid">
                <div className="settings-input-block">
                  <label className="input-field-label">Student Handle</label>
                  <div className="username-prefix-field">
                    <span>u/</span>
                    <input
                      type="text"
                      placeholder="e.g. Cosmic_Seeker3393"
                      value={muteUsername}
                      onChange={(e) => setMuteUsername(e.target.value.replace(/^(u\/|@)/, ""))}
                      list="community-members-datalist"
                      className="flat-settings-input"
                      required
                    />
                  </div>
                  <datalist id="community-members-datalist">
                    {membersList.map((m) => (
                      <option key={m.user_id} value={m.username} />
                    ))}
                  </datalist>
                </div>

                <div className="settings-input-block">
                  <label className="input-field-label">Duration</label>
                  <select
                    value={muteDuration}
                    onChange={(e) => setMuteDuration(e.target.value)}
                    className="flat-settings-select"
                  >
                    <option value="24h">24 Hours</option>
                    <option value="7d">7 Days</option>
                    <option value="permanent">Permanently</option>
                  </select>
                </div>
              </div>

              <div className="settings-input-block">
                <label className="input-field-label">Reason</label>
                <input
                  type="text"
                  placeholder="e.g., Harassment violating community rules"
                  value={muteReason}
                  onChange={(e) => setMuteReason(e.target.value)}
                  className="flat-settings-input"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={applyingMute || !muteUsername.trim()}
                className="btn-apply-mute-flat"
              >
                {applyingMute ? "Applying..." : "Mute Student from c/" + cleanSlug}
              </button>
            </form>

            {/* Currently Muted Users Table */}
            <div className="muted-users-container">
              <h4 className="muted-users-title">
                Currently Muted in c/{cleanSlug} ({mutes.length})
              </h4>
              {mutes.length === 0 ? (
                <div className="mutes-empty-note">
                  No students are currently muted. The community pond is peaceful!
                </div>
              ) : (
                <div className="muted-table">
                  {mutes.map((m) => (
                    <div key={m.id} className="mute-row-item">
                      <div className="mute-student-meta">
                        <div className="mute-handle-line">
                          <span className="mute-username">u/{m.username}</span>
                          <span className="mute-duration-badge">{m.duration || (m.is_permanent ? "permanent" : "temporary")}</span>
                        </div>
                        <span className="mute-reason-text">{m.reason}</span>
                      </div>

                      <div className="mute-expiry-meta">
                        <span className="mute-expiry-date">
                          {m.expires_at ? `Expires: ${m.expires_at.replace("T", " ").slice(0, 16)} UTC` : "Permanent"}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="btn-unmute-flat"
                        onClick={() => handleUnmute(m.id)}
                      >
                        Unmute
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

      </div>

      {/* Sticky Bottom "Unsaved Changes" Bar */}
      {hasUnsavedChanges && (
        <div className="sticky-unsaved-bar">
          <div className="unsaved-bar-inner">
            <div className="unsaved-notice-group">
              <span className="unsaved-dot" />
              <span>You have unsaved changes to <strong>c/{cleanSlug}</strong> settings.</span>
            </div>
            <div className="unsaved-actions-group">
              <button
                type="button"
                className="btn-unsaved-reset"
                onClick={handleResetChanges}
                disabled={savingSettings}
              >
                Reset
              </button>
              <button
                type="button"
                className="btn-unsaved-save"
                onClick={handleSaveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? "Saving to Supabase..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
