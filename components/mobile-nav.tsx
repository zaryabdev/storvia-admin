"use client";

import { Download, Menu } from "lucide-react";
import { useState } from "react";

import { MainNav } from "@/components/main-nav";
import { useInstallApp } from "@/components/pwa-provider";
import StoreSwitcher from "@/components/store-switcher";
import { StorviaLogo } from "@/components/storvia-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";

interface MobileNavProps {
  stores: Record<string, any>[];
}

export function MobileNav({ stores }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const { canInstall, install } = useInstallApp();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="left-0 top-0 h-[100dvh] max-h-[100dvh] w-[min(20rem,85vw)] max-w-[85vw] translate-x-0 translate-y-0 overflow-y-auto rounded-none p-6 sm:max-w-sm sm:rounded-none"
      >
        <DialogHeader className="text-left">
          <StorviaLogo className="mb-2" />
          <DialogTitle>Store navigation</DialogTitle>
          <DialogDescription className="sr-only">
            Navigate your store administration pages.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-full flex-col gap-6">
          <StoreSwitcher items={stores} onNavigate={() => setOpen(false)} />
          <MainNav mobile onNavigate={() => setOpen(false)} />
          <div className="mt-auto space-y-3 border-t pt-4">
            {canInstall && (
              <Button
                variant="outline"
                className="min-h-[44px] w-full justify-start gap-2"
                onClick={() => {
                  setOpen(false);
                  void install();
                }}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Install app
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
