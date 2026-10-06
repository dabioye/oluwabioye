'use client';
import { Checking, StaffLogin } from '../staff-shell';
import { useSession } from '../session';

/** Shows the sign-in card until the couple is signed in, then the screen. */
export function AdminGate({ children }: { children: React.ReactNode }) {
  const { role, setRole } = useSession();
  if (role === undefined) return <Checking />;
  if (role !== 'admin') return <StaffLogin kind="admin" onSignedIn={setRole} />;
  return <>{children}</>;
}
