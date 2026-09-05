/**
 * Taraz — the Omam design layer.
 *
 * A React Native port of the Moview design system: cool white paper, blue-grey
 * ink, one hot crimson reserved for actions. Screens import from here and
 * nowhere else — no loose hex values, no ad-hoc type sizes.
 */

export * from "./tokens";
export { ThemeProvider, useTheme, useColors, useThemeMode } from "./theme";
export type { ThemeMode } from "./theme";
export { useTarazFonts, typefaces } from "./fonts";
export { LanguageProvider, useLanguage, useTranslation } from "./i18n";

export { Accordion } from "./components/accordion";
export { Avatar } from "./components/avatar";
export { Badge } from "./components/badge";
export { Button } from "./components/button";
export { Card } from "./components/card";
export { ConfirmDialog } from "./components/confirm-dialog";
export { Divider } from "./components/divider";
export { EmptyState } from "./components/empty-state";
export { Glass } from "./components/glass";
export { Icon } from "./components/icon";
export { IconButton } from "./components/icon-button";
export { Input } from "./components/input";
export { ListRow } from "./components/list-row";
export { PageHeader } from "./components/page-header";
export { ProgressBar } from "./components/progress-bar";
export { Screen } from "./components/screen";
export { SegmentedControl } from "./components/segmented-control";
export { Skeleton } from "./components/skeleton";
export { Stat } from "./components/stat";
export { TabBar, useTabBarHeight } from "./components/tab-bar";
export { Tag } from "./components/tag";
export { Text } from "./components/text";
export { ToastProvider, useToast } from "./components/toast";

export type { AccordionProps } from "./components/accordion";
export type { AvatarProps } from "./components/avatar";
export type { BadgeProps, BadgeTone } from "./components/badge";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./components/button";
export type { CardProps } from "./components/card";
export type { ConfirmDialogProps } from "./components/confirm-dialog";
export type { EmptyStateProps } from "./components/empty-state";
export type { IconProps } from "./components/icon";
export type { InputProps } from "./components/input";
export type { ListRowProps } from "./components/list-row";
export type { PageHeaderProps } from "./components/page-header";
export type { ScreenProps } from "./components/screen";
export type { SegmentOption, SegmentedControlProps } from "./components/segmented-control";
export type { StatProps } from "./components/stat";
export type { TabBarProps, TabItem } from "./components/tab-bar";
export type { TagProps } from "./components/tag";
export type { TextProps } from "./components/text";
export type { ToastOptions, ToastTone } from "./components/toast";
