"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Periksa apakah sudah dalam mode aplikasi (standalone)
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
    }

    // Deteksi iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Tangkap event prompt instalasi bawaan Chrome/Android
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Tampilkan prompt bawaan (Android/Chrome)
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      // Pesan khusus untuk pengguna iOS (karena Apple tidak mengizinkan tombol prompt langsung)
      alert("Untuk menginstall di iPhone/iPad:\n\n1. Ketuk ikon 'Share' (Panah ke Atas) di bagian bawah browser.\n2. Gulir ke bawah lalu pilih 'Add to Home Screen'.");
    } else {
      // Fallback untuk browser lain
      alert("Browser Anda tidak mengizinkan pop-up otomatis.\nSilakan buka menu browser (titik tiga) lalu ketuk 'Install app' atau 'Add to Home screen'.");
    }
  };

  // Jangan tampilkan tombol jika sudah diinstall
  if (isStandalone) return null;

  return (
    <button onClick={handleInstall} className="w-full flex items-center justify-between p-4 rounded-2xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors">
      <div className="flex items-center gap-3 text-sm font-semibold">
        <Download size={18} />
        <span>Install Aplikasi ke HP</span>
      </div>
      <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-bold uppercase">Gratis</span>
    </button>
  );
}
