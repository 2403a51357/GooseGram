import React, { useState, useEffect } from "react";
import { GooseGramLogo, RefreshIcon } from "./Icons";
import { api, setToken } from "../api";

export default function AuthCard({ onLoginSuccess }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loadingUsername, setLoadingUsername] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isSignup) {
      fetchNewUsername();
    }
  }, [isSignup]);

  async function fetchNewUsername() {
    setLoadingUsername(true);
    try {
      const data = await api.suggestUsername();
      setUsername(data.username);
    } catch {
      // Fallback local generator if offline
      const adj = ["Cosmic", "Lucky", "Misty", "Curious", "Electric", "Silent", "Sleepy"];
      const nouns = ["Potato", "Waffle", "Panda", "Nebula", "Algorithm", "Coffee", "Falcon"];
      const num = Math.floor(1000 + Math.random() * 9000);
      setUsername(`${adj[Math.floor(Math.random() * adj.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}${num}`);
    } finally {
      setLoadingUsername(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      if (isSignup) {
        if (!email.toLowerCase().endsWith("@sru.edu.in")) {
          throw new Error("Must end with @sru.edu.in");
        }
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }

        const res = await api.signup({
          email: email.trim().toLowerCase(),
          password,
          username
        });

        setSuccessMsg(res.message || "Registration successful! Check your college email for verification.");
      } else {
        const data = await api.login({
          email: email.trim().toLowerCase(),
          password
        });

        setToken(data.access_token, data.refresh_token);
        onLoginSuccess(data.profile, data.access_token);
      }
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        <div className="auth-brand-header">
          <GooseGramLogo size={52} />
          <h1>GooseGram</h1>
          <p className="auth-tagline">Campus Gossips, Community & University Life</p>
        </div>

        <div className="auth-mode-tabs">
          <button
            type="button"
            className={`auth-tab ${!isSignup ? "active-tab" : ""}`}
            onClick={() => {
              setIsSignup(false);
              setError("");
              setSuccessMsg("");
            }}
          >
            Log In
          </button>
          <button
            type="button"
            className={`auth-tab ${isSignup ? "active-tab" : ""}`}
            onClick={() => {
              setIsSignup(true);
              setError("");
              setSuccessMsg("");
            }}
          >
            Create Account
          </button>
        </div>

        {error && <div className="auth-banner error-banner">{error}</div>}
        {successMsg && <div className="auth-banner success-banner">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>College Email</label>
            <input
              type="email"
              placeholder="rollnumber@sru.edu.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <span className="field-hint">Must end with @sru.edu.in</span>
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {isSignup && (
            <div className="auth-field username-gen-field">
              <label>Your Anonymous Username</label>
              <div className="username-preview-box">
                <span className="username-preview-text">
                  {loadingUsername ? "Generating..." : `u/${username}`}
                </span>
                <button
                  type="button"
                  className="btn-refresh-username"
                  onClick={fetchNewUsername}
                  disabled={loadingUsername}
                  title="Generate another suggestion"
                >
                  <RefreshIcon size={16} spinning={loadingUsername} />
                  <span>Refresh</span>
                </button>
              </div>
              <p className="field-hint-privacy">
                Students interact using platform-generated usernames. You can refresh until you find one you like!
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn-auth-submit"
            disabled={submitting || (isSignup && loadingUsername)}
          >
            {submitting ? "Please wait..." : isSignup ? "Join GooseGram" : "Log In"}
          </button>
        </form>

        <div className="auth-footer-notes">
          <p>
            By continuing, you agree to the campus student community guidelines and anonymous safety standards.
          </p>
        </div>
      </div>
    </div>
  );
}
