import { useState, useEffect, useCallback } from "react";
import { Award, BookOpen, Loader2, Star, Trophy } from "lucide-react";

import { ErrorState } from "@/components/ui/error-state";
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
        <div
          data-testid="badge-card"
          data-criteria={badge.criteria_type}
          tabIndex={0}
          className="flex flex-col items-center gap-2 rounded-lg border bg-card p-3 text-center shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BadgeIcon criteriaType={badge.criteria_type} />
          </span>
          <span className="text-xs font-medium leading-tight">
            {badge.name}
          </span>
          <span className="sr-only">{badge.description}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{badge.description}</TooltipContent>
    </Tooltip>
  );
}

function BadgeGrid({ userId, className }) {
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBadges = useCallback(async () => {
    if (userId == null) return;
    setLoading(true);
    setError(null);
    try {
      const results = await getUserBadges(userId);
      setBadges(Array.isArray(results) ? results : []);
    } catch {
      setError("Failed to load badges. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  if (loading) {
    return (
      <div
        className={cn("flex items-center justify-center py-8", className)}
        aria-busy="true"
        aria-label="Loading badges"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={fetchBadges} className={className} />;
  }

  if (badges.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 py-8 text-muted-foreground",
          className
        )}
      >
        <Trophy className="h-7 w-7" aria-hidden="true" />
        <p className="text-sm">No badges earned yet.</p>
      </div>
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
