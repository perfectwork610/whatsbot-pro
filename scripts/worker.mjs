// Start after the Next.js server. Uses the same .env.local via Node --env-file.
if (!process.env.WORKER_SECRET) throw new Error('Configure WORKER_SECRET in .env.local');
const url = process.env.APP_URL || 'http://localhost:3000';
console.log(`WhatsBot worker connected to ${url}`);
while (true) {
  try {
    const response = await fetch(`${url}/api/worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WORKER_SECRET}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) console.error(`Worker HTTP ${response.status}`);
    else {
      const result = await response.json();
      if (result.error) console.error(result.error);
    }
  } catch (error) {
    console.error(error.message);
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
