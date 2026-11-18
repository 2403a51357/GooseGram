import React, { useState, useEffect } from "react";
import {
  MBTI_QUESTIONS,
  CHAPTERS,
  calculateMbtiType,
  getMbtiDetails
} from "../data/mbtiQuestions";
import { api } from "../api";
import { SparklesIcon, CheckIcon, ArrowLeftIcon } from "./Icons";

export default function VibeCheckPage({
  currentUser,
  onProfileUpdated,
  onGoHome
}) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [justCompleted, setJustCompleted] = useState(null);
  const [showBadgeToggle, setShowBadgeToggle] = useState(true);
  const [retakeConfirmOpen, setRetakeConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch MBTI Quiz Status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    setErrorMessage("");
    try {
      const res = await api.getMbtiStatus();
      setStatus(res);
      setShowBadgeToggle(res.show_mbti_badge ?? true);

      const savedProgress = res.mbti_progress || {};
      setAnswers(savedProgress);

      // If already has locked MBTI and cannot retake, we show locked result screen
      if (res.mbti_type && !res.can_retake) {
        setLoading(false);
        return;
      }

      // If user is taking or resuming quiz, jump to first unanswered question
      const answeredKeys = Object.keys(savedProgress);
      if (answeredKeys.length > 0 && answeredKeys.length < 30) {
        const firstUnanswered = MBTI_QUESTIONS.findIndex(
          (q) => savedProgress[q.id] === undefined && savedProgress[String(q.id)] === undefined
        );
        if (firstUnanswered !== -1) {
          setCurrentIdx(firstUnanswered);
        }
      }
    } catch (err) {
      console.error("MBTI status error:", err);
      setErrorMessage("Could not load Vibe Check state from server.");
    } finally {
      setLoading(false);
    }
  }

  const currentQ = MBTI_QUESTIONS[currentIdx];
  const currentChapter = CHAPTERS.find(
    (c) => currentQ && currentQ.id >= c.start && currentQ.id <= c.end
  ) || CHAPTERS[0];

  const totalAnswered = Object.keys(answers).length;
  const progressPercent = Math.round((totalAnswered / 30) * 100);

  async function handleSelectOption(optionIdx) {
    if (!currentQ || isSaving) return;

    const newAnswers = {
      ...answers,
      [currentQ.id]: optionIdx
    };
    setAnswers(newAnswers);

    // If final question (30)
    if (currentIdx === MBTI_QUESTIONS.length - 1) {
      await handleFinishQuiz(newAnswers);
      return;
    }

    // Auto-save progress to Supabase in the background
    setIsSaving(true);
    api.saveMbtiProgress(newAnswers)
      .catch((err) => console.warn("Background auto-save notice:", err))
      .finally(() => setIsSaving(false));

    // Smoothly advance to next question
    setTimeout(() => {
      setCurrentIdx((prev) => Math.min(MBTI_QUESTIONS.length - 1, prev + 1));
    }, 180);
  }

  async function handleFinishQuiz(finalAnswers) {
    setIsSaving(true);
    setErrorMessage("");
    try {
      const computedType = calculateMbtiType(finalAnswers);
      const res = await api.completeMbtiQuiz({
        answers: finalAnswers,
        mbti_type: computedType
      });

      const details = getMbtiDetails(computedType);
      setJustCompleted(details);
      setStatus((prev) => ({
        ...prev,
        mbti_type: computedType,
        mbti_completed_at: res.mbti_completed_at || new Date().toISOString(),
        mbti_progress: finalAnswers,
        can_retake: false,
        cooldown_days_left: 14,
        show_mbti_badge: true
      }));

      if (onProfileUpdated) {
        onProfileUpdated({
          mbti_type: computedType,
          mbti_completed_at: res.mbti_completed_at || new Date().toISOString(),
          mbti_progress: finalAnswers,
          show_mbti_badge: true
        });
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to complete quiz.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleBadge() {
    const nextVal = !showBadgeToggle;
    setShowBadgeToggle(nextVal);
    try {
      await api.toggleMbtiBadge(nextVal);
      setStatus((prev) => ({ ...prev, show_mbti_badge: nextVal }));
      if (onProfileUpdated) {
        onProfileUpdated({ show_mbti_badge: nextVal });
      }
    } catch (err) {
      alert(err.message || "Could not update badge visibility.");
      setShowBadgeToggle(!nextVal);
    }
  }

  async function handleResetRetake() {
    try {
      await api.resetMbtiQuiz();
      setAnswers({});
      setCurrentIdx(0);
      setJustCompleted(null);
      setRetakeConfirmOpen(false);
      setStatus((prev) => ({
        ...prev,
        mbti_type: null,
        mbti_completed_at: null,
        mbti_progress: {},
        can_retake: true,
        cooldown_days_left: 0
      }));
      if (onProfileUpdated) {
        onProfileUpdated({
          mbti_type: null,
          mbti_completed_at: null,
          mbti_progress: {}
        });
      }
    } catch (err) {
      alert(err.message || "Could not reset quiz.");
    }
  }

  if (loading) {
    return (
      <div className="vibe-check-loading-container">
        <div className="loading-spinner" />
        <p>Loading your Campus Vibe Check...</p>
      </div>
    );
  }

  // =========================================================================
  // VIEW A: LOCKED RESULT / ACTIVE BADGE VIEW
  // =========================================================================
  const activeType = justCompleted?.code || status?.mbti_type;
  if (activeType && (!status?.can_retake || justCompleted)) {
    const archetype = getMbtiDetails(activeType);

    return (
      <div className="vibe-check-page-container">
        <div className="vibe-result-card">
          <div className="vibe-result-badge-halo">
            <span className="vibe-result-big-emoji">{archetype?.emoji}</span>
          </div>

          <div className="vibe-result-header-text">
            <span className={`vibe-result-group-tag ${archetype?.groupColor}`}>
              {archetype?.group}
            </span>
            <h1 className="vibe-result-title">
              {archetype?.badge} — {archetype?.title}
            </h1>
            <p className="vibe-result-bio">"{archetype?.bio}"</p>
          </div>

          {/* Locked Badge Notice */}
          <div className="vibe-locked-banner">
            <div className="locked-icon-badge">🔒</div>
            <div className="locked-banner-text">
              <strong>Goose-ality Badge Locked to Your Profile</strong>
              <p>
                To preserve authenticity, badges cannot be manually picked or changed. Retake unlocks in{" "}
                <span className="cooldown-days-highlight">
                  {status?.cooldown_days_left || 14} days
                </span>{" "}
                (14-day campus cycle).
              </p>
            </div>
          </div>

          {/* Badge Display on Feed Toggle */}
          <div className="vibe-toggle-card">
            <div className="toggle-info-col">
              <span className="toggle-title">Show Goose-ality badge on feed</span>
              <span className="toggle-subtitle">
                Displays your compact <code className="inline-badge-code">{archetype?.badge}</code> pill next to your u/username on posts and comments.
              </span>
            </div>
            <label className="switch-toggle-label">
              <input
                type="checkbox"
                checked={showBadgeToggle}
                onChange={handleToggleBadge}
              />
              <span className="slider-round" />
            </label>
          </div>

          {/* Back & Share Actions */}
          <div className="vibe-result-actions">
            <button
              type="button"
              className="btn-vibe-return-home"
              onClick={onGoHome}
            >
              Explore Campus Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: CAN RETAKE VIEW (14 Days Expired)
  // =========================================================================
  if (status?.mbti_type && status?.can_retake && !retakeConfirmOpen && totalAnswered === 0) {
    const prevArchetype = getMbtiDetails(status.mbti_type);
    return (
      <div className="vibe-check-page-container">
        <div className="vibe-result-card retake-ready-card">
          <span className="vibe-result-big-emoji">{prevArchetype?.emoji}</span>
          <h2>Current Badge: {prevArchetype?.badge} ({prevArchetype?.title})</h2>
          <p className="retake-eligible-text">
            ✨ Your 14-day cooldown period has passed! You are eligible to retake the Campus Vibe Check.
          </p>

          <div className="retake-actions-row">
            <button
              type="button"
              className="btn-vibe-retake-start"
              onClick={() => setRetakeConfirmOpen(true)}
            >
              Retake 30-Question Vibe Check
            </button>
            <button
              type="button"
              className="btn-vibe-keep-current"
              onClick={onGoHome}
            >
              Keep Current Badge
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW C: THE 30-QUESTION QUIZ INTERFACE
  // =========================================================================
  const selectedChoiceIdx = answers[currentQ?.id] ?? answers[String(currentQ?.id)];

  return (
    <div className="vibe-check-page-container">
      {/* Quiz Progress Header */}
      <div className="vibe-quiz-header">
        <div className="vibe-header-top-row">
          <div className="vibe-title-column">
            <span className="vibe-chapter-indicator">
              {currentChapter.title}
            </span>
            <h2 className="vibe-question-counter">
              Question {currentIdx + 1} of 30
            </h2>
          </div>

          <div className="vibe-save-indicator">
            {isSaving ? (
              <span className="saving-badge">Saving...</span>
            ) : totalAnswered > 0 ? (
              <span className="saved-badge">
                <CheckIcon size={12} /> Auto-Saved
              </span>
            ) : null}
          </div>
        </div>

        {/* Multi-Segment Chapter Progress Track */}
        <div className="vibe-chapter-tabs-row">
          {CHAPTERS.map((ch) => {
            const isCurrent = currentChapter.id === ch.id;
            const isCompleted = currentQ.id > ch.end;
            return (
              <div
                key={ch.id}
                className={`chapter-step-pill ${isCurrent ? "current" : ""} ${isCompleted ? "completed" : ""}`}
              >
                <span>{ch.title.split(":")[0]}</span>
              </div>
            );
          })}
        </div>

        {/* Continuous Linear Progress Bar */}
        <div className="vibe-progress-bar-track">
          <div
            className="vibe-progress-bar-fill"
            style={{ width: `${Math.max(5, progressPercent)}%` }}
          />
        </div>
      </div>

      {errorMessage && (
        <div className="vibe-error-banner">
          ⚠️ {errorMessage}
        </div>
      )}

      {/* Question Card */}
      <div className="vibe-question-card">
        <h3 className="vibe-question-prompt">
          "{currentQ?.text}"
        </h3>

        {/* 4 Multi-Choice Option Cards */}
        <div className="vibe-options-grid">
          {currentQ?.options.map((opt, idx) => {
            const letter = ["A", "B", "C", "D"][idx];
            const isSelected = selectedChoiceIdx === idx;

            return (
              <button
                key={idx}
                type="button"
                className={`vibe-option-btn ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelectOption(idx)}
              >
                <span className="option-letter-badge">{letter}</span>
                <span className="option-body-text">{opt.text}</span>
              </button>
            );
          })}
        </div>

        {/* Quiz Navigation Bottom Row */}
        <div className="vibe-quiz-navigation-row">
          <button
            type="button"
            className="btn-quiz-prev"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((prev) => Math.max(0, prev - 1))}
          >
            ← Previous Question
          </button>

          <button
            type="button"
            className="btn-quiz-save-exit"
            onClick={async () => {
              if (Object.keys(answers).length > 0) {
                try {
                  await api.saveMbtiProgress(answers);
                  if (onProfileUpdated) {
                    onProfileUpdated({ mbti_progress: answers });
                  }
                } catch (e) {
                  console.warn("Save on exit notice:", e);
                }
              }
              onGoHome();
            }}
            title="Your answers are auto-saved in Supabase. You can resume anytime."
          >
            Save & Exit to Feed
          </button>
        </div>
      </div>
    </div>
  );
}
