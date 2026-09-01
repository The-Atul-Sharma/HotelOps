import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Hotel } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useEntities';
import { LoadingState } from '@/components/shared/states';

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const { data: settings } = useSettings();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={from} replace />;
  if (!ready) return <LoadingState />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await login(username, password);
    setSubmitting(false);
    if (!ok) {
      toast.error('Invalid username or password');
      return;
    }
    toast.success('Signed in');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Hotel className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Hotel Decent Inn</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {settings?.hotelName ?? 'Sign in to continue'}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div>
            <Label className="mb-1.5 block text-xs" htmlFor="username">
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="Username"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs" htmlFor="password">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
