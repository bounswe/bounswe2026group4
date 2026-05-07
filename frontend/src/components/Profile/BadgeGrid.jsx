import { useState, useEffect, useCallback, useRef } from "react";
import { Award, BookOpen, Star, Trophy } from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getUserBadges } from "@/services/userService";
import { cn } from "@/lib/utils";

const ICON_CLASS = "h-5 w-5";

function BadgeIcon({ criteriaType }) {
  switch (criteriaType) {
    case "registration":
      return <Award className={ICON_CLASS} data-icon="Award" aria-hidden="true" />;
    case "story_count":
      return <BookOpen className={ICON_CLASS} data-icon="BookOpen" aria-hidden="true" />;
    case "points":
      return <Star className={ICON_CLASS} data-icon="Star" aria-hidden="true" />;
    default:
      return <Trophy className={ICON_CLASS} data-icon="Trophy" aria-hidden="true" />;
  }
}

function BadgeCard({ entry }) {
  const { badge } = entry;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="badge-card"
          data-criteria={badge.criteria_type}
          className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BadgeIcon criteriaType={badge.criteria_type} />
          </span>
          <span className="text-xs font-medium leading-tight">
            {badge.name}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{badge.description}</TooltipContent>
    </Tooltip>
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
    <div
      className={cn(
        "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6",
        className
      )}
    >
      {badges.map((entry) => (
        <BadgeCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export default BadgeGrid;
