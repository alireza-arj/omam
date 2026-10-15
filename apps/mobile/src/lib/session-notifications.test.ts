import { beforeEach, expect, mock, test } from "bun:test";
import type { NotificationHandler, NotificationRequest, NotificationRequestInput } from "expo-notifications";
import type { SessionDto } from "@omam/contracts";

const platform = { OS: "android" };
let handler: NotificationHandler | null = null;
let scheduled: NotificationRequest[] = [];
let presented: { request: NotificationRequest; date: number }[] = [];
let permission = { granted: true, canAskAgain: true };
const copy = { title: "Title", body: "Body", channelName: "Work sessions" };
const session = { id: "session" } as SessionDto;

function request(identifier: string, kind?: string, sessionKey?: string): NotificationRequest {
  return {
    identifier,
    content: { title: copy.title, body: copy.body, subtitle: null, sound: null, data: { kind, sessionKey } },
    trigger: null,
  };
}

const cancel = mock(async (identifier: string) => {
  scheduled = scheduled.filter((item) => item.identifier !== identifier);
});
const dismiss = mock(async (identifier: string) => {
  presented = presented.filter((item) => item.request.identifier !== identifier);
});
const schedule = mock(async (input: NotificationRequestInput) => {
  const identifier = `scheduled-${schedule.mock.calls.length}`;
  scheduled.push({ ...request(identifier), content: { ...request(identifier).content, ...input.content } });
  return identifier;
});
const askPermission = mock(async () => ({ granted: true, canAskAgain: true }));
mock.module("react-native", () => ({ Platform: platform }));
mock.module("expo-notifications", () => ({
  setNotificationHandler: (next: NotificationHandler) => { handler = next; },
  getAllScheduledNotificationsAsync: async () => [...scheduled],
  getPresentedNotificationsAsync: async () => [...presented],
  cancelScheduledNotificationAsync: cancel,
  dismissNotificationAsync: dismiss,
  scheduleNotificationAsync: schedule,
  setNotificationChannelAsync: async () => {},
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
  getPermissionsAsync: async () => permission,
  requestPermissionsAsync: askPermission,
}));

// Each import has its own startup cleanup and scheduling queue, like a fresh app launch.
let moduleId = 0;
const load = () => import(`./session-notifications.ts?test=${moduleId++}`) as Promise<typeof import("./session-notifications")>;

beforeEach(() => {
  platform.OS = "android";
  handler = null;
  scheduled = [];
  presented = [];
  permission = { granted: true, canAskAgain: true };
  cancel.mockClear();
  dismiss.mockClear();
  schedule.mockClear();
  askPermission.mockReset();
  askPermission.mockImplementation(async () => ({ granted: true, canAskAgain: true }));
});

test("removes legacy sync and untagged notifications while preserving the three allowed types", async () => {
  scheduled = [request("sync", "sync-complete"), request("untagged"), request("in", "clock-in"), request("out", "clock-out"), request("reminder", "session-reminder", "user:session")];
  presented = scheduled.map((request) => ({ request, date: 0 }));
  const notifications = await load();
  await notifications.configureSessionNotificationHandler();
  expect(scheduled.map((item) => item.identifier)).toEqual(["in", "out", "reminder"]);
  expect(presented.map((item) => item.request.identifier)).toEqual(["in", "out", "reminder"]);
  for (const kind of ["clock-in", "clock-out", "session-reminder", "sync-complete", undefined]) {
    const behavior = await handler!.handleNotification({ request: request("incoming", kind), date: 0 });
    expect(behavior.shouldShowBanner).toBe(["clock-in", "clock-out", "session-reminder"].includes(kind ?? ""));
    expect(behavior.shouldShowList).toBe(behavior.shouldShowBanner);
    expect(behavior.shouldPlaySound).toBe(false);
    expect(behavior.shouldSetBadge).toBe(false);
  }
});

test("only schedules start and stop confirmations and a single repeating two-hour reminder", async () => {
  const notifications = await load();
  // @ts-expect-error Sync is intentionally rejected at both the type and runtime boundaries.
  await notifications.sendSessionNotification("sync-complete", copy);
  await notifications.sendSessionNotification("clock-in", copy);
  await notifications.sendSessionNotification("clock-out", copy);
  await notifications.reconcileSessionReminder(session, "user", copy);
  await notifications.reconcileSessionReminder(session, "user", copy);
  expect(schedule.mock.calls.map(([input]) => input.content.data?.kind)).toEqual(["clock-in", "clock-out", "session-reminder"]);
  expect(schedule.mock.calls[2]?.[0].trigger).toEqual({ type: "timeInterval", seconds: 7200, repeats: true, channelId: "work-sessions" });
  await notifications.cancelSessionReminder(session.id);
  expect(scheduled.some((item) => item.content.data?.kind === "session-reminder")).toBe(false);
});

test("deduplicates reminders and cancels them on sign-out even when permission is revoked", async () => {
  scheduled = [request("old", "session-reminder", "other:session"), request("keep", "session-reminder", "user:session"), request("duplicate", "session-reminder", "user:session")];
  const notifications = await load();
  await notifications.reconcileSessionReminder(session, "user", copy);
  expect(scheduled.map((item) => item.identifier)).toEqual(["keep"]);
  permission.granted = false;
  await notifications.reconcileSessionReminder(null, null, copy);
  expect(scheduled).toHaveLength(0);
});

test("stopping while the permission prompt is open cannot leave a repeating reminder behind", async () => {
  permission.granted = false;
  let grant: (() => void) | undefined;
  askPermission.mockImplementation(() => new Promise((resolve) => {
    grant = () => {
      permission.granted = true;
      resolve(permission);
    };
  }));
  const notifications = await load();
  const start = notifications.sendSessionNotification("clock-in", copy);
  const reminder = notifications.reconcileSessionReminder(session, "user", copy);
  const stop = notifications.cancelSessionReminder(session.id);
  while (!grant) await Promise.resolve();
  grant();
  await Promise.all([start, reminder, stop]);
  expect(scheduled.some((item) => item.content.data?.kind === "session-reminder")).toBe(false);
});

test("reminders and stop confirmations never request notification permission", async () => {
  permission.granted = false;
  const notifications = await load();
  await notifications.sendSessionNotification("clock-out", copy);
  await notifications.reconcileSessionReminder(session, "user", copy);
  expect(askPermission).not.toHaveBeenCalled();
  expect(schedule).not.toHaveBeenCalled();
  await notifications.sendSessionNotification("clock-in", copy);
  expect(askPermission).toHaveBeenCalledTimes(1);
});

test("web and desktop do not use native notifications", async () => {
  platform.OS = "web";
  const notifications = await load();
  await notifications.sendSessionNotification("clock-in", copy);
  await notifications.reconcileSessionReminder(session, "user", copy);
  expect(handler).toBeNull();
  expect(schedule).not.toHaveBeenCalled();
});
