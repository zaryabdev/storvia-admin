"use client";

import { Share } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Chrome/Edge's install prompt event (not in the DOM typings).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallApp {
  /** Show the "Install app" menu item: the browser can prompt, or it's iPhone/iPad Safari. */
  canInstall: boolean;
  /** Chrome/Edge: shows the browser's install prompt. iOS Safari: opens the guide. */
  install: () => Promise<void>;
}

const InstallAppContext = createContext<InstallApp>({ canInstall: false, install: async () => {} });

export const useInstallApp = () => useContext(InstallAppContext);

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPhone/iPad Safari (iPadOS reports itself as a Mac with touch). Other iOS
// browsers (CriOS, FxiOS, EdgiOS…) are left out: they have no install guide here.
const isIosSafari = () => {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);

  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
};

// Registers the service worker (production only, so it never touches
// `next dev`) and shares the install state with the menus. Quiet by design:
// nothing is shown unless a menu item asks for it.
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true); // hidden until the effect decides
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    setInstalled(isStandalone());
    setIos(isIosSafari());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (deferred) {
      // The event can only be used once.
      setDeferred(null);
      await deferred.prompt();
      await deferred.userChoice;
    } else if (ios) {
      setGuideOpen(true);
    }
  }, [deferred, ios]);

  const value = useMemo(
    () => ({ canInstall: !installed && (deferred !== null || ios), install }),
    [installed, deferred, ios, install]
  );

  return (
    <InstallAppContext.Provider value={value}>
      {children}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install Storvia</DialogTitle>
            <DialogDescription>
              To install Storvia: tap the <strong>Share</strong>{" "}
              <Share className="inline h-4 w-4 align-text-bottom" aria-hidden="true" /> button, then{" "}
              <strong>Add to Home Screen</strong>.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </InstallAppContext.Provider>
  );
}
