import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-geist-mono",
});

export default function TeamFilesLayout({ children }: { children: React.ReactNode }) {
  return <div className={geistMono.variable}>{children}</div>;
}
