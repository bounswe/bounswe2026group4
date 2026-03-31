import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { Button, Input, Label } from "@/components/ui";
import MapPicker from "@/components/MapPicker/MapPicker";
import { createStory } from "@/services/storyService";
import { useToast } from "@/hooks/useToast";

const TAGS = [
  "Architecture",
  "War",
  "Culture",
  "Trade",
  "Religion",
  "Daily Life",
  "Art",
  "Politics",
];

const TIME_TYPES = [
  { value: "exact_year", label: "Exact Year" },
  { value: "approximate_year", label: "Approximate Year" },
  { value: "decade", label: "Decade" },
  { value: "year_range", label: "Year Range" },
];

const MAX_TAGS = 3;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];

function SubmitStoryPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [narrative, setNarrative] = useState("");
  const [location, setLocation] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [timeType, setTimeType] = useState("exact_year");
  const [year, setYear] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

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
    } else {
      if (!year.toString().trim()) errors.year = "Year is required";
      else if (isNaN(Number(year))) errors.year = "Year must be a valid number";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    setImageError("");

    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError("Only JPG and PNG images are allowed");
      setImageFile(null);
      setImagePreview(null);
      e.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setImageError("Image must be smaller than 2MB");
      setImageFile(null);
      setImagePreview(null);
      e.target.value = "";
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleTagToggle(tag) {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, tag];
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError("");
    setImageError("");

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

      if (timeType === "year_range") {
        if (yearStart) formData.append("year_start", yearStart);
        if (yearEnd) formData.append("year_end", yearEnd);
      } else {
        if (year) formData.append("year", year);
      }

      selectedTags.forEach((tag) => formData.append("tags", tag));

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const story = await createStory(formData);
      toast.success("Story submitted successfully!");
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

          {/* Year inputs */}
          {timeType === "year_range" ? (
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
                  placeholder="e.g. 1400"
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
                  placeholder="e.g. 1500"
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
                placeholder="e.g. 1453"
                disabled={isSubmitting}
              />
              {fieldErrors.year && (
                <p className="text-sm text-destructive">{fieldErrors.year}</p>
              )}
            </div>
          )}

          {/* Tags */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium leading-none">
              Tags (select up to {MAX_TAGS})
            </legend>
            <div className="flex flex-wrap gap-3">
              {TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                const isDisabled =
                  !isSelected && selectedTags.length >= MAX_TAGS;
                return (
                  <label
                    key={tag}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={isDisabled || isSubmitting}
                      onChange={() => handleTagToggle(tag)}
                      className="rounded border-input"
                    />
                    {tag}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Image upload */}
          <div className="space-y-2">
            <Label htmlFor="image">Image (optional)</Label>
            <Input
              id="image"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleImageChange}
              disabled={isSubmitting}
            />
            {imageError && (
              <p className="text-sm text-destructive">{imageError}</p>
            )}
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-2 max-h-48 rounded-md object-cover"
              />
            )}
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
