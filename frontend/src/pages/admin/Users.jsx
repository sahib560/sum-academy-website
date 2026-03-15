import { useMemo, useState } from "react";
import { motion } from "framer-motion";

const roles = ["Admin", "Teacher", "Student"];
const statuses = ["Active", "Inactive"];

const mockUsers = [
  {
    id: 1,
    name: "Sana Ahmed",
    email: "sana.ahmed@sumacademy.pk",
    role: "Admin",
    status: "Active",
    joined: "Mar 02, 2026",
  },
  {
    id: 2,
    name: "Bilal Khan",
    email: "bilal.khan@sumacademy.pk",
    role: "Teacher",
    status: "Active",
    joined: "Feb 18, 2026",
  },
  {
    id: 3,
    name: "Hina Sheikh",
    email: "hina.sheikh@sumacademy.pk",
    role: "Student",
    status: "Inactive",
    joined: "Feb 11, 2026",
  },
  {
    id: 4,
    name: "Usman Raza",
    email: "usman.raza@sumacademy.pk",
    role: "Student",
    status: "Active",
    joined: "Jan 28, 2026",
  },
  {
    id: 5,
    name: "Ayesha Noor",
    email: "ayesha.noor@sumacademy.pk",
    role: "Teacher",
    status: "Active",
    joined: "Jan 20, 2026",
  },
  {
    id: 6,
    name: "Hassan Ali",
    email: "hassan.ali@sumacademy.pk",
    role: "Student",
    status: "Active",
    joined: "Jan 12, 2026",
  },
  {
    id: 7,
    name: "Mariam Bukhari",
    email: "mariam.bukhari@sumacademy.pk",
    role: "Student",
    status: "Inactive",
    joined: "Dec 23, 2025",
  },
  {
    id: 8,
    name: "Adnan Malik",
    email: "adnan.malik@sumacademy.pk",
    role: "Teacher",
    status: "Active",
    joined: "Dec 10, 2025",
  },
  {
    id: 9,
    name: "Nimra Iqbal",
    email: "nimra.iqbal@sumacademy.pk",
    role: "Student",
    status: "Active",
    joined: "Nov 29, 2025",
  },
  {
    id: 10,
    name: "Fahad Riaz",
    email: "fahad.riaz@sumacademy.pk",
    role: "Student",
    status: "Active",
    joined: "Nov 18, 2025",
  },
  {
    id: 11,
    name: "Amina Latif",
    email: "amina.latif@sumacademy.pk",
    role: "Teacher",
    status: "Inactive",
    joined: "Nov 04, 2025",
  },
  {
    id: 12,
    name: "Saifullah Khan",
    email: "saifullah.khan@sumacademy.pk",
    role: "Admin",
    status: "Active",
    joined: "Oct 21, 2025",
  },
];

const roleColors = {
  Admin: "bg-purple-50 text-purple-600",
  Teacher: "bg-blue-50 text-blue-600",
  Student: "bg-emerald-50 text-emerald-600",
};

