import Constants from "expo-constants";
import { Platform } from "react-native";

const hostUri = Constants.expoConfig?.hostUri;
const developmentHost = hostUri
  ? new URL(`http://${hostUri}`).hostname
  : "127.0.0.1";
export const defaultApiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? `http://${developmentHost}:5182` : "");

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function validateApiUrl(value: string) {
  const url = new URL(value.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "Indiquez une adresse de serveur sans chemin, par exemple https://api.exemple.com.",
    );
  }
  if (!__DEV__ && url.protocol !== "https:")
    throw new Error("La version installable nécessite une API HTTPS.");
  return url.origin;
}

export async function request<T>(
  base: string,
  token: string | undefined,
  path: string,
  options: RequestInit = {},
  text = false,
): Promise<T> {
  if (!base)
    throw new Error("Configurez l’adresse du serveur dans Mon compte.");
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener("abort", relayAbort);
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(base + path, {
      ...options,
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ApiError(
        error?.message ||
          `Le serveur a répondu avec une erreur (${response.status}).`,
        response.status,
      );
    }
    if (response.status === 204) return undefined as T;
    return text
      ? ((await response.text()) as T)
      : ((await response.json()) as T);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted)
      throw new Error("Connexion interrompue ou délai dépassé. Réessayez.");
    throw new Error(
      `Serveur inaccessible. Vérifiez le Wi-Fi et l’adresse dans Mon compte.${Platform.OS === "web" ? " Le proxy mobile doit être démarré." : ""}`,
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", relayAbort);
  }
}
