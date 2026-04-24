import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/useToast";
import {
  updateProfile,
  uploadProfilePhoto,
  removeProfilePhoto,
} from "@/services/userService";
import PhotoUpload from "@/components/Profile/PhotoUpload";
import VisibilityToggle from "@/components/Profile/VisibilityToggle";

const MAX_BIO_LENGTH = 500;

function EditProfileForm({ initialProfile, onSave, onCancel }) {
  const { toast } = useToast();
  const p = initialProfile?.profile ?? {};

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [username, setUsername] = useState(() => initialProfile?.username ?? "");
  const [firstName, setFirstName] = useState(() => p.first_name ?? "");
  const [lastName, setLastName] = useState(() => p.last_name ?? "");
  const [location, setLocation] = useState(() => p.location ?? "");
  const [bio, setBio] = useState(() => p.bio ?? "");
  const [birthDate, setBirthDate] = useState(() => p.birth_date ?? "");

  const [isNamePublic, setIsNamePublic] = useState(() => p.is_name_public ?? true);
  const [isLocationPublic, setIsLocationPublic] = useState(() => p.is_location_public ?? true);
  const [isBirthDatePublic, setIsBirthDatePublic] = useState(() => p.is_birth_date_public ?? true);
  const [isPhotoPublic, setIsPhotoPublic] = useState(() => p.is_photo_public ?? true);

  const currentPhotoUrl = p.profile_photo ?? null;
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const [shouldRemovePhoto, setShouldRemovePhoto] = useState(false);

  function handlePhotoFileChange(file, error) {
    if (error) {
      setPhotoError(error);
      setNewPhotoFile(null);
      setNewPhotoPreview(null);
      return;
    }
    setPhotoError(null);
    setNewPhotoFile(file);
    setShouldRemovePhoto(false);
    setNewPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleRemovePhoto() {
    setNewPhotoFile(null);
    setNewPhotoPreview(null);
    setShouldRemovePhoto(true);
    setPhotoError(null);
  }

  function validate() {
    const errs = {};
    if (!username.trim()) errs.username = "Username is required.";
    if (bio.length > MAX_BIO_LENGTH) {
      errs.bio = `Bio must be ${MAX_BIO_LENGTH} characters or fewer.`;
    }
    if (birthDate) {
      const d = new Date(birthDate);
      if (d > new Date()) errs.birthDate = "Birth date cannot be in the future.";
      else if (d < new Date("1900-01-01")) errs.birthDate = "Birth date cannot be before 1900.";
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      if (shouldRemovePhoto) {
        await removeProfilePhoto();
      } else if (newPhotoFile) {
        await uploadProfilePhoto(newPhotoFile);
      }

      await updateProfile(
        { username: username.trim() },
        {
          first_name: firstName,
          last_name: lastName,
          location,
          bio,
          birth_date: birthDate || null,
          is_name_public: isNamePublic,
          is_location_public: isLocationPublic,
          is_birth_date_public: isBirthDatePublic,
          is_photo_public: isPhotoPublic,
        }
      );

      toast.success("Profile updated successfully.");
      onSave();
    } catch (err) {
      const message =
        err?.response?.data?.detail ?? err?.message ?? "Failed to save profile.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const displayPhotoUrl = newPhotoPreview ?? (shouldRemovePhoto ? null : currentPhotoUrl);

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Edit profile" className="space-y-6">
      {/* Photo */}
      <div className="flex items-start justify-between gap-4">
        <PhotoUpload
          photoUrl={displayPhotoUrl}
          onFileChange={handlePhotoFileChange}
          onRemove={handleRemovePhoto}
          error={photoError}
        />
        <VisibilityToggle
          checked={isPhotoPublic}
          onChange={setIsPhotoPublic}
          fieldLabel="Photo"
        />
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <Label htmlFor="edit-username">Username</Label>
        <Input
          id="edit-username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setErrors((p) => ({ ...p, username: undefined }));
          }}
          placeholder="username"
        />
        {errors.username && (
          <p className="text-sm text-destructive" role="alert">{errors.username}</p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Name</Label>
          <VisibilityToggle
            checked={isNamePublic}
            onChange={setIsNamePublic}
            fieldLabel="Name"
          />
        </div>
        <div className="flex gap-2">
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            aria-label="First name"
          />
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            aria-label="Last name"
          />
        </div>
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="edit-location">Location</Label>
          <VisibilityToggle
            checked={isLocationPublic}
            onChange={setIsLocationPublic}
            fieldLabel="Location"
          />
        </div>
        <Input
          id="edit-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City, Country"
        />
      </div>

      {/* Birth date */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="edit-birth-date">Birth date</Label>
          <VisibilityToggle
            checked={isBirthDatePublic}
            onChange={setIsBirthDatePublic}
            fieldLabel="Birth date"
          />
        </div>
        <Input
          id="edit-birth-date"
          type="date"
          value={birthDate}
          onChange={(e) => {
            setBirthDate(e.target.value);
            setErrors((p) => ({ ...p, birthDate: undefined }));
          }}
          max={new Date().toISOString().split("T")[0]}
          min="1900-01-01"
        />
        {errors.birthDate && (
          <p className="text-sm text-destructive" role="alert">{errors.birthDate}</p>
        )}
      </div>

      {/* Bio — no privacy flag in backend; bio is always public */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="edit-bio">Bio</Label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {bio.length}/{MAX_BIO_LENGTH}
            </span>
            <span className="text-xs text-muted-foreground italic">Always public</span>
          </div>
        </div>
        <textarea
          id="edit-bio"
          value={bio}
          onChange={(e) => {
            setBio(e.target.value);
            setErrors((p) => ({ ...p, bio: undefined }));
          }}
          placeholder="Tell us about yourself…"
          rows={4}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        {errors.bio && (
          <p className="text-sm text-destructive" role="alert">{errors.bio}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

export default EditProfileForm;
