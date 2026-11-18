import React, { useState } from "react";
import { GooseGramLogo, SearchIcon, PlusIcon, ChatIcon, BellIcon, UserIcon, ShieldIcon, SparklesIcon } from "./Icons";
import { useRouter } from "../router";
import { getMbtiDetails } from "../data/mbtiQuestions";

export default function Navbar({
  profile,
  onLogout,
  onOpenCreatePost,
  onOpenChat,
  onOpenNotifications,
  onOpenProfile,
  onOpenAdminPortal,
  unreadNotifications = 0,
  pendingChatRequests = 0,
  hasUnreadMessages = false,
  searchQuery,
  onSearchChange,
  onGoHome,
  currentCommunity = null,
  onClearCommunity = null
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { navigate } = useRouter();

  return (
    <header className="navbar">
      <div className="navbar-left">
        <a
          href="/"
          className="navbar-brand"
          onClick={(e) => {
            e.preventDefault();
            if (onGoHome) onGoHome();
          }}
        >
          <GooseGramLogo size={36} />
          <div className="brand-text">
            <span className="brand-name">GooseGram</span>
            <span className="brand-sub">Campus Gossips & Life</span>
          </div>
        </a>
      </div>

      <div className="navbar-center">
        <div className="search-bar">
          <SearchIcon size={18} />
          {currentCommunity && (
            <div className="search-community-badge">
              <span className="search-badge-avatar">{currentCommunity.slug?.charAt(0).toUpperCase()}</span>
              <span className="search-badge-slug">c/{currentCommunity.slug}</span>
              {onClearCommunity && (
                <button
                  type="button"
                  className="search-badge-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearCommunity();
                  }}
                  title="Search all of GooseGram"
                >
                  ✕
                </button>
              )}
            </div>
          )}
          <input
            type="text"
            placeholder={currentCommunity ? `Search in c/${currentCommunity.slug}` : "Search discussions, topics, gossips..."}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => onSearchChange("")}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="navbar-right">
        <button
          className="btn-create-post"
          onClick={onOpenCreatePost}
          title="Create a discussion"
        >
          <PlusIcon size={18} />
          <span>New Post</span>
        </button>

        <button
          className="nav-icon-btn nav-chat-btn"
          onClick={onOpenChat}
          title="Private Chat & Requests"
        >
          <ChatIcon size={20} />
          {pendingChatRequests > 0 ? (
            <span className="nav-badge">{pendingChatRequests}</span>
          ) : hasUnreadMessages ? (
            <span className="nav-unread-dot" title="Unread messages" />
          ) : null}
        </button>

        <button
          className="nav-icon-btn"
          onClick={onOpenNotifications}
          title="Notifications"
        >
          <BellIcon size={20} />
          {unreadNotifications > 0 && (
            <span className="nav-badge">{unreadNotifications}</span>
          )}
        </button>

        <div className="user-menu-container">
          <button
            className="user-profile-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="avatar-circle">
              {profile?.username?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="user-info-text">
              <span className="username-display">
                u/{profile?.username || "Student"}
              </span>
              <div className="user-subline-display">
                <span className="cv-id-display">{profile?.campus_voice_id || "CV-ID"}</span>
                {profile?.mbti_type && (
                  <span className="nav-mbti-tag" title={profile.mbti_type}>
                    {getMbtiDetails(profile.mbti_type)?.badge || profile.mbti_type}
                  </span>
                )}
              </div>
            </div>
          </button>

          {showUserMenu && (
            <div className="user-dropdown-menu">
              <div className="dropdown-header">
                <p className="dropdown-user">u/{profile?.username}</p>
                <p className="dropdown-cvid">{profile?.campus_voice_id}</p>
                <span className="dropdown-role">{profile?.role?.toUpperCase() || "STUDENT"}</span>
              </div>

              <div className="dropdown-divider" />

              {/* Goose-ality Vibe Check Menu Item */}
              <button
                className="dropdown-item mbti-dropdown-item"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate("/vibe-check");
                }}
              >
                {profile?.mbti_type ? (
                  <>
                    <span className="dropdown-mbti-emoji">{getMbtiDetails(profile.mbti_type)?.emoji || "✨"}</span>
                    <span>Goose-ality: {profile.mbti_type}</span>
                  </>
                ) : (
                  <>
                    <span className="dropdown-mbti-emoji">🥚</span>
                    <span>
                      {Object.keys(profile?.mbti_progress || {}).length > 0
                        ? `Resume Vibe Check (${Object.keys(profile?.mbti_progress || {}).length}/30)`
                        : "Vibe Check (Earn Badge 🥚)"}
                    </span>
                  </>
                )}
              </button>

              <button
                className="dropdown-item"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenProfile(profile?.username || "me");
                }}
              >
                <UserIcon size={16} />
                <span>My Profile</span>
              </button>

              {profile?.role === "admin" && (
                <button
                  className="dropdown-item admin-item"
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenAdminPortal();
                  }}
                >
                  <ShieldIcon size={16} />
                  <span>Admin & Identity Portal</span>
                </button>
              )}

              <div className="dropdown-divider" />

              <button
                className="dropdown-item logout-item"
                onClick={() => {
                  setShowUserMenu(false);
                  onLogout();
                }}
              >
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
