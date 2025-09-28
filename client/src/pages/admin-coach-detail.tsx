import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";
import { AuthUser } from "@/lib/types";

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

export default function AdminCoachDetailPage({ user, onLogout }: Props) {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = params?.id || "";

  if (user.role !== 'admin') {
    setLocation('/');
    return null;
  }

  const query = useQuery({
    queryKey: ['/api/admin/coaches', id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/coaches/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch coach');
      return res.json();
    },
    enabled: !!id,
    refetchOnMount: 'always',
  });

  const mutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await fetch(`/api/admin/coaches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Failed to update');
      return data;
    },
    onSuccess: () => query.refetch(),
  });

  const coach = query.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Admin · Coach Detail</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <button onClick={onLogout} className="px-3 py-1 rounded bg-red-600 text-white">Logout</button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/admin/coaches"><a className="px-3 py-1 rounded border">Back</a></Link>
          <button onClick={() => query.refetch()} className="px-3 py-1 rounded bg-thrst-green text-white">Refresh</button>
        </div>

        {query.isLoading && <div>Loading…</div>}
        {query.error && <div className="text-red-500">{(query.error as any).message}</div>}

        {coach && (
          <div className="grid gap-3">
            <div className="border rounded p-3">
              <div className="font-medium text-lg">{coach.firstName} {coach.lastName}</div>
              <div className="text-sm text-muted-foreground">{coach.email}</div>
              <div className="text-sm mt-2">Status: <span className="font-medium uppercase">{coach.profileStatus || 'n/a'}</span></div>
              <div className="text-sm text-muted-foreground">Clients: {coach.clientsCount ?? 0}</div>
              {coach.bio && (
                <div className="mt-2"><div className="text-sm font-medium">Bio</div><p className="text-sm whitespace-pre-wrap">{coach.bio}</p></div>
              )}
              {coach.specialties && Array.isArray(coach.specialties) && coach.specialties.length > 0 && (
                <div className="mt-2"><div className="text-sm font-medium">Specialties</div><div className="text-sm">{coach.specialties.join(', ')}</div></div>
              )}
              {coach.phone && (
                <div className="mt-2"><div className="text-sm font-medium">Phone</div><div className="text-sm">{coach.phone}</div></div>
              )}
            </div>

            <div className="border rounded p-3">
              <div className="font-medium mb-2">Actions</div>
              <div className="flex items-center gap-2">
                <button onClick={() => mutation.mutate({ action: 'approve' })} className="px-3 py-1 rounded bg-emerald-600 text-white">Approve</button>
                <button onClick={() => mutation.mutate({ action: 'suspend' })} className="px-3 py-1 rounded bg-yellow-600 text-white">Suspend</button>
                <button onClick={() => mutation.mutate({ action: 'reactivate' })} className="px-3 py-1 rounded bg-blue-600 text-white">Reactivate</button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">These admin actions are part of the approval flow. In Phase 1, endpoints are read-only; buttons will work only if server PATCH is enabled.</p>
              {mutation.error && <div className="text-red-500 text-sm mt-2">{(mutation.error as any).message}</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
