import { StorviaLogo } from "@/components/storvia-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 py-8">
      <StorviaLogo size={40} wordmarkClassName="text-2xl" />
      {children}
    </div>
  );
};
