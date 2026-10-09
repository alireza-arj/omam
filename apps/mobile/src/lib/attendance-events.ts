const listeners = new Set<() => void>();

export function notifyAttendanceChanged() {
  for (const listener of listeners) listener();
}

export function onAttendanceChanged(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
