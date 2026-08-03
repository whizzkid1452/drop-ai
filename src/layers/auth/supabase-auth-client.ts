import type { AuthSnapshot, IAuthClient, MagicLinkSignInRequest } from './i-auth-client';

interface SupabaseAuthError {
  readonly message: string;
}

interface SupabaseAuthResult {
  readonly error: SupabaseAuthError | null;
}

export interface SupabaseSession {
  readonly user: {
    readonly id: string;
    readonly email?: string;
  };
}

export interface SupabaseAuthPort {
  onAuthStateChange(listener: (session: SupabaseSession | null) => void): void;
  signInWithOtp(request: {
    readonly email: string;
    readonly options: { readonly emailRedirectTo: string };
  }): Promise<SupabaseAuthResult>;
  signOut(): Promise<SupabaseAuthResult>;
}

const INITIAL_AUTH_SNAPSHOT: AuthSnapshot = { status: 'loading', user: null };

export class SupabaseAuthClient implements IAuthClient {
  private readonly listeners = new Set<() => void>();
  private snapshot: AuthSnapshot = INITIAL_AUTH_SNAPSHOT;

  constructor(private readonly authPort: SupabaseAuthPort) {
    this.authPort.onAuthStateChange(session => this.replaceSession(session));
  }

  getSnapshot = (): AuthSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async signInWithMagicLink({ email, callbackUrl }: MagicLinkSignInRequest): Promise<void> {
    const result = await this.authPort.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });
    this.throwAuthError(result.error);
  }

  async signOut(): Promise<void> {
    const result = await this.authPort.signOut();
    this.throwAuthError(result.error);
  }

  private replaceSession(session: SupabaseSession | null): void {
    this.snapshot = session
      ? {
          status: 'authenticated',
          user: { id: session.user.id, email: session.user.email ?? null },
        }
      : { status: 'anonymous', user: null };
    this.listeners.forEach(listener => listener());
  }

  private throwAuthError(error: SupabaseAuthError | null): void {
    if (error) {
      throw new Error(error.message);
    }
  }
}
