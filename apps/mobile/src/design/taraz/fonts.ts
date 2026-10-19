import { Figtree_400Regular } from "@expo-google-fonts/figtree/400Regular";
import { Figtree_500Medium } from "@expo-google-fonts/figtree/500Medium";
import { Figtree_600SemiBold } from "@expo-google-fonts/figtree/600SemiBold";
import { Figtree_700Bold } from "@expo-google-fonts/figtree/700Bold";
import { Figtree_800ExtraBold } from "@expo-google-fonts/figtree/800ExtraBold";
import { PublicSans_400Regular } from "@expo-google-fonts/public-sans/400Regular";
import { PublicSans_500Medium } from "@expo-google-fonts/public-sans/500Medium";
import { PublicSans_600SemiBold } from "@expo-google-fonts/public-sans/600SemiBold";
import { IBMPlexMono_400Regular } from "@expo-google-fonts/ibm-plex-mono/400Regular";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { Vazirmatn_400Regular } from "@expo-google-fonts/vazirmatn/400Regular";
import { Vazirmatn_500Medium } from "@expo-google-fonts/vazirmatn/500Medium";
import { Vazirmatn_600SemiBold } from "@expo-google-fonts/vazirmatn/600SemiBold";
import { Vazirmatn_700Bold } from "@expo-google-fonts/vazirmatn/700Bold";
import { Vazirmatn_800ExtraBold } from "@expo-google-fonts/vazirmatn/800ExtraBold";
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
