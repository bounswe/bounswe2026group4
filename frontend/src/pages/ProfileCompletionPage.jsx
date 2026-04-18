import { useState, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { MapPin, User, Calendar, Camera, Loader2 } from "lucide-react";

import {
  Button,
  Input,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui";
import { updateCurrentUser } from "@/services/userService";
import { useToast } from "@/hooks/useToast";

const INITIAL_ERRORS = {
  first_name: "",
  last_name: "",
  location: "",
  birth_date: "",
  bio: "",
  profile_photo: "",
};

function validateBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Date must be in YYYY-MM-DD format.";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "Enter a valid date.";
  return "";
}

function ProfileCompletionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [locationVal, setLocationVal] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bio, setBio] = useState("");
  const [isUsernamePublic, setIsUsernamePublic] = useState(true);
  const [isNamePublic, setIsNamePublic] = useState(true);
  const [isLocationPublic, setIsLocationPublic] = useState(true);
  const [isBirthDatePublic, setIsBirthDatePublic] = useState(false);
  const [isPhotoPublic, setIsPhotoPublic] = useState(true);
  const [fieldErrors, setFieldErrors] = useState(INITIAL_ERRORS);
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function clearFieldError(field) {
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFieldErrors((prev) => ({ ...prev, profile_photo: "Please upload a valid image file." }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, profile_photo: "" }));
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function validateForm() {
    const errors = { ...INITIAL_ERRORS };
    let valid = true;

    if (!firstName.trim()) {
      errors.first_name = "Name is required.";
      valid = false;
    }
    if (!lastName.trim()) {
      errors.last_name = "Surname is required.";
      valid = false;
    }
    if (locationVal.length > 255) {
      errors.location = "Location cannot exceed 255 characters.";
      valid = false;
    }
    if (birthDate) {
      const dateErr = validateBirthDate(birthDate);
      if (dateErr) {
        errors.birth_date = dateErr;
        valid = false;
      }
    }

    setFieldErrors(errors);
    return valid;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");
    if (!validateForm()) return;

    const profile = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      is_name_public: isNamePublic,
      is_location_public: isLocationPublic,
      is_birth_date_public: isBirthDatePublic,
      is_photo_public: isPhotoPublic,
    };
    if (locationVal.trim()) profile.location = locationVal.trim();
    if (birthDate) profile.birth_date = birthDate;
    if (bio.trim()) profile.bio = bio.trim();

    setIsLoading(true);
    try {
      await updateCurrentUser({
        profile,
        userFields: { is_username_public: isUsernamePublic },
        profilePhoto: photoFile || undefined,
      });
      toast.success("Profile completed! Welcome aboard!");
      const from = location.state?.from;
      navigate(
        from ? { pathname: from.pathname, search: from.search, hash: from.hash } : "/",
        { replace: true }
      );
    } catch (error) {
      const data = error.response?.data;
      const profileErrors = data?.errors?.profile;
      if (profileErrors) {
        const mapped = { ...INITIAL_ERRORS };
        for (const [key, val] of Object.entries(profileErrors)) {
          if (key in mapped) {
            mapped[key] = Array.isArray(val) ? val[0] : val;
          }
        }
        setFieldErrors(mapped);
      } else {
        setApiError(data?.message || data?.detail || "Failed to save profile. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const skipTo = location.state?.from;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-bold">Local History Story Map</CardTitle>
          </div>
          <CardDescription>Complete your profile to get started</CardDescription>
        </CardHeader>

        <CardContent>
          {apiError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Required Information
            </p>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="first_name">
                Name <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="first_name"
                  type="text"
                  placeholder="Your name"
                  className="pl-9"
                  autoComplete="given-name"
                  aria-invalid={!!fieldErrors.first_name}
                  aria-describedby={fieldErrors.first_name ? "first_name-error" : undefined}
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (fieldErrors.first_name) clearFieldError("first_name");
                  }}
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.first_name && (
                <p id="first_name-error" className="text-sm text-destructive">{fieldErrors.first_name}</p>
              )}
            </div>

            {/* Surname */}
            <div className="space-y-2">
              <Label htmlFor="last_name">
                Surname <span className="text-destructive" aria-hidden="true">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="last_name"
                  type="text"
                  placeholder="Your surname"
                  className="pl-9"
                  autoComplete="family-name"
                  aria-invalid={!!fieldErrors.last_name}
                  aria-describedby={fieldErrors.last_name ? "last_name-error" : undefined}
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (fieldErrors.last_name) clearFieldError("last_name");
                  }}
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.last_name && (
                <p id="last_name-error" className="text-sm text-destructive">{fieldErrors.last_name}</p>
              )}
            </div>

            {/* Name & username visibility */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNamePublic}
                  onChange={(e) => setIsNamePublic(e.target.checked)}
                  disabled={isLoading}
                  aria-label="Show name publicly"
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Show name publicly
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUsernamePublic}
                  onChange={(e) => setIsUsernamePublic(e.target.checked)}
                  disabled={isLoading}
                  aria-label="Show username publicly"
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Show username publicly
              </label>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Optional Information
            </p>

            {/* Profile Photo */}
            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <div className="flex items-center gap-3">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Profile preview"
                    className="h-16 w-16 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border border-border">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="space-y-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Upload profile photo"
                    onChange={handlePhotoChange}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    {photoFile ? "Change photo" : "Upload photo"}
                  </Button>
                  {photoFile && (
                    <p className="text-xs text-muted-foreground">{photoFile.name}</p>
                  )}
                </div>
              </div>
              {fieldErrors.profile_photo && (
                <p className="text-sm text-destructive">{fieldErrors.profile_photo}</p>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPhotoPublic}
                  onChange={(e) => setIsPhotoPublic(e.target.checked)}
                  disabled={isLoading}
                  aria-label="Show profile photo publicly"
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Show profile photo publicly
              </label>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="location"
                  type="text"
                  placeholder="e.g. Istanbul, Turkey"
                  className="pl-9"
                  autoComplete="address-level2"
                  aria-invalid={!!fieldErrors.location}
                  value={locationVal}
                  onChange={(e) => {
                    setLocationVal(e.target.value);
                    if (fieldErrors.location) clearFieldError("location");
                  }}
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.location && (
                <p className="text-sm text-destructive">{fieldErrors.location}</p>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLocationPublic}
                  onChange={(e) => setIsLocationPublic(e.target.checked)}
                  disabled={isLoading}
                  aria-label="Show location publicly"
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Show location publicly
              </label>
            </div>

            {/* Birth Date */}
            <div className="space-y-2">
              <Label htmlFor="birth_date">Birth Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="birth_date"
                  type="date"
                  className="pl-9"
                  aria-invalid={!!fieldErrors.birth_date}
                  aria-describedby={fieldErrors.birth_date ? "birth_date-error" : undefined}
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    if (fieldErrors.birth_date) clearFieldError("birth_date");
                  }}
                  disabled={isLoading}
                />
              </div>
              {fieldErrors.birth_date && (
                <p id="birth_date-error" className="text-sm text-destructive">{fieldErrors.birth_date}</p>
              )}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBirthDatePublic}
                  onChange={(e) => setIsBirthDatePublic(e.target.checked)}
                  disabled={isLoading}
                  aria-label="Show birth date publicly"
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Show birth date publicly
              </label>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea
                id="bio"
                placeholder="Tell us about yourself..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={isLoading}
              />
              {fieldErrors.bio && (
                <p className="text-sm text-destructive">{fieldErrors.bio}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving profile...
                </>
              ) : (
                "Complete Profile"
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            <Link
              to={skipTo ? `${skipTo.pathname}${skipTo.search || ""}${skipTo.hash || ""}` : "/"}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Skip for now
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default ProfileCompletionPage;
