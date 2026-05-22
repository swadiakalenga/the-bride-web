// Capacitor push notification setup.
// Gracefully skips on web — only active on native Android/iOS builds.

import { supabase } from "./supabase";

type AppRouter = { push: (path: string) => void };

export async function initPushNotifications(userId: string, router: AppRouter): Promise<void> {
  if (typeof window === "undefined") return;

  // Dynamic import — Capacitor modules throw on web if imported at module load
  let Capacitor: typeof import("@capacitor/core").Capacitor;
  try {
    ({ Capacitor } = await import("@capacitor/core"));
    if (!Capacitor.isNativePlatform()) return;
  } catch {
    return;
  }

  let PushNotifications: typeof import("@capacitor/push-notifications").PushNotifications;
  try {
    ({ PushNotifications } = await import("@capacitor/push-notifications"));
  } catch {
    console.warn("[push] @capacitor/push-notifications not available");
    return;
  }

  // 1. Request OS permission
  const { receive } = await PushNotifications.requestPermissions();
  if (receive !== "granted") {
    console.info("[push] permission not granted");
    return;
  }

  // 2. Register with FCM — triggers 'registration' event below
  await PushNotifications.register();

  // 3. Persist token in Supabase
  await PushNotifications.addListener("registration", async (token) => {
    const platform = Capacitor.getPlatform() as "android" | "ios";
    const { error } = await supabase.from("device_push_tokens").upsert(
      {
        user_id: userId,
        token: token.value,
        platform,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" },
    );
    if (error) console.error("[push] token save error", error);
  });

  await PushNotifications.addListener("registrationError", (err) => {
    console.error("[push] registration error", err);
  });

  // 4. Log foreground notifications (OS handles background display automatically)
  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.info("[push] foreground notification", notification.title);
  });

  // 5. Notification tap → deep link
  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = (action.notification.data ?? {}) as Record<string, string | undefined>;
    const type = data.type;

    if ((type === "message" || type === "message_request") && data.conversation_id) {
      router.push(`/messages/${data.conversation_id}`);
    } else if (
      (type === "church_verified" ||
        type === "church_rejected" ||
        type === "membership_approved" ||
        type === "membership_rejected" ||
        type === "membership_request") &&
      data.church_id
    ) {
      router.push(`/church/${data.church_id}`);
    } else if (
      (type === "comment" ||
        type === "reply" ||
        type === "like" ||
        type === "tag") &&
      data.post_id
    ) {
      router.push(`/post/${data.post_id}`);
    } else {
      router.push("/notifications");
    }
  });
}

// Call on sign-out to disable delivery to this device
export async function disablePushForUser(userId: string): Promise<void> {
  await supabase
    .from("device_push_tokens")
    .update({ enabled: false })
    .eq("user_id", userId);
}
