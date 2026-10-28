import "./dynamic-notifications.web.css";
import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Easing } from "react-native";
import { Bell, Check, Clock3, X } from "lucide-react-native";
import { useLanguage } from "../i18n";
import { useColors } from "../theme";
import { layout, motion, notificationTokens as tokens, palette, radius, space } from "../tokens";
import { subscribeDynamicNotifications, type DynamicNotification } from "../dynamic-notifications";
import { notificationGeometry } from "./dynamic-notification-geometry";
import { Icon } from "./icon";
import { Text } from "./text";

const ease = Easing.bezier(motion.easePopover.x1, motion.easePopover.y1, motion.easePopover.x2, motion.easePopover.y2);

export function DynamicNotifications() {
  const colors = useColors();
  const { direction, t } = useLanguage();
  const filterId = `notification-goo-${useId().replace(/:/g, "")}`;
  const [notification, setNotification] = useState<DynamicNotification | null>(null);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [size, setSize] = useState({ width: tokens.cardMaxWidth as number, height: tokens.cardMinHeight as number });
  const [reducedMotion, setReducedMotion] = useState(false);
  const progress = useRef(0);
  const card = useRef<HTMLDivElement>(null);
  const shape = useRef<SVGRectElement>(null);
  const neck = useRef<SVGRectElement>(null);
  const canvas = useRef<SVGSVGElement>(null);
  const drag = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; y: number } | null>(null);

  useEffect(() => subscribeDynamicNotifications((next) => {
    if (document.visibilityState === "hidden") return;
    setNotification({ ...next });
    setPaused(false);
    setOpen(true);
  }), []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!notification || !card.current) return;
    const element = card.current;
    const measure = () => setSize({ width: element.offsetWidth, height: element.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [notification]);

  useEffect(() => {
    if (!notification) return;
    let frame = 0;
    const from = progress.current;
    const target = open ? 1 : 0;
    const started = performance.now();
    const duration = reducedMotion ? motion.durFast : tokens.duration;
    const draw = (now: number) => {
      const elapsed = Math.min(1, (now - started) / duration);
      const value = from + (target - from) * ease(elapsed);
      progress.current = value;
      const geometry = notificationGeometry(reducedMotion ? 1 : value, size.width, size.height);
      for (const [element, attributes] of [
        [shape.current, { x: geometry.x, y: geometry.y, width: geometry.width, height: geometry.height, rx: geometry.radius }],
        [neck.current, { x: geometry.neckX, y: geometry.neckY, width: geometry.neckWidth, height: geometry.neckHeight, rx: geometry.neckWidth / 2 }],
      ] as const) {
        for (const [key, attribute] of Object.entries(attributes)) element?.setAttribute(key, String(attribute));
      }
      if (canvas.current) canvas.current.style.opacity = String(value);
      if (card.current) {
        card.current.style.opacity = String(reducedMotion ? value : geometry.reveal);
        card.current.style.transform = reducedMotion ? "none" : `translateY(${geometry.offsetY}px) scale(${motion.pressScale + geometry.reveal * (1 - motion.pressScale)})`;
      }
      if (elapsed < 1) frame = requestAnimationFrame(draw);
      else if (!open) setNotification(null);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [open, notification, size.width, size.height, reducedMotion]);

  useEffect(() => {
    if (!open || paused || !notification) return;
    const timer = setTimeout(() => setOpen(false), tokens.lifetime);
    return () => clearTimeout(timer);
  }, [open, paused, notification]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const onVisibility = () => { if (document.visibilityState === "hidden") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open]);

  function endDrag(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    if (pointer.current?.id !== event.pointerId) return;
    if (!cancelled && event.clientY - pointer.current.y < -tokens.swipeDistance) setOpen(false);
    pointer.current = null;
    if (drag.current) drag.current.style.transform = "none";
    setPaused(false);
  }

  if (!notification || typeof document === "undefined") return null;
  const glyph = notification.kind === "clock-in" ? Clock3 : notification.kind === "clock-out" ? Check : Bell;
  const style = {
    "--notification-top": `${tokens.top}px`,
    "--notification-frame": `${layout.webFrameMaxWidth}px`,
    "--notification-max": `${tokens.cardMaxWidth}px`,
    "--notification-margin": `${space[7]}px`,
    "--notification-gap": `${tokens.islandHeight + tokens.cardGap}px`,
    "--notification-height": `${tokens.cardMinHeight}px`,
    "--notification-radius": `${radius.full}px`,
    "--notification-pad": `${space[7]}px`,
    "--notification-close": `${layout.tapMin}px`,
    "--notification-fast": `${motion.durFast}ms`,
    "--notification-ease": `cubic-bezier(${Object.values(motion.easePopover).join(",")})`,
    "--notification-press": String(motion.pressScale),
    "--notification-surface": colors.surfaceCard,
    "--notification-ink": colors.textBody,
    "--notification-line": colors.lineStrong,
    "--notification-hairline": `${layout.hairline}px`,
    "--notification-shadow": tokens.shadow,
    "--notification-focus": colors.focusRing,
    zIndex: tokens.layer,
  } as CSSProperties;

  return createPortal(
    <div className="taraz-notification" style={style} dir={direction} data-testid="dynamic-notification" data-open={open}>
      <svg ref={canvas} aria-hidden="true" width="100%" height={tokens.islandHeight + tokens.cardGap + size.height + tokens.canvasPadding} viewBox={`0 0 ${size.width} ${tokens.islandHeight + tokens.cardGap + size.height + tokens.canvasPadding}`} style={{ overflow: "visible", opacity: 0 }}>
        <defs>
          <filter id={filterId} x="-25%" y="-50%" width="150%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={tokens.blur} />
            <feColorMatrix type="matrix" values={`1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${tokens.gooGain} ${-tokens.gooGain * tokens.gooThreshold}`} />
          </filter>
        </defs>
        <g filter={reducedMotion ? undefined : `url(#${filterId})`}>
          <rect x={(size.width - tokens.islandWidth) / 2} width={tokens.islandWidth} height={tokens.islandHeight} rx={tokens.islandHeight / 2} fill={palette.gray950} />
          <rect ref={neck} fill={palette.gray950} />
          <rect ref={shape} fill={colors.surfaceCard} />
        </g>
      </svg>
      <div ref={drag} className="taraz-notification-drag"
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest("button")) return;
          pointer.current = { id: event.pointerId, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
          setPaused(true);
        }}
        onPointerMove={(event) => {
          if (pointer.current?.id !== event.pointerId || !drag.current || reducedMotion) return;
          drag.current.style.transform = `translateY(${Math.min(0, event.clientY - pointer.current.y)}px)`;
        }}
        onPointerUp={(event) => endDrag(event)} onPointerCancel={(event) => endDrag(event, true)}>
        <div ref={card} className="taraz-notification-card" style={{ opacity: 0 }}
          role="status" aria-live="polite" aria-atomic="true"
          onPointerEnter={() => setPaused(true)} onPointerLeave={() => { if (!pointer.current) setPaused(false); }}
          onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
          <div aria-hidden="true" className="taraz-notification-icon"><Icon glyph={glyph} size={layout.iconMd} color={notification.kind === "test" ? colors.infoText : colors.successText} /></div>
          <div className="taraz-notification-copy">
            <Text role="button" tone="title">{notification.title}</Text>
            <Text role="bodySm" tone="muted">{notification.body}</Text>
          </div>
          <button type="button" className="taraz-notification-close" aria-label={t("common.close")} onClick={() => setOpen(false)}>
            <Icon glyph={X} size={layout.iconSm} color={colors.textMuted} />
          </button>
        </div>
      </div>
    </div>, document.body,
  );
}
