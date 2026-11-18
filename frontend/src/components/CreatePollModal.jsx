import React, { useState } from "react";
import { CloseIcon, PlusIcon, TrashIcon } from "./Icons";

export default function CreatePollModal({ isOpen, onClose, onSubmit }) {
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState("7d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  function handleOptionChange(index, value) {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  }

  function handleAddOption() {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  }

  function handleRemoveOption(index) {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const valid = options.map(o => o.trim()).filter(Boolean);

    if (!question.trim()) {
      setError("Please enter a poll question.");
      return;
    }

    if (valid.length < 2) {
      setError("Please provide at least 2 poll options.");
      return;
    }

    setLoading(true);
    setError("");

    // Calculate closes_at timestamp based on selected duration
    let closesAtDate = new Date();
    if (duration === "24h") {
      closesAtDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else if (duration === "3d") {
      closesAtDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    } else if (duration === "14d") {
      closesAtDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    } else {
      // 7 Days default
      closesAtDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    const closes_at = closesAtDate.toISOString();

    try {
      await onSubmit({
        question: question.trim(),
        description: description.trim(),
        options: valid,
        closes_at,
        duration
      });
      setQuestion("");
      setDescription("");
      setOptions(["", ""]);
      setDuration("7d");
      onClose();
    } catch (err) {
      const errMsg =
        err?.response?.data?.error ||
        err?.error ||
        err?.message ||
        (typeof err === "string" ? err : "Failed to create poll.");
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-create-poll" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create a Campus Poll</h3>
          <button className="btn-modal-close" onClick={onClose}>
            <CloseIcon size={20} />
          </button>
        </div>

        {error && (
          <div className="modal-error-banner">
            <span className="modal-error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Question</label>
            <input
              type="text"
              placeholder="What would you like to poll the campus about?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="form-group">
            <label>Context / Description (Optional)</label>
            <textarea
              placeholder="Add relevant context or background..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Poll Duration Dropdown */}
          <div className="form-group">
            <label>Poll Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="select-poll-duration"
            >
              <option value="24h">24 Hours</option>
              <option value="3d">3 Days</option>
              <option value="7d">7 Days (Default)</option>
              <option value="14d">14 Days</option>
            </select>
          </div>

          <div className="form-group">
            <label>Poll Options (2 to 6)</label>
            <div className="poll-options-builder">
              {options.map((opt, index) => (
                <div key={index} className="poll-builder-row">
                  <input
                    type="text"
                    placeholder={`Option ${index + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    maxLength={100}
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="btn-remove-opt"
                      onClick={() => handleRemoveOption(index)}
                      title="Remove option"
                    >
                      <TrashIcon size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 6 && (
              <button
                type="button"
                className="btn-add-opt"
                onClick={handleAddOption}
              >
                <PlusIcon size={16} />
                <span>Add Option</span>
              </button>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? "Creating..." : "Launch Poll"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
