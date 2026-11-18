import os
import re
import uuid
import math
from datetime import datetime, timezone, timedelta
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client

from identity import (
    generate_anonymous_username,
    generate_campus_voice_id,
    validate_username
)
from community_safety import (
    validate_community,
    slugify
)

# Global set for post IDs reported by users as disruptive
REPORTED_POST_IDS = set()


def normalize_community_slug(raw):
    """Safely normalizes community slug without slicing characters from words starting with 'c'."""
    if not raw:
        return ""
    s = str(raw).strip().lower().replace("%2f", "/")
    if s.startswith("c/"):
        s = s[2:]
    elif s.startswith("c-"):
        s = s[2:]
    return s.strip("/")


def normalize_username(raw):
    """Safely normalizes username without slicing characters."""
    if not raw:
        return ""
    s = str(raw).strip()
    if s.startswith("u/"):
        s = s[2:]
    elif s.startswith("@"):
        s = s[1:]
    return s.strip("/")


def same_id(a, b):
    """Type-safe comparison of UUIDs, strings, and object IDs."""
    if a is None or b is None:
        return False
    return str(a).strip().lower() == str(b).strip().lower()


# Load environment variables
load_dotenv()

app = Flask(__name__)

# Allow CORS for development and deployment
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
frontend_env = os.getenv("FRONTEND_URL")
if frontend_env:
    allowed_origins.append(frontend_env)

CORS(app, origins=allowed_origins, supports_credentials=True)

# Connect to Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Supabase credentials are missing from .env")

# Base Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_authenticated_client():
    """Validates the Authorization Bearer token and returns an RLS-scoped Supabase client."""
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return None, None

    access_token = auth_header.split(" ", 1)[1]

    try:
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        result = auth_client.auth.get_user(access_token)

        if not result.user:
            return None, None

        auth_client.postgrest.auth(access_token)
        return auth_client, result.user

    except Exception as e:
        print(f"[AUTH NOTICE] get_authenticated_client rejected token: {e}")
        return None, None


def get_user_role(auth_client, user_id):
    """Fetches user role ('student', 'moderator', 'admin')."""
    try:
        res = (
            auth_client.table("profiles")
            .select("role")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0].get("role", "student")
    except Exception:
        pass
    return "student"


# ---------------------------------------------------------------------------
# Base & Health Endpoints
# ---------------------------------------------------------------------------

@app.route("/")
def home():
    return jsonify({
        "message": "Welcome to CampusVoice API!",
        "status": "Backend is running"
    })


@app.route("/api/health")
def health():
    return jsonify({
        "status": "healthy",
        "application": "CampusVoice",
        "supabase_configured": True
    })


