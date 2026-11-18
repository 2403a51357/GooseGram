/**
 * CampusVoice Central API Client
 * Automatically attaches Bearer access tokens from localStorage.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

function getToken() {
  return localStorage.getItem("campusvoice_token");
}

function getRefreshToken() {
  return localStorage.getItem("campusvoice_refresh_token");
}

export function setToken(token, refreshToken = null) {
  if (token) {
    localStorage.setItem("campusvoice_token", token);
  } else {
    localStorage.removeItem("campusvoice_token");
  }

  if (refreshToken) {
    localStorage.setItem("campusvoice_refresh_token", refreshToken);
  } else if (!token) {
    localStorage.removeItem("campusvoice_refresh_token");
  }
}

let isRefreshing = false;

async function request(endpoint, options = {}, isRetry = false) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  // Automatic token refresh on 401 Unauthorized
  if (response.status === 401 && !isRetry && !endpoint.startsWith("/auth/")) {
    const refreshToken = getRefreshToken();
    if (refreshToken && !isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        const refreshData = await refreshRes.json().catch(() => ({}));
        if (refreshRes.ok && refreshData.access_token) {
          setToken(refreshData.access_token, refreshData.refresh_token);
          isRefreshing = false;
          // Retry original request with fresh token
          return request(endpoint, options, true);
        }
      } catch (e) {
        console.warn("Token refresh failed:", e);
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth & Identity
  suggestUsername: () => request("/auth/suggest-username"),
  checkUsername: (username) => request("/auth/check-username", {
    method: "POST",
    body: JSON.stringify({ username })
  }),
  signup: (payload) => request("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  login: (payload) => request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  getMe: () => request("/me"),

  // Public Profiles (Natural discovery through posts/comments)
  getPublicProfile: (identifier) => {
    const clean = String(identifier || "").replace(/^(u\/|@)/, "").trim();
    return request(`/users/${encodeURIComponent(clean)}/profile`);
  },

  // Posts & Feed
  getPost: (postId) => request(`/posts/${postId}`),
  getPosts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.sort) query.append("sort", params.sort);
    if (params.flair) query.append("flair", params.flair);
    if (params.search) query.append("search", params.search);
    if (params.community) query.append("community", params.community);
    const qs = query.toString();
    return request(`/posts${qs ? `?${qs}` : ""}`);
  },
  createPost: (payload) => request("/posts", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  deletePost: (postId) => request(`/posts/${postId}`, {
    method: "DELETE"
  }),
  toggleSavePost: (postId) => request(`/posts/${postId}/save`, {
    method: "POST"
  }),
  getSavedPosts: () => request("/posts/saved"),
  votePost: (postId, voteValue) => request(`/posts/${postId}/vote`, {
    method: "POST",
    body: JSON.stringify({ vote_value: voteValue })
  }),
  getPostVotes: (postId) => request(`/posts/${postId}/votes`),

  // Communities (c/Hubs) & Moderator Management
  getCommunities: (params = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.append("category", params.category);
    if (params.search) query.append("search", params.search);
    const qs = query.toString();
    return request(`/communities${qs ? `?${qs}` : ""}`);
  },
  getMyCommunities: () => request("/communities/my"),
  getCommunity: (slug) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}`);
  },
  getCommunityMembers: (slug) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/members`);
  },
  updateCommunityMemberRole: (slug, userId, role) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/members/${encodeURIComponent(userId)}/role`, {
      method: "POST",
      body: JSON.stringify({ role })
    });
  },
  createCommunity: (payload) => request("/communities", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  toggleJoinCommunity: (identifier) => {
    const clean = String(identifier || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/join`, {
      method: "POST"
    });
  },
  getCommunitySettings: (slug) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/settings`);
  },
  updateCommunitySettings: (slug, payload) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/settings`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  createCommunityTimeout: (slug, payload) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/timeouts`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createCommunityMute: (slug, payload) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/timeouts`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  removeCommunityTimeout: (slug, timeoutId) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/timeouts/${encodeURIComponent(timeoutId)}`, {
      method: "DELETE"
    });
  },
  removeCommunityMute: (slug, muteId) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/timeouts/${encodeURIComponent(muteId)}`, {
      method: "DELETE"
    });
  },
  pinCommunityPost: (slug, postId) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/posts/${encodeURIComponent(postId)}/pin`, {
      method: "POST"
    });
  },
  restoreCommunityPost: (slug, postId) => {
    const clean = String(slug || "").replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
    return request(`/communities/${encodeURIComponent(clean)}/posts/${encodeURIComponent(postId)}/restore`, {
      method: "POST"
    });
  },
  reportDisruptivePost: (postId, reason = "Disruptive content") => request("/reports", {
    method: "POST",
    body: JSON.stringify({ post_id: postId, reason, details: reason })
  }),

  // Comments
  getComments: (postId) => request(`/posts/${postId}/comments`),
  createComment: (postId, payload) => request(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),

  // Polls
  getPolls: () => request("/polls"),
  getPoll: (pollId) => request(`/polls/${pollId}`),
  createPoll: (payload) => request("/polls", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  deletePoll: (pollId) => request(`/polls/${pollId}`, {
    method: "DELETE"
  }),
  closePoll: (pollId) => request(`/polls/${pollId}/close`, {
    method: "POST"
  }),
  votePoll: (pollId, optionId) => request(`/polls/${pollId}/vote`, {
    method: "POST",
    body: JSON.stringify({ option_id: optionId })
  }),
  toggleSavePoll: (pollId) => request(`/polls/${pollId}/save`, {
    method: "POST"
  }),
  getPollResults: (pollId) => request(`/polls/${pollId}/results`),
  getPollComments: (pollId) => request(`/polls/${pollId}/comments`),
  createPollComment: (pollId, payload) => request(`/polls/${pollId}/comments`, {
    method: "POST",
    body: JSON.stringify(payload)
  }),

  // Private Chat System (Approval-Based)
  sendChatRequest: (recipientId, message = "") => request("/chat/request", {
    method: "POST",
    body: JSON.stringify({ recipient_id: recipientId, message })
  }),
  getChatRequests: () => request("/chat/requests"),
  respondChatRequest: (requestId, action) => request(`/chat/requests/${requestId}/respond`, {
    method: "POST",
    body: JSON.stringify({ action })
  }),
  getConversations: () => request("/chat/conversations"),
  getMessages: (conversationId) => request(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, body) => request(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body })
  }),

  // Notifications
  getNotifications: () => request("/notifications"),
  markAllNotificationsRead: () => request("/notifications/read-all", {
    method: "POST"
  }),

  // Moderation & Reports
  submitReport: (payload) => request("/reports", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  getAdminReports: () => request("/admin/reports"),
  updatePostStatus: (postId, status) => request(`/admin/posts/${postId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status })
  }),

  // Private Real-Name Administration (Section 6)
  getAdminIdentities: () => request("/admin/identities"),
  updateAdminIdentity: (userId, payload) => request(`/admin/identities/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  }),

  // Campus MBTI ("Goose-ality") Badge & Vibe Check System
  getMbtiStatus: () => request("/mbti/quiz-status"),
  saveMbtiProgress: (progress) => request("/mbti/progress", {
    method: "POST",
    body: JSON.stringify({ progress })
  }),
  completeMbtiQuiz: (payload) => request("/mbti/complete", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  toggleMbtiBadge: (showBadge) => request("/mbti/toggle-badge", {
    method: "PATCH",
    body: JSON.stringify({ show_mbti_badge: showBadge })
  }),
  resetMbtiQuiz: () => request("/mbti/reset", {
    method: "POST"
  })
};
