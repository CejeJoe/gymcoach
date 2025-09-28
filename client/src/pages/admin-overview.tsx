import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { AuthUser } from "@/lib/types";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

interface Overview {
  coaches: { total: number; pending: number; active: number; suspended: number };
  clients: { total: number; new7d: number; new30d: number };
  workouts: { created7d: number; completed7d: number };
  messaging: { sent24h: number };
}

export default function AdminOverviewPage({ user, onLogout }: Props) {
  const [, setLocation] = useLocation();
  if (user.role !== 'admin') {
    setLocation('/');
    return null;
  }

  const { data, isLoading, error, refetch } = useQuery<Overview>({
    queryKey: ['/api/admin/overview'],
    queryFn: async () => {
      const res = await fetch('/api/admin/overview', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch admin overview');
      return res.json();
    },
    refetchOnMount: 'always'
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Admin · Overview</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <button onClick={onLogout} className="px-3 py-1 rounded bg-red-600 text-white">Logout</button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="px-3 py-1 rounded bg-thrst-green text-white">Refresh</button>
          <Link href="/admin/coaches"><a className="px-3 py-1 rounded border">Coaches</a></Link>
        </div>

        {isLoading && <div>Loading…</div>}
        {error && <div className="text-red-500">{(error as any).message}</div>}

        {data && (
          <>
            <section>
              <h2 className="text-base font-semibold mb-2">Coaches</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Total" value={data.coaches.total} />
                <KpiCard label="Pending" value={data.coaches.pending} />
                <KpiCard label="Active" value={data.coaches.active} />
                <KpiCard label="Suspended" value={data.coaches.suspended} />
              </div>
              <div className="mt-3">
                <Link href="/admin/coaches"><a className="text-sm underline">Open coaches directory →</a></Link>
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2">Clients</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <KpiCard label="Total" value={data.clients.total} />
                <KpiCard label="New (7d)" value={data.clients.new7d} />
                <KpiCard label="New (30d)" value={data.clients.new30d} />
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2">Workouts</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <KpiCard label="Created (7d)" value={data.workouts.created7d} />
                <KpiCard label="Completed (7d)" value={data.workouts.completed7d} />
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold mb-2">Messaging</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <KpiCard label="Sent (24h)" value={data.messaging.sent24h} />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{Number(value).toLocaleString()}</div>
    </div>
  );
}
