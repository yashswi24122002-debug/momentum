"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  pushSupported,
  getExistingSubscription,
  enablePushNotifications,
  disablePushNotifications,
} from "@/lib/push/client";

export function PushNotificationToggle() {
  const [supported] = useState(() => pushSupported());
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    getExistingSubscription().then((sub) => setSubscribed(!!sub));
  }, [supported]);

  async function handleToggle() {
    setBusy(true);
    if (subscribed) {
      await disablePushNotifications();
      setSubscribed(false);
      toast.success("Reminders turned off for this device.");
    } else {
      const result = await enablePushNotifications();
      if (result.ok) {
        setSubscribed(true);
        toast.success("Reminders enabled on this device.");
      } else {
        toast.error(result.error ?? "Couldn't enable reminders — try again.");
      }
    }
    setBusy(false);
  }

  if (!supported || subscribed === null) return null;

  return (
    <Button variant="outline" size="sm" onClick={handleToggle} disabled={busy}>
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : subscribed ? (
        <BellOff className="size-4" />
      ) : (
        <Bell className="size-4" />
      )}
      {subscribed ? "Turn off reminders on this device" : "Enable reminders on this device"}
    </Button>
  );
}
