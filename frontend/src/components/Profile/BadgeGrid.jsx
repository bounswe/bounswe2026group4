import { useState, useEffect, useCallback, useRef } from "react";
import { Award, BookOpen, Star, Trophy } from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { getUserBadges } from "@/services/userService";
import { cn } from "@/lib/utils";

const ICON_CLASS = "h-5 w-5";

// Per-criteria visual treatment. Tuned to match the mobile palette in PR #569
// so the same award reads as the same colour on web and mobile.
const BADGE_VARIANTS = {
  registration: {
    Icon: Award,
    halo: "bg-blue-100 text-blue-700 ring-1 ring-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-900/60",
  },
  story_count: {
    Icon: BookOpen,
    halo: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900/60",
  },
  points: {
    Icon: Star,
    halo: "bg-amber-100 text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900/60",
  },
  default: {
    Icon: Trophy,
    halo: "bg-violet-100 text-violet-700 ring-1 ring-violet-200/80 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-900/60",
  },
};

function variantFor(criteriaType) {
  return BADGE_VARIANTS[criteriaType] ?? BADGE_VARIANTS.default;
}

function BadgeCard({ entry }) {
  const { badge } = entry;
  const variant = variantFor(badge.criteria_type);
  const Icon = variant.Icon;

  return (
    <li
      data-testid="badge-card"
      data-criteria={badge.criteria_type}
      className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center shadow-xs"
    >
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full",
          variant.halo
        )}
      >
        <Icon className={ICON_CLASS} aria-hidden="true" />
      </span>
      <span className="line-clamp-2 break-words text-xs font-medium leading-tight">
        {badge.name}
      </span>
      {badge.description && (
        <span className="line-clamp-2 break-words text-[11px] leading-snug text-muted-foreground">
          {badge.description}
        </span>
      )}
    </li>
  );
}

function BadgeGrid({ userId, className }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reqIdRef = useRef(0);

  const fetchBadges = useCallback(async () => {
    if (userId == null) return;
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const results = await getUserBadges(userId);
      if (reqIdRef.current === myReqId) {
        setBadges(Array.isArray(results) ? results : []);
      }
    } catch {
      if (reqIdRef.current === myReqId) {
        setError("Failed to load badges. Please try again.");
      }
    } finally {
      if (reqIdRef.current === myReqId) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  if (loading) {
    return (
      <LoadingSpinner
        size="sm"
        aria-label="Loading badges"
        className={cn("py-8", className)}
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={fetchBadges}
        className={className}
      />
    );
  }

  if (badges.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No badges yet"
        message="Badges will appear here as you earn them."
        className={className}
      />
    );
  }

  return (
    <ul
      aria-label="Earned badges"
      className={cn(
        "grid list-none grid-cols-3 gap-3 p-0 sm:grid-cols-4 md:grid-cols-6",
        className
      )}
    >
      {badges.map((entry) => (
        <BadgeCard key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}

export default BadgeGrid;
