import React, { useState, useEffect } from "react";
import { api } from "../api";
import { CloseIcon, ShieldIcon, TrashIcon } from "./Icons";

const BANNER_PRESETS = [
  { name: "Ocean Blue", value: "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)" },
  { name: "Deep Violet", value: "linear-gradient(135deg, #581c87 0%, #831843 100%)" },
  { name: "Warm Amber", value: "linear-gradient(135deg, #b45309 0%, #78350f 100%)" },
  { name: "Emerald Green", value: "linear-gradient(135deg, #065f46 0%, #064e3b 100%)" },
  { name: "Crimson Red", value: "linear-gradient(135deg, #991b1b 0%, #450a0a 100%)" },
  { name: "Slate Charcoal", value: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)" }
];

const THRESHOLD_OPTIONS = [
  { val: 5, label: "5 Downvotes", note: "Strict — Quick removal of disputed content" },
  { val: 10, label: "10 Downvotes (Recommended)", note: "Balanced — Default campus threshold" },
  { val: 15, label: "15 Downvotes", note: "Moderate — Suitable for highly active communities" },
  { val: 20, label: "20 Downvotes", note: "Lenient — Hides only universally disliked content" },
  { val: 0, label: "Disabled (0)", note: "Posts are never auto-hidden by downvotes" }
];

