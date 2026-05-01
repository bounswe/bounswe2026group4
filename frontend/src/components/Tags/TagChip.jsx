import React from "react";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getTagColorClass } from "@/utils/tagUtils";

const TagChip = React.forwardRef(({ tag, onRemove, className }, ref) => {
  const colorClass = getTagColorClass(tag.name);
  const base = cn(
    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
    colorClass,
    className
  );

  if (onRemove) {
    return (
      <span ref={ref} className={base}>
        {tag.name}
        <button
          type="button"
          onClick={() => onRemove(tag)}
          aria-label={`Remove ${tag.name}`}
          className="rounded-full hover:opacity-70"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      </span>
    );
  }

  return (
    <Link
      ref={ref}
      to={`/tags/${tag.name}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(base, "hover:opacity-80 transition-opacity")}
    >
      {tag.name}
    </Link>
  );
});

TagChip.displayName = "TagChip";

export default TagChip;
