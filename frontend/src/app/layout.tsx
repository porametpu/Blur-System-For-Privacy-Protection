import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/context/AuthContext";
import { Suspense } from "react";

const outfit = Outfit({ 
  variable: "--font-outfit", 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"]
});

export const metadata: Metadata = {
  title: "BlurSystem | AI Face Detection & Privacy",
  description: "AI-powered face detection, recognition, and selective blur system for video privacy protection.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} antialiased min-h-screen flex flex-col`}>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<div className="h-20 bg-white/70" />}>
              <Navbar />
            </Suspense>
            <main className="flex-1 flex flex-col pt-32 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto w-full">
              {children}
            </main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
