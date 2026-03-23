# ── Point event types ─────────────────────────────────────────────────────────
# Each constant is a (event_type_key, point_delta) pair. Negative deltas are
# used when an action is rescinded (req. 1.7.1.3).

STORY_PUBLISHED = 'story_published'
STORY_REMOVED = 'story_removed'        # story removed by moderation (reverses STORY_PUBLISHED)

STORY_LIKED = 'story_liked'
STORY_LIKE_REMOVED = 'story_like_removed'

STORY_COMMENTED = 'story_commented'
STORY_COMMENT_REMOVED = 'story_comment_removed'

STORY_SAVED = 'story_saved'
STORY_SAVE_REMOVED = 'story_save_removed'

# ── Point values (req. 1.7.1) ─────────────────────────────────────────────────
POINT_VALUES = {
    STORY_PUBLISHED: 50,
    STORY_REMOVED: -50,
    STORY_LIKED: 2,
    STORY_LIKE_REMOVED: -2,
    STORY_COMMENTED: 4,
    STORY_COMMENT_REMOVED: -4,
    STORY_SAVED: 3,
    STORY_SAVE_REMOVED: -3,
}

# ── Badge criteria types ───────────────────────────────────────────────────────
BADGE_CRITERIA_REGISTRATION = 'registration'
BADGE_CRITERIA_STORIES_PUBLISHED = 'stories_published'
BADGE_CRITERIA_POINTS_TOTAL = 'points_total'

# ── Badge thresholds (req. 1.7.2) ─────────────────────────────────────────────
STORY_BADGE_THRESHOLDS = [1, 3, 5, 10, 50]
POINTS_BADGE_THRESHOLDS = [50, 100, 200, 500, 1000]
