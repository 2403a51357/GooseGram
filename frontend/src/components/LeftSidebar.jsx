import React, { useState } from "react";
import {
  HomeIcon,
  TrendingIcon,
  ClockIcon,
  PollIcon,
  PlusIcon,
  CompassIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from "./Icons";

export const ALL_FLAIRS = [
  "Gossip", "Help", "Question", "Discussion", "Coding", "Software", "Project",
  "Academics", "Placement", "Career", "Resources", "Announcement",
  "Event", "Campus Life", "Canteen", "Hostel", "Transport",
  "Infrastructure", "Problem", "Report", "Suggestion", "Poll", "General"
];

export default function LeftSidebar({
  currentFeed,
  onFeedSelect,
  selectedFlair,
  onFlairSelect,
  myCommunities = [],
  currentCommunity = null,
  onSelectCommunity,
  onOpenCreateCommunity,
  onOpenExploreCommunities
}) {
  const [pocketOpen, setPocketOpen] = useState(false);
  const [flairsOpen, setFlairsOpen] = useState(true);

  // Before pocket opens, max visible communities is 3
  const initialCommunities = myCommunities.slice(0, 3);
  const hasMoreThanThree = myCommunities.length > 3;

  return (
    <aside className="left-sidebar">
      {/* Top Primary Navigation (No "FEEDS" heading) */}
      <div className="sidebar-section">
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`nav-link ${currentFeed === "home" && !selectedFlair && !currentCommunity ? "active" : ""}`}
            onClick={() => {
              if (onSelectCommunity) onSelectCommunity(null);
              onFeedSelect("home");
              onFlairSelect(null);
            }}
          >
            <span className="nav-icon"><HomeIcon size={18} /></span>
            <span>Home</span>
          </button>

          <button
            type="button"
            className={`nav-link ${currentFeed === "popular" && !selectedFlair && !currentCommunity ? "active" : ""}`}
            onClick={() => {
              if (onSelectCommunity) onSelectCommunity(null);
              onFeedSelect("popular");
              onFlairSelect(null);
            }}
          >
            <span className="nav-icon"><TrendingIcon size={18} /></span>
            <span>Popular</span>
          </button>

          <button
            type="button"
            className={`nav-link ${currentFeed === "latest" && !selectedFlair && !currentCommunity ? "active" : ""}`}
            onClick={() => {
              if (onSelectCommunity) onSelectCommunity(null);
              onFeedSelect("latest");
              onFlairSelect(null);
            }}
          >
            <span className="nav-icon"><ClockIcon size={18} /></span>
            <span>Latest</span>
          </button>

          <button
            type="button"
            className={`nav-link ${currentFeed === "polls" ? "active" : ""}`}
            onClick={() => {
              if (onSelectCommunity) onSelectCommunity(null);
              onFeedSelect("polls");
              onFlairSelect(null);
            }}
          >
            <span className="nav-icon"><PollIcon size={18} /></span>
            <span>Campus Polls</span>
          </button>

          <button
            type="button"
            className="nav-link btn-start-community-nav"
            onClick={onOpenCreateCommunity}
            title="Start a new campus community"
          >
            <span className="nav-icon"><PlusIcon size={18} /></span>
            <span>Start a Community</span>
          </button>
        </nav>
      </div>

      <div className="sidebar-divider" />

      {/* Communities Hub Section */}
      <div className="sidebar-section">
        {/* Header without + icon since dedicated button exists */}
        <div className="sidebar-section-header">
          <h4 className="sidebar-heading">COMMUNITIES</h4>
        </div>

        <nav className="sidebar-nav">
          {/* Explore Nav Item */}
          <button
            type="button"
            className="nav-link nav-link-explore"
            onClick={onOpenExploreCommunities}
          >
            <span className="nav-icon"><CompassIcon size={18} /></span>
            <span>Explore</span>
          </button>

          {/* Joined Communities Display */}
          {myCommunities.length === 0 ? (
            <div className="sidebar-empty-communities">
              <span>No joined hubs yet.</span>
            </div>
          ) : !pocketOpen ? (
            /* CLOSED: Max 3 communities visible */
            <>
              {initialCommunities.map((c) => {
                const isActive =
                  currentCommunity &&
                  (currentCommunity.id === c.id || currentCommunity.slug === c.slug);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`nav-link community-nav-item ${isActive ? "active" : ""}`}
                    onClick={() => {
                      if (onSelectCommunity) onSelectCommunity(c);
                      onFlairSelect(null);
                    }}
                    title={c.name}
                  >
                    <span className="community-sidebar-combined">c/{c.slug || c.name}</span>
                  </button>
                );
              })}

              {/* Seamless Line Before Drop: ----- show more (N) ----- */}
              {hasMoreThanThree && (
                <button
                  type="button"
                  className="pocket-split-divider-btn"
                  onClick={() => setPocketOpen(true)}
                  title="Show all joined communities"
                >
                  <span className="divider-line" />
                  <span className="divider-label">show more ({myCommunities.length})</span>
                  <span className="divider-line" />
                </button>
              )}
            </>
          ) : (
            /* OPEN: Rectangular Film Viewport of Size 7 Communities containing ALL */
            <>
              <div className="communities-film-viewport">
                <div className="communities-film-track">
                  {myCommunities.map((c) => {
                    const isActive =
                      currentCommunity &&
                      (currentCommunity.id === c.id || currentCommunity.slug === c.slug);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`nav-link community-nav-item in-film ${isActive ? "active" : ""}`}
                        onClick={() => {
                          if (onSelectCommunity) onSelectCommunity(c);
                          onFlairSelect(null);
                        }}
                        title={c.name}
                      >
                        <span className="community-sidebar-combined">c/{c.slug || c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom edge of film pocket: ----- show less ----- */}
              <button
                type="button"
                className="pocket-close-divider-btn"
                onClick={() => setPocketOpen(false)}
                title="Collapse communities"
              >
                <span className="divider-line" />
                <span className="divider-label">show less</span>
                <span className="divider-line" />
              </button>
            </>
          )}
        </nav>
      </div>

      <div className="sidebar-divider" />

      {/* Topics & Flairs Direct Dropdown Section */}
      <div className="sidebar-section">
        <button
          type="button"
          className="flair-heading-dropdown-btn"
          onClick={() => setFlairsOpen(!flairsOpen)}
          title="Toggle topics and flairs"
        >
          <div className="flair-heading-title">
            <h4 className="sidebar-heading">TOPICS & FLAIRS</h4>
            {selectedFlair && (
              <span className="active-flair-indicator">({selectedFlair})</span>
            )}
          </div>
          <span className="flair-dropdown-chevron">
            {flairsOpen ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
          </span>
        </button>

        {flairsOpen && (
          <div className="flair-list-dropdown">
            {selectedFlair && (
              <button
                type="button"
                className="clear-flair-pill-btn"
                onClick={() => onFlairSelect(null)}
              >
                Clear filter ({selectedFlair}) ✕
              </button>
            )}
            <div className="flair-list">
              {ALL_FLAIRS.map((flair) => (
                <button
                  key={flair}
                  type="button"
                  className={`flair-item-btn ${selectedFlair === flair ? "active-flair" : ""}`}
                  onClick={() => onFlairSelect(selectedFlair === flair ? null : flair)}
                >
                  <span className="flair-tag-dot" />
                  <span>{flair}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <p className="footer-brand">GooseGram</p>
        <p className="footer-sub">Campus Gossips & University Life</p>
      </div>
    </aside>
  );
}
