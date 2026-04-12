import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import FileUploader from "../../components/FileUploader.jsx";
import { Skeleton } from "../../components/Skeleton.jsx";
import {
  createAdminVideo,
  getAdminVideos,
  getCourses,
  getTeachers,
  uploadAdminVideoFile,
} from "../../services/admin.service.js";

const toDateText = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDurationLabel = (seconds = 0) => {
  const safe = Math.max(0, Math.floor(Number(seconds || 0)));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const getLocalVideoDurationSec = (file) =>
  new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = url;
      video.onloadedmetadata = () => {
        const duration = Number(video.duration || 0);
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(duration) ? Math.floor(duration) : 0);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(0);
      };
    } catch {
      resolve(0);
    }
  });

function AdminVideos() { 
  const queryClient = useQueryClient(); 
  const [title, setTitle] = useState(""); 
  const [courseId, setCourseId] = useState(""); 
  const [teacherId, setTeacherId] = useState(""); 
  const [uploadedVideo, setUploadedVideo] = useState(null); 
  const [hlsUrl, setHlsUrl] = useState(""); 
  const [isLiveSession, setIsLiveSession] = useState(false); 
  const [durationSec, setDurationSec] = useState(0); 

  const videosQuery = useQuery({
    queryKey: ["admin-videos"],
    queryFn: getAdminVideos,
    staleTime: 30000,
  });
  const coursesQuery = useQuery({
    queryKey: ["admin-courses-for-videos"],
    queryFn: getCourses,
    staleTime: 30000,
  });
  const teachersQuery = useQuery({
    queryKey: ["admin-teachers-for-videos"],
    queryFn: getTeachers,
    staleTime: 30000,
  });

  const courses = useMemo(() => (Array.isArray(coursesQuery.data) ? coursesQuery.data : []), [
    coursesQuery.data,
  ]);
  const teachers = useMemo(
    () => (Array.isArray(teachersQuery.data) ? teachersQuery.data : []),
    [teachersQuery.data]
  );

  const selectedCourse = courses.find((row) => row.id === courseId) || null;
  const selectedTeacher =
    teachers.find((row) => (row.uid || row.id) === teacherId) || null;

  const createMutation = useMutation({
    mutationFn: createAdminVideo,
    onSuccess: async () => { 
      await queryClient.invalidateQueries({ queryKey: ["admin-videos"] }); 
      toast.success("Video saved in library"); 
      setTitle(""); 
      setUploadedVideo(null); 
      setHlsUrl(""); 
      setIsLiveSession(false); 
      setDurationSec(0); 
    }, 
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Failed to save video"),
  });

  const submitVideo = () => { 
    if (!title.trim()) return toast.error("Video title is required"); 
    if (!courseId) return toast.error("Select subject"); 
    if (!teacherId) return toast.error("Selected subject has no assigned teacher"); 
    if (!uploadedVideo?.url) return toast.error("Upload video first"); 
    if (isLiveSession && !(Number(durationSec) > 0)) { 
      return toast.error( 
        "Live sessions need a detected duration. Please re-upload a web-compatible MP4 (H.264 + AAC) or provide an HLS URL." 
      ); 
    } 
 
    createMutation.mutate({ 
      title: title.trim(), 
      url: uploadedVideo.url, 
      hlsUrl: String(hlsUrl || "").trim(), 
      courseId, 
      subjectId: courseId, 
      courseName: selectedCourse?.title || "", 
      teacherId, 
      teacherName: selectedTeacher?.fullName || "", 
      isLiveSession,
      videoMode: isLiveSession ? "live_session" : "recorded",
      // Single source of truth: durationSec only (server computes a label when needed).
      durationSec: Math.max(0, Number(durationSec || 0)), 
    }); 
  }; 

  const videos = Array.isArray(videosQuery.data) ? videosQuery.data : [];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <section>
        <h1 className="font-heading text-3xl text-slate-900">Video Library</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload once, then attach videos in subject content by title and URL.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-xl text-slate-900">Add New Video</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">Video Title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              placeholder="Class 9 Algebra - Session 1"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Subject</label>
            <select
              value={courseId}
              onChange={(event) => {
                const nextCourseId = event.target.value;
                const nextCourse =
                  courses.find((row) => String(row.id) === String(nextCourseId)) || null;
                const nextTeacherId = String(nextCourse?.teacherId || "").trim();
                setCourseId(nextCourseId);
                setTeacherId(nextTeacherId);
                setUploadedVideo(null);
              }}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
            >
              <option value="">Select subject</option>
              {courses.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title || "Subject"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Assigned Teacher (Auto)
            </label>
            <input
              type="text"
              value={
                selectedTeacher?.fullName ||
                selectedTeacher?.name ||
                selectedTeacher?.email ||
                selectedCourse?.teacherName ||
                "No teacher assigned to this subject"
              }
              readOnly
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600"
            />
          </div>
          <div className="md:col-span-2"> 
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"> 
              <input
                type="checkbox"
                checked={isLiveSession}
                onChange={(event) => setIsLiveSession(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              Mark this gallery video as live session
            </label>
          </div> 
          <div className="md:col-span-2"> 
            <label className="text-sm font-semibold text-slate-700">HLS URL (Optional)</label> 
            <input 
              type="text" 
              value={hlsUrl} 
              onChange={(event) => setHlsUrl(event.target.value)} 
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" 
              placeholder="https://storage.googleapis.com/.../master.m3u8" 
            /> 
            <p className="mt-1 text-xs text-slate-500"> 
              If you generated HLS output, paste the <code className="rounded bg-slate-100 px-1">master.m3u8</code> URL here for smoother playback on web. 
            </p> 
          </div> 
        </div> 

        <div className="mt-4">
          <FileUploader
            accept="video/mp4,video/avi,video/x-msvideo,video/quicktime,video/webm,video/x-matroska,.mov,.mkv,.webm"
            maxSize={2048}
            label="Upload Course Video"
            hint="MP4, AVI, MOV - max 2GB"
            onUpload={async (file, { onProgress }) => {
              if (!courseId) throw new Error("Select subject first");
              const response = await uploadAdminVideoFile(
                file,
                courseId,
                courseId,
                (event) => {
                  if (!event?.total) return;
                  const pct = Math.round((event.loaded / event.total) * 100);
                  if (typeof onProgress === "function") onProgress(pct);
                }
              );
              const data = response?.data || response || {};
              if (!data?.url) {
                const message =
                  data?.message ||
                  "Upload failed. Please try again or upload a valid MP4 file.";
                toast.error(message);
                throw new Error(message);
              }
              setUploadedVideo({
                url: data.url,
                filePath: data.filePath,
                name: file.name,
                size: file.size,
                type: file.type,
              });
              setDurationSec(Number(data.durationSec || 0) || 0);
              setHlsUrl(String(data.hlsUrl || "").trim());
              if (data.hlsError) {
                toast.error(`HLS conversion failed: ${data.hlsError}`);
              }
              return data;
            }}
          />
        </div>

        {durationSec > 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Detected duration: <span className="font-semibold text-slate-700">{formatDurationLabel(durationSec)}</span>
          </p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={submitVideo}
            disabled={createMutation.isPending}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createMutation.isPending ? "Saving..." : "Save In Library"}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-xl text-slate-900">Library Videos</h2>
        <div className="mt-4 space-y-3">
          {videosQuery.isLoading ? (
            <>
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </>
          ) : videos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No videos added yet.
            </p>
          ) : (
            videos.map((row) => (
              <div
                key={row.id}
                className="rounded-2xl border border-slate-200 p-4 text-sm"
              >
                <p className="font-semibold text-slate-900">{row.title || "Video"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {row.subjectName || row.courseName || "Subject"} -{" "}
                  {row.teacherName || "Teacher"} -{" "}
                  {toDateText(row.createdAt)}
                </p>
                <div className="mt-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                      row.isLiveSession
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {row.isLiveSession ? "Live Session" : "Recorded"}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs text-primary">{row.url}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default AdminVideos;
