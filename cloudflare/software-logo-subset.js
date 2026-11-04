/** Read only the public software logos needed by this workspace. */
export async function softwareLogoSubset(bucket, raw) {
  const slugs = [...new Set(raw.split(",").filter(Boolean))];
  if (
    raw.length > 4000 ||
    slugs.length > 80 ||
    slugs.some((slug) => !/^[a-z0-9-]{1,80}$/.test(slug))
  )
    throw Error("Sélection de logos invalide (80 maximum).");
  const logos = {};
  for (let offset = 0; offset < slugs.length; offset += 8) {
    await Promise.all(
      slugs.slice(offset, offset + 8).map(async (slug) => {
        const object = await bucket.get(`software-logos/current/${slug}.json`);
        if (!object) return;
        const entry = JSON.parse(await object.text());
        if (entry.slug === slug && typeof entry.dataUrl === "string") logos[slug] = entry.dataUrl;
      }),
    );
  }
  return logos;
}
