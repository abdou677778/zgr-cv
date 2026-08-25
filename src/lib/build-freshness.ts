type PublishedVersion = { buildId?: string };

const buildId = (import.meta.env.VITE_ZGR_BUILD_ID as string | undefined)?.trim() || "local";

export async function refreshStalePublishedBuild() {
  if (typeof window === "undefined" || window.location.protocol !== "https:") return;
  if (buildId === "local" || import.meta.env.DEV) return;

  try {
    const versionUrl = new URL("./version.json", window.location.href);
    versionUrl.searchParams.set("check", Date.now().toString());
    const response = await fetch(versionUrl, {
      cache: "no-store",
      credentials: "omit",
    });
    if (!response.ok) return;
    const published = (await response.json()) as PublishedVersion;
    const publishedBuildId = published.buildId?.trim();
    if (!publishedBuildId || publishedBuildId === buildId) return;

    const target = new URL(window.location.href);
    if (target.searchParams.get("build") === publishedBuildId) return;
    target.searchParams.set("build", publishedBuildId);
    window.location.replace(target.toString());
  } catch {
    // Version checks must never delay or block the editor when the network is unavailable.
  }
}
