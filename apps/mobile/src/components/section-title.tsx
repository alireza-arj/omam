import { Text, View } from "react-native";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function SectionTitle({ eyebrow, title, description }: Props) {
  return (
    <View className="gap-1">
      <Text className="text-xs uppercase tracking-[2px] text-mint/70">{eyebrow}</Text>
      <Text className="text-3xl font-semibold text-mist">{title}</Text>
      {description ? <Text className="text-sm leading-6 text-muted">{description}</Text> : null}
    </View>
  );
}
