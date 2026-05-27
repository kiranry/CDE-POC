"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: {
    uploaderPartyCode?: string;
    documentName?: string;
    folderCode?: string;
    uploadedAt?: string;
  } | null;
  readAt: string | null;
  createdAt: string;
  isRead: boolean;
};

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    const onRefresh = () => load();
    window.addEventListener("cde-party-changed", onRefresh);
    window.addEventListener("cde-notifications-changed", onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("cde-party-changed", onRefresh);
      window.removeEventListener("cde-notifications-changed", onRefresh);
    };
  }, [load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
      ),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    await load();
  }

  async function clearAll() {
    await fetch("/api/notifications", { method: "DELETE" });
    setNotifications([]);
    setUnreadCount(0);
  }

  function handleItemClick(n: NotificationItem) {
    if (!n.isRead) markRead(n.id);
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100"
        title="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="text-lg" aria-hidden>
          🔔
        </span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <span className="sr-only">
          Notifications{unreadCount > 0 ? `, ${unreadCount} unread` : ""}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,24rem)] rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-900">Notifications</h2>
            {(unreadCount > 0 || notifications.length > 0) && (
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs text-slate-600 hover:text-red-700 hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 ${
                        n.isRead ? "bg-white opacity-75" : "bg-blue-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            n.isRead
                              ? "font-normal text-slate-600"
                              : "font-semibold text-slate-900"
                          }`}
                        >
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span
                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{n.message}</p>
                      <p className="mt-2 text-[10px] text-slate-400">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="border-t border-slate-100 px-4 py-2 text-center text-[10px] text-slate-400">
            Clear all permanently removes notifications from your view
          </p>
        </div>
      )}
    </div>
  );
}
