import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs';

import prismadb from '@/lib/prismadb';

// Print pages (packing slips): same sign-in and Store-ownership checks as the
// dashboard layout, but no dashboard navigation.
export default async function PrintLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { storeId: string }
}) {
  const { userId } = auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const store = await prismadb.store.findFirst({
    where: {
      id: params.storeId,
      userId,
    },
    select: { id: true },
  });

  if (!store) {
    redirect('/');
  }

  return <>{children}</>;
};
