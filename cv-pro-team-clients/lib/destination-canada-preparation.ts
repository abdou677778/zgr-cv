import schema from '../assets/destination-canada-tunis.json';

type Version = { versionNumber: number; storageKey: string };
type Dependencies = {
  getOrder: (id: string) => Promise<unknown>;
  getVersions: (id: string) => Promise<Version[]>;
  getContract: () => Promise<Record<string, unknown>>;
  readJson: (key: string) => Promise<unknown>;
};

export async function prepareDestinationCanadaContext(orderId: string, dependencies: Dependencies) {
  if (!(await dependencies.getOrder(orderId))) return { error: 'Commande introuvable.' };
  let contract: Record<string, unknown>;
  try {
    contract = await dependencies.getContract();
    if (!contract.schema || typeof contract.status !== 'string') throw new Error('Contrat incomplet');
  } catch {
    // A failed public-source request must not hide an otherwise readable order.
    // The snapshot is explicitly not a live verification or proof of opening.
    contract = {
      status: 'unverified', checkedAt: null, snapshotCheckedAt: schema.checkedAt,
      reason: 'Vérification en direct indisponible. Schéma de référence uniquement : contrôler les sources officielles avant toute candidature.',
      applicationUrl: schema.officialUrl, schema,
      deadline: { status: 'unknown', value: null },
    };
  }
  const versions = await dependencies.getVersions(orderId);
  const active = versions[0];
  let profile: unknown = null;
  const issues: string[] = [];
  if (!active) issues.push('Aucune version JSON active. Lire les sources avant toute proposition de profil ; ne pas créer ou sauvegarder automatiquement un JSON.');
  else {
    try {
      const json = await dependencies.readJson(active.storageKey);
      if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('JSON invalide');
      const root = json as Record<string, unknown>;
      const documents = root.documents as Record<string, unknown> | undefined;
      profile = documents?.fr ?? root;
    } catch {
      issues.push('La version active est répertoriée mais son fichier JSON est absent ou illisible. Aucun profil ne doit être reconstitué ou inventé.');
    }
  }
  return {
    orderId, contract, activeVersion: active?.versionNumber ?? null, profile,
    preparationStatus: !active ? 'missing_profile' : profile ? 'profile_available' : 'profile_unreadable',
    issues, sourceReadingRequired: true, saved: false, submitted: false,
    instruction: 'Lecture et contrôle uniquement. Lire les documents sources et get_master_prompt avant de proposer des réponses. Demander les données absentes. Ne pas modifier le CV, ne pas sauvegarder et ne pas soumettre. Si contract.status != open, faire vérifier les sources et les choix officiels. Une éventuelle sauvegarde ultérieure exige une validation explicite et la version active comme base_version.',
  };
}
