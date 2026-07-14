"use client";

import { api, appPath } from "@/lib/api";

export type ReminderPermissionState =
  | "unsupported"
  | "default"
  | "denied"
  | "granted"
  | "subscribed";

function urlBase64ToApplicationServerKey(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

function deviceName(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || navigator.platform || "Device";
  const standalone = window.matchMedia("(display-mode: standalone)").matches ? "PWA" : "Browser";
  return `${platform} ${standalone}`;
}

function platformName(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return nav.userAgentData?.platform || navigator.platform || "unknown";
}

export function notificationSupport(): ReminderPermissionState {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (notificationSupport() === "unsupported") return null;
  const registration = await navigator.serviceWorker.getRegistration(appPath("/"));
  return registration?.pushManager.getSubscription() ?? null;
}

async function getAppServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(appPath("/"));
  if (existing) return existing;
  return navigator.serviceWorker.register(appPath("/sw.js"), { scope: appPath("/") });
}

export async function enableChefReminders(): Promise<void> {
  if (notificationSupport() === "unsupported") {
    throw new Error("Push notifications are not supported on this device.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked for Chef.");
  }

  const registration = await getAppServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToApplicationServerKey(await api.getVapidPublicKey()),
  });

  await api.subscribeDevice({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.toJSON().keys?.p256dh ?? "",
      auth: subscription.toJSON().keys?.auth ?? "",
    },
    device_name: deviceName(),
    platform: platformName(),
  });
}

export async function disableChefReminders(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await api.unsubscribeDevice({
    endpoint: subscription.endpoint,
    device_name: deviceName(),
    platform: platformName(),
  });
  await subscription.unsubscribe();
}
