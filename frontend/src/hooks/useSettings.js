import { useContext } from "react";
import SettingsContext from "../context/SettingsContext.jsx";

export const useSettings = () => useContext(SettingsContext);