@app.route("/api/test-db")
def test_db():
    try:
        result = supabase.table("profiles").select("id").limit(1).execute()
        return jsonify({
            "status": "success",
            "message": "Supabase database is reachable"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


# ---------------------------------------------------------------------------
# Authentication & Anonymous Identity System (Section 5)
# ---------------------------------------------------------------------------

@app.route("/api/auth/suggest-username", methods=["GET"])
def suggest_username():
    """Generates an anonymous student username suggestion and checks availability."""
    for _ in range(10):
        candidate = generate_anonymous_username()
        try:
            res = supabase.table("profiles").select("id").eq("username", candidate).limit(1).execute()
            if not res.data:
                return jsonify({
                    "username": candidate,
                    "format": "Adjective_NounNumber"
                }), 200
        except Exception:
            return jsonify({
                "username": candidate,
                "format": "Adjective_NounNumber"
            }), 200

    return jsonify({"username": generate_anonymous_username()}), 200


@app.route("/api/auth/check-username", methods=["POST"])
def check_username():
    """Checks whether a selected username is available."""
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()

    if not validate_username(username):
        return jsonify({
            "available": False,
            "error": "Username must be 4-32 characters, using only letters, numbers, and underscores."
        }), 400

    try:
        res = supabase.table("profiles").select("id").eq("username", username).limit(1).execute()
        if res.data:
            return jsonify({
                "available": False,
                "error": "This username is already taken. Please choose another or generate a new one."
            }), 200

        return jsonify({
            "available": True,
            "message": "Username is available!"
        }), 200
    except Exception as e:
        return jsonify({"available": True}), 200


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    """
    Registers a student with verified college email and permanently assigned
    pseudonymous username and CampusVoice ID.
    """
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    username = data.get("username", "").strip()

    # Allow only SRU student email addresses
    if not email.endswith("@sru.edu.in") or email.count("@") != 1:
        return jsonify({
            "error": "Only @sru.edu.in email addresses are allowed."
        }), 400

    if not password or len(password) < 8:
        return jsonify({
            "error": "Password must contain at least 8 characters."
        }), 400

    # Ensure a valid username is provided or generate one
    if not username:
        username = generate_anonymous_username()
    elif not validate_username(username):
        return jsonify({
            "error": "Username must contain only letters, numbers, and underscores (4-32 chars)."
        }), 400

    # Check username uniqueness in profiles
    try:
        existing = supabase.table("profiles").select("id").eq("username", username).limit(1).execute()
        if existing.data:
            return jsonify({
                "error": "This username is already taken. Please pick another suggestion."
            }), 400
    except Exception:
        pass

    # Generate permanent CampusVoice ID
    campus_voice_id = generate_campus_voice_id()

    try:
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        result = auth_client.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "username": username,
                    "campus_voice_id": campus_voice_id,
                    "display_name": username  # Keep display_name aligned with username for backwards compat
                }
            }
        })

        user_id = result.user.id if result.user else None

        # Upsert profile record with username and CampusVoice ID
        if user_id:
            try:
                supabase.table("profiles").upsert({
                    "id": user_id,
                    "username": username,
                    "display_name": username,
                    "campus_voice_id": campus_voice_id,
                    "role": "student"
                }).execute()
            except Exception as pe:
                print("Profile upsert notice:", pe)

            # Insert initial record into private_identities for admin management
            try:
                supabase.table("private_identities").insert({
                    "user_id": user_id,
                    "college_email": email
                }).execute()
            except Exception as pie:
                print("Private identity insert notice:", pie)

        return jsonify({
            "message": "Registration successful! Please check your college email for verification.",
            "email": email,
            "username": username,
            "campus_voice_id": campus_voice_id
        }), 201

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 400


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if email.count("@") != 1 or not email.endswith("@sru.edu.in"):
        return jsonify({
            "error": "Only @sru.edu.in email addresses are allowed."
        }), 400

    if not password:
        return jsonify({
            "error": "Password is required."
        }), 400

    try:
        auth_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        result = auth_client.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        user = result.user
        user_id = user.id
        access_token = result.session.access_token

        # Scope auth_client to user session for RLS operations
        auth_client.postgrest.auth(access_token)

        # Retrieve profile details
        profile_res = (
            auth_client.table("profiles")
            .select("id, username, display_name, campus_voice_id, role, created_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )

        profile = profile_res.data[0] if profile_res.data else {}

        # Fallback if username or campus_voice_id not yet populated in profiles table
        chosen_username = (
            profile.get("username")
            or user.user_metadata.get("username")
            or profile.get("display_name")
            or generate_anonymous_username()
        )
        cid = (
            profile.get("campus_voice_id")
            or user.user_metadata.get("campus_voice_id")
            or generate_campus_voice_id()
        )

        # If profiles table is missing username or has CV-UNKNOWN, update it with authenticated client
        if not profile.get("username") or not profile.get("campus_voice_id") or profile.get("campus_voice_id") == "CV-UNKNOWN":
            try:
                auth_client.table("profiles").update({
                    "username": chosen_username,
                    "display_name": chosen_username,
                    "campus_voice_id": cid
                }).eq("id", user_id).execute()
                profile["username"] = chosen_username
                profile["campus_voice_id"] = cid
            except Exception as pe:
                print("Profile update on login notice:", pe)

        return jsonify({
            "message": "Login successful!",
            "access_token": result.session.access_token,
            "refresh_token": result.session.refresh_token,
            "user": {
                "id": user.id,
                "email": user.email
            },
            "profile": {
                "id": profile.get("id", user.id),
                "username": profile.get("username") or chosen_username,
                "campus_voice_id": profile.get("campus_voice_id") or cid,
                "role": profile.get("role", "student"),
                "created_at": profile.get("created_at") or user.created_at
            }
        }), 200

    except Exception as e:
        print("Login error:", e)
        return jsonify({
            "error": "Invalid credentials or email not verified."
        }), 401


@app.route("/api/auth/refresh", methods=["POST"])
def refresh_session_token():
    """Refreshes an expired Supabase access token using a valid refresh token."""
    data = request.get_json(silent=True) or {}
    refresh_token = data.get("refresh_token")

    if not refresh_token:
        return jsonify({"error": "Refresh token is required."}), 400

    try:
        res = supabase.auth.refresh_session(refresh_token)
        if not res or not res.session:
            return jsonify({"error": "Could not refresh session."}), 401

        return jsonify({
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token
        }), 200

    except Exception as e:
        print("[AUTH NOTICE] Refresh session failed:", str(e))
        return jsonify({"error": "Session expired. Please log in again."}), 401


@app.route("/api/me", methods=["GET"])
def get_current_user():
    auth_client, user = get_authenticated_client()

    if not user:
        return jsonify({"error": "Access token is invalid or missing."}), 401

    try:
        profile_data = {}
        try:
            profile_result = (
                auth_client.table("profiles")
                .select("id, username, display_name, campus_voice_id, role, created_at, mbti_type, mbti_progress, mbti_completed_at, show_mbti_badge")
                .eq("id", user.id)
                .limit(1)
                .execute()
            )
            if profile_result.data and len(profile_result.data) > 0:
                profile_data = profile_result.data[0]
        except Exception as pe:
            print("auth_client profile fetch notice on /api/me:", pe)

        if not profile_data and supabase:
            try:
                fb_result = (
                    supabase.table("profiles")
                    .select("id, username, display_name, campus_voice_id, role, created_at, mbti_type, mbti_progress, mbti_completed_at, show_mbti_badge")
                    .eq("id", user.id)
                    .limit(1)
                    .execute()
                )
                if fb_result.data and len(fb_result.data) > 0:
                    profile_data = fb_result.data[0]
            except Exception as fe:
                print("supabase fallback profile fetch notice on /api/me:", fe)

        # Fallback if username missing
        username = (
            profile_data.get("username")
            or user.user_metadata.get("username")
            or profile_data.get("display_name")
            or "Student"
        )
        cid = (
            profile_data.get("campus_voice_id")
            or user.user_metadata.get("campus_voice_id")
            or (f"CV-{user.id[:8].upper()}" if user.id else "CV-UNKNOWN")
        )

        # Auto-sync profiles table if missing columns
        if not profile_data.get("username") or not profile_data.get("campus_voice_id") or profile_data.get("campus_voice_id") == "CV-UNKNOWN":
            try:
                auth_client.table("profiles").update({
                    "username": username,
                    "display_name": username,
                    "campus_voice_id": cid
                }).eq("id", user.id).execute()
            except Exception as ue:
                print("Profile auto-sync on /api/me notice:", ue)

        return jsonify({
            "user": {
                "id": user.id,
                "email": user.email
            },
            "profile": {
                "id": profile_data.get("id", user.id),
                "username": username,
                "campus_voice_id": cid,
                "role": profile_data.get("role", "student"),
                "created_at": profile_data.get("created_at") or user.created_at,
                "mbti_type": profile_data.get("mbti_type"),
                "mbti_progress": profile_data.get("mbti_progress") or {},
                "mbti_completed_at": profile_data.get("mbti_completed_at"),
                "show_mbti_badge": profile_data.get("show_mbti_badge", True)
            }
        }), 200

    except Exception as e:
        print("Profile request error:", str(e))
        return jsonify({"error": "Could not fetch profile."}), 500


# ---------------------------------------------------------------------------
# Post Enrichment Pipeline (Shared across Feeds, Communities, Profiles & Saved)
# ---------------------------------------------------------------------------

def enrich_posts_list(posts, current_user=None, auth_client=None, active_clean_slug=""):
    """
    Standard post enrichment pipeline.
    Attaches upvotes, downvotes, score, my_vote, comment_count, comments_count,
    community info, author username, author_mbti badge, and moderation flags.
    Used by global feeds, community feeds, profile feeds, and saved posts
    to guarantee 100% data and UI consistency everywhere.
    """
    if not posts:
        return []

    client = auth_client or supabase

    # 1. Batch author usernames & MBTI badges for non-anonymous posts
    author_ids = list({p["author_id"] for p in posts if p.get("author_id") and not p.get("is_anonymous")})
    usernames = {}
    mbti_map = {}

    if author_ids:
        try:
            prof_res = (
                client.table("profiles")
                .select("id, username, display_name, mbti_type, show_mbti_badge")
                .in_("id", author_ids)
                .execute()
            )
            for row in (prof_res.data or []):
                usernames[row["id"]] = row.get("username") or row.get("display_name") or "Student"
                if row.get("show_mbti_badge", True) and row.get("mbti_type"):
                    mbti_map[row["id"]] = row.get("mbti_type")
        except Exception as pe:
            print("Enrich author profiles notice:", pe)

    # 2. Batch community info
    comm_ids = list({p["community_id"] for p in posts if p.get("community_id")})
    comms_map = {}
    if comm_ids:
        try:
            cm_res = client.table("communities").select("id, name, slug").in_("id", comm_ids).execute()
            for c in (cm_res.data or []):
                comms_map[c["id"]] = {"name": c["name"], "slug": c["slug"]}
        except Exception:
            pass
        fb_dict = globals().get("FALLBACK_COMMUNITIES", {})
        for fc in fb_dict.values():
            comms_map[fc["id"]] = {"name": fc["name"], "slug": fc["slug"]}

    # 3. Batch vote summaries to avoid N+1 queries
    post_ids = [p["id"] for p in posts if p.get("id")]
    votes_map = {}
    comments_map = {}
    if post_ids:
        try:
            votes_res = (
                client.table("votes")
                .select("post_id, user_id, vote_value")
                .in_("post_id", post_ids)
                .execute()
            )
            for v in (votes_res.data or []):
                pid = v["post_id"]
                if pid not in votes_map:
                    votes_map[pid] = {"upvotes": 0, "downvotes": 0, "my_vote": 0}
                if v["vote_value"] == 1:
                    votes_map[pid]["upvotes"] += 1
                elif v["vote_value"] == -1:
                    votes_map[pid]["downvotes"] += 1
                if current_user and same_id(v["user_id"], current_user.id):
                    votes_map[pid]["my_vote"] = v["vote_value"]
        except Exception as ve:
            print("Enrich votes notice:", ve)

        # Batch comment counts
        try:
            comm_cnt_res = (
                client.table("comments")
                .select("id, post_id")
                .in_("post_id", post_ids)
                .execute()
            )
            for c in (comm_cnt_res.data or []):
                pid = c.get("post_id")
                if pid:
                    comments_map[pid] = comments_map.get(pid, 0) + 1
        except Exception as ce:
            print("Enrich comment counts notice:", ce)

    # Determine moderator status for current user in active community
    user_id = current_user.id if current_user else None
    is_current_user_mod = False
    if active_clean_slug:
        fn_mod = globals().get("is_user_community_moderator")
        if fn_mod:
            is_current_user_mod = fn_mod(user_id, active_clean_slug, client)
    elif user_id:
        role = get_user_role(client, user_id)
        is_current_user_mod = role in ("moderator", "admin")

    pinned_post_ids = []
    downvote_threshold = 10
    if active_clean_slug:
        fn_settings = globals().get("get_or_create_community_settings")
        if fn_settings:
            st = fn_settings(active_clean_slug)
            pinned_post_ids = [str(x) for x in st.get("pinned_post_ids", [])]
            downvote_threshold = st.get("downvote_threshold", 10)

    rep_set = globals().get("REPORTED_POST_IDS", set())

    # Format output safely
    processed_posts = []
    for p in posts:
        pid = str(p.get("id"))
        vm = votes_map.get(p.get("id"), {"upvotes": 0, "downvotes": 0, "my_vote": 0})
        p["upvotes"] = vm["upvotes"]
        p["downvotes"] = vm["downvotes"]
        p["score"] = vm["upvotes"] - vm["downvotes"]
        p["my_vote"] = vm["my_vote"]
        cnt = comments_map.get(p.get("id"), 0)
        p["comment_count"] = cnt
        p["comments_count"] = cnt
        p["flair"] = p.get("flair") or p.get("category") or "General"
        p["status"] = p.get("status") or "Open"

        # Attach community info
        cid = p.get("community_id")
        if cid and cid in comms_map:
            p["community_name"] = comms_map[cid]["name"]
            p["community_slug"] = comms_map[cid]["slug"]
        else:
            p["community_name"] = None
            p["community_slug"] = None

        is_mine = user_id and same_id(p.get("author_id"), user_id)
        p["is_mine"] = bool(is_mine)

        if p.get("is_anonymous"):
            p["author_username"] = "Anonymous Student"
            p["author"] = "Anonymous Student"
            p["author_mbti"] = None
            p.pop("author_id", None)
        else:
            author_name = usernames.get(p.get("author_id"), "Student")
            p["author_username"] = author_name
            p["author"] = author_name
            p["author_mbti"] = mbti_map.get(p.get("author_id"))

        # Moderation flags:
        p["is_reported"] = bool(p.get("is_reported") or pid in rep_set)
        p["is_pinned"] = bool(p.get("is_pinned") or pid in pinned_post_ids)

        # Auto-hide threshold check
        is_auto_hidden = bool(p.get("is_hidden") or (downvote_threshold > 0 and p["downvotes"] >= downvote_threshold))
        p["is_auto_hidden"] = is_auto_hidden
        p["is_hidden"] = is_auto_hidden

        # Visibility: if auto-hidden, only visible to moderators or post author
        if is_auto_hidden and not (is_current_user_mod or is_mine):
            continue

        processed_posts.append(p)

    return processed_posts


# ---------------------------------------------------------------------------
# Public User Profile (Section 7 - No Global User Directory)
# ---------------------------------------------------------------------------

@app.route("/api/users/<identifier>/profile", methods=["GET"])
def get_public_profile(identifier):
    """
    Returns public student profile information when clicking an author or viewing own profile.
    Does NOT reveal real name, college email, or internal database UUIDs.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        clean_id = (identifier or "").strip().lstrip("@")
        is_self_request = (
            clean_id.lower() in ("me", "self", "my")
            or clean_id == user.id
            or (user.user_metadata.get("username") and clean_id.lower() == user.user_metadata.get("username", "").lower())
        )

        target = None

        if is_self_request:
            # Query current user's profile
            res = auth_client.table("profiles").select(
                "id, username, display_name, campus_voice_id, created_at, role, mbti_type, show_mbti_badge"
            ).eq("id", user.id).limit(1).execute()
            if res.data and len(res.data) > 0:
                target = res.data[0]
            else:
                target = {
                    "id": user.id,
                    "username": user.user_metadata.get("username", "Student"),
                    "campus_voice_id": user.user_metadata.get("campus_voice_id", "CV-UNKNOWN"),
                    "created_at": user.created_at,
                    "role": "student",
                    "mbti_type": None,
                    "show_mbti_badge": True
                }
        else:
            # Check by id (UUID)
            if re.match(r"^[0-9a-fA-F-]{36}$", clean_id):
                res = auth_client.table("profiles").select(
                    "id, username, display_name, campus_voice_id, created_at, role, mbti_type, show_mbti_badge"
                ).eq("id", clean_id).limit(1).execute()
                if res.data:
                    target = res.data[0]

            # If not found, check by username OR display_name
            if not target:
                res = auth_client.table("profiles").select(
                    "id, username, display_name, campus_voice_id, created_at, role, mbti_type, show_mbti_badge"
                ).or_(f"username.eq.{clean_id},display_name.eq.{clean_id}").limit(1).execute()
                if res.data:
                    target = res.data[0]

            # If still not found, check against current user's metadata username
            if not target:
                my_uname = user.user_metadata.get("username", "")
                if my_uname and clean_id.lower() == my_uname.lower():
                    target = {
                        "id": user.id,
                        "username": my_uname,
                        "campus_voice_id": user.user_metadata.get("campus_voice_id", "CV-UNKNOWN"),
                        "created_at": user.created_at,
                        "role": "student",
                        "mbti_type": None,
                        "show_mbti_badge": True
                    }

        if not target:
            return jsonify({"error": "User profile not found."}), 404

        target_id = target.get("id") or user.id
        target_username = target.get("username") or target.get("display_name") or user.user_metadata.get("username") or "Student"
        target_cid = target.get("campus_voice_id") or user.user_metadata.get("campus_voice_id") or "CV-UNKNOWN"

        # Fetch public non-anonymous posts using the exact same feed post query & enrichment pipeline
        posts = []
        try:
            client = auth_client or supabase
            posts_res = (
                client.table("posts")
                .select(
                    "id, title, body, category, flair, status, is_anonymous, created_at, author_id, community_id, is_pinned, pinned_at, is_hidden, is_reported"
                )
                .eq("author_id", target_id)
                .eq("is_anonymous", False)
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            raw_posts = posts_res.data or []
            posts = enrich_posts_list(raw_posts, current_user=user, auth_client=client)
        except Exception as pe:
            print("Profile posts fetch notice:", pe)
            posts = []

        # Check existing chat request status between current user and this profile
        chat_status = "none"
        if target_id != user.id:
            try:
                cr_res = (
                    auth_client.table("chat_requests")
                    .select("id, sender_id, recipient_id, status")
                    .or_(f"and(sender_id.eq.{user.id},recipient_id.eq.{target_id}),and(sender_id.eq.{target_id},recipient_id.eq.{user.id})")
                    .limit(1)
                    .execute()
                )
                if cr_res.data:
                    req = cr_res.data[0]
                    if req["status"] == "accepted":
                        chat_status = "connected"
                    elif req["sender_id"] == user.id and req["status"] == "pending":
                        chat_status = "pending_sent"
                    elif req["recipient_id"] == user.id and req["status"] == "pending":
                        chat_status = "pending_received"
                    elif req["status"] == "declined":
                        chat_status = "declined"
            except Exception:
                pass

        created_val = target.get("created_at")
        if not created_val and hasattr(user, "created_at"):
            created_val = user.created_at.isoformat() if hasattr(user.created_at, "isoformat") else str(user.created_at)

        return jsonify({
            "profile": {
                "username": target_username,
                "campus_voice_id": target_cid,
                "created_at": created_val,
                "post_count": len(posts),
                "posts": posts,
                "is_self": target_id == user.id,
                "chat_status": chat_status,
                "target_id": target_id,
                "mbti_type": target.get("mbti_type") if target.get("show_mbti_badge", True) else None,
                "show_mbti_badge": target.get("show_mbti_badge", True)
            }
        }), 200

    except Exception as e:
        print("Get public profile error:", str(e))
        return jsonify({"error": "Could not fetch user profile."}), 500


# ---------------------------------------------------------------------------
# Campus MBTI ("Goose-ality") Badge & Vibe Check System
# ---------------------------------------------------------------------------

@app.route("/api/mbti/quiz-status", methods=["GET"])
def get_mbti_quiz_status():
    """
    Fetches the current student's MBTI quiz state:
    saved progress, locked type, completed timestamp, and retake cooldown.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        res = (
            auth_client.table("profiles")
            .select("id, mbti_type, mbti_progress, mbti_completed_at, show_mbti_badge")
            .eq("id", user.id)
            .limit(1)
            .execute()
        )
        row = res.data[0] if (res.data and len(res.data) > 0) else {}

        completed_at = row.get("mbti_completed_at")
        can_retake = True
        cooldown_days_left = 0

        if completed_at:
            try:
                dt = datetime.fromisoformat(str(completed_at).replace("Z", "+00:00"))
                delta_sec = (datetime.now(timezone.utc) - dt).total_seconds()
                fourteen_days_sec = 14 * 86400
                if delta_sec < fourteen_days_sec:
                    can_retake = False
                    cooldown_days_left = max(1, math.ceil((fourteen_days_sec - delta_sec) / 86400))
            except Exception as dte:
                print("MBTI date parse notice:", dte)

        return jsonify({
            "mbti_type": row.get("mbti_type"),
            "mbti_progress": row.get("mbti_progress") or {},
            "mbti_completed_at": completed_at,
            "show_mbti_badge": row.get("show_mbti_badge", True),
            "can_retake": can_retake,
            "cooldown_days_left": cooldown_days_left
        }), 200

    except Exception as e:
        print("MBTI quiz status error:", str(e))
        return jsonify({"error": "Could not fetch MBTI status."}), 500


@app.route("/api/mbti/progress", methods=["POST"])
def save_mbti_progress():
    """
    Auto-saves the student's quiz answers incrementally to Supabase
    so they can close the tab and resume without losing progress.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    progress = data.get("progress") or {}

    try:
        auth_client.table("profiles").update({
            "mbti_progress": progress
        }).eq("id", user.id).execute()

        return jsonify({
            "message": "Progress saved successfully.",
            "mbti_progress": progress
        }), 200

    except Exception as e:
        print("Save MBTI progress notice (auth_client):", str(e))
        try:
            supabase.table("profiles").update({
                "mbti_progress": progress
            }).eq("id", user.id).execute()

            return jsonify({
                "message": "Progress saved successfully.",
                "mbti_progress": progress
            }), 200
        except Exception as e_fb:
            print("Save MBTI progress fallback error:", str(e_fb))
            return jsonify({"error": "Could not save progress."}), 500


@app.route("/api/mbti/complete", methods=["POST"])
def complete_mbti_quiz():
    """
    Finalizes the quiz: computes and locks the 4-letter type into profiles,
    stamps mbti_completed_at, and starts the 14-day retake cooldown.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    answers = data.get("answers") or {}
    mbti_type = data.get("mbti_type")

    if not mbti_type or len(mbti_type) != 4:
        return jsonify({"error": "Invalid MBTI type provided."}), 400

    # Verify 14-day retake cooldown
    try:
        client = auth_client or supabase
        prof_res = (
            client.table("profiles")
            .select("mbti_completed_at")
            .eq("id", user.id)
            .limit(1)
            .execute()
        )
        if prof_res.data and len(prof_res.data) > 0:
            cat = prof_res.data[0].get("mbti_completed_at")
            if cat:
                dt = datetime.fromisoformat(str(cat).replace("Z", "+00:00"))
                delta_sec = (datetime.now(timezone.utc) - dt).total_seconds()
                if delta_sec < 14 * 86400:
                    days_left = max(1, math.ceil((14 * 86400 - delta_sec) / 86400))
                    return jsonify({
                        "error": f"Badge is locked. You can only retake the Vibe Check after 14 days ({days_left} days left)."
                    }), 403
    except Exception as ce:
        print("Cooldown verification notice:", ce)

    now_iso = datetime.now(timezone.utc).isoformat()
    update_payload = {
        "mbti_type": mbti_type,
        "mbti_progress": answers,
        "mbti_completed_at": now_iso,
        "show_mbti_badge": True
    }

    try:
        auth_client.table("profiles").update(update_payload).eq("id", user.id).execute()

        return jsonify({
            "message": "Vibe Check completed! Your Goose-ality badge is locked.",
            "mbti_type": mbti_type,
            "mbti_progress": answers,
            "mbti_completed_at": now_iso,
            "show_mbti_badge": True
        }), 200

    except Exception as e:
        print("Complete MBTI quiz notice (auth_client):", str(e))
        try:
            supabase.table("profiles").update(update_payload).eq("id", user.id).execute()

            return jsonify({
                "message": "Vibe Check completed! Your Goose-ality badge is locked.",
                "mbti_type": mbti_type,
                "mbti_progress": answers,
                "mbti_completed_at": now_iso,
                "show_mbti_badge": True
            }), 200
        except Exception as e_fb:
            print("Complete MBTI quiz fallback error:", str(e_fb))
            return jsonify({"error": str(e)}), 500


@app.route("/api/mbti/toggle-badge", methods=["PATCH"])
def toggle_mbti_badge():
    """
    Toggles whether the student's MBTI badge appears on posts and comments.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    show_badge = bool(data.get("show_mbti_badge", True))

    try:
        auth_client.table("profiles").update({
            "show_mbti_badge": show_badge
        }).eq("id", user.id).execute()

        return jsonify({
            "message": "Badge visibility updated.",
            "show_mbti_badge": show_badge
        }), 200

    except Exception as e:
        print("Toggle MBTI badge notice (auth_client):", str(e))
        try:
            supabase.table("profiles").update({
                "show_mbti_badge": show_badge
            }).eq("id", user.id).execute()

            return jsonify({
                "message": "Badge visibility updated.",
                "show_mbti_badge": show_badge
            }), 200
        except Exception as e_fb:
            return jsonify({"error": "Could not update badge visibility."}), 500


@app.route("/api/mbti/reset", methods=["POST"])
def reset_mbti_quiz():
    """
    Resets the quiz progress and unlocks retake IF 14 days have passed.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        client = auth_client or supabase
        prof_res = (
            client.table("profiles")
            .select("mbti_completed_at")
            .eq("id", user.id)
            .limit(1)
            .execute()
        )
        if prof_res.data and len(prof_res.data) > 0:
            cat = prof_res.data[0].get("mbti_completed_at")
            if cat:
                dt = datetime.fromisoformat(str(cat).replace("Z", "+00:00"))
                delta_sec = (datetime.now(timezone.utc) - dt).total_seconds()
                if delta_sec < 14 * 86400:
                    days_left = max(1, math.ceil((14 * 86400 - delta_sec) / 86400))
                    return jsonify({
                        "error": f"Badge is locked. You can only retake the Vibe Check after 14 days ({days_left} days left)."
                    }), 403

        reset_payload = {
            "mbti_progress": {},
            "mbti_type": None,
            "mbti_completed_at": None
        }

        try:
            auth_client.table("profiles").update(reset_payload).eq("id", user.id).execute()
        except Exception as re_auth:
            print("Reset MBTI quiz notice (auth_client):", re_auth)
            supabase.table("profiles").update(reset_payload).eq("id", user.id).execute()

        return jsonify({"message": "Quiz reset. You may retake the Vibe Check now."}), 200

    except Exception as e:
        print("Reset MBTI quiz error:", str(e))
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Posts & Discussions (Section 10, 11, 14, 15)
# ---------------------------------------------------------------------------

ALLOWED_FLAIRS = [
    "Gossip", "Help", "Question", "Discussion", "Coding", "Software", "Project",
    "Academics", "Placement", "Career", "Resources", "Announcement",
    "Event", "Campus Life", "Canteen", "Hostel", "Transport",
    "Infrastructure", "Problem", "Report", "Suggestion", "Poll", "General"
]

@app.route("/api/posts", methods=["GET"])
def get_posts():
    """
    Returns discussion posts. Supports sorting ('newest', 'popular', 'top'),
    flair filtering, content search, and community filtering ('?community=slug').
    """
    auth_client, user = get_authenticated_client()

    if not user:
        return jsonify({"error": "Please log in first."}), 401

    sort_by = request.args.get("sort", "newest")
    flair_filter = request.args.get("flair")
    search_query = request.args.get("search", "").strip()
    community_param = request.args.get("community", "").strip()

    # Resolve community parameter if provided
    community_id = None
    clean_comm_param = normalize_community_slug(community_param) if community_param else ""
    active_clean_slug = clean_comm_param
    if clean_comm_param:
        try:
            if re.match(r"^[0-9a-fA-F-]{36}$", clean_comm_param):
                community_id = clean_comm_param
                try:
                    c_slug_res = auth_client.table("communities").select("slug").eq("id", clean_comm_param).limit(1).execute()
                    if c_slug_res.data and c_slug_res.data[0].get("slug"):
                        active_clean_slug = normalize_community_slug(c_slug_res.data[0]["slug"])
                except Exception:
                    pass
            else:
                c_res = auth_client.table("communities").select("id").ilike("slug", clean_comm_param).limit(1).execute()
                if c_res.data:
                    community_id = c_res.data[0]["id"]
                else:
                    fb = FALLBACK_COMMUNITIES.get(clean_comm_param) or next(
                        (v for v in FALLBACK_COMMUNITIES.values() if normalize_community_slug(v["slug"]).lower() == clean_comm_param.lower()),
                        None
                    )
                    if fb:
                        community_id = fb["id"]
                    else:
                        return jsonify({"posts": []}), 200
        except Exception as e:
            print("Community lookup error in get_posts:", e)
            fb = FALLBACK_COMMUNITIES.get(clean_comm_param) or next(
                (v for v in FALLBACK_COMMUNITIES.values() if normalize_community_slug(v["slug"]).lower() == clean_comm_param.lower()),
                None
            )
            if fb:
                community_id = fb["id"]

    # Standard query
    try:
        query = auth_client.table("posts").select(
            "id, title, body, category, flair, status, is_anonymous, created_at, author_id, community_id, is_pinned, pinned_at, is_hidden, is_reported"
        )

        if community_id:
            query = query.eq("community_id", community_id)

        if flair_filter:
            query = query.or_(f"flair.eq.{flair_filter},category.eq.{flair_filter}")

        if search_query:
            query = query.ilike("title", f"%{search_query}%")

        if sort_by == "newest":
            query = query.order("created_at", desc=True)
        elif sort_by in ("popular", "top"):
            query = query.order("created_at", desc=True)

        res = query.limit(50).execute()
        posts = res.data or []

        processed_posts = enrich_posts_list(
            posts,
            current_user=user,
            auth_client=auth_client,
            active_clean_slug=active_clean_slug
        )

        # Sorting: Score sort if requested
        if sort_by in ("popular", "top"):
            processed_posts.sort(key=lambda x: x.get("score", 0), reverse=True)
        elif sort_by == "newest" or not active_clean_slug:
            processed_posts.sort(key=lambda x: x.get("created_at") or "", reverse=True)

        # Pinned posts placed at top of community feed ONLY (never on global feeds)
        if active_clean_slug:
            processed_posts.sort(key=lambda x: (0 if x.get("is_pinned") else 1))

        return jsonify({"posts": processed_posts}), 200

    except Exception as e:
        print("Get posts error:", str(e))
        return jsonify({"error": "Could not fetch posts."}), 500


@app.route("/api/posts", methods=["POST"])
def create_post():
    auth_client, user = get_authenticated_client()

    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}

    title = data.get("title", "").strip()
    body = data.get("body", "").strip()
    flair = data.get("flair") or data.get("category") or "General"
    is_anonymous = bool(data.get("is_anonymous", False))
    community_id = data.get("community_id")
    community_slug = data.get("community_slug")

    if not title or not body:
        return jsonify({"error": "Title and description are required."}), 400

    if flair not in ALLOWED_FLAIRS:
        flair = "General"

    # Resolve community_slug
    clean_slug = normalize_community_slug(community_slug) if community_slug else ""
    if not clean_slug and community_id:
        for fc in FALLBACK_COMMUNITIES.values():
            if same_id(fc["id"], community_id):
                clean_slug = fc["slug"]
                break

    # Temporary Pond Timeout Check:
    # "Allow mods to mute a disruptive user from posting in that specific community for 24 hours, 7 days, or Permanently"
    if clean_slug or community_id:
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Check real Supabase database first
        if auth_client and community_id:
            try:
                t_res = auth_client.table("community_timeouts").select("id, duration, reason, expires_at").eq("community_id", community_id).eq("user_id", user.id).limit(1).execute()
                if t_res.data and len(t_res.data) > 0:
                    t = t_res.data[0]
                    expires_at = t.get("expires_at")
                    if not expires_at or expires_at > now_iso:
                        dur_label = t.get("duration", "temporary")
                        reason_msg = t.get("reason") or "Violation of community rules"
                        exp_msg = f"until {expires_at[:16].replace('T', ' ')}" if expires_at else "permanently"
                        return jsonify({
                            "error": f"You are in a pond timeout in this community ({dur_label}) {exp_msg}. Reason: {reason_msg}"
                        }), 403
            except Exception as te:
                pass

        # 2. Check in-memory store
        if clean_slug:
            st = get_or_create_community_settings(clean_slug)
            for t in st.get("timeouts", []):
                if same_id(t.get("user_id"), user.id):
                    expires_at = t.get("expires_at")
                    if not expires_at or expires_at > now_iso:
                        dur_label = t.get("duration", "temporary")
                        reason_msg = t.get("reason") or "Violation of community rules"
                        exp_msg = f"until {expires_at[:16].replace('T', ' ')}" if expires_at else "permanently"
                        return jsonify({
                            "error": f"You are in a pond timeout in c/{clean_slug} ({dur_label}) {exp_msg}. Reason: {reason_msg}"
                        }), 403

    if not community_id and clean_slug:
        try:
            c_res = auth_client.table("communities").select("id").eq("slug", clean_slug).limit(1).execute()
            if c_res.data:
                community_id = c_res.data[0]["id"]
            else:
                fb = FALLBACK_COMMUNITIES.get(clean_slug)
                if fb:
                    community_id = fb["id"]
        except Exception:
            fb = FALLBACK_COMMUNITIES.get(clean_slug)
            if fb:
                community_id = fb["id"]

    try:
        insert_payload = {
            "author_id": user.id,
            "title": title,
            "body": body,
            "category": flair,
            "flair": flair,
            "is_anonymous": is_anonymous,
            "status": "Pending" if flair in ("Suggestion", "Problem", "Report") else "Open"
        }
        if community_id:
            insert_payload["community_id"] = community_id

        result = auth_client.table("posts").insert(insert_payload).execute()
        return jsonify({
            "message": "Post created successfully!",
            "post": result.data[0] if result.data else {}
        }), 201

    except Exception as e:
        print("Create post error:", str(e))
        return jsonify({"error": "Could not create post."}), 500


@app.route("/api/posts/<post_id>", methods=["GET"])
def get_single_post(post_id):
    """Retrieve full details for a single discussion post."""
    auth_client, user = get_authenticated_client()
    try:
        res = (
            auth_client.table("posts")
            .select("id, title, body, category, flair, status, is_anonymous, created_at, author_id, community_id")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return jsonify({"error": "Post not found."}), 404

        post = res.data[0]

        # Author details
        if post.get("is_anonymous"):
            post["author_username"] = "Anonymous Student"
            post["author"] = "Anonymous Student"
            post["author_mbti"] = None
            post.pop("author_id", None)
        else:
            author_mbti = None
            try:
                prof_res = (
                    auth_client.table("profiles")
                    .select("username, display_name, mbti_type, show_mbti_badge")
                    .eq("id", post["author_id"])
                    .limit(1)
                    .execute()
                )
                if prof_res.data:
                    row = prof_res.data[0]
                    author_name = row.get("username") or row.get("display_name") or "Student"
                    if row.get("show_mbti_badge", True) and row.get("mbti_type"):
                        author_mbti = row.get("mbti_type")
                else:
                    author_name = "Student"
            except Exception:
                author_name = "Student"
            post["author_username"] = author_name
            post["author"] = author_name
            post["author_mbti"] = author_mbti

        # Community info
        cid = post.get("community_id")
        if cid:
            try:
                cm_res = auth_client.table("communities").select("name, slug").eq("id", cid).limit(1).execute()
                if cm_res.data:
                    post["community_name"] = cm_res.data[0]["name"]
                    post["community_slug"] = cm_res.data[0]["slug"]
            except Exception:
                pass

        # Votes
        votes_res = auth_client.table("votes").select("vote_value, user_id").eq("post_id", post_id).execute()
        upvotes = 0
        downvotes = 0
        my_vote = 0
        for v in (votes_res.data or []):
            if v.get("vote_value") == 1:
                upvotes += 1
            elif v.get("vote_value") == -1:
                downvotes += 1
            if user and v.get("user_id") == user.id:
                my_vote = v.get("vote_value", 0)

        post["upvotes"] = upvotes
        post["downvotes"] = downvotes
        post["score"] = upvotes - downvotes
        post["my_vote"] = my_vote

        # Comments count
        try:
            cnt_res = auth_client.table("comments").select("id").eq("post_id", post_id).execute()
            post["comment_count"] = len(cnt_res.data or [])
        except Exception:
            post["comment_count"] = 0

        post["flair"] = post.get("flair") or post.get("category") or "General"
        post["status"] = post.get("status") or "Open"

        return jsonify({"post": post}), 200
    except Exception as e:
        print("Get single post error:", str(e))
        return jsonify({"error": "Could not fetch discussion."}), 500


@app.route("/api/posts/<post_id>", methods=["DELETE"])
def delete_post(post_id):
    """
    Allows author or community moderators/admins to delete a post.
    For community moderators, deleting a disruptive post is UNLOCKED ONLY
    if somebody reported it as disruptive.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    post = None
    try:
        post_res = auth_client.table("posts").select("id, author_id, community_id").eq("id", post_id).limit(1).execute()
        if post_res.data and len(post_res.data) > 0:
            post = post_res.data[0]
    except Exception:
        pass

    if not post:
        post = {"id": post_id, "author_id": None}

    author_id = post.get("author_id")
    is_author = same_id(author_id, user.id)
    role = get_user_role(auth_client, user.id)
    is_admin = role == "admin"

    # Check if caller is community moderator
    comm_id = post.get("community_id")
    is_comm_mod = False
    if comm_id:
        is_comm_mod = is_user_community_moderator(user.id, comm_id, auth_client)
    if not is_comm_mod and role in ("moderator", "admin"):
        is_comm_mod = True

    if not is_author and not is_admin and not is_comm_mod:
        return jsonify({"error": "You do not have permission to delete this post."}), 403

    # Disruptive report requirement:
    # "allow moders to delete the distupive post in the community this delete option is unlocekd only if somebody reported it as distuptive"
    if not is_author and not is_admin and is_comm_mod:
        is_reported = str(post_id) in REPORTED_POST_IDS
        if not is_reported and auth_client:
            try:
                rep_res = auth_client.table("reports").select("id").eq("target_id", str(post_id)).limit(1).execute()
                if rep_res.data and len(rep_res.data) > 0:
                    is_reported = True
            except Exception:
                pass

        if not is_reported:
            return jsonify({
                "error": "Delete option locked: Community moderators can only delete posts that have been reported by members as disruptive."
            }), 403

    # Delete post
    try:
        if auth_client:
            auth_client.table("posts").delete().eq("id", post_id).execute()
    except Exception as e:
        print("Delete post DB notice:", str(e))

    # Clean up reported and pinned references
    REPORTED_POST_IDS.discard(str(post_id))
    for s, st in COMMUNITY_SETTINGS.items():
        if str(post_id) in st.get("pinned_post_ids", []):
            st["pinned_post_ids"] = [pid for pid in st["pinned_post_ids"] if pid != str(post_id)]

    return jsonify({
        "message": "Post deleted successfully." if is_author else "Disruptive post removed by community moderator."
    }), 200


# ---------------------------------------------------------------------------
# Saved / Bookmarked Posts
# ---------------------------------------------------------------------------

@app.route("/api/posts/<post_id>/save", methods=["POST"])
def toggle_save_post(post_id):
    """Bookmarks or un-bookmarks a post or poll for the current student."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        # Determine if target is a poll
        is_poll = request.path.startswith("/api/polls/")
        if not is_poll:
            try:
                p_check = auth_client.table("posts").select("id").eq("id", post_id).limit(1).execute()
                if not p_check.data:
                    pl_check = auth_client.table("polls").select("id").eq("id", post_id).limit(1).execute()
                    if pl_check.data:
                        is_poll = True
            except Exception:
                pass

        field_name = "poll_id" if is_poll else "post_id"
        existing = (
            auth_client.table("saved_posts")
            .select("id")
            .eq("user_id", user.id)
            .eq(field_name, post_id)
            .limit(1)
            .execute()
        )

        if existing.data:
            auth_client.table("saved_posts").delete().eq("user_id", user.id).eq(field_name, post_id).execute()
            return jsonify({"saved": False, "message": "Removed from saved."}), 200
        else:
            auth_client.table("saved_posts").insert({"user_id": user.id, field_name: post_id}).execute()
            return jsonify({"saved": True, "message": "Saved successfully!"}), 200

    except Exception as e:
        print("Toggle save error:", str(e))
        return jsonify({"error": "Could not update saved status."}), 500


@app.route("/api/posts/saved", methods=["GET"])
def get_saved_posts():
    """Returns all posts bookmarked by the current student."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        saved_res = (
            auth_client.table("saved_posts")
            .select("post_id, created_at")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .execute()
        )
        post_ids = [r["post_id"] for r in (saved_res.data or []) if r.get("post_id")]

        if not post_ids:
            return jsonify({"posts": []}), 200

        client = auth_client or supabase
        posts_res = (
            client.table("posts")
            .select("id, title, body, category, flair, status, is_anonymous, created_at, author_id, community_id, is_pinned, pinned_at, is_hidden, is_reported")
            .in_("id", post_ids)
            .execute()
        )
        raw_posts = posts_res.data or []
        enriched = enrich_posts_list(raw_posts, current_user=user, auth_client=client)

        # Preserve the saved ordering (most recently saved first)
        post_order_map = {pid: i for i, pid in enumerate(post_ids)}
        enriched.sort(key=lambda x: post_order_map.get(x["id"], 999999))

        return jsonify({"posts": enriched}), 200

    except Exception as e:
        print("Get saved posts error:", str(e))
        return jsonify({"error": "Could not fetch saved posts."}), 500


# ---------------------------------------------------------------------------
# Comments & Threaded Discussion (Section 12)
# ---------------------------------------------------------------------------

@app.route("/api/posts/<post_id>/comments", methods=["GET"])
@app.route("/api/polls/<post_id>/comments", methods=["GET"])
def get_comments(post_id):
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        try:
            res = (
                auth_client.table("comments")
                .select("id, post_id, poll_id, author_id, parent_comment_id, body, is_anonymous, created_at")
                .or_(f"post_id.eq.{post_id},poll_id.eq.{post_id}")
                .order("created_at")
                .execute()
            )
        except Exception:
            res = (
                auth_client.table("comments")
                .select("id, post_id, author_id, parent_comment_id, body, is_anonymous, created_at")
                .eq("post_id", post_id)
                .order("created_at")
                .execute()
            )
        comments = res.data or []

        # Map author usernames & MBTI
        author_ids = list({c["author_id"] for c in comments if not c.get("is_anonymous")})
        usernames = {}
        mbti_map = {}

        if author_ids:
            prof_res = (
                auth_client.table("profiles")
                .select("id, username, display_name, mbti_type, show_mbti_badge")
                .in_("id", author_ids)
                .execute()
            )
            for row in (prof_res.data or []):
                usernames[row["id"]] = row.get("username") or row.get("display_name") or "Student"
                if row.get("show_mbti_badge", True) and row.get("mbti_type"):
                    mbti_map[row["id"]] = row.get("mbti_type")

        for c in comments:
            if c.get("is_anonymous"):
                c["author"] = "Anonymous Student"
                c["author_username"] = "Anonymous Student"
                c["author_mbti"] = None
                c.pop("author_id", None)
            else:
                author_name = usernames.get(c["author_id"], "Student")
                c["author"] = author_name
                c["author_username"] = author_name
                c["author_mbti"] = mbti_map.get(c["author_id"])
                c["is_mine"] = c["author_id"] == user.id

        return jsonify({"comments": comments}), 200

    except Exception as e:
        print("Get comments error:", str(e))
        return jsonify({"error": "Could not fetch comments."}), 500


@app.route("/api/posts/<post_id>/comments", methods=["POST"])
@app.route("/api/polls/<post_id>/comments", methods=["POST"])
def create_comment(post_id):
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    body = data.get("body", "").strip()
    parent_comment_id = data.get("parent_comment_id")
    is_anonymous = bool(data.get("is_anonymous", False))

    if not body:
        return jsonify({"error": "Comment cannot be empty."}), 400

    if len(body) > 2000:
        return jsonify({"error": "Comment is too long."}), 400

    try:
        is_poll = False
        target_author_id = None
        target_title = "discussion"

        # Check if post or poll
        post_res = auth_client.table("posts").select("id, author_id, title").eq("id", post_id).limit(1).execute()
        if post_res.data:
            target_author_id = post_res.data[0].get("author_id")
            target_title = post_res.data[0].get("title", "post")
        else:
            poll_res = auth_client.table("polls").select("id, author_id, question").eq("id", post_id).limit(1).execute()
            if poll_res.data:
                is_poll = True
                target_author_id = poll_res.data[0].get("author_id")
                target_title = poll_res.data[0].get("question", "poll")
            else:
                return jsonify({"error": "Post or Poll not found."}), 404

        payload = {
            "author_id": user.id,
            "body": body,
            "is_anonymous": is_anonymous
        }
        if is_poll:
            payload["poll_id"] = post_id
        else:
            payload["post_id"] = post_id

        if parent_comment_id:
            payload["parent_comment_id"] = parent_comment_id

        result = auth_client.table("comments").insert(payload).execute()
        comment = result.data[0] if result.data else {}

        # Send notification to author if not self
        if target_author_id and target_author_id != user.id:
            try:
                target_link = f"/polls/{post_id}" if is_poll else f"/#post-{post_id}"
                auth_client.table("notifications").insert({
                    "user_id": target_author_id,
                    "notification_type": "comment",
                    "title": "New Comment",
                    "message": f"Someone commented on your {'poll' if is_poll else 'post'}: \"{target_title[:50]}\"",
                    "link": target_link
                }).execute()
            except Exception:
                pass

        return jsonify({
            "message": "Comment added successfully!",
            "comment": comment
        }), 201

    except Exception as e:
        print("Create comment error:", str(e))
        return jsonify({"error": "Could not add comment."}), 500


# ---------------------------------------------------------------------------
# Voting System
# ---------------------------------------------------------------------------

@app.route("/api/posts/<post_id>/votes", methods=["GET"])
def get_votes(post_id):
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        result = auth_client.rpc("get_post_vote_summary", {"p_post_id": post_id}).execute()
        summary = result.data[0] if result.data else {"upvotes": 0, "downvotes": 0, "my_vote": None}
        return jsonify(summary), 200
    except Exception as e:
        return jsonify({"upvotes": 0, "downvotes": 0, "my_vote": 0}), 200


@app.route("/api/posts/<post_id>/vote", methods=["POST"])
def cast_vote(post_id):
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    vote_value = data.get("vote_value")

    if type(vote_value) is not int or vote_value not in (1, -1):
        return jsonify({"error": "Vote must be 1 (upvote) or -1 (downvote)."}), 400

    try:
        existing = (
            auth_client.table("votes")
            .select("vote_value")
            .eq("post_id", post_id)
            .eq("user_id", user.id)
            .limit(1)
            .execute()
        )

        if existing.data:
            current_vote = existing.data[0]["vote_value"]
            if current_vote == vote_value:
                auth_client.table("votes").delete().eq("post_id", post_id).eq("user_id", user.id).execute()
                message = "Vote removed."
            else:
                auth_client.table("votes").update({"vote_value": vote_value}).eq("post_id", post_id).eq("user_id", user.id).execute()
                message = "Vote updated."
        else:
            auth_client.table("votes").insert({
                "post_id": post_id,
                "user_id": user.id,
                "vote_value": vote_value
            }).execute()
            message = "Vote added."

        try:
            summary = auth_client.rpc("get_post_vote_summary", {"p_post_id": post_id}).execute()
            votes_data = summary.data[0] if summary.data else {}
        except Exception:
            votes_data = {}

        # Direct fallback aggregation if RPC is missing or empty
        if not votes_data or "upvotes" not in votes_data:
            try:
                v_res = auth_client.table("votes").select("vote_value, user_id").eq("post_id", post_id).execute()
                all_v = v_res.data or []
                upvotes = sum(1 for v in all_v if v.get("vote_value") == 1)
                downvotes = sum(1 for v in all_v if v.get("vote_value") == -1)
                user_vote = next((v.get("vote_value") for v in all_v if v.get("user_id") == user.id), 0)
                votes_data = {
                    "upvotes": upvotes,
                    "downvotes": downvotes,
                    "score": upvotes - downvotes,
                    "my_vote": user_vote
                }
            except Exception as ve:
                print("Vote aggregation fallback error:", ve)
                votes_data = {"upvotes": 0, "downvotes": 0, "score": 0, "my_vote": 0}

        return jsonify({
            "message": message,
            "votes": votes_data
        }), 200

    except Exception as e:
        print("Cast vote error:", str(e))
        return jsonify({"error": "Could not process vote."}), 500


# ---------------------------------------------------------------------------
# Polls System (Section 13)
# ---------------------------------------------------------------------------

def enrich_polls_list(polls, current_user=None, auth_client=None):
    """
    Standard poll enrichment pipeline.
    Attaches options, calculated vote tallies, percentages, current user vote,
    author username, author MBTI badge, comments_count, and saved status.
    """
    if not polls:
        return []

    client = auth_client or supabase
    poll_ids = [p["id"] for p in polls]
    author_ids = list({p["author_id"] for p in polls if p.get("author_id")})

    options_map = {}
    poll_votes_map = {}
    user_poll_vote_map = {}
    usernames_map = {}
    mbti_map = {}
    comments_count_map = {}
    user_saved_polls = set()

    # 1. Options
    if poll_ids:
        try:
            options_res = (
                client.table("poll_options")
                .select("id, poll_id, option_text")
                .in_("poll_id", poll_ids)
                .execute()
            )
            for opt in (options_res.data or []):
                pid = opt["poll_id"]
                options_map.setdefault(pid, []).append(opt)
        except Exception as oe:
            print("Enrich polls options error:", oe)

    # 2. Votes
    if poll_ids:
        try:
            votes_res = (
                client.table("poll_votes")
                .select("poll_id, option_id, user_id")
                .in_("poll_id", poll_ids)
                .execute()
            )
            for pv in (votes_res.data or []):
                pid = pv.get("poll_id")
                oid = pv.get("option_id")
                uid = pv.get("user_id")
                if pid and oid:
                    poll_votes_map.setdefault(pid, {})
                    poll_votes_map[pid][oid] = poll_votes_map[pid].get(oid, 0) + 1
                    if current_user and uid == current_user.id:
                        user_poll_vote_map[pid] = oid
        except Exception as ve:
            print("Enrich polls votes error:", ve)

    # 3. Authors (Profile & MBTI)
    if author_ids:
        try:
            prof_res = (
                client.table("profiles")
                .select("id, username, display_name, mbti_type, show_mbti_badge")
                .in_("id", author_ids)
                .execute()
            )
            for pr in (prof_res.data or []):
                uname = pr.get("username") or pr.get("display_name") or "Goose"
                usernames_map[pr["id"]] = uname
                if pr.get("show_mbti_badge", True) and pr.get("mbti_type"):
                    mbti_map[pr["id"]] = pr.get("mbti_type")
        except Exception as pe:
            print("Enrich polls authors error:", pe)

    # 4. Comments Count
    if poll_ids:
        try:
            comm_res = client.table("comments").select("id, poll_id").in_("poll_id", poll_ids).execute()
            for c in (comm_res.data or []):
                pid = c.get("poll_id")
                if pid:
                    comments_count_map[pid] = comments_count_map.get(pid, 0) + 1
        except Exception:
            pass

    # 5. Saved Status
    if poll_ids and current_user:
        try:
            saved_res = client.table("saved_posts").select("poll_id").eq("user_id", current_user.id).in_("poll_id", poll_ids).execute()
            for s in (saved_res.data or []):
                if s.get("poll_id"):
                    user_saved_polls.add(s["poll_id"])
        except Exception:
            pass

    user_role = get_user_role(client, current_user.id) if current_user else "student"
    now_utc = datetime.now(timezone.utc)

    enriched = []
    for raw in polls:
        poll = dict(raw)
        pid = poll["id"]
        opts = options_map.get(pid, [])
        poll["options"] = opts

        p_votes = poll_votes_map.get(pid, {})
        total_votes = sum(p_votes.values())
        results_list = []
        user_choice_id = user_poll_vote_map.get(pid)

        for opt in opts:
            oid = opt["id"]
            cnt = p_votes.get(oid, 0)
            pct = round((cnt / total_votes * 100), 1) if total_votes > 0 else 0
            results_list.append({
                "option_id": oid,
                "option_text": opt.get("option_text", ""),
                "vote_count": cnt,
                "percentage": pct,
                "my_vote": (oid == user_choice_id)
            })

        poll["results"] = results_list
        poll["total_votes"] = total_votes
        poll["user_voted_option_id"] = user_choice_id
        poll["has_voted"] = bool(user_choice_id)

        # Check closing/expiration
        is_closed = bool(poll.get("is_closed"))
        if not is_closed and poll.get("closes_at"):
            try:
                closing_time = datetime.fromisoformat(str(poll["closes_at"]).replace("Z", "+00:00"))
                if closing_time.tzinfo is None:
                    closing_time = closing_time.replace(tzinfo=timezone.utc)
                if now_utc >= closing_time:
                    is_closed = True
            except Exception:
                pass
        poll["is_closed"] = is_closed

        author_id = poll.get("author_id")
        poll["author_username"] = usernames_map.get(author_id, "Goose")
        poll["author_mbti"] = mbti_map.get(author_id)
        c_count = comments_count_map.get(pid, 0)
        poll["comments_count"] = c_count
        poll["comment_count"] = c_count
        poll["is_saved"] = pid in user_saved_polls

        poll["is_mine"] = bool(current_user and author_id and author_id == current_user.id)
        poll["can_delete"] = poll["is_mine"] or (user_role in ("admin", "moderator"))
        poll["can_close"] = poll["can_delete"] and not poll["is_closed"]

        enriched.append(poll)

    return enriched


@app.route("/api/polls", methods=["GET"])
def get_polls():
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        poll_res = (
            auth_client.table("polls")
            .select("id, question, description, author_id, closes_at, is_closed, created_at")
            .order("created_at", desc=True)
            .execute()
        )
        raw_polls = poll_res.data or []
        enriched_polls = enrich_polls_list(raw_polls, current_user=user, auth_client=auth_client)
        return jsonify({"polls": enriched_polls}), 200

    except Exception as e:
        print("Get polls error:", str(e))
        return jsonify({"error": "Could not fetch polls."}), 500


@app.route("/api/polls/<poll_id>", methods=["GET"])
def get_single_poll(poll_id):
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        poll_res = (
            auth_client.table("polls")
            .select("id, question, description, author_id, closes_at, is_closed, created_at")
            .eq("id", poll_id)
            .limit(1)
            .execute()
        )
        if not poll_res.data:
            return jsonify({"error": "Poll not found."}), 404

        enriched = enrich_polls_list(poll_res.data, current_user=user, auth_client=auth_client)
        return jsonify({"poll": enriched[0] if enriched else {}}), 200
    except Exception as e:
        print("Get single poll error:", str(e))
        return jsonify({"error": "Could not fetch poll."}), 500


@app.route("/api/polls/<poll_id>", methods=["DELETE"])
def delete_poll(poll_id):
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        poll_res = auth_client.table("polls").select("id, author_id").eq("id", poll_id).limit(1).execute()
        if not poll_res.data:
            return jsonify({"error": "Poll not found."}), 404

        poll = poll_res.data[0]
        user_role = get_user_role(auth_client, user.id)
        if poll["author_id"] != user.id and user_role not in ("admin", "moderator"):
            return jsonify({"error": "You do not have permission to delete this poll."}), 403

        auth_client.table("polls").delete().eq("id", poll_id).execute()
        return jsonify({"message": "Poll deleted successfully!"}), 200
    except Exception as e:
        print("Delete poll error:", str(e))
        return jsonify({"error": "Could not delete poll."}), 500


@app.route("/api/polls/<poll_id>/save", methods=["POST"])
def toggle_save_poll(poll_id):
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        existing = (
            auth_client.table("saved_posts")
            .select("id")
            .eq("user_id", user.id)
            .eq("poll_id", poll_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            auth_client.table("saved_posts").delete().eq("user_id", user.id).eq("poll_id", poll_id).execute()
            return jsonify({"saved": False, "message": "Poll removed from saved."}), 200
        else:
            auth_client.table("saved_posts").insert({"user_id": user.id, "poll_id": poll_id}).execute()
            return jsonify({"saved": True, "message": "Poll saved successfully!"}), 200
    except Exception as e:
        print("Toggle save poll error:", str(e))
        return jsonify({"error": "Could not update saved status."}), 500


@app.route("/api/polls", methods=["POST"])
def create_poll():
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()
    description = data.get("description", "").strip()
    options = data.get("options", [])

    if not question:
        return jsonify({"error": "Poll question is required."}), 400

    if len(question) > 200:
        return jsonify({"error": "Question must be under 200 characters."}), 400

    valid_options = [opt.strip() for opt in options if isinstance(opt, str) and opt.strip()]

    if len(valid_options) < 2:
        return jsonify({"error": "Poll requires at least 2 options."}), 400

    if len(valid_options) > 6:
        return jsonify({"error": "Poll cannot have more than 6 options."}), 400

    # Ensure closes_at is populated; default to 7 days from now (UTC ISO 8601 string)
    closes_at = data.get("closes_at")
    if not closes_at:
        duration = data.get("duration")
        now = datetime.now(timezone.utc)
        if duration in ("24h", "1d", 1, "1"):
            closes_at = (now + timedelta(hours=24)).isoformat()
        elif duration in ("3d", 3, "3"):
            closes_at = (now + timedelta(days=3)).isoformat()
        elif duration in ("14d", 14, "14"):
            closes_at = (now + timedelta(days=14)).isoformat()
        else:
            closes_at = (now + timedelta(days=7)).isoformat()
    elif isinstance(closes_at, str):
        closes_at = closes_at.strip()
        if not closes_at:
            closes_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    try:
        poll_res = auth_client.table("polls").insert({
            "author_id": user.id,
            "question": question,
            "description": description,
            "closes_at": closes_at
        }).execute()

        poll = poll_res.data[0]
        option_rows = [{"poll_id": poll["id"], "option_text": opt} for opt in valid_options]
        opt_res = auth_client.table("poll_options").insert(option_rows).execute()

        return jsonify({
            "message": "Poll created successfully!",
            "poll": poll,
            "options": opt_res.data
        }), 201

    except Exception as e:
        print("Create poll error:", str(e))
        err_msg = "Could not create poll."
        if isinstance(e, dict) and "message" in e:
            err_msg = e["message"]
        elif hasattr(e, "message") and e.message:
            err_msg = e.message
        elif hasattr(e, "args") and e.args:
            err_msg = str(e.args[0])
        elif str(e):
            err_msg = str(e)
        return jsonify({"error": err_msg}), 500


@app.route("/api/polls/<poll_id>/close", methods=["POST"])
def close_poll(poll_id):
    """Allows poll creator or administrators to close a poll."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        poll_res = auth_client.table("polls").select("id, author_id, is_closed").eq("id", poll_id).limit(1).execute()
        if not poll_res.data:
            return jsonify({"error": "Poll not found."}), 404

        poll = poll_res.data[0]
        role = get_user_role(auth_client, user.id)

        if poll["author_id"] != user.id and role not in ("admin", "moderator"):
            return jsonify({"error": "You can only close polls you created."}), 403

        if poll["is_closed"]:
            return jsonify({"message": "This poll is already closed."}), 200

        auth_client.table("polls").update({"is_closed": True}).eq("id", poll_id).execute()
        return jsonify({"message": "Poll closed successfully!"}), 200

    except Exception as e:
        print("Close poll error:", str(e))
        return jsonify({"error": "Could not close the poll."}), 500


@app.route("/api/polls/<poll_id>/vote", methods=["POST"])
def vote_poll(poll_id):
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    option_id = data.get("option_id")

    if not option_id:
        return jsonify({"error": "Please select an option."}), 400

    try:
        poll_res = auth_client.table("polls").select("id, is_closed, closes_at").eq("id", poll_id).limit(1).execute()
        if not poll_res.data:
            return jsonify({"error": "Poll not found."}), 404

        poll = poll_res.data[0]

        if poll["is_closed"]:
            return jsonify({"error": "This poll is closed."}), 400

        if poll.get("closes_at"):
            try:
                closing_time = datetime.fromisoformat(str(poll["closes_at"]).replace("Z", "+00:00"))
                if closing_time.tzinfo is None:
                    closing_time = closing_time.replace(tzinfo=timezone.utc)
                if datetime.now(timezone.utc) >= closing_time:
                    return jsonify({"error": "This poll has expired. Voting is closed."}), 400
            except Exception:
                pass

        # Check existing vote - allows changing vote on open polls
        existing = (
            auth_client.table("poll_votes")
            .select("id, option_id")
            .eq("poll_id", poll_id)
            .eq("user_id", user.id)
            .limit(1)
            .execute()
        )
        if existing.data:
            current_vote_id = existing.data[0]["id"]
            current_opt = existing.data[0].get("option_id")
            if current_opt != option_id:
                auth_client.table("poll_votes").update({
                    "option_id": option_id
                }).eq("id", current_vote_id).execute()
        else:
            auth_client.table("poll_votes").insert({
                "poll_id": poll_id,
                "option_id": option_id,
                "user_id": user.id
            }).execute()

        # Recalculate results so frontend gets immediate updated counts & percentages
        votes_res = auth_client.table("poll_votes").select("option_id").eq("poll_id", poll_id).execute()
        votes = votes_res.data or []
        total_votes = len(votes)
        counts = {}
        for v in votes:
            oid = v["option_id"]
            counts[oid] = counts.get(oid, 0) + 1

        results = [
            {
                "option_id": oid,
                "vote_count": cnt,
                "percentage": round((cnt / total_votes * 100), 1) if total_votes > 0 else 0,
                "my_vote": (oid == option_id)
            }
            for oid, cnt in counts.items()
        ]

        return jsonify({
            "message": "Your vote was submitted successfully!",
            "my_vote_option_id": option_id,
            "total_votes": total_votes,
            "results": results
        }), 200

    except Exception as e:
        print("Poll vote error:", str(e))
        return jsonify({"error": "Could not submit your vote."}), 500


@app.route("/api/polls/<poll_id>/results", methods=["GET"])
def get_poll_results(poll_id):
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        result = auth_client.rpc("get_poll_results", {"p_poll_id": poll_id}).execute()
        return jsonify({"results": result.data or []}), 200
    except Exception as e:
        # Fallback calculation if RPC is missing
        try:
            votes_res = auth_client.table("poll_votes").select("option_id, user_id").eq("poll_id", poll_id).execute()
            votes = votes_res.data or []
            counts = {}
            my_vote = None
            for v in votes:
                counts[v["option_id"]] = counts.get(v["option_id"], 0) + 1
                if v["user_id"] == user.id:
                    my_vote = v["option_id"]

            results = [
                {"option_id": opt_id, "vote_count": count, "my_vote": opt_id == my_vote}
                for opt_id, count in counts.items()
            ]
            return jsonify({"results": results}), 200
        except Exception:
            return jsonify({"results": []}), 200


# ---------------------------------------------------------------------------
# Private Chat System (Section 9 - Approval-Based Only)
# ---------------------------------------------------------------------------

@app.route("/api/chat/request", methods=["POST"])
def send_chat_request():
    """
    Sends a chat request to another student.
    Requires recipient approval before any message exchange can occur.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    recipient_id = data.get("recipient_id")
    initial_message = data.get("message", "").strip()

    if not recipient_id:
        return jsonify({"error": "Recipient is required."}), 400

    if recipient_id == user.id:
        return jsonify({"error": "You cannot start a conversation with yourself."}), 400

    try:
        # Check if recipient exists
        recip_res = auth_client.table("profiles").select("id, username").eq("id", recipient_id).limit(1).execute()
        if not recip_res.data:
            return jsonify({"error": "User not found."}), 404

        # Check existing chat request
        existing = (
            auth_client.table("chat_requests")
            .select("id, sender_id, status")
            .or_(f"and(sender_id.eq.{user.id},recipient_id.eq.{recipient_id}),and(sender_id.eq.{recipient_id},recipient_id.eq.{user.id})")
            .limit(1)
            .execute()
        )

        if existing.data:
            cr = existing.data[0]
            if cr["status"] == "pending":
                return jsonify({"error": "A chat request is already pending between you two."}), 409
            elif cr["status"] == "accepted":
                return jsonify({"message": "You are already connected!", "status": "accepted"}), 200

        # Insert new request
        res = auth_client.table("chat_requests").insert({
            "sender_id": user.id,
            "recipient_id": recipient_id,
            "initial_message": initial_message,
            "status": "pending"
        }).execute()

        # Send notification to recipient
        try:
            my_prof = auth_client.table("profiles").select("username").eq("id", user.id).limit(1).execute()
            my_name = my_prof.data[0]["username"] if my_prof.data else "A student"
            auth_client.table("notifications").insert({
                "user_id": recipient_id,
                "notification_type": "chat_request",
                "title": "New Chat Request",
                "message": f"@{my_name} wants to connect with you.",
                "link": "/chat"
            }).execute()
        except Exception:
            pass

        return jsonify({
            "message": "Chat request sent! Messaging will be available once approved.",
            "request": res.data[0] if res.data else {}
        }), 201

    except Exception as e:
        print("Send chat request error:", str(e))
        return jsonify({"error": "Could not send chat request."}), 500


@app.route("/api/chat/requests", methods=["GET"])
def get_chat_requests():
    """Lists received and sent pending chat requests."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        # Received pending requests
        rec_res = (
            auth_client.table("chat_requests")
            .select("id, sender_id, initial_message, created_at, status")
            .eq("recipient_id", user.id)
            .eq("status", "pending")
            .order("created_at", desc=True)
            .execute()
        )
        received = rec_res.data or []

        # Sent pending requests
        sent_res = (
            auth_client.table("chat_requests")
            .select("id, recipient_id, initial_message, created_at, status")
            .eq("sender_id", user.id)
            .eq("status", "pending")
            .order("created_at", desc=True)
            .execute()
        )
        sent = sent_res.data or []

        # Populate usernames
        partner_ids = list({r["sender_id"] for r in received} | {s["recipient_id"] for s in sent})
        usernames = {}
        if partner_ids:
            prof_res = auth_client.table("profiles").select("id, username, campus_voice_id").in_("id", partner_ids).execute()
            for p in (prof_res.data or []):
                usernames[p["id"]] = {
                    "username": p.get("username") or "Student",
                    "campus_voice_id": p.get("campus_voice_id") or "CV-UNKNOWN"
                }

        for r in received:
            info = usernames.get(r["sender_id"], {"username": "Student", "campus_voice_id": "CV-UNKNOWN"})
            r["sender_username"] = info["username"]
            r["sender_cv_id"] = info["campus_voice_id"]

        for s in sent:
            info = usernames.get(s["recipient_id"], {"username": "Student", "campus_voice_id": "CV-UNKNOWN"})
            s["recipient_username"] = info["username"]
            s["recipient_cv_id"] = info["campus_voice_id"]

        return jsonify({
            "received": received,
            "sent": sent
        }), 200

    except Exception as e:
        print("Get chat requests error:", str(e))
        return jsonify({"error": "Could not fetch chat requests."}), 500


@app.route("/api/chat/requests/<request_id>/respond", methods=["POST"])
def respond_chat_request(request_id):
    """Accepts or declines a chat request."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    action = data.get("action", "").lower()  # 'accept' or 'decline'

    if action not in ("accept", "decline"):
        return jsonify({"error": "Action must be 'accept' or 'decline'."}), 400

    try:
        req_res = (
            auth_client.table("chat_requests")
            .select("id, sender_id, recipient_id, status")
            .eq("id", request_id)
            .limit(1)
            .execute()
        )
        if not req_res.data:
            return jsonify({"error": "Request not found."}), 404

        cr = req_res.data[0]
        if cr["recipient_id"] != user.id:
            return jsonify({"error": "Only the recipient can respond to this request."}), 403

        new_status = "accepted" if action == "accept" else "declined"
        auth_client.table("chat_requests").update({
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", request_id).execute()

        # If accepted, ensure conversation record exists
        conversation_id = None
        if action == "accept":
            # Canonical ordering of participant IDs for unique constraint
            p1, p2 = sorted([cr["sender_id"], cr["recipient_id"]])
            try:
                conv_res = (
                    auth_client.table("conversations")
                    .select("id")
                    .or_(f"and(participant_one.eq.{p1},participant_two.eq.{p2}),and(participant_one.eq.{p2},participant_two.eq.{p1})")
                    .limit(1)
                    .execute()
                )
                if conv_res.data:
                    conversation_id = conv_res.data[0]["id"]
                else:
                    new_conv = auth_client.table("conversations").insert({
                        "participant_one": p1,
                        "participant_two": p2,
                        "last_message": cr.get("initial_message") or "Chat request accepted",
                        "last_message_at": datetime.now(timezone.utc).isoformat()
                    }).execute()
                    if new_conv.data:
                        conversation_id = new_conv.data[0]["id"]
            except Exception as ce:
                print("Conversation creation notice:", ce)

            # Notify sender
            try:
                auth_client.table("notifications").insert({
                    "user_id": cr["sender_id"],
                    "notification_type": "chat_accepted",
                    "title": "Chat Request Accepted",
                    "message": "Your chat request was accepted! You can now exchange messages.",
                    "link": "/chat"
                }).execute()
            except Exception:
                pass

        return jsonify({
            "message": f"Chat request {new_status}.",
            "status": new_status,
            "conversation_id": conversation_id
        }), 200

    except Exception as e:
        print("Respond chat request error:", str(e))
        return jsonify({"error": "Could not process request."}), 500


@app.route("/api/chat/conversations", methods=["GET"])
def get_conversations():
    """Lists all active accepted conversations for the logged-in student."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        # Auto-heal / backfill: check for any accepted chat requests missing a conversation record (batched)
        try:
            accepted_reqs = (
                auth_client.table("chat_requests")
                .select("id, sender_id, recipient_id, initial_message, created_at")
                .eq("status", "accepted")
                .or_(f"sender_id.eq.{user.id},recipient_id.eq.{user.id}")
                .execute()
            )
            reqs = accepted_reqs.data or []
            if reqs:
                # Pre-fetch existing conversation pairs in a single query instead of N loop queries
                existing_convs = (
                    auth_client.table("conversations")
                    .select("id, participant_one, participant_two")
                    .or_(f"participant_one.eq.{user.id},participant_two.eq.{user.id}")
                    .execute()
                )
                existing_pairs = {
                    tuple(sorted([c["participant_one"], c["participant_two"]]))
                    for c in (existing_convs.data or [])
                }
                for req in reqs:
                    pair = tuple(sorted([req["sender_id"], req["recipient_id"]]))
                    if pair not in existing_pairs:
                        auth_client.table("conversations").insert({
                            "participant_one": pair[0],
                            "participant_two": pair[1],
                            "last_message": req.get("initial_message") or "Chat request accepted",
                            "last_message_at": datetime.now(timezone.utc).isoformat()
                        }).execute()
                        existing_pairs.add(pair)
        except Exception as heal_err:
            print("Conversation auto-heal notice:", heal_err)

        conv_res = (
            auth_client.table("conversations")
            .select("id, participant_one, participant_two, last_message, last_message_at")
            .or_(f"participant_one.eq.{user.id},participant_two.eq.{user.id}")
            .order("last_message_at", desc=True)
            .execute()
        )
        conversations = conv_res.data or []

        # Determine partner IDs
        partner_ids = [
            c["participant_two"] if c["participant_one"] == user.id else c["participant_one"]
            for c in conversations
        ]

        usernames = {}
        if partner_ids:
            prof_res = auth_client.table("profiles").select("id, username, campus_voice_id").in_("id", partner_ids).execute()
            for p in (prof_res.data or []):
                usernames[p["id"]] = {
                    "username": p.get("username") or "Student",
                    "campus_voice_id": p.get("campus_voice_id") or "CV-UNKNOWN"
                }

        for c in conversations:
            partner_id = c["participant_two"] if c["participant_one"] == user.id else c["participant_one"]
            info = usernames.get(partner_id, {"username": "Student", "campus_voice_id": "CV-UNKNOWN"})
            c["partner_id"] = partner_id
            c["partner_username"] = info["username"]
            c["partner_cv_id"] = info["campus_voice_id"]

        return jsonify({"conversations": conversations}), 200

    except Exception as e:
        print("Get conversations error:", str(e))
        return jsonify({"error": "Could not fetch conversations."}), 500


@app.route("/api/chat/conversations/<conversation_id>/messages", methods=["GET"])
def get_messages(conversation_id):
    """Fetches messages inside an approved private conversation."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        # Verify user is a participant
        conv_res = (
            auth_client.table("conversations")
            .select("id, participant_one, participant_two")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
        if not conv_res.data:
            return jsonify({"error": "Conversation not found."}), 404

        conv = conv_res.data[0]
        if user.id not in (conv["participant_one"], conv["participant_two"]):
            return jsonify({"error": "Unauthorized access to this conversation."}), 403

        # Load latest 50 messages (ordered descending, reversed to chronological)
        msg_res = (
            auth_client.table("messages")
            .select("id, conversation_id, sender_id, body, is_read, created_at")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        messages = list(reversed(msg_res.data or []))

        for m in messages:
            m["is_mine"] = m["sender_id"] == user.id

        return jsonify({"messages": messages}), 200

    except Exception as e:
        print("Get messages error:", str(e))
        return jsonify({"error": "Could not fetch messages."}), 500


@app.route("/api/chat/conversations/<conversation_id>/messages", methods=["POST"])
def send_message(conversation_id):
    """Sends a message inside an approved private conversation."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    body = data.get("body", "").strip()

    if not body:
        return jsonify({"error": "Message body cannot be empty."}), 400

    if len(body) > 4000:
        return jsonify({"error": "Message is too long."}), 400

    try:
        # Validate participant
        conv_res = (
            auth_client.table("conversations")
            .select("id, participant_one, participant_two")
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        )
        if not conv_res.data:
            return jsonify({"error": "Conversation not found."}), 404

        conv = conv_res.data[0]
        if user.id not in (conv["participant_one"], conv["participant_two"]):
            return jsonify({"error": "Unauthorized."}), 403

        # Insert message
        msg_res = auth_client.table("messages").insert({
            "conversation_id": conversation_id,
            "sender_id": user.id,
            "body": body
        }).execute()

        new_msg = msg_res.data[0] if msg_res.data else {}
        new_msg["is_mine"] = True

        # Update last message on conversation
        now_iso = datetime.now(timezone.utc).isoformat()
        auth_client.table("conversations").update({
            "last_message": body[:100],
            "last_message_at": now_iso
        }).eq("id", conversation_id).execute()

        return jsonify({
            "message": "Message sent!",
            "data": new_msg,
            "created_message": new_msg
        }), 201

    except Exception as e:
        print("Send message error:", str(e))
        return jsonify({"error": "Could not send message."}), 500


# ---------------------------------------------------------------------------
# Notifications (Section 16)
# ---------------------------------------------------------------------------

@app.route("/api/notifications", methods=["GET"])
def get_notifications():
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        res = (
            auth_client.table("notifications")
            .select("id, user_id, title, message, notification_type, is_read, created_at")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        notifications = res.data or []
        for n in notifications:
            n["content"] = n.get("message")
            n["type"] = n.get("notification_type")

        unread_count = sum(1 for n in notifications if not n.get("is_read"))

        return jsonify({
            "notifications": notifications,
            "unread_count": unread_count
        }), 200

    except Exception as e:
        return jsonify({"notifications": [], "unread_count": 0}), 200


@app.route("/api/notifications/read-all", methods=["POST"])
def mark_all_notifications_read():
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        auth_client.table("notifications").update({"is_read": True}).eq("user_id", user.id).execute()
        return jsonify({"message": "All notifications marked as read."}), 200
    except Exception as e:
        return jsonify({"error": "Could not update notifications."}), 500


# ---------------------------------------------------------------------------
# Moderation, Reports & Admin Real-Name Portal (Section 6, 17, 18)
# ---------------------------------------------------------------------------

@app.route("/api/reports", methods=["POST"])
def submit_report():
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    post_id = data.get("post_id")
    comment_id = data.get("comment_id")
    target_user_id = data.get("target_user_id")
    reason = data.get("reason", "").strip()
    details = data.get("details", "").strip() or reason

    if not reason:
        return jsonify({"error": "Report reason is required."}), 400

    target_type = "post" if post_id else ("comment" if comment_id else "user")
    target_id = post_id or comment_id or target_user_id

    if not target_id:
        return jsonify({"error": "Target content or user is required."}), 400

    if target_type == "post" and target_id:
        REPORTED_POST_IDS.add(str(target_id))

    try:
        auth_client.table("reports").insert({
            "reporter_id": user.id,
            "target_type": target_type,
            "target_id": target_id,
            "reason": reason,
            "details": details,
            "status": "pending"
        }).execute()

        return jsonify({"message": "Thank you. Your report has been submitted for moderation."}), 201

    except Exception as e:
        print("Submit report notice:", str(e))
        # Keep in-memory report registered so mods can act on disruptive content
        return jsonify({"message": "Thank you. Your report has been submitted for moderation."}), 201


@app.route("/api/admin/identities", methods=["GET"])
def get_admin_identities():
    """
    Administrative lookup portal for students' private real identities.
    STRICTLY accessible only by authorized administrators.
    Never exposed to regular students or moderators.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    role = get_user_role(auth_client, user.id)
    if role != "admin":
        return jsonify({"error": "Unauthorized: Administrator access required."}), 403

    try:
        # Join profiles with private_identities
        prof_res = (
            auth_client.table("profiles")
            .select("id, username, campus_voice_id, role, created_at")
            .order("created_at", desc=True)
            .execute()
        )
        profiles = prof_res.data or []

        identities_res = (
            auth_client.table("private_identities")
            .select("user_id, college_email, real_name, admin_notes, updated_at")
            .execute()
        )
        identities_map = {i["user_id"]: i for i in (identities_res.data or [])}

        results = []
        for p in profiles:
            ident = identities_map.get(p["id"], {})
            results.append({
                "user_id": p["id"],
                "username": p.get("username", "Unknown"),
                "campus_voice_id": p.get("campus_voice_id", "CV-UNKNOWN"),
                "role": p.get("role", "student"),
                "college_email": ident.get("college_email", "N/A"),
                "real_name": ident.get("real_name") or "",
                "admin_notes": ident.get("admin_notes") or "",
                "created_at": p.get("created_at")
            })

        return jsonify({"users": results}), 200

    except Exception as e:
        print("Admin identities error:", str(e))
        return jsonify({"error": "Could not fetch private identities."}), 500


@app.route("/api/admin/identities/<target_user_id>", methods=["PUT"])
def update_admin_identity(target_user_id):
    """
    Administrative entry of student real names based on verified college Gmail records.
    Audit logged with administrator id and timestamp.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    role = get_user_role(auth_client, user.id)
    if role != "admin":
        return jsonify({"error": "Unauthorized: Administrator access required."}), 403

    data = request.get_json(silent=True) or {}
    real_name = data.get("real_name", "").strip()
    admin_notes = data.get("admin_notes", "").strip()

    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        supabase.table("private_identities").upsert({
            "user_id": target_user_id,
            "real_name": real_name,
            "admin_notes": admin_notes,
            "updated_by": user.id,
            "updated_at": now_iso
        }).execute()

        return jsonify({"message": "Student real identity record saved successfully."}), 200

    except Exception as e:
        print("Update admin identity error:", str(e))
        return jsonify({"error": "Could not update real identity record."}), 500


@app.route("/api/admin/reports", methods=["GET"])
def get_admin_reports():
    """Fetches moderation queue of reported content."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    role = get_user_role(auth_client, user.id)
    if role not in ("moderator", "admin"):
        return jsonify({"error": "Unauthorized: Moderator/Admin access required."}), 403

    try:
        res = auth_client.table("reports").select("*").order("created_at", desc=True).execute()
        return jsonify({"reports": res.data or []}), 200
    except Exception as e:
        return jsonify({"reports": []}), 200


@app.route("/api/admin/posts/<post_id>/status", methods=["PUT"])
def update_post_status(post_id):
    """Updates feedback or suggestion status ('Pending', 'Under Review', 'Resolved')."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    role = get_user_role(auth_client, user.id)
    if role not in ("moderator", "admin"):
        return jsonify({"error": "Unauthorized."}), 403

    data = request.get_json(silent=True) or {}
    new_status = data.get("status", "Pending")

    if new_status not in ("Pending", "Under Review", "Resolved", "Closed"):
        return jsonify({"error": "Invalid status."}), 400

    try:
        auth_client.table("posts").update({"status": new_status}).eq("id", post_id).execute()
        return jsonify({"message": f"Post status updated to {new_status}."}), 200
    except Exception as e:
        return jsonify({"error": "Could not update post status."}), 500


# ---------------------------------------------------------------------------
# Communities (c/Hubs) System with Moderator Roles, Members & Mod Controls
# ---------------------------------------------------------------------------

FALLBACK_COMMUNITIES = {
    "godot": {
        "id": "11111111-1111-1111-1111-111111111101",
        "slug": "godot",
        "name": "Godot Developers",
        "description": "Game dev in Godot engine, tips, showcases, shaders, and help.",
        "category": "Tech & Coding",
        "creator_id": "system-user-godot",
        "member_count": 4,
        "is_verified": True,
        "created_at": "2026-01-15T00:00:00Z",
        "members": [
            {"user_id": "system-user-godot", "username": "GodotLead", "campus_voice_id": "CV-0101", "role": "moderator", "is_creator": True, "joined_at": "2026-01-15T00:00:00Z"},
            {"user_id": "system-user-2", "username": "Rudigio1324", "campus_voice_id": "CV-1324", "role": "moderator", "is_creator": False, "joined_at": "2026-02-01T10:00:00Z"},
            {"user_id": "system-user-3", "username": "PixelArtist", "campus_voice_id": "CV-4421", "role": "member", "is_creator": False, "joined_at": "2026-02-10T12:00:00Z"},
            {"user_id": "system-user-4", "username": "ShaderWizard", "campus_voice_id": "CV-8829", "role": "member", "is_creator": False, "joined_at": "2026-02-14T09:30:00Z"}
        ]
    },
    "caldruki": {
        "id": "11111111-1111-1111-1111-111111111102",
        "slug": "Caldruki",
        "name": "Caldruki Campus",
        "description": "This community is for the Caldruki YouTube channel, campus memes, and highlights.",
        "category": "Campus Life",
        "creator_id": "system-user-cal",
        "member_count": 2,
        "is_verified": True,
        "created_at": "2026-02-01T00:00:00Z",
        "members": [
            {"user_id": "system-user-cal", "username": "CaldrukiMod", "campus_voice_id": "CV-0007", "role": "moderator", "is_creator": True, "joined_at": "2026-02-01T00:00:00Z"},
            {"user_id": "system-user-5", "username": "CampusMemeLord", "campus_voice_id": "CV-7711", "role": "member", "is_creator": False, "joined_at": "2026-02-05T14:20:00Z"}
        ]
    },
    "boys-backbenchers": {
        "id": "11111111-1111-1111-1111-111111111103",
        "slug": "boys-backbenchers",
        "name": "Boys Backbenchers",
        "description": "Backbench discussions, canteen gossip, exam survival, and classroom vibes.",
        "category": "Campus Life",
        "creator_id": "system-user-bb",
        "member_count": 1,
        "is_verified": False,
        "created_at": "2026-02-10T00:00:00Z",
        "members": [
            {"user_id": "system-user-bb", "username": "BackbenchLead", "campus_voice_id": "CV-0022", "role": "moderator", "is_creator": True, "joined_at": "2026-02-10T00:00:00Z"}
        ]
    },
    "webdev-club": {
        "id": "11111111-1111-1111-1111-111111111104",
        "slug": "webdev-club",
        "name": "Web Dev Club",
        "description": "React, Next.js, Vite, Python APIs, hackathons, and design reviews.",
        "category": "Tech & Coding",
        "creator_id": "system-user-web",
        "member_count": 1,
        "is_verified": True,
        "created_at": "2026-01-20T00:00:00Z",
        "members": [
            {"user_id": "system-user-web", "username": "WebDevPres", "campus_voice_id": "CV-0303", "role": "moderator", "is_creator": True, "joined_at": "2026-01-20T00:00:00Z"}
        ]
    }
}

# Community Settings Store (Appearance, Rules max 5, Downvote Threshold, Pinned Announcements max 2, Pond Timeouts)
COMMUNITY_SETTINGS = {
    "godot": {
        "bio": "Game dev in Godot engine, tips, showcases, shaders, and help.",
        "banner_color": "linear-gradient(135deg, #1e3a8a 0%, #0369a1 100%)",
        "icon_emoji": "🤖",
        "rules": [
            {"id": "rule-1", "title": "Respect fellow developers", "desc": "Constructive feedback only. No personal insults."},
            {"id": "rule-2", "title": "Keep it Godot & gamedev related", "desc": "Showcase your shaders, GDScript, C#, and 2D/3D work."},
            {"id": "rule-3", "title": "No phone numbers or real names", "desc": "Keep all communication anonymous and safe."},
            {"id": "rule-4", "title": "No unauthorized self-promo", "desc": "Game showcases are allowed; raw spam links are removed."}
        ],
        "downvote_threshold": 10,
        "pinned_post_ids": [],
        "timeouts": []
    },
    "caldruki": {
        "bio": "This community is for the Caldruki YouTube channel, campus memes, and highlights.",
        "banner_color": "linear-gradient(135deg, #581c87 0%, #831843 100%)",
        "icon_emoji": "👾",
        "rules": [
            {"id": "rule-1", "title": "No real names or phone numbers", "desc": "Anonymity is mandatory for student safety."},
            {"id": "rule-2", "title": "Keep it funny, no hate speech", "desc": "Humor is welcome; harassment or bullying is banned."}
        ],
        "downvote_threshold": 10,
        "pinned_post_ids": [],
        "timeouts": []
    },
    "boys-backbenchers": {
        "bio": "Backbench discussions, canteen gossip, exam survival, and classroom vibes.",
        "banner_color": "linear-gradient(135deg, #b45309 0%, #78350f 100%)",
        "icon_emoji": "🎒",
        "rules": [
            {"id": "rule-1", "title": "What happens in backbench stays in backbench", "desc": "No personal attacks on lecturers or students."},
            {"id": "rule-2", "title": "No real identity leaks", "desc": "Protect all anonymous identities."}
        ],
        "downvote_threshold": 10,
        "pinned_post_ids": [],
        "timeouts": []
    },
    "webdev-club": {
        "bio": "React, Next.js, Vite, Python APIs, hackathons, and design reviews.",
        "banner_color": "linear-gradient(135deg, #065f46 0%, #064e3b 100%)",
        "icon_emoji": "💻",
        "rules": [
            {"id": "rule-1", "title": "Post working code & reproducible issues", "desc": "Include error details and environment."},
            {"id": "rule-2", "title": "Be helpful to beginners", "desc": "Every developer starts somewhere."}
        ],
        "downvote_threshold": 10,
        "pinned_post_ids": [],
        "timeouts": []
    }
}


def get_or_create_community_settings(slug, name=None, desc=None):
    clean_s = normalize_community_slug(slug)
    if clean_s not in COMMUNITY_SETTINGS:
        COMMUNITY_SETTINGS[clean_s] = {
            "bio": desc or f"Welcome to c/{clean_s}! Student community for campus discussions.",
            "banner_color": "linear-gradient(135deg, #2563eb 0%, #1e1b4b 100%)",
            "icon_emoji": "💬",
            "rules": [
                {"id": "rule-1", "title": "No real names or phone numbers", "desc": "Protect fellow student anonymity."},
                {"id": "rule-2", "title": "Keep discussions constructive", "desc": "No hate speech or harassment."}
            ],
            "downvote_threshold": 10,
            "pinned_post_ids": [],
            "timeouts": []
        }
    return COMMUNITY_SETTINGS[clean_s]


def is_user_community_moderator(user_id, clean_slug, auth_client=None):
    if not user_id:
        return False
    clean_s = normalize_community_slug(clean_slug)

    fb = FALLBACK_COMMUNITIES.get(clean_s) or next(
        (v for v in FALLBACK_COMMUNITIES.values() if normalize_community_slug(v["slug"]) == clean_s),
        None
    )
    if fb:
        if same_id(fb.get("creator_id"), user_id):
            return True
        if any(same_id(m.get("user_id"), user_id) and m.get("role") == "moderator" for m in fb.get("members", [])):
            return True

    client = auth_client or supabase
    if client:
        try:
            role = get_user_role(client, user_id)
            if role in ("moderator", "admin"):
                return True
            c_res = client.table("communities").select("id, creator_id").ilike("slug", clean_s).limit(1).execute()
            if c_res.data:
                cid = c_res.data[0]["id"]
                if same_id(c_res.data[0].get("creator_id"), user_id):
                    return True
                m_res = client.table("community_members").select("role").eq("community_id", cid).eq("user_id", user_id).limit(1).execute()
                if m_res.data and m_res.data[0].get("role") == "moderator":
                    return True
        except Exception:
            pass

    return False


@app.route("/api/communities", methods=["GET"])
def get_communities():
    """
    Returns list of public student communities.
    Supports filtering by category and search by name.
    Annotates whether current user has joined each community.
    """
    auth_client, user = get_authenticated_client()
    client = auth_client if auth_client else supabase

    category = request.args.get("category")
    search = request.args.get("search", "").strip()

    try:
        query = client.table("communities").select(
            "id, slug, name, description, category, member_count, is_verified, created_at, creator_id"
        )

        if category and category.lower() != "all":
            query = query.eq("category", category)

        if search:
            query = query.ilike("name", f"%{search}%")

        query = query.order("member_count", desc=True)
        res = query.limit(100).execute()
        communities = res.data or []

        joined_ids = set()
        if user and auth_client:
            try:
                m_res = auth_client.table("community_members").select("community_id").eq("user_id", user.id).execute()
                joined_ids = {m["community_id"] for m in (m_res.data or [])}
            except Exception as me:
                print("Community memberships lookup error:", me)

        for c in communities:
            c["is_member"] = c["id"] in joined_ids
            st = get_or_create_community_settings(c["slug"], c["name"], c.get("description"))
            c["icon_emoji"] = st.get("icon_emoji", "💬")
            c["banner_color"] = st.get("banner_color")

        return jsonify({"communities": communities}), 200

    except Exception:
        items = list(FALLBACK_COMMUNITIES.values())
        if category and category.lower() != "all":
            items = [c for c in items if c.get("category") == category]
        if search:
            items = [c for c in items if search.lower() in c.get("name", "").lower() or search.lower() in c.get("slug", "").lower()]

        for c in items:
            c["member_count"] = len(c.get("members", []))
            c["is_member"] = bool(user and any(same_id(m.get("user_id"), user.id) for m in c.get("members", [])))
            st = get_or_create_community_settings(c["slug"], c["name"], c.get("description"))
            c["icon_emoji"] = st.get("icon_emoji", "💬")
            c["banner_color"] = st.get("banner_color")

        return jsonify({"communities": items}), 200


@app.route("/api/communities/my", methods=["GET"])
def get_my_communities():
    """Returns only the communities joined by the authenticated student."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    try:
        m_res = auth_client.table("community_members").select("community_id").eq("user_id", user.id).execute()
        joined_ids = [m["community_id"] for m in (m_res.data or [])]

        if not joined_ids:
            return jsonify({"communities": []}), 200

        c_res = (
            auth_client.table("communities")
            .select("id, slug, name, description, category, member_count, is_verified, created_at, creator_id")
            .in_("id", joined_ids)
            .order("name")
            .execute()
        )

        communities = c_res.data or []
        for c in communities:
            c["is_member"] = True
            st = get_or_create_community_settings(c["slug"], c["name"], c.get("description"))
            c["icon_emoji"] = st.get("icon_emoji", "💬")
            c["banner_color"] = st.get("banner_color")

        return jsonify({"communities": communities}), 200

    except Exception:
        joined = []
        for c in FALLBACK_COMMUNITIES.values():
            if any(same_id(m.get("user_id"), user.id) for m in c.get("members", [])):
                st = get_or_create_community_settings(c["slug"], c["name"], c.get("description"))
                joined.append({
                    **c,
                    "member_count": len(c.get("members", [])),
                    "is_member": True,
                    "icon_emoji": st.get("icon_emoji", "💬"),
                    "banner_color": st.get("banner_color")
                })
        return jsonify({"communities": joined}), 200


@app.route("/api/communities/<path:slug>", methods=["GET"])
def get_community_detail(slug):
    """
    Fetches community details by handle slug (e.g. boys-backbenchers, godot).
    Returns metadata, current user join & moderator status, custom icon and rules.
    """
    auth_client, user = get_authenticated_client()
    clean_slug = normalize_community_slug(slug)
    st = get_or_create_community_settings(clean_slug)

    # 1. Try Supabase lookup
    try:
        client = auth_client or supabase
        res = (
            client.table("communities")
            .select("id, slug, name, description, category, member_count, is_verified, created_at, creator_id")
            .ilike("slug", clean_slug)
            .limit(1)
            .execute()
        )

        if res.data and len(res.data) > 0:
            community = res.data[0]
            community["is_member"] = False
            community["is_moderator"] = False

            if user:
                # 1. Check if user is site-wide admin
                try:
                    user_role = get_user_role(client, user.id)
                    if user_role in ("admin", "moderator"):
                        community["is_moderator"] = True
                        community["is_member"] = True
                except Exception:
                    pass

                # 2. Check if user is the community creator
                if same_id(community.get("creator_id"), user.id):
                    community["is_moderator"] = True
                    community["is_member"] = True

                # 3. Check community_members table
                try:
                    m_res = (
                        client.table("community_members")
                        .select("id, role")
                        .eq("community_id", community["id"])
                        .eq("user_id", user.id)
                        .limit(1)
                        .execute()
                    )
                    if m_res.data and len(m_res.data) > 0:
                        community["is_member"] = True
                        if m_res.data[0].get("role") == "moderator":
                            community["is_moderator"] = True
                except Exception as m_err:
                    print("community_members lookup notice in get_community_detail:", m_err)

                # 4. Fallback moderator verification
                if not community["is_moderator"]:
                    if is_user_community_moderator(user.id, clean_slug, client):
                        community["is_moderator"] = True
                        community["is_member"] = True

            # Attach settings
            community["bio"] = st.get("bio") or community.get("description")
            community["banner_color"] = st.get("banner_color")
            community["rules"] = st.get("rules", [])
            community["downvote_threshold"] = st.get("downvote_threshold", 10)
            community["pinned_post_ids"] = st.get("pinned_post_ids", [])

            return jsonify({"community": community}), 200

    except Exception as e:
        print("get_community_detail DB lookup exception:", e)

    # 2. Check fallback store
    fb = FALLBACK_COMMUNITIES.get(clean_slug) or next(
        (v for v in FALLBACK_COMMUNITIES.values() if normalize_community_slug(v["slug"]).lower() == clean_slug.lower()),
        None
    )
    if fb:
        comm = {**fb}
        comm["member_count"] = len(comm.get("members", []))
        comm["is_member"] = False
        comm["is_moderator"] = False
        if user:
            m = next((mem for mem in comm.get("members", []) if same_id(mem["user_id"], user.id)), None)
            if m:
                comm["is_member"] = True
                if m.get("role") == "moderator" or same_id(comm.get("creator_id"), user.id):
                    comm["is_moderator"] = True
            elif same_id(comm.get("creator_id"), user.id):
                comm["is_member"] = True
                comm["is_moderator"] = True

        comm["bio"] = st.get("bio") or comm.get("description")
        comm["banner_color"] = st.get("banner_color")
        comm["icon_emoji"] = st.get("icon_emoji", "💬")
        comm["rules"] = st.get("rules", [])
        comm["downvote_threshold"] = st.get("downvote_threshold", 10)
        comm["pinned_post_ids"] = st.get("pinned_post_ids", [])

        return jsonify({"community": comm}), 200

    return jsonify({"error": f"Community 'c/{clean_slug}' not found."}), 404


@app.route("/api/communities/<path:slug>/members", methods=["GET"])
def get_community_members(slug):
    """
    Returns list of joined members for the community, highlighting moderators.
    Creator has moderator role by default and is permanently pinned as moderator.
    """
    auth_client, user = get_authenticated_client()
    clean_slug = normalize_community_slug(slug)
    client = auth_client or supabase

    # 1. Try Supabase lookup
    try:
        c_res = client.table("communities").select("id, slug, name, creator_id, created_at").ilike("slug", clean_slug).limit(1).execute()
        if c_res.data and len(c_res.data) > 0:
            comm = c_res.data[0]
            cid = comm["id"]
            creator_id = comm.get("creator_id")

            m_res = client.table("community_members").select("id, user_id, role, created_at").eq("community_id", cid).execute()
            rows = m_res.data or []

            # Ensure creator is always included as Creator · Mod even if not yet in community_members
            if creator_id and not any(same_id(r.get("user_id"), creator_id) for r in rows):
                rows.append({
                    "id": f"creator-{creator_id}",
                    "user_id": creator_id,
                    "role": "moderator",
                    "created_at": comm.get("created_at") or datetime.now(timezone.utc).isoformat()
                })

            user_ids = [r["user_id"] for r in rows if r.get("user_id")]

            profiles_map = {}
            if user_ids:
                p_res = client.table("profiles").select("id, username, campus_voice_id, display_name").in_("id", user_ids).execute()
                for p in (p_res.data or []):
                    profiles_map[p["id"]] = p

            members_list = []
            for r in rows:
                uid = r["user_id"]
                p = profiles_map.get(uid, {})
                is_creator = same_id(uid, creator_id)
                role = "moderator" if is_creator else (r.get("role") or "member")
                members_list.append({
                    "id": r["id"],
                    "user_id": uid,
                    "username": p.get("username") or p.get("display_name") or f"Student_{str(uid)[:6]}",
                    "campus_voice_id": p.get("campus_voice_id") or "CV-ID",
                    "role": role,
                    "is_creator": is_creator,
                    "joined_at": r.get("created_at")
                })

            members_list.sort(key=lambda m: (0 if m["is_creator"] else (1 if m["role"] == "moderator" else 2), m["username"].lower()))

            is_current_user_mod = False
            if user:
                is_current_user_mod = is_user_community_moderator(user.id, clean_slug, client)

            return jsonify({
                "members": members_list,
                "total_count": len(members_list),
                "moderator_count": sum(1 for m in members_list if m["role"] == "moderator"),
                "is_current_user_mod": is_current_user_mod
            }), 200
    except Exception as e:
        print("get_community_members DB lookup exception:", e)

    # 2. Fallback store lookup
    fb = FALLBACK_COMMUNITIES.get(clean_slug) or next(
        (v for v in FALLBACK_COMMUNITIES.values() if normalize_community_slug(v["slug"]).lower() == clean_slug.lower()),
        None
    )
    if fb:
        members_list = list(fb.get("members", []))
        creator_id = fb.get("creator_id")

        # Ensure creator has moderator role by default
        for m in members_list:
            if same_id(m.get("user_id"), creator_id) or m.get("is_creator"):
                m["role"] = "moderator"
                m["is_creator"] = True

        members_list.sort(key=lambda m: (0 if m.get("is_creator") else (1 if m.get("role") == "moderator" else 2), m.get("username", "").lower()))

        is_current_user_mod = False
        if user:
            is_current_user_mod = is_user_community_moderator(user.id, clean_slug, auth_client)

        return jsonify({
            "members": members_list,
            "total_count": len(members_list),
            "moderator_count": sum(1 for m in members_list if m.get("role") == "moderator"),
            "is_current_user_mod": is_current_user_mod
        }), 200

    return jsonify({"error": f"Community 'c/{clean_slug}' not found."}), 404


@app.route("/api/communities/<path:slug>/members/<target_user_id>/role", methods=["POST"])
def update_community_member_role(slug, target_user_id):
    """
    Assigns or revokes the community 'moderator' role for a joined member.
    Creator's moderator role is permanent and cannot be revoked.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    clean_slug = normalize_community_slug(slug)
    data = request.get_json(silent=True) or {}
    new_role = data.get("role", "member")
    if new_role not in ("moderator", "member"):
        return jsonify({"error": "Role must be 'moderator' or 'member'."}), 400

    if not is_user_community_moderator(user.id, clean_slug, auth_client):
        return jsonify({"error": "Only community moderators can assign or manage roles."}), 403

    # Fallback store update
    fb = FALLBACK_COMMUNITIES.get(clean_slug) or next(
        (v for v in FALLBACK_COMMUNITIES.values() if normalize_community_slug(v["slug"]) == clean_slug),
        None
    )
    if fb:
        comm_creator_id = fb.get("creator_id")
        if same_id(target_user_id, comm_creator_id) and new_role == "member":
            return jsonify({"error": "The community creator's moderator role cannot be revoked."}), 400

        target_member = next((m for m in fb.get("members", []) if same_id(m["user_id"], target_user_id)), None)
        if target_member:
            target_member["role"] = new_role
        else:
            fb.setdefault("members", []).append({
                "user_id": target_user_id,
                "username": f"Member_{str(target_user_id)[:6]}",
                "campus_voice_id": "CV-ID",
                "role": new_role,
                "is_creator": False,
                "joined_at": datetime.now(timezone.utc).isoformat()
            })

        return jsonify({
            "message": f"Successfully updated member role to {new_role}.",
            "role": new_role,
            "user_id": target_user_id
        }), 200

    return jsonify({"error": "Community not found."}), 404


@app.route("/api/communities/<path:slug>/settings", methods=["GET"])
def get_community_settings(slug):
    """
    Fetches full moderator settings (appearance, rules, thresholds, timeouts, pinned posts)
    directly from Supabase database with seamless fallback.
    """
    auth_client, user = get_authenticated_client()
    clean_slug = normalize_community_slug(slug)
    st = get_or_create_community_settings(clean_slug)
    comm_name = clean_slug

    # 1. Query Supabase Database
    try:
        c_res = supabase.table("communities").select("id, name, slug, description, bio, icon_url, banner_color, rules, downvote_threshold, pinned_post_ids").ilike("slug", clean_slug).limit(1).execute()
        if c_res.data and len(c_res.data) > 0:
            db_c = c_res.data[0]
            cid = db_c["id"]
            comm_name = db_c.get("name") or clean_slug
            if db_c.get("bio") or db_c.get("description"):
                st["bio"] = db_c.get("bio") or db_c.get("description")
            if db_c.get("icon_url"):
                st["icon_url"] = db_c["icon_url"]
            if db_c.get("banner_color"):
                st["banner_color"] = db_c["banner_color"]
            if db_c.get("rules") is not None:
                st["rules"] = db_c["rules"]
            if db_c.get("downvote_threshold") is not None:
                st["downvote_threshold"] = db_c["downvote_threshold"]
            if db_c.get("pinned_post_ids") is not None:
                st["pinned_post_ids"] = db_c["pinned_post_ids"]

            # Query real mutes from community_mutes or community_timeouts table
            try:
                t_res = None
                try:
                    t_res = supabase.table("community_mutes").select("id, user_id, expires_at, is_permanent, reason, created_at").eq("community_id", cid).execute()
                except Exception:
                    t_res = supabase.table("community_timeouts").select("id, user_id, duration, reason, expires_at, created_at").eq("community_id", cid).execute()

                t_rows = (t_res.data if t_res else []) or []
                if t_rows:
                    u_ids = [r["user_id"] for r in t_rows if r.get("user_id")]
                    p_map = {}
                    if u_ids:
                        p_res = supabase.table("profiles").select("id, username").in_("id", u_ids).execute()
                        for p in (p_res.data or []):
                            p_map[p["id"]] = p.get("username")
                    st["timeouts"] = [
                        {
                            "id": r["id"],
                            "user_id": r["user_id"],
                            "username": p_map.get(r["user_id"]) or f"Student_{str(r['user_id'])[:6]}",
                            "duration": r.get("duration") or ("permanent" if r.get("is_permanent") else "temporary"),
                            "is_permanent": r.get("is_permanent", False),
                            "reason": r.get("reason", "Violating community guidelines"),
                            "expires_at": r.get("expires_at"),
                            "created_at": r.get("created_at")
                        }
                        for r in t_rows
                    ]
            except Exception as te:
                pass

            # Query auto-hidden posts in this community for the review queue
            try:
                h_res = supabase.table("posts").select("id, title, body, author_id, created_at, is_hidden, is_reported").eq("community_id", cid).eq("is_hidden", True).execute()
                st["hidden_posts"] = h_res.data or []
            except Exception:
                st["hidden_posts"] = []
    except Exception as dbe:
        fb = FALLBACK_COMMUNITIES.get(clean_slug)
        if fb:
            comm_name = fb.get("name", clean_slug)
            if fb.get("description"):
                st["bio"] = fb["description"]

    return jsonify({
        "settings": st,
        "slug": clean_slug,
        "name": comm_name
    }), 200


@app.route("/api/communities/<path:slug>/settings", methods=["PUT"])
def update_community_settings(slug):
    """
    Updates community settings (Name/Bio, custom emoji icon, banner gradient, rules max 5, downvote threshold).
    Allowed only for community moderators.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    clean_slug = normalize_community_slug(slug)
    if not is_user_community_moderator(user.id, clean_slug, auth_client):
        return jsonify({"error": "Only community moderators can edit community settings."}), 403

    data = request.get_json(silent=True) or {}
    st = get_or_create_community_settings(clean_slug)

    # 1. Community Bio (keeps name and slug immutable)
    if "bio" in data:
        st["bio"] = str(data["bio"]).strip()
        if clean_slug in FALLBACK_COMMUNITIES:
            FALLBACK_COMMUNITIES[clean_slug]["description"] = st["bio"]

    # 2. Community Icon URL
    if "icon_url" in data:
        st["icon_url"] = str(data["icon_url"]).strip()

    # 3. Banner Styling
    if "banner_color" in data:
        st["banner_color"] = str(data["banner_color"]).strip()

    # 4. Community Rules (Max 5 enforced)
    if "rules" in data:
        rules_input = data["rules"]
        if isinstance(rules_input, list):
            if len(rules_input) > 5:
                return jsonify({"error": "A community can have a maximum of 5 rules."}), 400
            formatted = []
            for idx, r in enumerate(rules_input[:5]):
                if isinstance(r, dict):
                    formatted.append({
                        "id": r.get("id") or f"rule-{idx+1}",
                        "title": str(r.get("title", "")).strip()[:100],
                        "desc": str(r.get("desc", r.get("description", ""))).strip()[:300]
                    })
                elif isinstance(r, str):
                    formatted.append({
                        "id": f"rule-{idx+1}",
                        "title": str(r).strip()[:100],
                        "desc": ""
                    })
            st["rules"] = formatted

    # 5. Downvote Threshold (Auto-Hide)
    if "downvote_threshold" in data:
        try:
            st["downvote_threshold"] = max(0, int(data["downvote_threshold"]))
        except (ValueError, TypeError):
            pass

    # Persist to database directly (Supabase)
    try:
        if auth_client:
            db_payload = {}
            if "bio" in data:
                db_payload["bio"] = st["bio"]
                db_payload["description"] = st["bio"]
            if "icon_url" in data:
                db_payload["icon_url"] = st["icon_url"]
            if "banner_color" in data:
                db_payload["banner_color"] = st["banner_color"]
            if "rules" in data:
                db_payload["rules"] = st["rules"]
            if "downvote_threshold" in data:
                db_payload["downvote_threshold"] = st["downvote_threshold"]
            if db_payload:
                auth_client.table("communities").update(db_payload).ilike("slug", clean_slug).execute()
    except Exception as dbe:
        print("Database update community settings notice:", dbe)

    return jsonify({
        "message": "Community settings updated successfully.",
        "settings": st
    }), 200


@app.route("/api/communities/<path:slug>/timeouts", methods=["POST"])
def add_community_timeout(slug):
    """
    Temporary Pond Timeout: Mutes a disruptive user from posting in this specific community
    for 24 hours, 7 days, or Permanently without deanonymizing who they are.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    clean_slug = normalize_community_slug(slug)
    if not is_user_community_moderator(user.id, clean_slug, auth_client):
        return jsonify({"error": "Only community moderators can mute users."}), 403

    data = request.get_json(silent=True) or {}
    target_user_id = data.get("target_user_id")
    target_username = normalize_username(data.get("username"))
    duration = data.get("duration", "24h")  # "24h", "7d", "permanent"
    reason = data.get("reason", "").strip() or "Violating community safety guidelines"

    # Resolve target user from username if ID not passed
    if not target_user_id and target_username:
        for c in FALLBACK_COMMUNITIES.values():
            for m in c.get("members", []):
                if m.get("username", "").lower() == target_username.lower():
                    target_user_id = m.get("user_id")
                    break
            if target_user_id:
                break

    if not target_user_id:
        target_user_id = f"anon-user-{uuid.uuid4().hex[:8]}"

    if not target_username:
        target_username = f"Student_{str(target_user_id)[:6]}"

    # Cannot mute creator
    fb = FALLBACK_COMMUNITIES.get(clean_slug)
    if fb and same_id(fb.get("creator_id"), target_user_id):
        return jsonify({"error": "The community creator cannot be timed out."}), 400

    now = datetime.now(timezone.utc)
    expires_at = None
    if duration == "24h":
        expires_at = (now + timedelta(hours=24)).isoformat()
    elif duration == "7d":
        expires_at = (now + timedelta(days=7)).isoformat()
    elif duration == "permanent":
        expires_at = None
    else:
        expires_at = (now + timedelta(hours=24)).isoformat()

    timeout_record = {
        "id": str(uuid.uuid4()),
        "user_id": str(target_user_id),
        "username": target_username,
        "duration": duration,
        "reason": reason,
        "created_at": now.isoformat(),
        "expires_at": expires_at
    }

    st = get_or_create_community_settings(clean_slug)
    st["timeouts"] = [t for t in st.get("timeouts", []) if not same_id(t.get("user_id"), target_user_id)]
    st["timeouts"].append(timeout_record)

    # Persist timeout to database if available
    try:
        if auth_client and re.match(r"^[0-9a-fA-F-]{36}$", str(target_user_id)):
            c_res = auth_client.table("communities").select("id").ilike("slug", clean_slug).limit(1).execute()
            if c_res.data:
                cid = c_res.data[0]["id"]
                # Write to community_mutes (and community_timeouts for backward compatibility)
                try:
                    auth_client.table("community_mutes").upsert({
                        "community_id": cid,
                        "user_id": target_user_id,
                        "muted_by": user.id,
                        "expires_at": expires_at,
                        "is_permanent": (duration == "permanent"),
                        "reason": reason
                    }, on_conflict="community_id,user_id").execute()
                except Exception:
                    pass

                try:
                    auth_client.table("community_timeouts").upsert({
                        "community_id": cid,
                        "user_id": target_user_id,
                        "duration": duration,
                        "reason": reason,
                        "expires_at": expires_at
                    }, on_conflict="community_id,user_id").execute()
                except Exception:
                    pass
    except Exception as dbe:
        print("Database community timeout notice:", dbe)

    return jsonify({
        "message": f"u/{target_username} is now in pond timeout ({duration}).",
        "timeout": timeout_record,
        "timeouts": st["timeouts"]
    }), 201


@app.route("/api/communities/<path:slug>/timeouts/<timeout_id>", methods=["DELETE"])
def remove_community_timeout(slug, timeout_id):
    """Unmutes a student and removes their active timeout."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    clean_slug = normalize_community_slug(slug)
    if not is_user_community_moderator(user.id, clean_slug, auth_client):
        return jsonify({"error": "Only community moderators can unmute students."}), 403

    st = get_or_create_community_settings(clean_slug)
    st["timeouts"] = [t for t in st.get("timeouts", []) if str(t.get("id")) != str(timeout_id)]

    try:
        if auth_client and re.match(r"^[0-9a-fA-F-]{36}$", str(timeout_id)):
            try:
                auth_client.table("community_mutes").delete().eq("id", timeout_id).execute()
            except Exception:
                pass
            try:
                auth_client.table("community_timeouts").delete().eq("id", timeout_id).execute()
            except Exception:
                pass
    except Exception as dbe:
        print("Database remove timeout notice:", dbe)

    return jsonify({
        "message": "User has been unmuted.",
        "timeouts": st["timeouts"]
    }), 200


@app.route("/api/communities/<path:slug>/posts/<post_id>/restore", methods=["POST"])
def restore_community_post(slug, post_id):
    """Restores an auto-hidden post back to the community feed."""
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    clean_slug = normalize_community_slug(slug)
    if not is_user_community_moderator(user.id, clean_slug, auth_client):
        return jsonify({"error": "Only community moderators can restore posts."}), 403

    try:
        if auth_client:
            auth_client.table("posts").update({"is_hidden": False}).eq("id", post_id).execute()
        return jsonify({"message": "Post restored to community feed.", "is_hidden": False}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/communities/<path:slug>/posts/<post_id>/pin", methods=["POST"])
def toggle_pin_community_post(slug, post_id):
    """
    Pins or unpins an announcement post at the top of the community feed.
    Enforces a strict maximum of 2 pinned announcements per community.
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    clean_slug = normalize_community_slug(slug)
    if not is_user_community_moderator(user.id, clean_slug, auth_client):
        return jsonify({"error": "Only community moderators can pin announcements."}), 403

    st = get_or_create_community_settings(clean_slug)
    pinned_list = st.setdefault("pinned_post_ids", [])
    str_pid = str(post_id)

    if str_pid in pinned_list:
        pinned_list.remove(str_pid)
        is_pinned = False
    else:
        if len(pinned_list) >= 2:
            return jsonify({
                "error": "You can pin up to 2 announcements only. Please unpin an existing announcement first."
            }), 400
        pinned_list.append(str_pid)
        is_pinned = True

    # Persist directly to Supabase
    try:
        if auth_client:
            now_iso = datetime.now(timezone.utc).isoformat() if is_pinned else None
            auth_client.table("posts").update({
                "is_pinned": is_pinned,
                "pinned_at": now_iso
            }).eq("id", str_pid).execute()
            auth_client.table("communities").update({"pinned_post_ids": pinned_list}).ilike("slug", clean_slug).execute()
    except Exception as dbe:
        print("Database pin post notice:", dbe)

    return jsonify({
        "message": "Announcement pinned to top of feed!" if is_pinned else "Announcement unpinned.",
        "is_pinned": is_pinned,
        "pinned_post_ids": pinned_list
    }), 200


@app.route("/api/communities", methods=["POST"])
def create_community():
    """
    Creates a new student community with strict safety & anti-deanonymization checks.
    Automatically assigns creator as member with the MODERATOR role by default.
    Initial member count is exactly 1 (the creator/moderator).
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    data = request.get_json(silent=True) or {}
    raw_slug = data.get("slug") or data.get("name") or ""
    slug_input = normalize_community_slug(raw_slug)
    name = (data.get("name") or slug_input).strip()
    description = (data.get("description") or "").strip()
    category = (data.get("category") or "Campus Life").strip()

    is_valid, error_msg, clean_slug = validate_community(
        name=name,
        slug=slug_input,
        description=description,
        category=category
    )

    if not is_valid:
        return jsonify({"error": error_msg}), 400

    creator_username = "Creator"
    creator_cv_id = "CV-0001"
    try:
        p_res = auth_client.table("profiles").select("username, campus_voice_id").eq("id", user.id).limit(1).execute()
        if p_res.data:
            creator_username = p_res.data[0].get("username") or creator_username
            creator_cv_id = p_res.data[0].get("campus_voice_id") or creator_cv_id
    except Exception:
        pass

    creator_uid = str(user.id)
    comm_id = str(uuid.uuid4())

    new_comm = {
        "id": comm_id,
        "name": name,
        "slug": clean_slug,
        "description": description,
        "category": category,
        "creator_id": creator_uid,
        "member_count": 1,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_member": True,
        "is_moderator": True,
        "members": [
            {
                "user_id": creator_uid,
                "username": creator_username,
                "campus_voice_id": creator_cv_id,
                "role": "moderator",
                "is_creator": True,
                "joined_at": datetime.now(timezone.utc).isoformat()
            }
        ]
    }

    # Store in fallback store
    FALLBACK_COMMUNITIES[clean_slug] = new_comm
    st = get_or_create_community_settings(clean_slug, name, description)
    new_comm["icon_emoji"] = st.get("icon_emoji", "💬")
    new_comm["banner_color"] = st.get("banner_color")
    new_comm["rules"] = st.get("rules", [])

    # Try saving to Supabase
    try:
        client = auth_client or supabase
        comm_res = client.table("communities").insert({
            "name": name,
            "slug": clean_slug,
            "description": description,
            "category": category,
            "creator_id": user.id,
            "member_count": 1
        }).execute()
        if comm_res.data:
            db_comm = comm_res.data[0]
            new_comm["id"] = db_comm["id"]
            try:
                client.table("community_members").upsert({
                    "community_id": db_comm["id"],
                    "user_id": user.id,
                    "role": "moderator"
                }, on_conflict="community_id,user_id").execute()
            except Exception as e_mem:
                print("community_members upsert notice:", e_mem)
                try:
                    supabase.table("community_members").upsert({
                        "community_id": db_comm["id"],
                        "user_id": user.id,
                        "role": "moderator"
                    }, on_conflict="community_id,user_id").execute()
                except Exception:
                    pass
    except Exception as e:
        print("Supabase create community notice:", str(e))
        try:
            comm_res = supabase.table("communities").insert({
                "name": name,
                "slug": clean_slug,
                "description": description,
                "category": category,
                "creator_id": user.id,
                "member_count": 1
            }).execute()
            if comm_res.data:
                db_comm = comm_res.data[0]
                new_comm["id"] = db_comm["id"]
                supabase.table("community_members").upsert({
                    "community_id": db_comm["id"],
                    "user_id": user.id,
                    "role": "moderator"
                }, on_conflict="community_id,user_id").execute()
        except Exception as e2:
            print("Supabase fallback create community notice:", str(e2))

    return jsonify({
        "message": f"Community c/{clean_slug} created successfully! You are the community moderator.",
        "community": new_comm
    }), 201


@app.route("/api/communities/<path:identifier>/join", methods=["POST"])
def toggle_join_community(identifier):
    """
    Toggles join/leave membership in a community.
    Calculates member_count accurately as len(members).
    """
    auth_client, user = get_authenticated_client()
    if not user:
        return jsonify({"error": "Please log in first."}), 401

    clean_id = normalize_community_slug(identifier)

    user_name = "Student"
    user_cvid = "CV-ID"
    try:
        p_res = auth_client.table("profiles").select("username, campus_voice_id").eq("id", user.id).limit(1).execute()
        if p_res.data:
            user_name = p_res.data[0].get("username") or user_name
            user_cvid = p_res.data[0].get("campus_voice_id") or user_cvid
    except Exception:
        pass

    # Try database toggle first
    try:
        comm = None
        if re.match(r"^[0-9a-fA-F-]{36}$", clean_id):
            res = auth_client.table("communities").select("id, slug, name, member_count, creator_id").eq("id", clean_id).limit(1).execute()
            if res.data:
                comm = res.data[0]

        if not comm:
            res = auth_client.table("communities").select("id, slug, name, member_count, creator_id").eq("slug", clean_id).limit(1).execute()
            if res.data:
                comm = res.data[0]

        if comm:
            comm_id = comm["id"]
            m_res = auth_client.table("community_members").select("id").eq("community_id", comm_id).eq("user_id", user.id).limit(1).execute()

            if m_res.data:
                auth_client.table("community_members").delete().eq("id", m_res.data[0]["id"]).execute()
                new_count = max(0, (comm.get("member_count") or 1) - 1)
                try:
                    auth_client.table("communities").update({"member_count": new_count}).eq("id", comm_id).execute()
                except Exception:
                    pass
                return jsonify({
                    "message": f"Left c/{comm['slug']}",
                    "joined": False,
                    "member_count": new_count
                }), 200
            else:
                is_creator = same_id(user.id, comm.get("creator_id"))
                role_val = "moderator" if is_creator else "member"
                auth_client.table("community_members").insert({
                    "community_id": comm_id,
                    "user_id": user.id,
                    "role": role_val
                }).execute()
                new_count = (comm.get("member_count") or 0) + 1
                try:
                    auth_client.table("communities").update({"member_count": new_count}).eq("id", comm_id).execute()
                except Exception:
                    pass
                return jsonify({
                    "message": f"Joined c/{comm['slug']}",
                    "joined": True,
                    "member_count": new_count
                }), 200
    except Exception as e:
        print("Toggle join community DB notice:", str(e))

    # Fallback store toggle
    fb = FALLBACK_COMMUNITIES.get(clean_id) or next(
        (v for v in FALLBACK_COMMUNITIES.values() if normalize_community_slug(v["slug"]) == clean_id),
        None
    )
    if fb:
        is_creator = same_id(user.id, fb.get("creator_id"))
        existing_idx = next((i for i, m in enumerate(fb.get("members", [])) if same_id(m["user_id"], user.id)), None)

        if existing_idx is not None:
            # Leave
            fb["members"].pop(existing_idx)
            fb["member_count"] = len(fb["members"])
            return jsonify({
                "message": f"Left c/{fb['slug']}",
                "joined": False,
                "member_count": fb["member_count"]
            }), 200
        else:
            # Join
            role_val = "moderator" if is_creator else "member"
            fb.setdefault("members", []).append({
                "user_id": str(user.id),
                "username": user_name,
                "campus_voice_id": user_cvid,
                "role": role_val,
                "is_creator": is_creator,
                "joined_at": datetime.now(timezone.utc).isoformat()
            })
            fb["member_count"] = len(fb["members"])
            return jsonify({
                "message": f"Joined c/{fb['slug']}",
                "joined": True,
                "member_count": fb["member_count"]
            }), 200

    return jsonify({"error": "Community not found."}), 404



if __name__ == "__main__":
    app.run(debug=True, port=5000)
