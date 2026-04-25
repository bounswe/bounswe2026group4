import { cn } from "@/lib/utils";

function VisibilityToggle({ checked, onChange, fieldLabel = "" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground select-none">
        {checked ? "Public" : "Private"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${fieldLabel} visibility`}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

export default VisibilityToggle;
