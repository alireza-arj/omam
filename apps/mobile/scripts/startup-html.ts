import { createTranslator } from "@omam/i18n";
import { startupTokens } from "../src/design/taraz/startup-tokens";

function restoreStartupPreferences() {
  try {
    const theme = localStorage.getItem("taraz.theme-mode");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.startupTheme = theme;
    const language = localStorage.getItem("taraz.language");
    if (language === "en" || language === "fa") {
      document.documentElement.lang = language;
      document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
    }
  } catch {}
}

export function startupHead() {
  return `<style id="startup-style">
    :root { --app-background: ${startupTokens.lightBackground}; --startup-logo-background: ${startupTokens.lightLogoBackground}; }
    @media (prefers-color-scheme: dark) {
      :root { --app-background: ${startupTokens.darkBackground}; --startup-logo-background: ${startupTokens.darkLogoBackground}; }
    }
    :root[data-startup-theme="light"] { --app-background: ${startupTokens.lightBackground}; --startup-logo-background: ${startupTokens.lightLogoBackground}; }
    :root[data-startup-theme="dark"] { --app-background: ${startupTokens.darkBackground}; --startup-logo-background: ${startupTokens.darkLogoBackground}; }
    html, body { background: var(--app-background); }
    #startup-splash { flex: 1; display: flex; align-items: center; justify-content: center; background: var(--app-background); }
    #startup-splash svg { width: ${startupTokens.logoSize}px; height: ${startupTokens.logoSize}px; border-radius: ${startupTokens.logoRadius}px; }
    #startup-splash rect { fill: var(--startup-logo-background); }
    #startup-splash [lang="fa"] { display: none; }
    html:lang(fa) #startup-splash [lang="en"] { display: none; }
    html:lang(fa) #startup-splash [lang="fa"] { display: flex; }
    #startup-splash [lang="en"] { display: flex; }
  </style><script>(${restoreStartupPreferences.toString()})();</script>`;
}

export function startupMarkup(logo: string) {
  const image = logo.replace(/<title>.*?<\/title>/, "").replace("<svg ", '<svg aria-hidden="true" ');
  const labels = (["en", "fa"] as const).map((language) => {
    const t = createTranslator(language);
    return `<span lang="${language}" role="progressbar" aria-label="${t("admin.brand")} — ${t("common.loading")}" aria-busy="true">${image}</span>`;
  }).join("");
  return `<div id="startup-splash">${labels}</div>`;
}
