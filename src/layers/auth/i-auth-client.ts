export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
}

export type AuthSnapshot =
  | { readonly status: 'loading'; readonly user: null }
  | { readonly status: 'anonymous'; readonly user: null }
  | { readonly status: 'authenticated'; readonly user: AuthUser }
  | { readonly status: 'unavailable'; readonly user: null };

export interface MagicLinkSignInRequest {
  readonly email: string;
  readonly callbackUrl: string;
}

export interface IAuthClient {
  getSnapshot(): AuthSnapshot;
  getAccessToken(): string | null;
  subscribe(listener: () => void): () => void;
  signInWithMagicLink(request: MagicLinkSignInRequest): Promise<void>;
  signOut(): Promise<void>;
}
