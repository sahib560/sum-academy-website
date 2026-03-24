import { SettingsProvider } from "./SettingsContext.jsx";
import { useSettings } from "../hooks/useSettings.js";

export const SiteSettingsProvider = SettingsProvider;
export const useSiteSettings = useSettings;
