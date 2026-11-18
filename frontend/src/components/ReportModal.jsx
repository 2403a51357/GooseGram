import React, { useState } from "react";
import { CloseIcon, FlagIcon } from "./Icons";
import { api } from "../api";

export default function ReportModal({
  isOpen,
  onClose,
  targetId,
  targetType // 'post' | 'comment' | 'user'
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please explain the reason for your report.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const payload = {
        reason: reason.trim(),
        ...(targetType === "post" ? { post_id: targetId } : {}),
        ...(targetType === "comment" ? { comment_id: targetId } : {}),
        ...(targetType === "user" ? { target_user_id: targetId } : {})
      };

      await api.submitReport(payload);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setReason("");
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-report" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="report-title-header">
            <FlagIcon size={18} />
            <h3>Report {targetType === "user" ? "User" : "Content"}</h3>
          </div>
          <button className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        {error && <div className="modal-error-banner">{error}</div>}
        {success && <div className="modal-success-banner">Report submitted to college moderators.</div>}

        {!success && (
          <form onSubmit={handleSubmit} className="modal-form">
            <p className="report-prompt-text">
              Please help keep CampusVoice safe and respectful. Tell our moderators what rule was violated:
            </p>

            <div className="report-reasons-quick">
              {[
                "Harassment or Hate Speech",
                "Spam or Promotion",
                "Academic Misconduct",
                "De-anonymization / Doxxing",
                "Inappropriate Content"
              ].map(opt => (
                <button
                  type="button"
                  key={opt}
                  className={`btn-quick-reason ${reason === opt ? "active-reason" : ""}`}
                  onClick={() => setReason(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label>Additional Details</label>
              <textarea
                placeholder="Describe the issue..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
