import type { Metadata } from "next";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bearing | Market decisions",
  description: "Evidence for international retail investment decisions.",
};

import CustomCursor from "./CustomCursor";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CustomCursor />{children}</body></html>;
}
