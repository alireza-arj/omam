import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from "@expo-google-fonts/figtree";
import {
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
} from "@expo-google-fonts/public-sans";
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from "@expo-google-fonts/ibm-plex-mono";
import {
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
  Vazirmatn_800ExtraBold,
} from "@expo-google-fonts/vazirmatn";
import { useFonts } from "expo-font";

/**
 * Figtree for display and UI labels, Public Sans for running copy, IBM Plex
 * Mono for timecodes and counts. React Native cannot synthesise weights for a
 * custom family, so every weight ships as its own face.
 *
 * Vazirmatn covers Persian: none of the Latin faces have Persian glyphs, so a
 * Persian string in one of them renders as empty boxes.
 */
export const typefaces = {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  PublicSans_400Regular,
  PublicSans_500Medium,
  PublicSans_600SemiBold,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
  Vazirmatn_800ExtraBold,
};

export function useTarazFonts() {
  const [loaded, error] = useFonts(typefaces);

  return { fontsLoaded: loaded, fontError: error };
}
