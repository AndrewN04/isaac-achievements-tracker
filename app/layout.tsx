import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { JSX } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Isaac Achievements Tracker",
  description:
    "Track your Binding of Isaac achievements with a fast, filterable checklist.",
  metadataBase: new URL("http://localhost:3000")
};

export default function RootLayout(props: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" className="bg-bg">
      <body
        className={`${inter.className} min-h-screen bg-bg text-text antialiased`}
      >
        {props.children}
      </body>
    </html>
  );
}