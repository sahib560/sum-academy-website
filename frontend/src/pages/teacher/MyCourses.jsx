import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { SkeletonCard, Skeleton } from "../../components/Skeleton.jsx";

const categories = [
  { label: "All", value: "All" },
  { label: "Biology", value: "Biology" },
  { label: "Chemistry", value: "Chemistry" },
  { label: "Physics", value: "Physics" },
  { label: "English", value: "English" },
];

const categoryStyles = {
  Biology: "from-emerald-400/70 to-emerald-100",
  Chemistry: "from-blue-500/70 to-blue-100",
  Physics: "from-violet-500/70 to-violet-100",
  English: "from-orange-400/70 to-orange-100",
};

const statusStyles = {
  Published: "bg-emerald-50 text-emerald-600",
  Draft: "bg-amber-50 text-amber-600",
  Archived: "bg-slate-100 text-slate-500",
};

const initialCourses = [
  {
    id: 1,
    title: "Biology Masterclass XI - Genetics and Human Physiology",
    category: "Biology",
    status: "Published",
    enrolled: 180,
    completion: 78,
    revenue: 420000,
  },
  {
    id: 2,
    title: "Chemistry Quick Revision for Board Exams",
    category: "Chemistry",
    status: "Published",
    enrolled: 142,
    completion: 83,
    revenue: 320000,
  },
  {
    id: 3,
    title: "Physics Practice Lab - Mechanics Fundamentals",
    category: "Physics",
    status: "Draft",
    enrolled: 112,
    completion: 71,
    revenue: 210000,
  },
  {
    id: 4,
    title: "English Essay Clinic - Academic Writing Skills",
    category: "English",
    status: "Published",
    enrolled: 95,
    completion: 65,
    revenue: 150000,
  },
  {
    id: 5,
    title: "Entrance Test Sprint - Full Biology Series",
    category: "Biology",
    status: "Archived",
    enrolled: 203,
    completion: 88,
    revenue: 540000,
  },
  {
    id: 6,
    title: "Chemistry Organic Reactions Intensive",
    category: "Chemistry",
    status: "Published",
    enrolled: 126,
    completion: 74,
    revenue: 280000,
  },
];

const defaultChapters = [
  {
    id: "ch-1",
    title: "Introduction",
    open: true,
    lectures: [
      { id: "lec-1", title: "Welcome & Overview", duration: "12m" },
      { id: "lec-2", title: "Course Goals", duration: "9m" },
    ],
  },
  {
    id: "ch-2",
    title: "Core Concepts",
    open: false,
    lectures: [
      { id: "lec-3", title: "Key Theory", duration: "18m" },
      { id: "lec-4", title: "Practice Examples", duration: "22m" },
    ],
  },
];

const sampleStudents = [
  { id: 1, name: "Ayesha Noor", completedOn: "Mar 10, 2026" },
  { id: 2, name: "Bilal Khan", completedOn: "Mar 09, 2026" },
  { id: 3, name: "Hina Sheikh", completedOn: "Mar 08, 2026" },
  { id: 4, name: "Usman Raza", completedOn: "Mar 07, 2026" },
];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45 },
};

const reorder = (list, startIndex, endIndex) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

