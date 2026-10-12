import {createContext, useContext, type ReactNode} from 'react';
interface MermaidThemeContextValue {
  frontmatterTheme: string | null;
}
const MermaidThemeContext = createContext<MermaidThemeContextValue>({
  frontmatterTheme: null,
});
export function MermaidThemeProvider({
  theme,
  children,
}: {
  theme: string | null;
  children: ReactNode;
}): ReactNode {
  return (
    <MermaidThemeContext.Provider value={{frontmatterTheme: theme}}>
      {children}
    </MermaidThemeContext.Provider>
  );
}
export function useMermaidThemeOverride(): string | null {
  return useContext(MermaidThemeContext).frontmatterTheme;
}