function Users() {
  const [users, setUsers] = useState(mockUsers);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDelete, setShowDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    id: null,
    name: "",
    email: "",
    password: "",
    role: "Student",
    status: "Active",
  });
  const [saving, setSaving] = useState(false);

  const perPage = 10;

  useMemo(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesTab = tab === "All" || user.role === tab.slice(0, -1);
      const matchesRole = roleFilter === "All" || user.role === roleFilter;
      const matchesStatus = statusFilter === "All" || user.status === statusFilter;
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);
      return matchesTab && matchesRole && matchesStatus && matchesSearch;
    });
  }, [roleFilter, search, statusFilter, tab, users]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / perPage));
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * perPage,
    page * perPage
  );

  const openAdd = () => {
    setForm({
      id: null,
      name: "",
      email: "",
      password: "",
      role: "Student",
      status: "Active",
    });
    setShowModal(true);
  };

  const openEdit = (user) => {
    setForm({ ...user, password: "" });
    setShowModal(true);
  };

  const handleSave = (event) => {
    event.preventDefault();
    if (!form.name || !form.email || (!form.id && !form.password)) {
      setToast({ type: "error", message: "Please fill all required fields." });
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      if (form.id) {
        setUsers((prev) =>
          prev.map((user) => (user.id === form.id ? { ...user, ...form } : user))
        );
        setToast({ type: "success", message: "User updated." });
      } else {
        setUsers((prev) => [
          {
            ...form,
            id: Date.now(),
            joined: "Mar 13, 2026",
          },
          ...prev,
        ]);
        setToast({ type: "success", message: "User added." });
      }
      setShowModal(false);
    }, 900);
  };

  const handleDelete = () => {
    setUsers((prev) => prev.filter((user) => user.id !== showDelete.id));
    setToast({ type: "success", message: "User deleted." });
    setShowDelete(null);
  };

  const toggleStatus = (user) => {
    setUsers((prev) =>
      prev.map((item) =>
        item.id === user.id
          ? { ...item, status: item.status === "Active" ? "Inactive" : "Active" }
          : item
      )
    );
  };

  useMemo(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(() => {
    return {
      All: users.length,
      Students: users.filter((u) => u.role === "Student").length,
      Teachers: users.filter((u) => u.role === "Teacher").length,
      Admins: users.filter((u) => u.role === "Admin").length,
    };
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-3xl text-slate-900">User Management</h2>
          <p className="text-sm text-slate-500">
            Manage student, teacher, and admin accounts.
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          Add User
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {["All", "Students", "Teachers", "Admins"].map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === item
                ? "bg-primary text-white"
                : "border border-slate-200 text-slate-600"
            }`}
            onClick={() => {
              setTab(item);
              setPage(1);
            }}
          >
            {item}
            <span className="ml-2 rounded-full bg-white/20 px-2 text-xs">
              {counts[item]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="All">Role: All</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700"
        >
          <option value="All">Status: All</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="sm:hidden">
          <div className="space-y-3 px-4 py-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`card-skeleton-${index}`}
                  className="skeleton h-24 w-full rounded-2xl"
                />
              ))
            ) : paginatedUsers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                No users found.
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <div
                  key={user.id}
                  className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-sm shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {user.name
                          .split(" ")
                          .slice(0, 2)
                          .map((word) => word[0])
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {user.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${roleColors[user.role]}`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600">
                    <span>Joined: {user.joined}</span>
                    <button
                      className={`relative h-6 w-12 rounded-full transition ${
                        user.status === "Active" ? "bg-emerald-400" : "bg-slate-200"
                      }`}
                      onClick={() => toggleStatus(user)}
                      aria-pressed={user.status === "Active"}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          user.status === "Active" ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-primary"
                      onClick={() => openEdit(user)}
                      aria-label="Edit user"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d="M3 17.2V21h3.8l11-11-3.8-3.8-11 11zm17.7-10.5a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-1.6 1.6 3.8 3.8 1.2-1z" />
                      </svg>
                    </button>
                    <button
                      className="rounded-full border border-slate-200 p-2 text-rose-500 hover:text-rose-600"
                      onClick={() => setShowDelete(user)}
                      aria-label="Delete user"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined Date</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`row-skeleton-${index}`} className="border-b border-slate-100">
                    <td className="px-6 py-4">
                      <div className="skeleton h-8 w-40" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-40" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-20" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-16" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-24" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="skeleton h-6 w-12" />
                    </td>
                  </tr>
                ))
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {user.name
                            .split(" ")
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{user.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.email}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${roleColors[user.role]}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className={`relative h-6 w-12 rounded-full transition ${
                          user.status === "Active" ? "bg-emerald-400" : "bg-slate-200"
                        }`}
                        onClick={() => toggleStatus(user)}
                        aria-pressed={user.status === "Active"}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            user.status === "Active" ? "translate-x-6" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.joined}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-primary"
                          onClick={() => openEdit(user)}
                          aria-label="Edit user"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                            <path d="M3 17.2V21h3.8l11-11-3.8-3.8-11 11zm17.7-10.5a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-1.6 1.6 3.8 3.8 1.2-1z" />
                          </svg>
                        </button>
                        <button
                          className="rounded-full border border-slate-200 p-2 text-rose-500 hover:text-rose-600"
                          onClick={() => setShowDelete(user)}
                          aria-label="Delete user"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                            <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4 text-sm text-slate-500">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1"
              onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
              disabled={page === pageCount}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">
              {form.id ? "Edit User" : "Add User"}
            </h3>
            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              />
              {!form.id && (
                <input
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                />
              )}
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary w-full" disabled={saving}>
                {saving ? "Saving..." : "Save User"}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowDelete(null)}
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-heading text-2xl text-slate-900">Delete user?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This action cannot be undone. Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">{showDelete.name}</span>?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setShowDelete(null)}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
            toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default Users;