export default function CommunitySettingsModal({
  isOpen,
  onClose,
  community,
  onSettingsSaved
}) {
  const [loading, setLoading] = useState(false);
  const [savingSection, setSavingSection] = useState(null); // "general", "rules", "threshold", "timeout"
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // 1. General & Banner
  const [bio, setBio] = useState("");
  const [bannerColor, setBannerColor] = useState("linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)");

  // 2. Rules (Max 5)
  const [rules, setRules] = useState([]);
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleDesc, setNewRuleDesc] = useState("");

  // 3. Auto-Hide Downvote Threshold
  const [downvoteThreshold, setDownvoteThreshold] = useState(10);

  // 4. Pond Timeouts (Muted users)
  const [timeouts, setTimeouts] = useState([]);
  const [timeoutUsername, setTimeoutUsername] = useState("");
  const [timeoutDuration, setTimeoutDuration] = useState("24h");
  const [timeoutReason, setTimeoutReason] = useState("");
  const [membersList, setMembersList] = useState([]);

  const slug = community?.slug;

  useEffect(() => {
    if (isOpen && slug) {
      loadSettings();
      loadMembers();
    }
  }, [isOpen, slug]);

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const res = await api.getCommunitySettings(slug);
      const st = res.settings || {};
      setBio(st.bio || community?.description || "");
      setBannerColor(st.banner_color || "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)");
      setRules(st.rules || []);
      setDownvoteThreshold(st.downvote_threshold ?? 10);
      setTimeouts(st.timeouts || []);
    } catch (err) {
      setError(err.message || "Could not load community settings.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMembers() {
    try {
      const res = await api.getCommunityMembers(slug);
      setMembersList(res.members || []);
    } catch {
      // Ignored
    }
  }

  function flashSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg((prev) => (prev === msg ? "" : prev));
    }, 4000);
  }

  // 1. Save General Info & Banner
  async function handleSaveGeneral(e) {
    e.preventDefault();
    setSavingSection("general");
    setError("");
    try {
      const res = await api.updateCommunitySettings(slug, {
        bio: bio.trim(),
        banner_color: bannerColor
      });
      flashSuccess("General settings and banner saved.");
      if (onSettingsSaved) onSettingsSaved(res.settings);
    } catch (err) {
      setError(err.message || "Failed to save general settings.");
    } finally {
      setSavingSection(null);
    }
  }

  // 2. Rules Management
  async function handleAddRule(e) {
    e.preventDefault();
    if (!newRuleTitle.trim()) return;
    if (rules.length >= 5) {
      setError("Maximum limit of 5 rules reached.");
      return;
    }
    const updated = [
      ...rules,
      {
        id: `rule-${Date.now()}`,
        title: newRuleTitle.trim(),
        desc: newRuleDesc.trim()
      }
    ];
    setSavingSection("rules");
    setError("");
    try {
      const res = await api.updateCommunitySettings(slug, { rules: updated });
      setRules(updated);
      setNewRuleTitle("");
      setNewRuleDesc("");
      flashSuccess("Rule added.");
      if (onSettingsSaved) onSettingsSaved(res.settings);
    } catch (err) {
      setError(err.message || "Failed to add rule.");
    } finally {
      setSavingSection(null);
    }
  }

  async function handleDeleteRule(ruleId) {
    const updated = rules.filter((r) => r.id !== ruleId);
    setSavingSection("rules");
    setError("");
    try {
      const res = await api.updateCommunitySettings(slug, { rules: updated });
      setRules(updated);
      flashSuccess("Rule removed.");
      if (onSettingsSaved) onSettingsSaved(res.settings);
    } catch (err) {
      setError(err.message || "Failed to remove rule.");
    } finally {
      setSavingSection(null);
    }
  }

  // 3. Downvote Threshold Save
  async function handleSelectThreshold(val) {
    const num = Number(val);
    setDownvoteThreshold(num);
    setSavingSection("threshold");
    setError("");
    try {
      const res = await api.updateCommunitySettings(slug, { downvote_threshold: num });
      flashSuccess(`Auto-hide threshold set to ${num === 0 ? "Disabled" : `${num} downvotes`}.`);
      if (onSettingsSaved) onSettingsSaved(res.settings);
    } catch (err) {
      setError(err.message || "Failed to update threshold.");
    } finally {
      setSavingSection(null);
    }
  }

  // 4. Pond Timeouts
  async function handleAddTimeout(e) {
    e.preventDefault();
    if (!timeoutUsername.trim()) {
      setError("Please specify a student's u/username to mute.");
      return;
    }
    setSavingSection("timeout");
    setError("");
    try {
      const res = await api.createCommunityTimeout(slug, {
        username: timeoutUsername.trim(),
        duration: timeoutDuration,
        reason: timeoutReason.trim() || "Violating community guidelines"
      });
      setTimeouts(res.timeouts || []);
      setTimeoutUsername("");
      setTimeoutReason("");
      flashSuccess(`u/${timeoutUsername} has been muted (${timeoutDuration}).`);
    } catch (err) {
      setError(err.message || "Failed to apply pond timeout.");
    } finally {
      setSavingSection(null);
    }
  }

  async function handleRemoveTimeout(timeoutId) {
    setSavingSection("timeout");
    setError("");
    try {
      const res = await api.removeCommunityTimeout(slug, timeoutId);
      setTimeouts(res.timeouts || []);
      flashSuccess("Student unmuted.");
    } catch (err) {
      setError(err.message || "Failed to unmute student.");
    } finally {
      setSavingSection(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-page-card" onClick={(e) => e.stopPropagation()}>
        {/* Sticky Header */}
        <header className="settings-page-header">
          <div className="settings-header-left">
            <div className="settings-header-badge">
              <ShieldIcon size={16} />
              <span>Moderator Tools</span>
            </div>
            <h2 className="settings-header-title">Community Settings</h2>
            <span className="settings-header-sub">c/{slug}</span>
          </div>
          <button className="settings-btn-close" onClick={onClose} aria-label="Close settings">
            <CloseIcon size={20} />
          </button>
        </header>

        {/* Global Notifications */}
        {error && <div className="settings-alert-banner alert-error">{error}</div>}
        {successMsg && <div className="settings-alert-banner alert-success">{successMsg}</div>}

        {/* Scrollable Content: Clean List of Settings Sections */}
        <div className="settings-page-body">
          {loading ? (
            <div className="settings-loading-view">Loading community settings...</div>
          ) : (
            <div className="settings-sections-list">
              {/* SECTION 1: GENERAL & BANNER */}
              <section className="settings-section-card">
                <div className="settings-section-header">
                  <div>
                    <h3 className="section-title">General & Appearance</h3>
                    <p className="section-subtitle">
                      Set the public description and header banner theme for this community.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveGeneral} className="settings-section-content">
                  <div className="settings-field">
                    <label className="settings-label" htmlFor="comm-bio">Community Bio / Description</label>
                    <textarea
                      id="comm-bio"
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Describe what this community is for, topics discussed, and overall vibe."
                      className="settings-textarea"
                    />
                    <span className="settings-help-text">
                      Visible to all students in the right sidebar and search results.
                    </span>
                  </div>

                  <div className="settings-field">
                    <label className="settings-label">Header Banner Theme</label>
                    <div className="banner-theme-grid">
                      {BANNER_PRESETS.map((p) => {
                        const isSelected = bannerColor === p.value;
                        return (
                          <button
                            type="button"
                            key={p.name}
                            className={`banner-theme-choice ${isSelected ? "selected" : ""}`}
                            style={{ background: p.value }}
                            onClick={() => setBannerColor(p.value)}
                          >
                            <span className="banner-theme-label">{p.name}</span>
                            {isSelected && <span className="banner-theme-check">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clean Banner Preview */}
                  <div className="banner-preview-box" style={{ background: bannerColor }}>
                    <div className="banner-preview-avatar">
                      {slug ? slug.charAt(0).toUpperCase() : "C"}
                    </div>
                    <div className="banner-preview-meta">
                      <span className="banner-preview-title">c/{slug}</span>
                      <span className="banner-preview-bio">{bio || "Community description preview"}</span>
                    </div>
                  </div>

                  <div className="settings-section-footer">
                    <button
                      type="submit"
                      className="settings-btn-primary"
                      disabled={savingSection === "general"}
                    >
                      {savingSection === "general" ? "Saving..." : "Save General Settings"}
                    </button>
                  </div>
                </form>
              </section>

              {/* SECTION 2: COMMUNITY RULES */}
              <section className="settings-section-card">
                <div className="settings-section-header">
                  <div>
                    <div className="section-title-with-count">
                      <h3 className="section-title">Community Rules</h3>
                      <span className="rules-counter-badge">{rules.length} / 5</span>
                    </div>
                    <p className="section-subtitle">
                      Set clear rules that appear in the community sidebar and pop up before any student submits a post.
                    </p>
                  </div>
                </div>

                <div className="settings-section-content">
                  {/* Current Rules */}
                  <div className="rules-vertical-list">
                    {rules.length === 0 ? (
                      <div className="rules-empty-state">
                        No rules created yet. Add up to 5 clear guidelines below.
                      </div>
                    ) : (
                      rules.map((rule, idx) => (
                        <div key={rule.id || idx} className="rule-list-item">
                          <span className="rule-index">{idx + 1}</span>
                          <div className="rule-info">
                            <span className="rule-title">{rule.title}</span>
                            {rule.desc && <p className="rule-desc">{rule.desc}</p>}
                          </div>
                          <button
                            type="button"
                            className="rule-btn-remove"
                            onClick={() => handleDeleteRule(rule.id)}
                            title="Remove rule"
                            disabled={savingSection === "rules"}
                          >
                            <TrashIcon size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Rule Inline Form */}
                  {rules.length < 5 ? (
                    <form onSubmit={handleAddRule} className="rule-add-container">
                      <h4 className="rule-add-title">+ Add New Rule</h4>
                      <div className="settings-field">
                        <input
                          type="text"
                          value={newRuleTitle}
                          onChange={(e) => setNewRuleTitle(e.target.value)}
                          placeholder="Rule title (e.g., No real names or phone numbers)"
                          maxLength={80}
                          className="settings-input"
                          required
                        />
                      </div>
                      <div className="settings-field">
                        <textarea
                          rows={2}
                          value={newRuleDesc}
                          onChange={(e) => setNewRuleDesc(e.target.value)}
                          placeholder="Rule explanation (optional detail for students)"
                          maxLength={200}
                          className="settings-textarea"
                        />
                      </div>
                      <button
                        type="submit"
                        className="settings-btn-secondary"
                        disabled={savingSection === "rules" || !newRuleTitle.trim()}
                      >
                        {savingSection === "rules" ? "Adding..." : "+ Add Rule"}
                      </button>
                    </form>
                  ) : (
                    <div className="rules-limit-banner">
                      ✓ Maximum limit of 5 rules reached. Delete an existing rule to add a new one.
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION 3: AUTO-HIDE DOWNVOTE THRESHOLD */}
              <section className="settings-section-card">
                <div className="settings-section-header">
                  <div>
                    <h3 className="section-title">Auto-Hide Feed Threshold</h3>
                    <p className="section-subtitle">
                      Protect student feeds from spam and harassment. Posts reaching this downvote threshold are automatically hidden until reviewed by a moderator.
                    </p>
                  </div>
                </div>

                <div className="settings-section-content">
                  <div className="threshold-list-selector">
                    {THRESHOLD_OPTIONS.map((opt) => {
                      const isSelected = downvoteThreshold === opt.val;
                      return (
                        <div
                          key={opt.val}
                          className={`threshold-row-item ${isSelected ? "selected" : ""}`}
                          onClick={() => handleSelectThreshold(opt.val)}
                        >
                          <div className="threshold-circle">
                            {isSelected && <div className="threshold-dot" />}
                          </div>
                          <div className="threshold-text">
                            <span className="threshold-name">{opt.label}</span>
                            <span className="threshold-note">{opt.note}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="threshold-status-bar">
                    Current policy: <strong>{downvoteThreshold === 0 ? "Auto-Hide Disabled" : `Auto-hide post at ${downvoteThreshold} downvotes`}</strong>
                  </div>
                </div>
              </section>

              {/* SECTION 4: POND TIMEOUTS (MUTED STUDENTS) */}
              <section className="settings-section-card">
                <div className="settings-section-header">
                  <div>
                    <h3 className="section-title">Pond Timeouts (Muted Members)</h3>
                    <p className="section-subtitle">
                      Mute disruptive students from posting or commenting in c/{slug}. Student handles remain anonymous (u/username).
                    </p>
                  </div>
                </div>

                <div className="settings-section-content">
                  {/* Mute Form */}
                  <form onSubmit={handleAddTimeout} className="timeout-form-wrapper">
                    <h4 className="timeout-form-title">Mute a Student</h4>
                    <div className="timeout-form-row">
                      <div className="settings-field flex-1">
                        <label className="settings-label">Student Username</label>
                        <div className="username-input-prefix">
                          <span>u/</span>
                          <input
                            type="text"
                            value={timeoutUsername}
                            onChange={(e) => setTimeoutUsername(e.target.value.replace(/^u\//, ""))}
                            placeholder="username"
                            className="settings-input"
                            list="members-datalist"
                            required
                          />
                        </div>
                        <datalist id="members-datalist">
                          {membersList.map((m) => (
                            <option key={m.user_id} value={m.username} />
                          ))}
                        </datalist>
                      </div>

                      <div className="settings-field flex-1">
                        <label className="settings-label">Duration</label>
                        <select
                          value={timeoutDuration}
                          onChange={(e) => setTimeoutDuration(e.target.value)}
                          className="settings-select"
                        >
                          <option value="24h">24 Hours</option>
                          <option value="7d">7 Days</option>
                          <option value="permanent">Permanently</option>
                        </select>
                      </div>
                    </div>

                    <div className="settings-field">
                      <label className="settings-label">Reason</label>
                      <input
                        type="text"
                        value={timeoutReason}
                        onChange={(e) => setTimeoutReason(e.target.value)}
                        placeholder="e.g., Repeated rule violations, targeted trolling"
                        className="settings-input"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="settings-btn-primary"
                      disabled={savingSection === "timeout"}
                    >
                      {savingSection === "timeout" ? "Applying..." : "Apply Timeout"}
                    </button>
                  </form>

                  {/* Active Timeouts List */}
                  <div className="active-timeouts-container">
                    <h4 className="active-timeouts-title">
                      Active Timeouts ({timeouts.length})
                    </h4>
                    {timeouts.length === 0 ? (
                      <div className="timeouts-empty-note">
                        No active timeouts. The community pond is calm!
                      </div>
                    ) : (
                      <div className="timeouts-table">
                        {timeouts.map((t) => (
                          <div key={t.id} className="timeout-row">
                            <div className="timeout-info-col">
                              <div className="timeout-user-line">
                                <span className="timeout-username">u/{t.username}</span>
                                <span className="timeout-badge">{t.duration}</span>
                              </div>
                              <span className="timeout-reason">{t.reason}</span>
                            </div>
                            <div className="timeout-expiry-col">
                              <span className="timeout-expiry">
                                {t.expires_at ? `Expires: ${t.expires_at.replace("T", " ").slice(0, 16)}` : "Permanent"}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="timeout-btn-unmute"
                              onClick={() => handleRemoveTimeout(t.id)}
                              disabled={savingSection === "timeout"}
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
          )}
        </div>

        {/* Modal Bottom Footer */}
        <footer className="settings-page-footer">
          <button type="button" className="settings-btn-done" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
