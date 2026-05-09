import { Button } from "@/components/ui/button";

/**
 * Simple paginator for DRF-style { count, next, previous } responses.
 * Page numbers are 1-based. Renders nothing when there is only one page.
 */
function Pagination({ page, count, pageSize, onPageChange, disabled = false }) {
  const totalPages = count > 0 ? Math.ceil(count / pageSize) : 1;
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({count} total)
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default Pagination;
