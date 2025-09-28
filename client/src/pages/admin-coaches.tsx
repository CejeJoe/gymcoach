import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { AuthUser } from "@/lib/types";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export default function AdminCoachesPage({ user, onLogout }: Props) {
  const [, setLocation] = useLocation();

  if (user.role !== 'admin') {
    setLocation('/');
    return null;
  }

  const { data, isLoading, error, refetch } = useQuery<{ id: string; email: string; firstName: string; lastName: string; role: string; profileStatus?: string | null; clientsCount?: number | null; }[]>({
    queryKey: ['/api/admin/coaches'],
    queryFn: async () => {
      const res = await fetch('/api/admin/coaches', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch coaches');
      return res.json();
    },
    refetchOnMount: 'always'
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Admin · Coaches</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <button onClick={onLogout} className="px-3 py-1 rounded bg-red-600 text-white">Logout</button>
        </div>
      </header>

      <main className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => refetch()} className="px-3 py-1 rounded bg-thrst-green text-white">Refresh</button>
          <Link href="/">
            <a className="px-3 py-1 rounded border">Back to App</a>
          </Link>
        </div>

        {isLoading && <div>Loading…</div>}
        {error && <div className="text-red-500">{(error as any).message}</div>}

        <div className="grid gap-3">
          {data?.map((c) => (
            <Link key={c.id} href={`/admin/coaches/${c.id}`}>
              <a className="block border rounded p-3 hover:bg-accent">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.firstName} {c.lastName}</div>
                    <div className="text-sm text-muted-foreground">{c.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">Status: <span className="font-medium uppercase">{c.profileStatus || 'n/a'}</span></div>
                    <div className="text-xs text-muted-foreground">Clients: {c.clientsCount ?? 0}</div>
                  </div>
                </div>
              </a>
            </Link>
          ))}
          {(!isLoading && !error && (!data || data.length === 0)) && (
            <div className="text-muted-foreground">No coaches found.</div>
          )}
        </div>
      </main>
    </div>
  );
}
