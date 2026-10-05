import { UserButton, auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import StoreSwitcher from "@/components/store-switcher";
import { MainNav } from "@/components/main-nav";
import { MobileNav } from "@/components/mobile-nav";
import { StorviaLogo } from "@/components/storvia-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import prismadb from "@/lib/prismadb";

const Navbar = async () => {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const stores = await prismadb.store.findMany({
    where: {
      userId,
    }
  });

  return ( 
    <div className="border-b">
      <div className="hidden h-16 items-center px-4 md:flex">
        {/* Icon-only at md: this row is already full (switcher + 8 links). */}
        <StorviaLogo className="mr-4" wordmarkClassName="hidden lg:inline" />
        <StoreSwitcher items={stores} />
        <MainNav className="mx-6" />
        <div className="ml-auto flex items-center space-x-4">
          <ThemeToggle />
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
      <div className="flex h-16 items-center justify-between px-4 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNav stores={stores} />
          <StorviaLogo wordmarkClassName="hidden sm:inline" />
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
};
 
export default Navbar;