function MyCourses() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [courses, setCourses] = useState(initialCourses);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState("Info");
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseMenu, setCourseMenu] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [videoModal, setVideoModal] = useState(null);
  const [pdfModal, setPdfModal] = useState(null);
  const [unlockModal, setUnlockModal] = useState(false);
  const [videoStage, setVideoStage] = useState("File Selected");
  const [videoProgress, setVideoProgress] = useState(0);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [chapters, setChapters] = useState(defaultChapters);
  const [courseInfo, setCourseInfo] = useState({
    title: "",
    shortDescription: "",
    description: "",
    category: "Biology",
    level: "Beginner",
    price: 12000,
    discount: 0,
    thumbnail: "",
  });
  const [searchStudent, setSearchStudent] = useState("");
  const [unlockState, setUnlockState] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const tabCounts = useMemo(() => {
    return {
      All: courses.length,
      Published: courses.filter((course) => course.status === "Published").length,
      Draft: courses.filter((course) => course.status === "Draft").length,
      Archived: courses.filter((course) => course.status === "Archived").length,
    };
  }, [courses]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesTab = activeTab === "All" || course.status === activeTab;
      const matchesSearch =
        !query || course.title.toLowerCase().includes(query);
      const matchesCategory =
        category === "All" || course.category === category;
      return matchesTab && matchesSearch && matchesCategory;
    });
  }, [activeTab, category, courses, search]);

  const discountedPrice = useMemo(() => {
    const price = Number(courseInfo.price) || 0;
    const discount = Number(courseInfo.discount) || 0;
    return Math.max(price - (price * discount) / 100, 0);
  }, [courseInfo.discount, courseInfo.price]);

  const filteredStudents = useMemo(() => {
    const query = searchStudent.trim().toLowerCase();
    return sampleStudents.filter((student) =>
      student.name.toLowerCase().includes(query)
    );
  }, [searchStudent]);

  const lectureOptions = useMemo(() => {
    const lectures = chapters.flatMap((chapter) =>
      chapter.lectures.map((lecture) => ({
        id: lecture.id,
        title: lecture.title,
      }))
    );
    return lectures.slice(0, 4);
  }, [chapters]);

  const handleOpenDrawer = (course) => {
    setEditingCourse(course || null);
    setDrawerTab("Info");
    setCourseInfo(
      course
        ? {
            title: course.title,
            shortDescription: "",
            description: "",
            category: course.category,
            level: "Intermediate",
            price: 12000,
            discount: 0,
            thumbnail: "",
          }
        : {
            title: "",
            shortDescription: "",
            description: "",
            category: "Biology",
            level: "Beginner",
            price: 12000,
            discount: 0,
            thumbnail: "",
          }
    );
    setChapters(defaultChapters);
    setDrawerOpen(true);
  };

  const handleSaveCourse = (status) => {
    setToast({ type: "success", message: `Course saved as ${status}.` });
    setDrawerOpen(false);
  };

  const handleDeleteCourse = () => {
    if (!deleteTarget) return;
    setCourses((prev) => prev.filter((course) => course.id !== deleteTarget.id));
    setToast({ type: "success", message: "Course deleted." });
    setDeleteTarget(null);
  };

  const handleArchiveCourse = (course) => {
    setCourses((prev) =>
      prev.map((item) =>
        item.id === course.id ? { ...item, status: "Archived" } : item
      )
    );
    setToast({ type: "success", message: "Course archived." });
  };

  const handleDropThumbnail = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setCourseInfo((prev) => ({ ...prev, thumbnail: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleDragChapter = (startIndex, endIndex) => {
    setChapters((prev) => reorder(prev, startIndex, endIndex));
  };

  const handleDragLecture = (chapterIndex, startIndex, endIndex) => {
    setChapters((prev) => {
      const updated = [...prev];
      updated[chapterIndex].lectures = reorder(
        updated[chapterIndex].lectures,
        startIndex,
        endIndex
      );
      return updated;
    });
  };

  const handleAddChapter = () => {
    setChapters((prev) => [
      ...prev,
      {
        id: `ch-${Date.now()}`,
        title: "New Chapter",
        open: true,
        lectures: [],
      },
    ]);
  };

  const handleAddLecture = (chapterIndex) => {
    setChapters((prev) => {
      const updated = [...prev];
      updated[chapterIndex].lectures.push({
        id: `lec-${Date.now()}`,
        title: "New Lecture",
        duration: "0m",
      });
      return updated;
    });
  };

  const handleDeleteChapter = (chapterId) => {
    const confirmed = window.confirm("Delete this chapter?");
    if (!confirmed) return;
    setChapters((prev) => prev.filter((chapter) => chapter.id !== chapterId));
  };

  const handleDeleteLecture = (chapterId, lectureId) => {
    const confirmed = window.confirm("Delete this lecture?");
    if (!confirmed) return;
    setChapters((prev) =>
      prev.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              lectures: chapter.lectures.filter((lec) => lec.id !== lectureId),
            }
          : chapter
      )
    );
  };

  const openVideoModal = (lecture) => {
    setVideoModal(lecture);
    setVideoStage("File Selected");
    setVideoProgress(0);
  };

  const openPdfModal = (lecture) => {
    setPdfModal(lecture);
    setPdfProgress(0);
  };

  const simulateVideoUpload = () => {
    setVideoStage("Uploading");
    setVideoProgress(20);
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      if (step === 1) setVideoProgress(60);
      if (step === 2) setVideoStage("Transcoding");
      if (step === 3) {
        setVideoStage("Ready");
        setVideoProgress(100);
        clearInterval(timer);
      }
    }, 700);
  };

  const simulatePdfUpload = () => {
    let progress = 10;
    const timer = setInterval(() => {
      progress += 20;
      setPdfProgress(progress);
      if (progress >= 100) clearInterval(timer);
    }, 400);
  };

  return (
    <div className="space-y-6">
      <motion.section {...fadeUp} className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl text-slate-900">My Courses</h1>
        <button className="btn-primary" onClick={() => handleOpenDrawer(null)}>
          Create New Course
        </button>
      </motion.section>

      <motion.section {...fadeUp} className="flex flex-wrap items-center gap-3">
        {["All", "Published", "Draft", "Archived"].map((tab) => (
          <button
            key={tab}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              activeTab === tab
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}{" "}
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {tabCounts[tab]}
            </span>
          </button>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label === "All" ? "Category: All" : item.label}
              </option>
            ))}
          </select>
        </div>
      </motion.section>

      <motion.section {...fadeUp} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <SkeletonCard key={`course-skeleton-${index}`} />
            ))
          : filteredCourses.map((course) => (
              <div
                key={course.id}
                className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div
                  className={`h-20 bg-gradient-to-r ${
                    categoryStyles[course.category] || "from-slate-300 to-slate-100"
                  }`}
                />
                <span
                  className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold ${
                    statusStyles[course.status]
                  }`}
                >
                  {course.status}
                </span>
                <div className="p-5">
                  <h3
                    className="font-heading text-lg text-slate-900"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {course.title}
                  </h3>
                  <span className="mt-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {course.category}
                  </span>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-500">
                    <div>
                      <p className="font-semibold text-slate-900">{course.enrolled}</p>
                      Enrolled
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {course.completion}%
                      </p>
                      Completion
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        PKR {course.revenue.toLocaleString()}
                      </p>
                      Revenue
                    </div>
                  </div>
                  <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${course.completion}%` }}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary"
                      onClick={() => handleOpenDrawer(course)}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d="M4 17.3V20h2.7l7.9-7.9-2.7-2.7L4 17.3zM20.7 7.04a1 1 0 0 0 0-1.41l-2.3-2.3a1 1 0 0 0-1.41 0l-1.8 1.8 3.7 3.7 1.8-1.79z" />
                      </svg>
                      Edit Content
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary"
                      onClick={() => setUnlockModal(true)}
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d="M7 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm10 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM2 20a5 5 0 0 1 10 0H2zm12 0a4 4 0 0 1 8 0h-8z" />
                      </svg>
                      View Students
                    </button>
                    <div className="relative">
                      <button
                        className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                        onClick={() =>
                          setCourseMenu(courseMenu === course.id ? null : course.id)
                        }
                      >
                        More
                      </button>
                      {courseMenu === course.id && (
                        <div className="absolute right-0 z-10 mt-2 w-36 rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-lg">
                          <button
                            className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-100"
                            onClick={() => {
                              handleArchiveCourse(course);
                              setCourseMenu(null);
                            }}
                          >
                            Archive
                          </button>
                          <button
                            className="block w-full rounded-xl px-3 py-2 text-left text-rose-500 hover:bg-rose-50"
                            onClick={() => {
                              setDeleteTarget(course);
                              setCourseMenu(null);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
      </motion.section>

      {drawerOpen && (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close drawer"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl text-slate-900">
                  {editingCourse ? "Edit Course" : "Create New Course"}
                </h2>
                <p className="text-sm text-slate-500">
                  Manage course information and content.
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500"
                onClick={() => setDrawerOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {["Info", "Content", "Settings"].map((tab) => (
                <button
                  key={tab}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    drawerTab === tab
                      ? "bg-primary text-white"
                      : "border border-slate-200 text-slate-600"
                  }`}
                  onClick={() => setDrawerTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {drawerTab === "Info" && (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Course Title
                  </label>
                  <input
                    type="text"
                    value={courseInfo.title}
                    onChange={(event) =>
                      setCourseInfo((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Short Description
                  </label>
                  <textarea
                    value={courseInfo.shortDescription}
                    onChange={(event) =>
                      setCourseInfo((prev) => ({
                        ...prev,
                        shortDescription: event.target.value.slice(0, 150),
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    rows={2}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {courseInfo.shortDescription.length}/150
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Full Description
                  </label>
                  <textarea
                    value={courseInfo.description}
                    onChange={(event) =>
                      setCourseInfo((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    rows={4}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Category
                    </label>
                    <select
                      value={courseInfo.category}
                      onChange={(event) =>
                        setCourseInfo((prev) => ({
                          ...prev,
                          category: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {categories
                        .filter((item) => item.value !== "All")
                        .map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Level
                    </label>
                    <select
                      value={courseInfo.level}
                      onChange={(event) =>
                        setCourseInfo((prev) => ({
                          ...prev,
                          level: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    >
                      {["Beginner", "Intermediate", "Advanced"].map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Price (PKR)
                    </label>
                    <input
                      type="number"
                      value={courseInfo.price}
                      onChange={(event) =>
                        setCourseInfo((prev) => ({
                          ...prev,
                          price: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-slate-400">
                      Discount %
                    </label>
                    <input
                      type="number"
                      value={courseInfo.discount}
                      onChange={(event) =>
                        setCourseInfo((prev) => ({
                          ...prev,
                          discount: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Discounted Price: PKR {discountedPrice.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Thumbnail Upload
                  </label>
                  <div
                    className="mt-2 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDropThumbnail}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setCourseInfo((prev) => ({
                          ...prev,
                          thumbnail: event.target.files?.[0]
                            ? URL.createObjectURL(event.target.files[0])
                            : prev.thumbnail,
                        }))
                      }
                    />
                    {courseInfo.thumbnail && (
                      <img
                        src={courseInfo.thumbnail}
                        alt="Thumbnail preview"
                        className="mx-auto mt-3 h-28 w-48 rounded-2xl object-cover"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {drawerTab === "Content" && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-xl text-slate-900">Chapters</h3>
                  <button className="btn-outline" onClick={handleAddChapter}>
                    Add Chapter
                  </button>
                </div>
                <div className="space-y-4">
                  {chapters.map((chapter, chapterIndex) => (
                    <div
                      key={chapter.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      draggable
                      onDragStart={(event) =>
                        event.dataTransfer.setData("chapter", chapterIndex)
                      }
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        const startIndex = Number(
                          event.dataTransfer.getData("chapter")
                        );
                        handleDragChapter(startIndex, chapterIndex);
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <input
                          value={chapter.title}
                          onChange={(event) =>
                            setChapters((prev) =>
                              prev.map((item) =>
                                item.id === chapter.id
                                  ? { ...item, title: event.target.value }
                                  : item
                              )
                            )
                          }
                          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                            onClick={() =>
                              setChapters((prev) =>
                                prev.map((item) =>
                                  item.id === chapter.id
                                    ? { ...item, open: !item.open }
                                    : item
                                )
                              )
                            }
                          >
                            {chapter.open ? "Collapse" : "Expand"}
                          </button>
                          <button
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-rose-500"
                            onClick={() => handleDeleteChapter(chapter.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {chapter.open && (
                        <div className="mt-4 space-y-3">
                          {chapter.lectures.map((lecture, lectureIndex) => (
                            <div
                              key={lecture.id}
                              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
                              draggable
                              onDragStart={(event) =>
                                event.dataTransfer.setData(
                                  "lecture",
                                  lectureIndex.toString()
                                )
                              }
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                const startIndex = Number(
                                  event.dataTransfer.getData("lecture")
                                );
                                handleDragLecture(
                                  chapterIndex,
                                  startIndex,
                                  lectureIndex
                                );
                              }}
                            >
                              <span className="text-xs text-slate-400">::</span>
                              <input
                                value={lecture.title}
                                onChange={(event) =>
                                  setChapters((prev) =>
                                    prev.map((item) =>
                                      item.id === chapter.id
                                        ? {
                                            ...item,
                                            lectures: item.lectures.map((lec) =>
                                              lec.id === lecture.id
                                                ? {
                                                    ...lec,
                                                    title: event.target.value,
                                                  }
                                                : lec
                                            ),
                                          }
                                        : item
                                    )
                                  )
                                }
                                className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                              />
                              <button
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                                onClick={() => openVideoModal(lecture)}
                              >
                                Upload Video
                              </button>
                              <button
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                                onClick={() => openPdfModal(lecture)}
                              >
                                Upload PDF
                              </button>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                                {lecture.duration}
                              </span>
                              <button
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-rose-500"
                                onClick={() =>
                                  handleDeleteLecture(chapter.id, lecture.id)
                                }
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                          <button
                            className="btn-outline"
                            onClick={() => handleAddLecture(chapterIndex)}
                          >
                            Add Lecture
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drawerTab === "Settings" && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Status</p>
                    <p className="text-xs text-slate-500">Draft / Published</p>
                  </div>
                  <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                    Draft
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Certificate on completion
                    </p>
                  </div>
                  <button className="rounded-full border border-slate-200 px-3 py-1 text-xs">
                    Enabled
                  </button>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Prerequisites
                  </label>
                  <select className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option>None</option>
                    {initialCourses.map((course) => (
                      <option key={course.id}>{course.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-slate-400">
                    Promo Code
                  </label>
                  <select className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option>None</option>
                    <option>SUMSAVE20</option>
                    <option>BIO1000</option>
                  </select>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                className="btn-outline"
                onClick={() => handleSaveCourse("Draft")}
              >
                Save Draft
              </button>
              <button
                className="btn-primary"
                onClick={() => handleSaveCourse("Published")}
              >
                Publish
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {videoModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setVideoModal(null)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">Upload Video</h3>
            <p className="text-sm text-slate-500">MP4/AVI/MOV up to 2GB.</p>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Drag and drop video file here
            </div>
            <div className="mt-4">
              <p className="text-xs text-slate-400">{videoStage}</p>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${videoProgress}%` }}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <button className="btn-outline" onClick={() => setVideoModal(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  simulateVideoUpload();
                  setToast({ type: "success", message: "Video upload started." });
                }}
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {pdfModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setPdfModal(null)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">Upload PDF</h3>
            <p className="text-sm text-slate-500">PDF only, max 50MB.</p>
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Drag and drop PDF file here
            </div>
            <div className="mt-4">
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${pdfProgress}%` }}
                />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <button className="btn-outline" onClick={() => setPdfModal(null)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  simulatePdfUpload();
                  setToast({ type: "success", message: "PDF upload started." });
                }}
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {unlockModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setUnlockModal(false)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">
              Video Unlocks
            </h3>
            <input
              type="text"
              value={searchStudent}
              onChange={(event) => setSearchStudent(event.target.value)}
              placeholder="Search student..."
              className="mt-4 w-full rounded-full border border-slate-200 px-4 py-2 text-sm"
            />
            <div className="mt-4 space-y-3">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{student.name}</p>
                      <p className="text-xs text-slate-500">
                        Completed on {student.completedOn}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {lectureOptions.map((lecture) => {
                      const key = `${student.id}-${lecture.id}`;
                      const unlocked = unlockState[key];
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                        >
                          <span className="text-slate-600">{lecture.title}</span>
                          <button
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              unlocked
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-slate-100 text-slate-500"
                            }`}
                            onClick={() =>
                              setUnlockState((prev) => ({
                                ...prev,
                                [key]: !prev[key],
                              }))
                            }
                          >
                            {unlocked ? "Unlocked" : "Locked"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button className="btn-outline" onClick={() => setUnlockModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setToast({ type: "success", message: "Unlock changes saved." });
                  setUnlockModal(false);
                }}
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setDeleteTarget(null)}
            aria-label="Close"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-xl text-slate-900">Delete course?</h3>
            <p className="mt-2 text-sm text-slate-500">
              This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                className="btn-outline flex-1"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button className="btn-primary flex-1" onClick={handleDeleteCourse}>
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {toast && (
        <div
          className={`fixed right-6 top-6 z-[80] rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
            toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default MyCourses;
