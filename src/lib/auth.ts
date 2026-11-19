/** Единый интерфейс входа.
    PUBLIC_AUTH_PROVIDER = 'none' | 'supabase'
    PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY — для supabase.
    Пакет ставится локально: npm i @supabase/supabase-js */
export type User = { id: string; email: string | null; name: string | null };

export interface AuthProvider {
  readonly name: string;
  enabled(): boolean;
  currentUser(): Promise<User | null>;
  signInWithEmail(email: string): Promise<{ ok: boolean; message: string }>;
  signOut(): Promise<void>;
}

const env: Record<string, string | undefined> = (import.meta as any).env ?? {};

class NoneProvider implements AuthProvider {
  readonly name = 'none';
  enabled(){ return false; }
  async currentUser(){ return null; }
  async signInWithEmail(){
    return { ok:false, message:'Регистрация пока не включена. Комментарии доступны через GitHub.' };
  }
  async signOut(){}
}

type SB = any;

class SupabaseProvider implements AuthProvider {
  readonly name = 'supabase';
  private client: SB = null;
  private url = env.PUBLIC_SUPABASE_URL;
  private key = env.PUBLIC_SUPABASE_ANON_KEY;

  enabled(){ return Boolean(this.url && this.key); }

  private async sdk(): Promise<SB> {
    if (this.client) return this.client;
    const { createClient } = await import('@supabase/supabase-js');
    this.client = createClient(this.url as string, this.key as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return this.client;
  }

  async currentUser(){
    if (!this.enabled()) return null;
    try {
      const sb = await this.sdk();
      const { data } = await sb.auth.getUser();
      const u = data?.user;
      return u ? { id: u.id, email: u.email ?? null, name: u.user_metadata?.name ?? null } : null;
    } catch { return null; }
  }

  async signInWithEmail(email: string){
    if (!this.enabled()) return { ok:false, message:'Провайдер входа не настроен.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok:false, message:'Проверьте адрес почты.' };
    try {
      const sb = await this.sdk();
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + '/account/' }
      });
      return error ? { ok:false, message:error.message }
                   : { ok:true, message:'Письмо со ссылкой для входа отправлено.' };
    } catch (e:any) {
      return { ok:false, message:'Не удалось связаться с сервером входа: ' + (e?.message ?? e) };
    }
  }

  async signOut(){ if (this.enabled()) { try { (await this.sdk()).auth.signOut(); } catch {} } }
}

export const auth: AuthProvider =
  env.PUBLIC_AUTH_PROVIDER === 'supabase' ? new SupabaseProvider() : new NoneProvider();