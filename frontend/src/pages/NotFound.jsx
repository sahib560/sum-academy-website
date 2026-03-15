import { Link } from "react-router-dom";

function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
          Error 404
        </p>
        <h1 className="mt-4 font-heading text-4xl text-slate-900">
          Page Not Found
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <Link to="/" className="btn-primary mt-6 inline-flex">
          Go Home
        </Link>
      </div>
    </main>
  );
}

export default NotFound;
