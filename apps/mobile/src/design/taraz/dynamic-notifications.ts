export type DynamicNotification = {
  kind: "clock-in" | "clock-out" | "test";
  title: string;
  body: string;
};

const listeners = new Set<(notification: DynamicNotification) => void>();

export function showDynamicNotification(notification: DynamicNotification) {
  for (const listener of listeners) listener(notification);
}

export function subscribeDynamicNotifications(listener: (notification: DynamicNotification) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
