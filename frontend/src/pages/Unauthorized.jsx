import { useNavigate } from "react-router-dom";
import { FiLock } from "react-icons/fi";

function Unauthorized() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <FiLock className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-heading text-3xl text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          You do not have permission to view this page.
        </p>
        <button className="btn-primary mt-6" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    </main>
  );
}

export default Unauthorized;
