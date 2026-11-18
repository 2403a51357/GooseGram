import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import { api, setToken } from "./api";
import { realtimeClient } from "./realtime";
import { useRouter } from "./router";
import Navbar from "./components/Navbar";
import LeftSidebar from "./components/LeftSidebar";
import RightSidebar from "./components/RightSidebar";
import PostCard from "./components/PostCard";
import PollCard from "./components/PollCard";
import PollPageView from "./components/PollPageView";
import CreatePostModal from "./components/CreatePostModal";
import CreatePollModal from "./components/CreatePollModal";
import CreateCommunityModal from "./components/CreateCommunityModal";
import ExploreCommunitiesModal from "./components/ExploreCommunitiesModal";
import CommunityHeader from "./components/CommunityHeader";
import CommunityPageView from "./components/CommunityPageView";
import CommunitySettingsPage from "./components/CommunitySettingsPage";
import CommunitySettingsModal from "./components/CommunitySettingsModal";
import PostPageView from "./components/PostPageView";
import ProfilePageView from "./components/ProfilePageView";
import VibeCheckPage from "./components/VibeCheckPage";
import ExploreCommunitiesPageView from "./components/ExploreCommunitiesPageView";
import FloatingChatWidget from "./components/FloatingChatWidget";
import NotificationsDropdown from "./components/NotificationsDropdown";
import AdminPortalModal from "./components/AdminPortalModal";
import ReportModal from "./components/ReportModal";
import AuthCard from "./components/AuthCard";
import { ClockIcon, TrendingIcon, SparklesIcon } from "./components/Icons";

