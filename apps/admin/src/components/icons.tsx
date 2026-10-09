const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  report: "M4 20h16 M7 16V9 M12 16V4 M17 16v-5",
  sessions: "M12 8v4l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
  members: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87",
  teams: "M3 21V7l9-4 9 4v14 M7 10h2 M15 10h2 M7 14h2 M15 14h2 M10 21v-4h4v4",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
  plus: "M12 5v14 M5 12h14",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  chevron: "M9 5l7 7-7 7",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M10 3h4l.5 2.4 2 1.2 2.4-.8 2 3.4-1.8 1.6v2.4l1.8 1.6-2 3.4-2.4-.8-2 1.2L14 21h-4l-.5-2.4-2-1.2-2.4.8-2-3.4 1.8-1.6v-2.4L3.1 9.2l2-3.4 2.4.8 2-1.2z",
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`ui-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
