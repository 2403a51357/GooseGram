import React, { useState, useEffect } from "react";
import { CloseIcon, ShieldIcon, CheckIcon } from "./Icons";
import { api } from "../api";

export default function AdminPortalModal({ isOpen, onClose }) {
  const [tab, setTab] = useState("identities"); // 'identities' | 'reports'
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState(null);
  const [realNameInput, setRealNameInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, tab]);

  async function loadData() {
    setLoading(true);
    setStatusMessage("");
    try {
      if (tab === "identities") {
        const data = await api.getAdminIdentities();
        setUsers(data.users || []);
      } else {
        const data = await api.getAdminReports();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error("Admin data load error:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleStartEdit(u) {
    setEditingUserId(u.user_id);
    setRealNameInput(u.real_name || "");
    setNotesInput(u.admin_notes || "");
  }

  async function handleSaveIdentity(userId) {
    setSaving(true);
    try {
      const res = await api.updateAdminIdentity(userId, {
        real_name: realNameInput.trim(),
        admin_notes: notesInput.trim()
      });
      setStatusMessage(res.message || "Identity record saved.");
      setEditingUserId(null);
      await loadData();
    } catch (err) {
      alert(err.message || "Failed to update identity record.");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-admin-portal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header admin-modal-header">
          <div className="admin-header-title">
            <ShieldIcon size={22} />
            <h3>Administrator & Moderation Portal</h3>
          </div>
          <button className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        {statusMessage && <div className="modal-success-banner">{statusMessage}</div>}

        <div className="admin-tabs-bar">
          <button
            className={`admin-tab-btn ${tab === "identities" ? "active" : ""}`}
            onClick={() => setTab("identities")}
          >
            Private Real-Name Management
          </button>
          <button
            className={`admin-tab-btn ${tab === "reports" ? "active" : ""}`}
            onClick={() => setTab("reports")}
          >
            Content Reports ({reports.length})
          </button>
        </div>

        <div className="admin-modal-body">
          {tab === "identities" ? (
            <div className="identities-section">
              <div className="identities-security-notice">
                <strong>Administrative Privacy Guarantee:</strong> Real names and verified college emails are protected in a dedicated private record. Regular students and moderators never see this information.
              </div>

              {loading ? (
                <p className="admin-loading">Loading student records...</p>
              ) : users.length === 0 ? (
                <p className="admin-empty">No student records found.</p>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>College Email</th>
                        <th>Pseudonymous Username</th>
                        <th>CampusVoice ID</th>
                        <th>Private Real Name</th>
                        <th>Admin Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => {
                        const isEditing = editingUserId === u.user_id;
                        return (
                          <tr key={u.user_id}>
                            <td className="email-cell">{u.college_email}</td>
                            <td className="username-cell">u/{u.username}</td>
                            <td className="cvid-cell">{u.campus_voice_id}</td>
                            <td className="realname-cell">
                              {isEditing ? (
                                <input
                                  type="text"
                                  placeholder="Enter student real name"
                                  value={realNameInput}
                                  onChange={(e) => setRealNameInput(e.target.value)}
                                  className="admin-input-sm"
                                  autoFocus
                                />
                              ) : (
                                <span>{u.real_name || <em className="unassigned-text">Unassigned</em>}</span>
                              )}
                            </td>
                            <td className="notes-cell">
                              {isEditing ? (
                                <input
                                  type="text"
                                  placeholder="Notes (optional)"
                                  value={notesInput}
                                  onChange={(e) => setNotesInput(e.target.value)}
                                  className="admin-input-sm"
                                />
                              ) : (
                                <span>{u.admin_notes || "—"}</span>
                              )}
                            </td>
                            <td className="actions-cell">
                              {isEditing ? (
                                <div className="edit-btn-group">
                                  <button
                                    className="btn-save-sm"
                                    onClick={() => handleSaveIdentity(u.user_id)}
                                    disabled={saving}
                                  >
                                    <CheckIcon size={14} />
                                    <span>{saving ? "Saving..." : "Save"}</span>
                                  </button>
                                  <button
                                    className="btn-cancel-sm"
                                    onClick={() => setEditingUserId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="btn-edit-sm"
                                  onClick={() => handleStartEdit(u)}
                                >
                                  Edit Name
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="reports-section">
              <h4>Moderation Queue</h4>
              {loading ? (
                <p className="admin-loading">Loading reports...</p>
              ) : reports.length === 0 ? (
                <p className="admin-empty">No pending reports! Community is clean.</p>
              ) : (
                <div className="reports-cards-list">
                  {reports.map(r => (
                    <div key={r.id} className="report-card-item">
                      <div className="report-meta-line">
                        <span className="report-reason-badge">Reason: {r.reason}</span>
                        <span className="report-status-badge">{r.status}</span>
                        <span className="report-date">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="report-target-desc">
                        Reported content ID: <code>{r.post_id || r.comment_id || r.target_user_id}</code>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
