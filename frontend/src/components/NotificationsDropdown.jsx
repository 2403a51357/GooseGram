import React from "react";
import { BellIcon, CheckIcon, CloseIcon } from "./Icons";

export default function NotificationsDropdown({
  isOpen,
  onClose,
  notifications = [],
  onMarkAllRead,
  onNotificationClick
}) {
  if (!isOpen) return null;

  function formatTime(isoString) {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  }

  return (
    <div className="notifications-dropdown-overlay" onClick={onClose}>
      <div className="notifications-dropdown-card" onClick={(e) => e.stopPropagation()}>
        <div className="notif-dropdown-header">
          <div className="notif-header-left">
            <BellIcon size={18} />
            <h4>Notifications</h4>
          </div>
          <div className="notif-header-right">
            {notifications.some(n => !n.is_read) && (
              <button className="btn-mark-all-read" onClick={onMarkAllRead} title="Mark all read">
                <CheckIcon size={14} />
                <span>Mark all read</span>
              </button>
            )}
            <button className="btn-notif-close" onClick={onClose}>
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        <div className="notif-items-list">
          {notifications.length === 0 ? (
            <div className="notif-empty-state">
              <p>No notifications yet.</p>
              <small>When someone replies to your post or sends a chat request, you'll see it here.</small>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`notif-item-row ${!n.is_read ? "notif-unread" : ""}`}
                onClick={() => onNotificationClick(n)}
              >
                {!n.is_read && <span className="unread-dot" />}
                <div className="notif-item-content">
                  <p className="notif-title">{n.title}</p>
                  <p className="notif-desc">{n.content}</p>
                  <span className="notif-time">{formatTime(n.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