export default function App() {
  const { route, navigate, getPostUrl, getPollUrl, getCommunityUrl, getCommunitySettingsUrl, getProfileUrl } = useRouter();

  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Active Post, Poll & Profile
  const [activePost, setActivePost] = useState(null);
  const [activePoll, setActivePoll] = useState(null);

  // Feed & Content State
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [savedPostIds, setSavedPostIds] = useState(new Set());
  const [selectedFlair, setSelectedFlair] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Communities State
  const [currentCommunity, setCurrentCommunity] = useState(null);
  const [myCommunities, setMyCommunities] = useState([]);
  const [createCommunityOpen, setCreateCommunityOpen] = useState(false);
  const [exploreCommunitiesOpen, setExploreCommunitiesOpen] = useState(false);
  const [communitySettingsOpen, setCommunitySettingsOpen] = useState(false);

  // Polls State
  const [polls, setPolls] = useState([]);
  const [pollResults, setPollResults] = useState({});
  const [loadingPolls, setLoadingPolls] = useState(false);

  // Header & Navigation Badges
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingChatRequests, setPendingChatRequests] = useState(0);

  // Modals & Floating Widgets
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createPollOpen, setCreatePollOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [adminPortalOpen, setAdminPortalOpen] = useState(false);
  const [reportModalData, setReportModalData] = useState(null);

  // Unread Messages & Navbar Dot State
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [unreadConversationIds, setUnreadConversationIds] = useState(new Set());
  const [activeChatConvId, setActiveChatConvId] = useState(null);

  const chatOpenRef = useRef(chatOpen);
  const activeChatConvIdRef = useRef(activeChatConvId);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);

  useEffect(() => {
    activeChatConvIdRef.current = activeChatConvId;
  }, [activeChatConvId]);

  // Realtime subscription for incoming direct messages (Navbar red unread dot)
  useEffect(() => {
    if (!currentUser?.id) return;

    const unsubscribe = realtimeClient.subscribe((newMsg) => {
      if (newMsg.sender_id && newMsg.sender_id !== currentUser.id) {
        if (!chatOpenRef.current || activeChatConvIdRef.current !== newMsg.conversation_id) {
          setHasUnreadMessages(true);
          setUnreadConversationIds((prev) => new Set(prev).add(newMsg.conversation_id));
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.id]);

  function handleClearUnreadConversation(convId) {
    setUnreadConversationIds((prev) => {
      const next = new Set(prev);
      next.delete(convId);
      if (next.size === 0) {
        setHasUnreadMessages(false);
      }
      return next;
    });
  }

  // Check persistent session on mount
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const data = await api.getMe();
      setCurrentUser(data.profile);
    } catch {
      setToken(null);
      setCurrentUser(null);
    } finally {
      setLoadingUser(false);
    }
  }

  function handleLoginSuccess(profile) {
    setCurrentUser(profile);
  }

  function handleLogout() {
    setToken(null);
    setCurrentUser(null);
    setPosts([]);
    setPolls([]);
    setCurrentCommunity(null);
    setMyCommunities([]);
    navigate("/");
  }

  // Load user data when authenticated
  useEffect(() => {
    if (currentUser) {
      loadNotifications();
      loadChatRequestBadge();
      loadSavedPostsList();
      loadMyCommunities();
    }
  }, [currentUser]);

  // Synchronize route state with active community & posts
  useEffect(() => {
    if (!currentUser) return;

    if (route.view === "community" || route.view === "community-settings") {
      const slug = route.communitySlug;
      if (!currentCommunity || currentCommunity.slug?.toLowerCase() !== slug?.toLowerCase()) {
        api.getCommunity(slug)
          .then((res) => {
            setCurrentCommunity(res.community);
          })
          .catch((err) => {
            console.error("Community lookup error:", err);
          });
      }
    } else if (route.view === "post") {
      if (route.communitySlug) {
        if (!currentCommunity || currentCommunity.slug?.toLowerCase() !== route.communitySlug?.toLowerCase()) {
          api.getCommunity(route.communitySlug)
            .then((res) => setCurrentCommunity(res.community))
            .catch(() => {});
        }
      }
      if (route.postId) {
        const found = posts.find((p) => String(p.id) === String(route.postId));
        if (found) {
          setActivePost(found);
        }
      }
    } else if (route.view === "feed") {
      if (currentCommunity) {
        setCurrentCommunity(null);
      }
    }
  }, [route.view, route.communitySlug, route.postId, currentUser]);

  // Feed loader triggered on view, community, flair, sort, or search change
  useEffect(() => {
    if (!currentUser) return;
    if (route.view === "feed" && route.feed === "polls") {
      loadPolls();
    } else if (route.view === "feed" || route.view === "community") {
      loadFeed();
    }
  }, [
    currentUser,
    route.view,
    route.feed,
    route.communitySlug,
    currentCommunity?.slug,
    selectedFlair,
    sortBy,
    searchQuery
  ]);

  // -------------------------------------------------------------------------
  // Page View Navigation Helpers
  // -------------------------------------------------------------------------
  function handleOpenPost(post) {
    setActivePost(post);
    navigate(getPostUrl(post));
  }

  function handleOpenProfile(username) {
    const target = (!username || username === "me") ? (currentUser?.username || "me") : username;
    navigate(getProfileUrl(target));
  }

  function handleSelectCommunity(commOrSlug) {
    if (!commOrSlug) {
      setCurrentCommunity(null);
      navigate("/");
      return;
    }
    const slug = typeof commOrSlug === "string"
      ? (commOrSlug.startsWith("c/") ? commOrSlug.slice(2) : commOrSlug)
      : commOrSlug.slug;
    navigate(getCommunityUrl(slug));
  }

  function handleFeedSelect(feed) {
    setCurrentCommunity(null);
    setSelectedFlair(null);
    setSearchQuery("");
    if (feed === "home") {
      navigate("/");
    } else {
      navigate(`/${feed}`);
    }
  }

  function handleGoHome() {
    setCurrentCommunity(null);
    setSelectedFlair(null);
    setSearchQuery("");
    navigate("/");
  }

  // -------------------------------------------------------------------------
  // Communities Loading & Actions
  // -------------------------------------------------------------------------
  async function loadMyCommunities() {
    try {
      const data = await api.getMyCommunities();
      setMyCommunities(data.communities || []);
    } catch (err) {
      console.error("Load my communities error:", err);
    }
  }

  function handleCommunityMembershipChanged(communityId, joined, memberCount) {
    loadMyCommunities();
    if (currentCommunity && currentCommunity.id === communityId) {
      setCurrentCommunity((prev) =>
        prev ? { ...prev, is_member: joined, member_count: memberCount } : null
      );
    }
  }

  // -------------------------------------------------------------------------
  // Feed Loading
  // -------------------------------------------------------------------------
  async function loadFeed() {
    if (route.view === "feed" && route.feed === "polls") return;

    setLoadingPosts(true);
    try {
      if (route.view === "feed" && route.feed === "saved") {
        const data = await api.getSavedPosts();
        setPosts(data.posts || []);
      } else {
        const activeFeed = route.view === "feed" ? route.feed : "home";
        const sortParam = activeFeed === "popular" ? "popular" : activeFeed === "latest" ? "newest" : sortBy;
        const commSlug = route.view === "community" ? route.communitySlug : undefined;

        const data = await api.getPosts({
          sort: sortParam,
          flair: selectedFlair || undefined,
          search: searchQuery || undefined,
          community: commSlug
        });

        let feedPosts = data.posts || [];
        if (activeFeed === "my-posts") {
          feedPosts = feedPosts.filter(p => p.author_username === currentUser?.username || p.is_mine);
        }

        // Scope pinned posts strictly to community view; on global feed sort purely by active sortParam
        if (route.view === "community") {
          feedPosts.sort((a, b) => {
            if (a.is_pinned !== b.is_pinned) {
              return a.is_pinned ? -1 : 1;
            }
            if (sortParam === "popular") return (b.score || 0) - (a.score || 0);
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
          });
        } else {
          feedPosts.sort((a, b) => {
            if (sortParam === "popular") return (b.score || 0) - (a.score || 0);
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
          });
        }
        setPosts(feedPosts);
      }
    } catch (err) {
      console.error("Feed load error:", err);
    } finally {
      setLoadingPosts(false);
    }
  }

  async function loadSavedPostsList() {
    try {
      const data = await api.getSavedPosts();
      const ids = new Set((data.posts || []).map(p => p.id));
      setSavedPostIds(ids);
    } catch {
      // Ignore
    }
  }

  // -------------------------------------------------------------------------
  // Polls Loading
  // -------------------------------------------------------------------------
  async function loadPolls() {
    setLoadingPolls(true);
    try {
      const data = await api.getPolls();
      const loadedPolls = data.polls || [];
      setPolls(loadedPolls);

      const resultsMap = {};
      loadedPolls.forEach((p) => {
        if (p.results) {
          resultsMap[p.id] = p.results;
        }
      });
      setPollResults(resultsMap);
    } catch (err) {
      console.error("Polls load error:", err);
    } finally {
      setLoadingPolls(false);
    }
  }

  // -------------------------------------------------------------------------
  // Notifications & Badges
  // -------------------------------------------------------------------------
  async function loadNotifications() {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadNotifications(data.unread_count || 0);
    } catch {
      // Ignore
    }
  }

  async function loadChatRequestBadge() {
    try {
      const data = await api.getChatRequests();
      setPendingChatRequests((data.received || []).length);
    } catch {
      // Ignore
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadNotifications(0);
    } catch (err) {
      console.error("Mark read error:", err);
    }
  }

  // -------------------------------------------------------------------------
  // Interactions: Voting, Saving, Deleting
  // -------------------------------------------------------------------------
  async function handleVotePost(postId, voteValue) {
    const prevPostsSnapshot = posts;
    const prevActivePostSnapshot = activePost;

    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const currentScore = p.score ?? ((p.upvotes || 0) - (p.downvotes || 0));
          const oldVote = p.my_vote || 0;
          const newVote = oldVote === voteValue ? 0 : voteValue;
          const scoreDelta = newVote - oldVote;
          return {
            ...p,
            my_vote: newVote,
            score: currentScore + scoreDelta
          };
        }
        return p;
      })
    );

    if (activePost && activePost.id === postId) {
      setActivePost(prev => {
        if (!prev) return null;
        const currentScore = prev.score ?? ((prev.upvotes || 0) - (prev.downvotes || 0));
        const oldVote = prev.my_vote || 0;
        const newVote = oldVote === voteValue ? 0 : voteValue;
        const scoreDelta = newVote - oldVote;
        return {
          ...prev,
          my_vote: newVote,
          score: currentScore + scoreDelta
        };
      });
    }

    try {
      const res = await api.votePost(postId, voteValue);
      if (res.votes && typeof res.votes.score === "number") {
        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? {
                  ...p,
                  my_vote: res.votes.my_vote ?? p.my_vote,
                  score: res.votes.score,
                  upvotes: res.votes.upvotes ?? p.upvotes,
                  downvotes: res.votes.downvotes ?? p.downvotes
                }
              : p
          )
        );
        if (activePost && activePost.id === postId) {
          setActivePost(prev =>
            prev
              ? {
                  ...prev,
                  my_vote: res.votes.my_vote ?? prev.my_vote,
                  score: res.votes.score,
                  upvotes: res.votes.upvotes ?? prev.upvotes,
                  downvotes: res.votes.downvotes ?? prev.downvotes
                }
              : prev
          );
        }
      }
    } catch (err) {
      setPosts(prevPostsSnapshot);
      setActivePost(prevActivePostSnapshot);
      alert(err.message || "Could not process vote.");
    }
  }

  function handleCommentAddedToPost(postId) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, comment_count: (p.comment_count ?? p.comments_count ?? 0) + 1 }
          : p
      )
    );
    if (activePost && activePost.id === postId) {
      setActivePost((prev) =>
        prev
          ? { ...prev, comment_count: (prev.comment_count ?? prev.comments_count ?? 0) + 1 }
          : prev
      );
    }
  }

  async function handleToggleSavePost(postId) {
    try {
      const res = await api.toggleSavePost(postId);
      setSavedPostIds(prev => {
        const next = new Set(prev);
        if (res.saved) {
          next.add(postId);
        } else {
          next.delete(postId);
        }
        return next;
      });
    } catch (err) {
      alert(err.message || "Could not update bookmark.");
    }
  }

  async function handleDeletePost(postId) {
    if (!window.confirm("Are you sure you want to delete this discussion?")) return;
    try {
      await api.deletePost(postId);
      setPosts(prev => prev.filter(p => p.id !== postId));
      if (route.view === "post" && route.postId === postId) {
        if (currentCommunity) {
          navigate(getCommunityUrl(currentCommunity.slug));
        } else {
          navigate("/");
        }
      }
    } catch (err) {
      alert(err.message || "Could not delete post.");
    }
  }

  async function handlePinPost(postId, commSlug) {
    const slug = commSlug || (route.view === "community" ? route.communitySlug : currentCommunity?.slug);
    if (!slug) return;
    try {
      const res = await api.pinCommunityPost(slug, postId);
      setPosts(prev => {
        const updated = prev.map(p =>
          p.id === postId ? { ...p, is_pinned: res.is_pinned } : p
        );
        if (route.view === "community") {
          return updated.sort((a, b) => (a.is_pinned === b.is_pinned ? 0 : a.is_pinned ? -1 : 1));
        }
        return updated;
      });
      if (activePost && activePost.id === postId) {
        setActivePost(prev => (prev ? { ...prev, is_pinned: res.is_pinned } : prev));
      }
    } catch (err) {
      alert(err.message || "Failed to update pinned announcement.");
    }
  }

  function handleOpenPoll(poll) {
    setActivePoll(poll);
    navigate(getPollUrl(poll));
  }

  async function handleVotePoll(pollId, optionId) {
    try {
      const res = await api.votePoll(pollId, optionId);
      setPolls(prev =>
        prev.map(p => {
          if (p.id === pollId) {
            return {
              ...p,
              results: res.results || p.results,
              total_votes: res.total_votes ?? p.total_votes,
              user_voted_option_id: res.my_vote_option_id || optionId,
              has_voted: true
            };
          }
          return p;
        })
      );
      setPollResults(prev => ({
        ...prev,
        [pollId]: res.results || []
      }));
      if (activePoll && activePoll.id === pollId) {
        setActivePoll(prev =>
          prev
            ? {
                ...prev,
                results: res.results || prev.results,
                total_votes: res.total_votes ?? prev.total_votes,
                user_voted_option_id: res.my_vote_option_id || optionId,
                has_voted: true
              }
            : prev
        );
      }
      return res;
    } catch (err) {
      alert(err.message || "Could not cast vote.");
    }
  }

  async function handleClosePoll(pollId) {
    if (!window.confirm("Are you sure you want to close voting on this poll?")) return;
    try {
      await api.closePoll(pollId);
      setPolls(prev =>
        prev.map(p => (p.id === pollId ? { ...p, is_closed: true, can_close: false } : p))
      );
      if (activePoll && activePoll.id === pollId) {
        setActivePoll(prev => (prev ? { ...prev, is_closed: true, can_close: false } : prev));
      }
    } catch (err) {
      alert(err.message || "Could not close poll.");
    }
  }

  async function handleDeletePoll(pollId) {
    if (!window.confirm("Are you sure you want to delete this poll?")) return;
    try {
      await api.deletePoll(pollId);
      setPolls(prev => prev.filter(p => p.id !== pollId));
      if (route.view === "poll" && route.pollId === pollId) {
        navigate("/polls");
      }
    } catch (err) {
      alert(err.message || "Could not delete poll.");
    }
  }

  // -------------------------------------------------------------------------
  // Render App
  // -------------------------------------------------------------------------
  if (loadingUser) {
    return (
      <div className="app-loading-screen">
        <div className="loading-spinner" />
        <p>Loading GooseGram...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthCard onLoginSuccess={handleLoginSuccess} />;
  }

  const currentFeedName = route.view === "feed" ? route.feed : route.view === "poll" ? "polls" : "home";

  return (
    <div className="goosegram-layout">
      {/* Top Navbar */}
      <Navbar
        profile={currentUser}
        onLogout={handleLogout}
        onOpenCreatePost={() => setCreatePostOpen(true)}
        onOpenChat={() => {
          setChatOpen(true);
          if (unreadConversationIds.size === 0) {
            setHasUnreadMessages(false);
          }
        }}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onOpenProfile={handleOpenProfile}
        onOpenAdminPortal={() => setAdminPortalOpen(true)}
        unreadNotifications={unreadNotifications}
        pendingChatRequests={pendingChatRequests}
        hasUnreadMessages={hasUnreadMessages}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onGoHome={handleGoHome}
        currentCommunity={route.view === "community" ? currentCommunity : null}
        onClearCommunity={() => {
          setCurrentCommunity(null);
          navigate("/");
        }}
      />

      {/* Main Layout Container (Persistent Left & Right panels!) */}
      <div className="app-container">
        {/* Left Sidebar - Sticks flush to left wall, never unmounts */}
        <LeftSidebar
          currentFeed={currentFeedName}
          onFeedSelect={handleFeedSelect}
          selectedFlair={selectedFlair}
          onFlairSelect={setSelectedFlair}
          myCommunities={myCommunities}
          currentCommunity={currentCommunity}
          onSelectCommunity={handleSelectCommunity}
          onOpenCreateCommunity={() => setCreateCommunityOpen(true)}
          onOpenExploreCommunities={() => navigate("/explore")}
        />

        {/* Center Main Area - Only this middle part switches with the active page route */}
        <main className="center-content">
          {route.view === "post" ? (
            /* Dedicated Post Page (Reddit Image 2 Style) */
            <PostPageView
              key={route.postId}
              postId={route.postId}
              post={activePost && String(activePost.id) === String(route.postId) ? activePost : null}
              currentUser={currentUser}
              onVote={handleVotePost}
              onToggleSave={handleToggleSavePost}
              isSaved={savedPostIds.has(route.postId)}
              onOpenProfile={handleOpenProfile}
              onDeletePost={handleDeletePost}
              onReportPost={(id, type) => setReportModalData({ id, type })}
              onPinPost={handlePinPost}
              isCommunityMod={Boolean(currentCommunity?.is_moderator || currentUser?.role === "admin")}
              onCommentAdded={handleCommentAddedToPost}
              onSelectCommunity={handleSelectCommunity}
              onOpenChat={(username) => {
                setChatTargetUser({ username });
                setChatOpen(true);
              }}
            />
          ) : route.view === "poll" ? (
            /* Dedicated Poll Detail & Discussion Page */
            <PollPageView
              key={route.pollId}
              pollId={route.pollId}
              initialPoll={activePoll && String(activePoll.id) === String(route.pollId) ? activePoll : null}
              currentUser={currentUser}
              onVotePoll={handleVotePoll}
              onClosePoll={handleClosePoll}
              onDeletePoll={handleDeletePoll}
              onToggleSave={handleToggleSavePost}
              savedPostIds={savedPostIds}
              onOpenProfile={handleOpenProfile}
              onOpenChat={(username) => {
                setChatTargetUser({ username });
                setChatOpen(true);
              }}
              onReportPoll={(id, type) => setReportModalData({ id, type: type || "poll" })}
              onGoBack={() => navigate("/polls")}
            />
          ) : route.view === "profile" ? (
            /* Dedicated Profile Page (/u/:username) */
            <ProfilePageView
              key={route.username}
              username={route.username === "me" ? currentUser?.username : route.username}
              currentUser={currentUser}
              onOpenPost={handleOpenPost}
              onOpenChatWith={(prof) => {
                setChatTargetUser(prof);
                setChatOpen(true);
              }}
              onOpenChat={(username) => {
                setChatTargetUser({ username });
                setChatOpen(true);
              }}
              onReport={(id, type) => setReportModalData({ id, type })}
              onVotePost={handleVotePost}
              onToggleSave={handleToggleSavePost}
              savedPostIds={savedPostIds}
              onDeletePost={handleDeletePost}
              onSelectCommunity={handleSelectCommunity}
            />
          ) : route.view === "vibe-check" ? (
            /* Dedicated Vibe Check Quiz Page (/vibe-check) */
            <VibeCheckPage
              currentUser={currentUser}
              onProfileUpdated={(updated) => {
                setCurrentUser((prev) => (prev ? { ...prev, ...updated } : prev));
              }}
              onGoHome={() => navigate("/")}
            />
          ) : route.view === "explore-communities" ? (
            /* Dedicated Explore Communities Page (/explore) */
            <ExploreCommunitiesPageView
              onSelectCommunity={handleSelectCommunity}
              onOpenCreateCommunity={() => setCreateCommunityOpen(true)}
              onCommunityMembershipChanged={handleCommunityMembershipChanged}
            />
          ) : route.view === "community-settings" ? (
            /* Dedicated Community Settings Page (/c/:community/settings) */
            <CommunitySettingsPage
              key={`settings-${route.communitySlug}`}
              slug={route.communitySlug}
              currentUser={currentUser}
            />
          ) : route.view === "community" ? (
            /* Dedicated Community Page (Reddit Image 1 Style) */
            <CommunityPageView
              key={route.communitySlug}
              slug={route.communitySlug}
              currentUser={currentUser}
              onOpenCreatePost={() => setCreatePostOpen(true)}
              onOpenSettings={() => navigate(getCommunitySettingsUrl(route.communitySlug))}
              onOpenPost={handleOpenPost}
              onOpenProfile={handleOpenProfile}
              onVotePost={handleVotePost}
              onToggleSave={handleToggleSavePost}
              savedPostIds={savedPostIds}
              onDeletePost={handleDeletePost}
              onReportPost={(id, type) => setReportModalData({ id, type })}
              onPinPost={handlePinPost}
              onMembershipChanged={handleCommunityMembershipChanged}
              onSelectCommunity={handleSelectCommunity}
              onOpenChat={(username) => {
                setChatTargetUser({ username });
                setChatOpen(true);
              }}
            />
          ) : (
            /* Discussion Feeds (/ or /popular or /latest etc.) */
            <>
              {route.view === "feed" && route.feed === "polls" ? (
                /* Polls Center View */
                <section className="polls-feed-view">
                  <div className="feed-header-bar">
                    <div className="header-title-box">
                      <h2>Campus Polls</h2>
                      <p>Cast your vote on ongoing college initiatives and topics.</p>
                    </div>
                    <button
                      className="btn-create-poll-top"
                      onClick={() => setCreatePollOpen(true)}
                    >
                      + Create a Poll
                    </button>
                  </div>

                  {loadingPolls ? (
                    <div className="feed-loading-state">Loading active polls...</div>
                  ) : polls.length === 0 ? (
                    <div className="feed-empty-state">
                      <p>No active polls found.</p>
                      <button onClick={() => setCreatePollOpen(true)}>Create the first campus poll</button>
                    </div>
                  ) : (
                    polls.map(p => (
                      <PollCard
                        key={p.id}
                        poll={p}
                        results={pollResults[p.id] || p.results || []}
                        onVote={handleVotePoll}
                        onClosePoll={handleClosePoll}
                        onDeletePoll={handleDeletePoll}
                        onToggleSave={handleToggleSavePost}
                        isSaved={savedPostIds.has(p.id) || Boolean(p.is_saved)}
                        onOpenPoll={handleOpenPoll}
                        onOpenProfile={handleOpenProfile}
                        onOpenChat={(username) => {
                          setChatTargetUser({ username });
                          setChatOpen(true);
                        }}
                        onReportPoll={(id, type) => setReportModalData({ id, type: type || "poll" })}
                        currentUser={currentUser}
                      />
                    ))
                  )}
                </section>
              ) : (
                /* Discussion Posts Feed */
                <section className="posts-feed-view">
                  {/* Sort Bar */}
                  <div className="feed-sort-bar">
                    <div className="sort-buttons-group">
                      <button
                        type="button"
                        className={`sort-pill ${sortBy === "newest" ? "active-sort" : ""}`}
                        onClick={() => setSortBy("newest")}
                      >
                        <ClockIcon size={14} />
                        <span>Newest</span>
                      </button>
                      <button
                        type="button"
                        className={`sort-pill ${sortBy === "popular" ? "active-sort" : ""}`}
                        onClick={() => setSortBy("popular")}
                      >
                        <TrendingIcon size={14} />
                        <span>Popular</span>
                      </button>
                      <button
                        type="button"
                        className={`sort-pill ${sortBy === "top" ? "active-sort" : ""}`}
                        onClick={() => setSortBy("top")}
                      >
                        <SparklesIcon size={14} />
                        <span>Top</span>
                      </button>
                    </div>

                    {selectedFlair && (
                      <div className="active-filter-badge">
                        <span>Topic: <strong>{selectedFlair}</strong></span>
                        <button onClick={() => setSelectedFlair(null)}>✕</button>
                      </div>
                    )}
                  </div>

                  {searchQuery && (
                    <div className="search-results-banner">
                      <span>Searching discussions for: "<strong>{searchQuery}</strong>"</span>
                      <button onClick={() => setSearchQuery("")}>Clear Search</button>
                    </div>
                  )}

                  {loadingPosts ? (
                    <div className="feed-loading-state">Waddling through the pond...</div>
                  ) : posts.length === 0 ? (
                    <div className="feed-empty-state">
                      {route.feed === "saved" ? (
                        <>
                          <p>Nothing stashed in your nest yet.</p>
                          <button onClick={() => navigate("/")}>Explore Discussions</button>
                        </>
                      ) : (
                        <>
                          <p>The pond is suspiciously quiet. Drop some tea.</p>
                          <button onClick={() => setCreatePostOpen(true)}>Spill Some Tea</button>
                        </>
                      )}
                    </div>
                  ) : (
                    posts.map(post => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onVote={handleVotePost}
                        onToggleSave={handleToggleSavePost}
                        isSaved={savedPostIds.has(post.id)}
                        onOpenProfile={handleOpenProfile}
                        onDeletePost={handleDeletePost}
                        onReportPost={(id, type) => setReportModalData({ id, type })}
                        onPinPost={handlePinPost}
                        isCommunityMod={Boolean(route.view === "community" && (currentCommunity?.is_moderator || currentUser?.role === "admin"))}
                        currentUser={currentUser}
                        onSelectCommunity={handleSelectCommunity}
                        onOpenPost={handleOpenPost}
                        onOpenChat={(username) => {
                          setChatTargetUser({ username });
                          setChatOpen(true);
                        }}
                        inCommunity={route.view === "community"}
                      />
                    ))
                  )}
                </section>
              )}
            </>
          )}
        </main>

        {/* Right Sidebar - Persistent, stays mounted, doesn't reload when switching pages */}
        <RightSidebar
          currentView={route.view}
          currentCommunity={currentCommunity}
          activePost={activePost}
          activeProfile={route.view === "profile" ? route.username : null}
          currentUser={currentUser}
          onOpenCreatePost={() => setCreatePostOpen(true)}
          onOpenCreatePoll={() => setCreatePollOpen(true)}
          onSelectCommunity={handleSelectCommunity}
          onCommunityMembershipChanged={handleCommunityMembershipChanged}
          onOpenProfile={handleOpenProfile}
          onOpenCommunitySettings={() => setCommunitySettingsOpen(true)}
        />
      </div>

      {/* Floating Bottom-Right Chat Window */}
      <FloatingChatWidget
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false);
          loadChatRequestBadge();
        }}
        currentUser={currentUser}
        onReport={(id, type) => setReportModalData({ id, type })}
        onOpenProfile={handleOpenProfile}
        initialTargetUser={chatTargetUser}
        unreadConversationIds={unreadConversationIds}
        onClearUnreadConversation={handleClearUnreadConversation}
        onActiveConvChange={setActiveChatConvId}
      />

      {/* Modals & Creation Slide-outs */}
      <CreatePostModal
        isOpen={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        myCommunities={myCommunities}
        defaultCommunity={currentCommunity}
        onSubmit={async (payload) => {
          await api.createPost(payload);
          await loadFeed();
        }}
      />

      <CreateCommunityModal
        isOpen={createCommunityOpen}
        onClose={() => setCreateCommunityOpen(false)}
        onCreated={(newComm) => {
          loadMyCommunities();
          handleSelectCommunity(newComm);
        }}
      />

      <ExploreCommunitiesModal
        isOpen={exploreCommunitiesOpen}
        onClose={() => setExploreCommunitiesOpen(false)}
        onSelectCommunity={handleSelectCommunity}
        onOpenCreate={() => setCreateCommunityOpen(true)}
      />

      <CreatePollModal
        isOpen={createPollOpen}
        onClose={() => setCreatePollOpen(false)}
        onSubmit={async (payload) => {
          await api.createPoll(payload);
          await loadPolls();
          navigate("/polls");
        }}
      />

      <NotificationsDropdown
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onNotificationClick={(n) => {
          setNotificationsOpen(false);
          if (n.link === "/chat") setChatOpen(true);
        }}
      />

      <AdminPortalModal
        isOpen={adminPortalOpen}
        onClose={() => setAdminPortalOpen(false)}
      />

      <ReportModal
        isOpen={!!reportModalData}
        onClose={() => setReportModalData(null)}
        targetId={reportModalData?.id}
        targetType={reportModalData?.type}
      />

      <CommunitySettingsModal
        isOpen={communitySettingsOpen}
        onClose={() => setCommunitySettingsOpen(false)}
        community={currentCommunity}
        onSettingsSaved={(newSettings) => {
          setCurrentCommunity(prev => prev ? {
            ...prev,
            bio: newSettings.bio,
            description: newSettings.bio,
            banner_color: newSettings.banner_color,
            icon_emoji: newSettings.icon_emoji,
            rules: newSettings.rules,
            downvote_threshold: newSettings.downvote_threshold
          } : prev);
          loadFeed();
        }}
      />
    </div>
  );
}
