import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, X } from "lucide-react";

import { Button, Input, Label } from "@/components/ui";
import MapPicker from "@/components/MapPicker/MapPicker";
import TagInput from "@/components/Tags/TagInput";
import VisibilityToggle from "@/components/Profile/VisibilityToggle";
import { createStory, uploadStoryImage, uploadStoryMedia } from "@/services/storyService";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";

const TIME_TYPES = [
  { value: "exact_year", label: "Exact Year" },
  { value: "approximate_year", label: "Approximate Year" },
  { value: "decade", label: "Decade" },
  { value: "year_range", label: "Year Range" },
  { value: "exact_date", label: "Specific Date" },
];

const MAX_TAGS = 3;
const MAX_IMAGES = 3;
const MAX_VIDEOS = 3;
const MAX_AUDIOS = 3;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm"];
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg"];

function SubmitStoryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [narrative, setNarrative] = useState("");
  const [location, setLocation] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [timeType, setTimeType] = useState("exact_year");
  const [year, setYear] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const [audioFiles, setAudioFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageError, setImageError] = useState("");
  const [videoError, setVideoError] = useState("");
  const [audioError, setAudioError] = useState("");
  // Default to anonymous if the user has a private profile (is_username_public=false)
  const [contributorVisible, setContributorVisible] = useState(
    () => user?.is_username_public !== false
  );

  const imagePreviewsRef = useRef([]);
  imagePreviewsRef.current = imagePreviews;

  useEffect(() => {
    return () => {
      imagePreviewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function validateForm() {
    const errors = {};
    if (!title.trim()) errors.title = "Title is required";
    if (!narrative.trim()) errors.narrative = "Narrative is required";
    if (!placeName.trim()) errors.placeName = "Place name is required";
    if (!location) errors.location = "Please select a location on the map";

    if (timeType === "year_range") {
      if (!yearStart.toString().trim()) errors.yearStart = "Start year is required";
      else if (isNaN(Number(yearStart))) errors.yearStart = "Start year must be a valid number";
      if (!yearEnd.toString().trim()) errors.yearEnd = "End year is required";
      else if (isNaN(Number(yearEnd))) errors.yearEnd = "End year must be a valid number";
      if (!errors.yearStart && !errors.yearEnd && Number(yearStart) >= Number(yearEnd)) {
        errors.yearStart = "Start year must be before end year";
      }
    } else if (timeType === "exact_date") {
      if (!dateValue.trim()) {
        errors.dateValue = "Date is required";
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        errors.dateValue = "Date must be in YYYY-MM-DD format";
      }
      if (timeValue && !/^\d{2}:\d{2}$/.test(timeValue)) {
        errors.timeValue = "Time must be in HH:MM format";
      }
    } else {
      if (!year.toString().trim()) errors.year = "Year is required";
      else if (isNaN(Number(year))) errors.year = "Year must be a valid number";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleImageChange(e) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    setImageError("");

    const newFiles = [];
    const newPreviews = [];
    let error = "";

    for (const file of selected) {
      if (imageFiles.length + newFiles.length >= MAX_IMAGES) {
        error = `You can upload at most ${MAX_IMAGES} images`;
        break;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        error = "Only JPG and PNG images are allowed";
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        error = "Each image must be smaller than 2MB";
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }

    if (error) setImageError(error);
    if (newFiles.length > 0) {
      setImageFiles((prev) => [...prev, ...newFiles]);
      setImagePreviews((prev) => [...prev, ...newPreviews]);
    }
  }

  function removeImage(idx) {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleVideoChange(e) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    setVideoError("");

    const newFiles = [];
    let error = "";

    for (const file of selected) {
      if (videoFiles.length + newFiles.length >= MAX_VIDEOS) {
        error = `You can upload at most ${MAX_VIDEOS} videos`;
        break;
      }
      if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
        error = "Only MP4 and WebM videos are allowed";
        continue;
      }
      if (file.size > MAX_VIDEO_SIZE) {
        error = "Each video must be smaller than 50MB";
        continue;
      }
      newFiles.push(file);
    }

    if (error) setVideoError(error);
    if (newFiles.length > 0) setVideoFiles((prev) => [...prev, ...newFiles]);
  }

  function removeVideo(idx) {
    setVideoFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAudioChange(e) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    setAudioError("");

    const newFiles = [];
    let error = "";

    for (const file of selected) {
      if (audioFiles.length + newFiles.length >= MAX_AUDIOS) {
        error = `You can upload at most ${MAX_AUDIOS} audio files`;
        break;
      }
      if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
        error = "Only MP3, WAV, and OGG audio files are allowed";
        continue;
      }
      if (file.size > MAX_AUDIO_SIZE) {
        error = "Each audio file must be smaller than 10MB";
        continue;
      }
      newFiles.push(file);
    }

    if (error) setAudioError(error);
    if (newFiles.length > 0) setAudioFiles((prev) => [...prev, ...newFiles]);
  }

  function removeAudio(idx) {
    setAudioFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");
    setImageError("");
    setVideoError("");
    setAudioError("");

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("narrative", narrative.trim());
      formData.append("location_lat", parseFloat(location.lat.toFixed(6)));
      formData.append("location_lng", parseFloat(location.lng.toFixed(6)));
      formData.append("location_name", placeName.trim());
      formData.append("time_type", timeType);
      formData.append("contributor_visible", contributorVisible);

      if (timeType === "year_range") {
        if (yearStart) formData.append("year_start", yearStart);
        if (yearEnd) formData.append("year_end", yearEnd);
      } else if (timeType === "exact_date") {
        if (dateValue) formData.append("date_value", dateValue);
        if (timeValue) formData.append("time_value", timeValue);
      } else {
        if (year) formData.append("year", year);
      }

      selectedTags.forEach(({ id }) => formData.append("tag_ids", id));

      const story = await createStory(formData);

      const failedUploads = [];

      let imageUploadError = false;
      for (const imgFile of imageFiles) {
        try {
          await uploadStoryImage(story.id, imgFile);
        } catch {
          imageUploadError = true;
        }
      }
      if (imageUploadError) failedUploads.push("image");

      let videoUploadError = false;
      for (const vidFile of videoFiles) {
        try {
          await uploadStoryMedia(story.id, vidFile);
        } catch {
          videoUploadError = true;
        }
      }
      if (videoUploadError) failedUploads.push("video");

      let audioUploadError = false;
      for (const audFile of audioFiles) {
        try {
          await uploadStoryMedia(story.id, audFile);
        } catch {
          audioUploadError = true;
        }
      }
      if (audioUploadError) failedUploads.push("audio");

      if (failedUploads.length > 1) {
        toast.error("Story saved, but some media could not be uploaded.");
      } else if (failedUploads.length === 1) {
        toast.error(`Story saved, but the ${failedUploads[0]} could not be uploaded.`);
      } else {
        toast.success("Story submitted successfully!");
      }
      navigate(`/stories/${story.id}`);
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Failed to submit story. Please try again.";
      setApiError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">
          Submit a Story
        </h1>

        {apiError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title)
                  setFieldErrors((prev) => ({ ...prev, title: "" }));
              }}
              placeholder="Enter story title"
              disabled={isSubmitting}
            />
            {fieldErrors.title && (
              <p className="text-sm text-destructive">{fieldErrors.title}</p>
            )}
          </div>

          {/* Narrative */}
          <div className="space-y-2">
            <Label htmlFor="narrative">Narrative</Label>
            <textarea
              id="narrative"
              value={narrative}
              onChange={(e) => {
                setNarrative(e.target.value);
                if (fieldErrors.narrative)
                  setFieldErrors((prev) => ({ ...prev, narrative: "" }));
              }}
              placeholder="Tell the story..."
              rows={6}
              disabled={isSubmitting}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {fieldErrors.narrative && (
              <p className="text-sm text-destructive">
                {fieldErrors.narrative}
              </p>
            )}
          </div>

          {/* Location picker */}
          <div className="space-y-2">
            <Label>Location</Label>
            <MapPicker value={location} onChange={setLocation} />
            {fieldErrors.location && (
              <p className="text-sm text-destructive">
                {fieldErrors.location}
              </p>
            )}
          </div>

          {/* Place name */}
          <div className="space-y-2">
            <Label htmlFor="placeName">Place Name</Label>
            <Input
              id="placeName"
              value={placeName}
              onChange={(e) => {
                setPlaceName(e.target.value);
                if (fieldErrors.placeName)
                  setFieldErrors((prev) => ({ ...prev, placeName: "" }));
              }}
              placeholder="e.g. Hagia Sophia"
              disabled={isSubmitting}
            />
            {fieldErrors.placeName && (
              <p className="text-sm text-destructive">
                {fieldErrors.placeName}
              </p>
            )}
          </div>

          {/* Time type */}
          <div className="space-y-2">
            <Label htmlFor="timeType">Time Type</Label>
            <select
              id="timeType"
              value={timeType}
              onChange={(e) => setTimeType(e.target.value)}
              disabled={isSubmitting}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {TIME_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year / date inputs */}
          {timeType === "exact_date" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateValue">Date</Label>
                  <Input
                    id="dateValue"
                    type="date"
                    value={dateValue}
                    onChange={(e) => {
                      setDateValue(e.target.value);
                      if (fieldErrors.dateValue)
                        setFieldErrors((prev) => ({ ...prev, dateValue: "" }));
                    }}
                    disabled={isSubmitting}
                  />
                  {fieldErrors.dateValue && (
                    <p className="text-sm text-destructive">{fieldErrors.dateValue}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeValue">Time (optional)</Label>
                  <Input
                    id="timeValue"
                    type="time"
                    value={timeValue}
                    onChange={(e) => {
                      setTimeValue(e.target.value);
                      if (fieldErrors.timeValue)
                        setFieldErrors((prev) => ({ ...prev, timeValue: "" }));
                    }}
                    disabled={isSubmitting || !dateValue}
                  />
                  {fieldErrors.timeValue && (
                    <p className="text-sm text-destructive">{fieldErrors.timeValue}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                BC dates are not supported for the Specific Date type. Use Exact Year, Approximate Year, Decade, or Year Range for BC.
              </p>
            </div>
          ) : timeType === "year_range" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="yearStart">Start Year</Label>
                <Input
                  id="yearStart"
                  type="number"
                  value={yearStart}
                  onChange={(e) => {
                    setYearStart(e.target.value);
                    if (fieldErrors.yearStart)
                      setFieldErrors((prev) => ({ ...prev, yearStart: "" }));
                  }}
                  placeholder="e.g. 1400 or -300"
                  disabled={isSubmitting}
                />
                {fieldErrors.yearStart && (
                  <p className="text-sm text-destructive">{fieldErrors.yearStart}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="yearEnd">End Year</Label>
                <Input
                  id="yearEnd"
                  type="number"
                  value={yearEnd}
                  onChange={(e) => {
                    setYearEnd(e.target.value);
                    if (fieldErrors.yearEnd)
                      setFieldErrors((prev) => ({ ...prev, yearEnd: "" }));
                  }}
                  placeholder="e.g. 1500 or -100"
                  disabled={isSubmitting}
                />
                {fieldErrors.yearEnd && (
                  <p className="text-sm text-destructive">{fieldErrors.yearEnd}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="year">Year</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  if (fieldErrors.year)
                    setFieldErrors((prev) => ({ ...prev, year: "" }));
                }}
                placeholder="e.g. 1453 or -300 for BC"
                disabled={isSubmitting}
              />
              {fieldErrors.year && (
                <p className="text-sm text-destructive">{fieldErrors.year}</p>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags (up to {MAX_TAGS})</Label>
            <TagInput
              value={selectedTags}
              onChange={setSelectedTags}
              disabled={isSubmitting}
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label htmlFor="image">Images (optional, up to {MAX_IMAGES})</Label>
            <Input
              id="image"
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={handleImageChange}
              disabled={isSubmitting || imageFiles.length >= MAX_IMAGES}
            />
            <p className="text-xs text-muted-foreground">Accepted formats: JPG, PNG · Max 2 MB per image</p>
            {imageError && (
              <p className="text-sm text-destructive">{imageError}</p>
            )}
            {imagePreviews.length > 0 && (
              <div
                className={`mt-2 grid gap-2 ${imagePreviews.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"}`}
                aria-label="Image previews"
              >
                {imagePreviews.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="rounded-md object-cover w-full h-24"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      disabled={isSubmitting}
                      className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100"
                      aria-label={`Remove image ${idx + 1}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Video upload */}
          <div className="space-y-2">
            <Label htmlFor="video">Videos (optional, up to {MAX_VIDEOS})</Label>
            <Input
              id="video"
              type="file"
              accept="video/mp4,video/webm"
              multiple
              onChange={handleVideoChange}
              disabled={isSubmitting || videoFiles.length >= MAX_VIDEOS}
            />
            <p className="text-xs text-muted-foreground">Accepted formats: MP4, WebM · Max 50 MB per video</p>
            {videoError && (
              <p className="text-sm text-destructive">{videoError}</p>
            )}
            {videoFiles.length > 0 && (
              <ul className="mt-1 space-y-1" aria-label="Selected videos">
                {videoFiles.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeVideo(idx)}
                      disabled={isSubmitting}
                      className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Remove video ${idx + 1}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Audio upload */}
          <div className="space-y-2">
            <Label htmlFor="audio">Audio (optional, up to {MAX_AUDIOS})</Label>
            <Input
              id="audio"
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg"
              multiple
              onChange={handleAudioChange}
              disabled={isSubmitting || audioFiles.length >= MAX_AUDIOS}
            />
            <p className="text-xs text-muted-foreground">Accepted formats: MP3, WAV, OGG · Max 10 MB per file</p>
            {audioError && (
              <p className="text-sm text-destructive">{audioError}</p>
            )}
            {audioFiles.length > 0 && (
              <ul className="mt-1 space-y-1" aria-label="Selected audio files">
                {audioFiles.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAudio(idx)}
                      disabled={isSubmitting}
                      className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Remove audio ${idx + 1}`}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contributor visibility */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label className="text-sm font-medium cursor-pointer">
                Show my name on this story
              </Label>
              <VisibilityToggle
                checked={contributorVisible}
                onChange={setContributorVisible}
                fieldLabel="Contributor"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {contributorVisible
                ? "Your username will appear on this story."
                : "This story will be submitted anonymously. Your name will not be shown."}
            </p>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Story"
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}

export default SubmitStoryPage;
