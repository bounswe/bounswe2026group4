import * as React from "react";

import { cn } from "@/lib/utils";

const Skeleton = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("animate-pulse rounded-md bg-muted", className)}
    aria-hidden="true"
    {...props}
  />
));
Skeleton.displayName = "Skeleton";

const SkeletonCard = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-3", className)} {...props}>
    <Skeleton className="h-48 w-full rounded-xl" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
  </div>
));
SkeletonCard.displayName = "SkeletonCard";

const SkeletonPage = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-4 p-6", className)} {...props}>
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
    <Skeleton className="h-4 w-4/6" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  </div>
));
SkeletonPage.displayName = "SkeletonPage";

// Named alias matching the acceptance criteria
const LoadingSkeleton = Skeleton;

export { Skeleton, SkeletonCard, SkeletonPage, LoadingSkeleton };
