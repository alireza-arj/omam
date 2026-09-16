import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type InputHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import {
  Avatar as HeroAvatar,
  Button as HeroButton,
  Card as HeroCard,
  Chip,
  Description,
  EmptyState as HeroEmptyState,
  FieldError,
  Input as HeroInput,
  Label,
  ListBox,
  Modal as HeroModal,
  ProgressBar,
  Select as HeroSelect,
  Spinner,
  TextArea,
  TextField,
  buttonVariants,
  Checkbox as HeroCheckbox,
  ColorPicker,
  ColorArea,
  ColorSlider,
  ColorSwatch,
  ColorField,
  Dropdown,
} from "@heroui/react";
import { Link } from "react-router-dom";
import { initials } from "../lib/format";
import { useT } from "../lib/i18n";

export { Table } from "@heroui/react";

type ButtonProps = Omit<ComponentProps<typeof HeroButton>, "variant" | "children"> & {
  children?: ReactNode;
  disabled?: boolean;
  variant?: "quiet" | "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  block?: boolean;
  loading?: boolean;
};

export function Button({
  variant = "quiet",
  size = "md",
  block,
  loading,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <HeroButton
      {...rest}
      variant={variant === "quiet" ? "secondary" : variant === "danger" ? "danger-soft" : variant}
      size={size}
      fullWidth={block}
      isDisabled={disabled || loading}
      isPending={loading}
      className={className}
    >
      {loading ? <Spinner size="sm" color="current" /> : null}
      {children}
    </HeroButton>
  );
}

export function Card({
  children,
  flush,
  className = "",
  style,
}: PropsWithChildren<{ flush?: boolean; className?: string; style?: CSSProperties }>) {
  return (
    <HeroCard className={`${flush ? "omam-card-flush" : ""} ${className}`} style={style}>
      {children}
    </HeroCard>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <HeroCard.Header className="omam-card-header">
      <div className="stack gap-2">
        <h2 className="card__title">{title}</h2>
        {subtitle ? <HeroCard.Description>{subtitle}</HeroCard.Description> : null}
      </div>
      {actions ? <div className="row gap-4">{actions}</div> : null}
    </HeroCard.Header>
  );
}

export function Badge({
  tone = "neutral",
  dot,
  children,
}: PropsWithChildren<{ tone?: "neutral" | "success" | "warning" | "info" | "accent"; dot?: boolean }>) {
  return (
    <Chip
      size="sm"
      variant="soft"
      color={tone === "neutral" || tone === "info" ? "default" : tone}
      className={tone === "info" ? "omam-chip-info" : undefined}
    >
      {dot ? <span className="dot" aria-hidden /> : null}
      {children}
    </Chip>
  );
}

const STATUS_TONE = { OPEN: "info", COMPLETED: "success" } as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS_TONE }) {
  const t = useT();
  return (
    <Badge tone={STATUS_TONE[status]} dot>
      {t(`status.${status}`)}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: "OWNER" | "MANAGER" | "MEMBER" }) {
  const t = useT();
  return <Badge>{t(`role.${role}`)}</Badge>;
}

export function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <HeroAvatar size={size} aria-hidden>
      {src ? <HeroAvatar.Image src={src} alt="" /> : null}
      <HeroAvatar.Fallback>{initials(name)}</HeroAvatar.Fallback>
    </HeroAvatar>
  );
}

