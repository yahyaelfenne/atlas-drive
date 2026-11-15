import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ApiError, defaultApiUrl, request, validateApiUrl } from "./api";
import type { Session, User } from "./types";

async function read(key: string) {
  return Platform.OS === "web"
    ? sessionStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function write(key: string, value: string | null) {
  if (Platform.OS === "web") {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } else if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}
interface AppContext {
  user: User | null;
  ready: boolean;
  baseUrl: string;
  api: <T>(path: string, options?: RequestInit, text?: boolean) => Promise<T>;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
  changeServer: (value: string) => Promise<void>;
}
const Context = createContext<AppContext | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [baseUrl, setBaseUrl] = useState(defaultApiUrl);
  const [ready, setReady] = useState(false);
  const signOut = useCallback(async () => {
    await write("atlas.session", null);
    setSession(null);
  }, []);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const savedBase = await read("atlas.server");
        const base = savedBase || defaultApiUrl;
        const savedSession = await read("atlas.session");
        if (!active) return;
        setBaseUrl(base);
        if (savedSession) {
          const cached: Session = JSON.parse(savedSession);
          try {
            const user = await request<User>(
              base,
              cached.token,
              "/api/auth/me",
            );
            if (active) setSession({ ...cached, user });
          } catch (error) {
            if (error instanceof ApiError && error.status === 401)
              await write("atlas.session", null);
            else if (active) setSession(cached);
          }
        }
      } catch {
        if (active) setSession(null);
      } finally {
        if (active) setReady(true);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);
  const token = session?.token;
  const api = useCallback(
    async <T,>(path: string, options?: RequestInit, text?: boolean) => {
      try {
        return await request<T>(baseUrl, token, path, options, text);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await signOut();
        throw error;
      }
    },
    [baseUrl, token, signOut],
  );
  async function signIn(value: Session) {
    await write("atlas.session", JSON.stringify(value));
    setSession(value);
  }
  async function changeServer(value: string) {
    const base = validateApiUrl(value);
    await signOut();
    await write("atlas.server", base);
    setBaseUrl(base);
  }
  return (
    <Context.Provider
      value={{
        user: session?.user || null,
        ready,
        baseUrl,
        api,
        signIn,
        signOut,
        changeServer,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("AppProvider manquant");
  return value;
}
