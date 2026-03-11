import React, { useEffect, useState } from "react";
import { listAdminUsers, runAdminUserAction } from "../lib/apiClient.js";

const roles = ["all", "artist", "listener", "admin"];

export default function DenUsers() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await listAdminUsers({ q, role: role === "all" ? "" : role, limit: 200 });
      setUsers(Array.isArray(result.users) ? result.users : []);
    } catch (err) {
      setError(err.message || "Failed to load users");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runAction = async (user, action) => {
    const reason = window.prompt(`Reason for ${action} (${user.email}):`);
    if (!reason) return;
    await runAdminUserAction(user.userId, { action, reason });
    await load();
  };

  const deleteUser = async (user) => {
    const marker = window.prompt(`Type DELETE to permanently remove user ${user.email}.`);
    if (marker !== "DELETE") return;
    const reason = window.prompt("Reason for permanent user deletion:");
    if (!reason) return;
    await runAdminUserAction(user.userId, { action: "delete_permanent", reason });
    await load();
  };

  return (
    <div className="page-wrap">
      <header className="page-header">
        <p className="eyebrow">User / Listener Management</p>
        <h1>Users</h1>
      </header>
      <section className="panel">
        <div className="album-actions">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search user/email/artist" />
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {roles.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="button" className="secondary-button" onClick={load} disabled={busy}>Search</button>
        </div>
        {error ? <p style={{ color: "#a40000" }}>{error}</p> : null}

        <ol className="status-stack">
          {users.map((user) => (
            <li key={user.userId}>
              <strong>{user.email}</strong>
              <span>ID: {user.userId}</span>
              <span>Role: {user.role}{user.adminScope ? ` (${user.adminScope})` : ""} | Status: {user.accountStatus}</span>
              <span>Saved tracks: {user.savedLibraryCount} | Play events: {user.telemetrySummary?.playEvents ?? 0}</span>
              <span>Last active: {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : "-"}</span>
              <div className="album-actions">
                <button type="button" className="secondary-button" onClick={() => runAction(user, "suspend")}>Suspend</button>
                <button type="button" className="secondary-button" onClick={() => runAction(user, "reinstate")}>Reinstate</button>
                <button type="button" className="secondary-button" onClick={() => deleteUser(user)}>Delete User</button>
              </div>
            </li>
          ))}
          {!users.length && !busy ? <li><strong>No users found.</strong></li> : null}
        </ol>
      </section>
    </div>
  );
}
