self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
  const appPath = (path) => `${scopePath}${path.startsWith("/") ? path : `/${path}`}`;
  const title = data.title || "Chef reminder";
  const options = {
    body: data.body || "Time to check your food decision.",
    tag: data.tag || "chef-reminder",
    badge: appPath("/icons/icon-192.png"),
    icon: appPath("/icons/icon-192.png"),
    data: {
      url: data.url || "/decision",
      reminderType: data.reminderType || "reminder",
    },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
  const path = event.notification.data?.url || "/decision";
  const targetUrl = new URL(`${scopePath}${path.startsWith("/") ? path : `/${path}`}`, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  })());
});
