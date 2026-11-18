// NDJSON via XMLHttpRequest also supports incremental text on React Native.
export function streamChat(url: string, body: unknown,
  onText: (text: string, source: string) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let offset = 0, pending = "", text = "", source = "", done = false, failed = false;
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const fail = (message: string) => {
      if (failed) return; failed = true; cleanup(); reject(new Error(message)); xhr.abort();
    };
    const abort = () => fail("Discussion interrompue.");
    const consume = () => {
      if (failed || xhr.status < 200 || xhr.status >= 300) return;
      pending += xhr.responseText.slice(offset); offset = xhr.responseText.length;
      let end: number;
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end); pending = pending.slice(end + 1);
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.error) { fail(event.error); return; }
          if (typeof event.delta === "string") { text += event.delta; source = event.source || source; onText(text, source); }
          if (event.done) done = true;
        } catch { fail("Réponse du serveur illisible."); return; }
      }
    };
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Accept", "application/x-ndjson");
    xhr.timeout = 120000;
    xhr.onprogress = consume;
    xhr.onload = () => {
      if (failed) return;
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = "Service de discussion indisponible. Réessayez.";
        try { message = JSON.parse(xhr.responseText).message || message; } catch { /* HTTP error without JSON */ }
        fail(message); return;
      }
      consume(); if (failed) return;
      cleanup();
      if (!done || !text) { reject(new Error("Réponse interrompue. Réessayez.")); return; }
      resolve();
    };
    xhr.onerror = () => fail("Connexion au chatbot interrompue.");
    xhr.ontimeout = () => fail("Le chatbot a mis trop de temps. Réessayez.");
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    xhr.send(JSON.stringify(body));
  });
}
