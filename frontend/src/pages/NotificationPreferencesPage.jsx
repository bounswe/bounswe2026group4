import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { SkeletonPage } from "@/components/ui/loading-skeleton";
import { useToast } from "@/hooks/useToast";
import {
  getPreferences,
  updatePreferences,
} from "@/services/notificationService";
import { NOTIFICATION_TYPES } from "@/utils/notificationFormat";

function ToggleRow({ id, label, description, checked, disabled, onChange }) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start justify-between gap-4 rounded-md border p-4 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 cursor-pointer accent-primary"
      />
    </label>
  );
}

function NotificationPreferencesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [muted, setMuted] = useState(false);
  const [prefs, setPrefs] = useState({});
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getPreferences();
        if (cancelled) return;
        setMuted(Boolean(data?.notifications_muted));
        setPrefs(data?.preferences ?? {});
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.response?.data?.detail ||
              err?.message ||
              "Failed to load preferences."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(key, payload, optimistic) {
    const previous = { muted, prefs };
    optimistic();
    setSavingKey(key);
    try {
      const data = await updatePreferences(payload);
      setMuted(Boolean(data?.notifications_muted));
      setPrefs(data?.preferences ?? {});
    } catch (err) {
      setMuted(previous.muted);
      setPrefs(previous.prefs);
      toast.error(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to save preference."
      );
    } finally {
      setSavingKey(null);
    }
  }

  function handleToggleType(typeKey, checked) {
    persist(typeKey, { [typeKey]: checked }, () => {
      setPrefs((p) => ({ ...p, [typeKey]: checked }));
    });
  }

  function handleToggleMuted(checked) {
    persist("__muted__", { notifications_muted: checked }, () => {
      setMuted(checked);
    });
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <SkeletonPage />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <ErrorState message={error} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground"
          >
            <Link to="/profile">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
              Back to profile
            </Link>
          </Button>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Notification preferences</h1>
            <p className="text-sm text-muted-foreground">
              Choose which events trigger an in-app notification.
            </p>
          </div>
          {savingKey && (
            <Loader2
              className="ml-auto h-4 w-4 animate-spin text-muted-foreground"
              aria-label="Saving"
            />
          )}
        </div>

        <section className="mb-6">
          <ToggleRow
            id="pref-muted"
            label="Stop all notifications"
            description="Mute every notification type. Turn this off to use the per-type toggles below."
            checked={muted}
            onChange={handleToggleMuted}
          />
        </section>

        <section aria-label="Per-type preferences" className="space-y-3">
          {NOTIFICATION_TYPES.map(({ key, label }) => (
            <ToggleRow
              key={key}
              id={`pref-${key}`}
              label={label}
              checked={prefs[key] !== false}
              disabled={muted}
              onChange={(checked) => handleToggleType(key, checked)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

export default NotificationPreferencesPage;
