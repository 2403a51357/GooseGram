import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// Convert title to Reddit-style slug with underscores/hyphens
export function slugify(text) {
  if (!text) return "post";
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "post";
}

export function cleanCommunitySlug(slug) {
  if (!slug) return "";
  return String(slug).replace(/^c\//, "").replace(/^\/+|\/+$/g, "").trim();
}

export function cleanUsername(username) {
  if (!username) return "";
  return String(username).replace(/^(u\/|@)/, "").replace(/^\/+|\/+$/g, "").trim();
}

export function getPostUrl(post) {
  if (!post || !post.id) return "/";
  const comm = cleanCommunitySlug(post.community_slug) || "general";
  const slug = slugify(post.title);
  return `/c/${comm}/comments/${post.id}/${slug}`;
}

export function getCommunityUrl(slug) {
  const clean = cleanCommunitySlug(slug);
  return clean ? `/c/${clean}` : "/";
}

export function getCommunitySettingsUrl(slug) {
  const clean = cleanCommunitySlug(slug);
  return clean ? `/c/${clean}/settings` : "/";
}

export function getProfileUrl(username) {
  const clean = cleanUsername(username);
  return clean ? `/u/${clean}` : "/";
}

export function getVibeCheckUrl() {
  return "/vibe-check";
}

export function getPollUrl(poll) {
  if (!poll) return "/polls";
  const pollId = typeof poll === "string" ? poll : poll.id;
  if (!pollId) return "/polls";
  const question = typeof poll === "object" ? (poll.question || poll.title || "poll") : "poll";
  const slug = slugify(question);
  return `/polls/${pollId}/${slug}`;
}

/**
 * Parses current pathname into a structured route object
 */
export function parsePath(pathname = "/") {
  const normalized = (pathname || "/").replace(/\/+$/, "") || "/";

  // Post view with community: /c/:community/comments/:postId/:slug?
  const postWithCommMatch = normalized.match(/^\/c\/([^/]+)\/comments\/([^/]+)(?:\/([^/]+))?$/i);
  if (postWithCommMatch) {
    return {
      view: "post",
      communitySlug: cleanCommunitySlug(postWithCommMatch[1]),
      postId: postWithCommMatch[2],
      postSlug: postWithCommMatch[3] || ""
    };
  }

  // Post view without community: /comments/:postId/:slug?
  const postNoCommMatch = normalized.match(/^\/comments\/([^/]+)(?:\/([^/]+))?$/i);
  if (postNoCommMatch) {
    return {
      view: "post",
      communitySlug: null,
      postId: postNoCommMatch[1],
      postSlug: postNoCommMatch[2] || ""
    };
  }

  // Community settings view: /c/:community/settings
  const commSettingsMatch = normalized.match(/^\/c\/([^/]+)\/settings$/i);
  if (commSettingsMatch) {
    return {
      view: "community-settings",
      communitySlug: cleanCommunitySlug(commSettingsMatch[1])
    };
  }

  // Community view: /c/:community
  const commMatch = normalized.match(/^\/c\/([^/]+)$/i);
  if (commMatch) {
    return {
      view: "community",
      communitySlug: cleanCommunitySlug(commMatch[1])
    };
  }

  // User profile view: /u/:username
  const userMatch = normalized.match(/^\/u\/([^/]+)$/i);
  if (userMatch) {
    return {
      view: "profile",
      username: cleanUsername(userMatch[1])
    };
  }

  // Dedicated pages & feeds
  if (normalized === "/vibe-check" || normalized === "/mbti" || normalized === "/quiz") {
    return { view: "vibe-check" };
  }
  if (normalized === "/explore" || normalized === "/explore-communities") {
    return { view: "explore-communities" };
  }
  if (normalized === "/polls") {
    return { view: "feed", feed: "polls" };
  }
  if (normalized === "/popular") {
    return { view: "feed", feed: "popular" };
  }
  if (normalized === "/latest") {
    return { view: "feed", feed: "latest" };
  }
  if (normalized === "/saved") {
    return { view: "feed", feed: "saved" };
  }
  if (normalized === "/my-posts") {
    return { view: "feed", feed: "my-posts" };
  }

  // Poll detail view with community: /c/:community/polls/:pollId/:slug?
  const commPollMatch = normalized.match(/^\/c\/([^/]+)\/polls\/([^/]+)(?:\/([^/]+))?$/i);
  if (commPollMatch) {
    return {
      view: "poll",
      communitySlug: cleanCommunitySlug(commPollMatch[1]),
      pollId: commPollMatch[2],
      pollSlug: commPollMatch[3] || ""
    };
  }

  // Poll detail view: /polls/:pollId/:slug? or /polls/comments/:pollId/:slug?
  const pollCommentsMatch = normalized.match(/^\/polls\/comments\/([^/]+)(?:\/([^/]+))?$/i);
  if (pollCommentsMatch) {
    return {
      view: "poll",
      pollId: pollCommentsMatch[1],
      pollSlug: pollCommentsMatch[2] || ""
    };
  }

  const pollMatch = normalized.match(/^\/polls\/([^/]+)(?:\/([^/]+))?$/i);
  if (pollMatch) {
    return {
      view: "poll",
      pollId: pollMatch[1],
      pollSlug: pollMatch[2] || ""
    };
  }

  // Default: Home feed
  return { view: "feed", feed: "home" };
}

const RouterContext = createContext(null);

export function RouterProvider({ children }) {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || "/");

  useEffect(() => {
    // Handle browser back/forward and laptop trackpad sideways swipe
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || "/");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((to, { replace = false, preserveScroll = false } = {}) => {
    if (!to) return;
    const targetUrl = to.startsWith("/") ? to : `/${to}`;
    if (window.location.pathname !== targetUrl) {
      if (replace) {
        window.history.replaceState({}, "", targetUrl);
      } else {
        window.history.pushState({}, "", targetUrl);
      }
      setCurrentPath(targetUrl);
      if (!preserveScroll) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, []);

  const route = parsePath(currentPath);

  const value = {
    currentPath,
    route,
    navigate,
    getPostUrl,
    getPollUrl,
    getCommunityUrl,
    getCommunitySettingsUrl,
    getProfileUrl
  };

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("useRouter must be used within a RouterProvider");
  }
  return ctx;
}
