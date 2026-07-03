function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

async function main() {
  const hookUrl = option("url", process.env.VERCEL_DEPLOY_HOOK_URL || "");

  if (!hookUrl) {
    throw new Error(
      "Missing VERCEL_DEPLOY_HOOK_URL. Create a Vercel Deploy Hook, keep the URL secret, then run this script.",
    );
  }

  const response = await fetch(hookUrl, { method: "POST" });
  const text = await response.text();
  let payload = text;

  try {
    payload = JSON.parse(text);
  } catch {
    // Keep non-JSON responses readable.
  }

  if (!response.ok) {
    throw new Error(`Vercel deploy hook failed (${response.status}): ${text}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: response.status,
        response: payload,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
