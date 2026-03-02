'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BudgetPage() {
  const router = useRouter();

  useEffect(() => {
    // Rediriger vers la page Charges par défaut
    router.replace('/dashboard/budget/charges');
  }, [router]);

  return null;
}