export function Person({ name, meta, src }: { name: string; meta?: ReactNode; src?: string | null }) {
  return (
    <div className="row gap-5">
      <Avatar name={name} src={src} />
      <div className="stack">
        <span className="t-label">{name}</span>
        {meta ? <span className="t-caption muted">{meta}</span> : null}
      </div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">
        <bdi>{value}</bdi>
      </span>
      {hint ? <span className="t-caption muted">{hint}</span> : null}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  const t = useT();
  const percent = Math.min(100, Math.max(0, Number.isFinite(value) ? value * 100 : 0));
  return (
    <ProgressBar value={percent} aria-label={t("common.progress")} size="sm">
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  );
}

const FieldContext = createContext<{ id: string; labelId: string; error?: string | null } | null>(null);

export function Field({
  label,
  error,
  hint,
  children,
}: PropsWithChildren<{ label: string; error?: string | null; hint?: ReactNode }>) {
  const id = useId();
  return (
    <FieldContext.Provider value={{ id, labelId: `${id}-label`, error }}>
      <TextField isInvalid={Boolean(error)} className="omam-field">
        <Label id={`${id}-label`} htmlFor={id}>
          {label}
        </Label>
        {children}
        {hint && !error ? <Description>{hint}</Description> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </TextField>
    </FieldContext.Provider>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const field = useContext(FieldContext);
  return <HeroInput {...props} id={props.id ?? field?.id} fullWidth />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useContext(FieldContext);
  return <TextArea {...props} id={props.id ?? field?.id} fullWidth />;
}

type SelectProps = {
  value?: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  className?: string;
  "aria-label"?: string;
};

export function Select({
  value,
  onValueChange,
  children,
  disabled,
  required,
  name,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  const field = useContext(FieldContext);
  const options = Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value: string; children: ReactNode; disabled?: boolean }>(child)) return [];
    return [{ id: child.props.value, label: child.props.children, disabled: child.props.disabled }];
  });
  return (
    <HeroSelect
      value={value ?? options[0]?.id ?? null}
      onChange={(next) => {
        if (next !== null) onValueChange(String(next));
      }}
      isDisabled={disabled}
      isRequired={required}
      isInvalid={Boolean(field?.error)}
      name={name}
      aria-label={ariaLabel}
      aria-labelledby={field?.labelId}
      className={className}
      fullWidth
    >
      <HeroSelect.Trigger id={field?.id}>
        <HeroSelect.Value />
        <HeroSelect.Indicator />
      </HeroSelect.Trigger>
      <HeroSelect.Popover>
        <ListBox disabledKeys={options.filter((option) => option.disabled).map((option) => option.id)}>
          {options.map((option) => (
            <ListBox.Item
              key={option.id}
              id={option.id}
              textValue={typeof option.label === "string" ? option.label : undefined}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
}

export function Checkbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  "aria-label": label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  "aria-label": string;
}) {
  return (
    <HeroCheckbox
      slot={null}
      isSelected={checked}
      isIndeterminate={indeterminate}
      isDisabled={disabled}
      onChange={onChange}
      aria-label={label}
    >
      <HeroCheckbox.Content aria-label={label}>
        <HeroCheckbox.Control>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
      </HeroCheckbox.Content>
    </HeroCheckbox>
  );
}

export function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <ColorPicker value={value} onChange={(color) => onChange(color.toString("hex").toUpperCase())}>
      <ColorPicker.Trigger aria-label={label}>
        <ColorSwatch />
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="omam-color-picker">
        <ColorArea colorSpace="hsb" xChannel="saturation" yChannel="brightness" aria-label={label}>
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider colorSpace="hsb" channel="hue" aria-label={label}>
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
        <ColorField aria-label={label}>
          <ColorField.Group>
            <ColorField.Input />
          </ColorField.Group>
        </ColorField>
      </ColorPicker.Popover>
    </ColorPicker>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: PropsWithChildren<{ title: string; onClose: () => void; footer?: ReactNode }>) {
  const t = useT();
  return (
    <HeroModal.Backdrop
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      isDismissable
    >
      <HeroModal.Container>
        <HeroModal.Dialog>
          <HeroModal.CloseTrigger aria-label={t("common.close")} />
          <HeroModal.Header>
            <HeroModal.Heading>{title}</HeroModal.Heading>
          </HeroModal.Header>
          <HeroModal.Body className="stack gap-6">{children}</HeroModal.Body>
          {footer ? <HeroModal.Footer>{footer}</HeroModal.Footer> : null}
        </HeroModal.Dialog>
      </HeroModal.Container>
    </HeroModal.Backdrop>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <HeroEmptyState className="empty">
      <span className="t-title3">{title}</span>
      {hint ? <p className="t-body-sm muted">{hint}</p> : null}
      {action}
    </HeroEmptyState>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="empty" role="status">
      <Spinner />
      <span className="t-body-sm muted">{label ?? t("common.loading")}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <EmptyState
      title={t("common.notLoaded")}
      hint={message}
      action={onRetry ? <Button onClick={onRetry}>{t("common.retry")}</Button> : undefined}
    />
  );
}

export function ButtonLink({
  to,
  children,
  primary = false,
}: PropsWithChildren<{ to: string; primary?: boolean }>) {
  return (
    <Link to={to} className={buttonVariants({ variant: primary ? "primary" : "ghost" })}>
      {children}
    </Link>
  );
}

export function ActionMenu({
  label,
  children,
  items,
  disabled = false,
}: {
  label: string;
  children?: ReactNode;
  disabled?: boolean;
  items: { label: string; onAction: () => void; disabled?: boolean }[];
}) {
  const t = useT();
  return (
    <Dropdown>
      <Dropdown.Trigger
        className={`action-trigger ${children ? "account-trigger" : ""}`}
        aria-label={label}
        isDisabled={disabled}
      >
        {children ?? t("admin.table.actions")}
        <span aria-hidden>⌄</span>
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label={label}>
          {items.map((item) => (
            <Dropdown.Item
              key={item.label}
              id={item.label}
              textValue={item.label}
              isDisabled={item.disabled}
              onAction={item.onAction}
            >
              {item.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export function TableScroll({ children }: PropsWithChildren) {
  const t = useT();
  const region = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = region.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setOverflows(element.scrollWidth > element.clientWidth));
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [children]);
  return (
    <>
      <div ref={region} className="table-scroll" role="region" aria-label={t("common.records")} tabIndex={0}>
        {children}
      </div>
      {overflows ? <p className="table-scroll-hint t-caption muted">{t("admin.table.scrollHint")}</p> : null}
    </>
  );
}
