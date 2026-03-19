export type HotkeyAction = {
  id: string;
  label: string;
  default: string;
  category: string;
};

export const HOTKEY_ACTIONS: HotkeyAction[] = [
  { id: "new_note", label: "New Note", default: "n", category: "Navigation" },
  { id: "go_home", label: "Go to Home", default: "h", category: "Navigation" },
  { id: "open_gallery", label: "Open Gallery", default: "g", category: "Navigation" },
  { id: "toggle_zen", label: "Toggle Zen Mode", default: "z", category: "Editor" },
  { id: "open_settings", label: "Settings", default: ",", category: "App" },
  { id: "open_shortcuts", label: "Shortcuts Reference", default: "/", category: "App" },
];
