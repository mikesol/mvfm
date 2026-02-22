export const MONO_THEME = {
  name: "mvfm-mono",
  type: "dark" as const,
  colors: {
    "editor.background": "#0a0a0a",
    "editor.foreground": "#a3a3a3",
  },
  settings: [
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#525252" } },
    { scope: ["string", "string.quoted"], settings: { foreground: "#d4d4d4" } },
    { scope: ["constant.numeric"], settings: { foreground: "#e5e5e5" } },
    { scope: ["keyword", "storage.type", "storage.modifier"], settings: { foreground: "#737373" } },
    { scope: ["entity.name.function", "support.function"], settings: { foreground: "#e5e5e5" } },
    { scope: ["variable", "variable.other"], settings: { foreground: "#a3a3a3" } },
    { scope: ["entity.name.type", "support.type"], settings: { foreground: "#a3a3a3" } },
    { scope: ["punctuation", "meta.brace"], settings: { foreground: "#525252" } },
    { scope: ["constant.language"], settings: { foreground: "#d4d4d4" } },
    { scope: ["entity.name.tag"], settings: { foreground: "#737373" } },
    {
      scope: ["support.class", "entity.other.inherited-class"],
      settings: { foreground: "#a3a3a3" },
    },
    { scope: ["meta.property-name", "entity.name.property"], settings: { foreground: "#d4d4d4" } },
    { scope: ["variable.other.property"], settings: { foreground: "#d4d4d4" } },
    { scope: ["keyword.operator"], settings: { foreground: "#737373" } },
  ],
};
