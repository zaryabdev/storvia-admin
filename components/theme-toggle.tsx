"use client"

import * as React from "react"
import { Download, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { useInstallApp } from "@/components/pwa-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// `showInstall`: the desktop navbar's menu also carries the quiet "Install app"
// item (the mobile drawer has its own button, so it is off there).
export function ThemeToggle({ showInstall = false }: { showInstall?: boolean }) {
  const { setTheme } = useTheme()
  const { canInstall, install } = useInstallApp()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
        {showInstall && canInstall && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void install()}>
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Install app
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

