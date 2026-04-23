import { useRef } from "react";
import { Camera, X, User } from "lucide-react";

import { Button } from "@/components/ui/button";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"];
const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

function PhotoUpload({ photoUrl, onFileChange, onRemove, error }) {
  const fileInputRef = useRef(null);

  function handleInputChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      onFileChange(null, "Only JPG and PNG files are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      onFileChange(null, "Photo must be 2 MB or smaller.");
      e.target.value = "";
      return;
    }
    onFileChange(file, null);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Profile preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <User
              className="absolute inset-0 m-auto h-10 w-10 text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {photoUrl ? "Change photo" : "Upload photo"}
          </Button>

          {photoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
              Remove photo
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-1 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={handleInputChange}
        aria-label="Upload profile photo"
        data-testid="photo-file-input"
      />
    </div>
  );
}

export default PhotoUpload;
