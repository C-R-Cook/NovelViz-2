import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { PublicFooter } from "@/components/public-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovelViz",
  description: "Chapter-gated AI for book readers",
};

const themeInitScript = `
(function(){
  try {
    var t = localStorage.getItem('novelviz-theme');
    if (t === 'light') document.documentElement.classList.remove('dark');
    else document.documentElement.classList.add('dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body className="flex min-h-screen flex-col">
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          <PublicFooter />
        </body>
      </html>
    </ClerkProvider>
  );
}
