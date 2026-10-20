import { useFonts } from "expo-font";
import Figtree_400Regular from "../../../../desktop/build/fonts/Figtree_400Regular.woff2";
import Figtree_500Medium from "../../../../desktop/build/fonts/Figtree_500Medium.woff2";
import Figtree_600SemiBold from "../../../../desktop/build/fonts/Figtree_600SemiBold.woff2";
import Figtree_700Bold from "../../../../desktop/build/fonts/Figtree_700Bold.woff2";
import Figtree_800ExtraBold from "../../../../desktop/build/fonts/Figtree_800ExtraBold.woff2";
import PublicSans_400Regular from "../../../../desktop/build/fonts/PublicSans_400Regular.woff2";
import PublicSans_500Medium from "../../../../desktop/build/fonts/PublicSans_500Medium.woff2";
import PublicSans_600SemiBold from "../../../../desktop/build/fonts/PublicSans_600SemiBold.woff2";
import IBMPlexMono_400Regular from "../../../../desktop/build/fonts/IBMPlexMono_400Regular.woff2";
import IBMPlexMono_500Medium from "../../../../desktop/build/fonts/IBMPlexMono_500Medium.woff2";
import Estedad_400Regular from "../../../../desktop/build/fonts/Estedad_400Regular.woff2";
import Estedad_500Medium from "../../../../desktop/build/fonts/Estedad_500Medium.woff2";
import Estedad_600SemiBold from "../../../../desktop/build/fonts/Estedad_600SemiBold.woff2";
import Estedad_700Bold from "../../../../desktop/build/fonts/Estedad_700Bold.woff2";
import Estedad_800ExtraBold from "../../../../desktop/build/fonts/Estedad_800ExtraBold.woff2";

export const typefaces = {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold,
  PublicSans_400Regular, PublicSans_500Medium, PublicSans_600SemiBold,
  IBMPlexMono_400Regular, IBMPlexMono_500Medium,
  Estedad_400Regular, Estedad_500Medium, Estedad_600SemiBold, Estedad_700Bold, Estedad_800ExtraBold,
} satisfies typeof import("./fonts").typefaces;

export function useTarazFonts() {
  const [loaded, error] = useFonts(typefaces);
  return { fontsLoaded: loaded, fontError: error };
}
