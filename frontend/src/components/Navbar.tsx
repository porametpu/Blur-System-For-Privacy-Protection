"use client";

import React from 'react';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 h-20 bg-white/70 backdrop-blur-md border-b border-slate-200 z-50">
      <div className="max-w-[1400px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">

        {/* Logo */}
        {/* Logo */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = '/';
          }}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 bg-[#1a73e8] rounded-full flex items-center justify-center shadow-md">
            <span className="text-white font-black text-sm">B</span>
          </div>
          <span className="text-xl font-black tracking-tight text-slate-800">
            Blur<span className="text-[#1a73e8]">System</span>
          </span>
        </a>

        {/* Center Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
          <Link href="/" className="text-[#1a73e8]">Dashboard</Link>
          <Link href="#" className="hover:text-slate-800 transition-colors">History</Link>
          <Link href="#" className="hover:text-slate-800 transition-colors">Settings</Link>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          <button className="bg-[#1a73e8] hover:bg-[#1557b0] text-white text-sm font-bold px-6 py-2 rounded-full transition-colors shadow-sm">
            Sign In
          </button>
        </div>

      </div>
    </nav>
  );
}
