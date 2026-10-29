import { cssVars } from "@lockin/tokens";

// Shared by the tournament and event pages.
export const section: React.CSSProperties = { display: "flex", flexDirection: "column", gap: cssVars.space.md, marginTop: cssVars.space.xl };
export const heading: React.CSSProperties = { font: cssVars.typography.heading.sm, color: cssVars.color.text.primary };
export const muted: React.CSSProperties = { font: cssVars.typography.body.md, color: cssVars.color.text.secondary };
export const errorText: React.CSSProperties = { font: cssVars.typography.body.sm, color: cssVars.color.text.danger };

export function Page({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    // The root layout supplies the main landmark, so this is just the page's content column.
    <div style={{ maxWidth: wide ? 1400 : 640, margin: `${cssVars.space.xl} auto`, padding: `0 ${cssVars.space.md}` }}>
      {children}
    </div>
  );
}
