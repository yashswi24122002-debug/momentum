// Habit reminder push notifications. Payload shape sent from
// app/api/cron/send-habit-reminders: { title, body, habitId, date, style }.
// style "checkin" gets Yes/No actions; "nudge" gets a single "Mark done".

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { title, body, habitId, date, style } = payload;

  const actions =
    style === "checkin"
      ? [
          { action: "yes", title: "Yes" },
          { action: "no", title: "No" },
        ]
      : [{ action: "done", title: "Mark done" }];

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: `habit-${habitId}-${date}`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { habitId, date, style },
      actions,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const { habitId, date } = event.notification.data ?? {};
  const markComplete = event.action === "yes" || event.action === "done";

  event.waitUntil(
    (async () => {
      if (markComplete && habitId && date) {
        try {
          await fetch(`/api/habits/${habitId}/log`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ date, completed: true }),
          });
        } catch {
          // Best-effort — if this fails (e.g. session expired), the habit
          // still shows up unmarked in the app for the user to complete by hand.
        }
      }

      const clientsList = await self.clients.matchAll({ type: "window" });
      const existing = clientsList.find((c) => c.url.includes("/habits"));
      if (existing) {
        existing.focus();
      } else if (self.clients.openWindow) {
        self.clients.openWindow("/habits");
      }
    })()
  );
});
