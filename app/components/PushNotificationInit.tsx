"use client";

// Zero-render component — initialises Capacitor push notifications once the
// user is authenticated. Mounted in the root layout so it covers every route.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { initPushNotifications, disablePushForUser } from "../../lib/pushNotifications";

export default function PushNotificationInit() {
  const router = useRouter();

  useEffect(() => {
    // Try to init immediately if a session is already present
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        initPushNotifications(session.user.id, router);
      }
    });

    // Also re-init on login, and clean up on logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        initPushNotifications(session.user.id, router);
      }
      if (event === "SIGNED_OUT" && session?.user?.id) {
        disablePushForUser(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
