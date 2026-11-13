// Keep ownership until initialization AND browser shutdown have finished. A
// Chromium launch can complete after destroy() was called during initialization.
async function destroyOwnedBrowser(client) {
  const child = client.pupBrowser?.process?.();
  let timeout;
  try {
    await Promise.race([
      Promise.resolve().then(() => client.destroy()).catch(() => {}),
      new Promise(resolve => { timeout = setTimeout(resolve, 5000); }),
    ]);
  } finally {
    clearTimeout(timeout);
    // Browser.close() can fail or return without releasing Chromium's profile.
    // Only terminate the exact child launched by this Client, never other tabs
    // or a user's normal Chrome process.
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGKILL');
      let exitTimeout;
      try {
        await Promise.race([
          exited,
          new Promise((_, reject) => {
            exitTimeout = setTimeout(() => reject(new Error('Outreach browser did not stop; profile remains reserved.')), 5000);
          }),
        ]);
      } finally { clearTimeout(exitTimeout); }
    }
  }
}

export async function closeOutreachClient(entry) {
  if (entry.closing) return entry.closing;
  entry.closing = (async () => {
    await destroyOwnedBrowser(entry.client);
    try { await entry.initializing; } catch {}
    await destroyOwnedBrowser(entry.client);
  })();
  return entry.closing;
}
