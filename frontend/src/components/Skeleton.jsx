function cn(base, extra) {
  return extra ? `${base} ${extra}` : base;
}

function Skeleton({ className = "" }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

function SkeletonText({ lines = 3, className = "" }) {
  const safeLines = Math.max(1, Number(lines) || 1);
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: safeLines }).map((ignore, index) => (
        <Skeleton
          key={`skeleton-line-${index}`}
          className={`h-3 ${index === safeLines - 1 ? "w-3/4" : "w-full"}`}
        />
      ))}
    </div>
  );
}

function SkeletonCard({ className = "" }) {
  return (
    <div
      className={cn(
        "glass-card flex flex-col gap-4 border border-slate-200/60 dark:border-white/10",
        className
      )}
      aria-hidden="true"
    >
      <Skeleton className="h-44 w-full rounded-2xl" />
      <SkeletonText lines={3} />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

function SkeletonTeacherCard({ className = "" }) {
  return (
    <div className={cn("flex items-center gap-4", className)} aria-hidden="true">
      <Skeleton className="h-14 w-14 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export { Skeleton, SkeletonCard, SkeletonText, SkeletonTeacherCard };
