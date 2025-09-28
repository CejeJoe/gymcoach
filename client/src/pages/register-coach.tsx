import { useState } from "react";
import { useLocation } from "wouter";

export default function RegisterCoachPage() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    bio: "",
    specialties: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const specialtiesArray = form.specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/auth/register-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          bio: form.bio || undefined,
          specialties: specialtiesArray.length ? specialtiesArray : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to register");

      setMessage(
        data?.verifyUrlHint
          ? `Registration received. Please check your email to verify. Dev hint: ${data.verifyUrlHint}`
          : "Registration received. Please check your email to verify."
      );
      // Optionally redirect to login after a short delay
      setTimeout(() => setLocation("/"), 4000);
    } catch (e: any) {
      setError(e?.message || "Failed to register");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl bg-card border rounded-lg p-6 shadow">
        <h1 className="text-2xl font-semibold mb-2">Register as Coach</h1>
        <p className="text-muted-foreground mb-6">Fill in the details below. You'll receive a verification email. An admin will review and approve your account.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">First Name</label>
              <input name="firstName" value={form.firstName} onChange={onChange} required className="w-full border rounded p-2 bg-background" />
            </div>
            <div>
              <label className="block text-sm mb-1">Last Name</label>
              <input name="lastName" value={form.lastName} onChange={onChange} required className="w-full border rounded p-2 bg-background" />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input type="email" name="email" value={form.email} onChange={onChange} required className="w-full border rounded p-2 bg-background" />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input type="password" name="password" value={form.password} onChange={onChange} required className="w-full border rounded p-2 bg-background" />
          </div>
          <div>
            <label className="block text-sm mb-1">Phone (optional)</label>
            <input name="phone" value={form.phone} onChange={onChange} className="w-full border rounded p-2 bg-background" />
          </div>
          <div>
            <label className="block text-sm mb-1">Specialties (comma-separated)</label>
            <input name="specialties" value={form.specialties} onChange={onChange} className="w-full border rounded p-2 bg-background" />
          </div>
          <div>
            <label className="block text-sm mb-1">Bio</label>
            <textarea name="bio" value={form.bio} onChange={onChange} className="w-full border rounded p-2 min-h-[100px] bg-background" />
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}
          {message && <div className="text-green-600 text-sm">{message}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center bg-thrst-green text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
