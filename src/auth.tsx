import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { db } from "./api";
import type { Profile, Role } from "./types";
const Context = createContext<{
  session: Session | null;
  role: Role | null;
  profile: Profile | null;
  loading: boolean;
  error: string;
}>({ session: null, role: null, profile: null, loading: true, error: "" });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [role, setRole] = useState<Role | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    let active = true;
    let generation = 0;
    let initialized = false;
    let previousUser: string | undefined;
    const sync = async (s: Session | null) => {
      const current = ++generation;
      const changed = !initialized || previousUser !== s?.user.id;
      initialized = true;
      previousUser = s?.user.id;
      if (changed) setLoading(true);
      setSession(s);
      if (changed) {
        setRole(null);
        setProfile(null);
      }
      setError("");
      try {
        if (s) {
          const [r, p] = await Promise.all([
            db!
              .from("staff_roles")
              .select("role,active")
              .eq("user_id", s.user.id)
              .maybeSingle(),
            db!.from("profiles").select("*").eq("id", s.user.id).maybeSingle(),
          ]);
          if (r.error) throw r.error;
          if (p.error) throw p.error;
          if (active && current === generation) {
            setRole(r.data?.active ? r.data.role : null);
            setProfile(p.data);
          }
        }
      } catch (e) {
        if (active && current === generation)
          setError(
            e instanceof Error ? e.message : "Unable to verify staff access",
          );
      } finally {
        if (active && current === generation) setLoading(false);
      }
    };
    db.auth.getSession().then(({ data, error }) => {
      if (error) {
        setError(error.message);
        setLoading(false);
      } else if (active) void sync(data.session);
    });
    const { data } = db.auth.onAuthStateChange((_event, s) => {
      queueMicrotask(() => {
        if (active) void sync(s);
      });
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider value={{ session, role, profile, loading, error }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
