import schema from '../src/data/destination-canada-tunis.json' with {type:'json'};
export const DESTINATION_CANDIDATES_URL='https://www.canada.ca/fr/immigration-refugies-citoyennete/services/travailler-canada/embaucher-etranger-temporaires/travailleurs-francophones-bilingues-exterieur-quebec/destination-canada/candidats.html';
export async function destinationCanadaContract(fetcher=fetch){
  let status='unverified';let reason='Sources officielles indisponibles : vérifier manuellement avant candidature.';
  try{
    const [page,form]=await Promise.all([fetcher(DESTINATION_CANDIDATES_URL,{signal:AbortSignal.timeout(15000)}),fetcher(schema.officialUrl,{signal:AbortSignal.timeout(15000)})]);
    if(!page.ok||!form.ok)throw new Error('HTTP');
    const [text,html]=await Promise.all([page.text(),form.text()]);
    const open=/Les inscriptions pour les participants sont maintenant ouvertes/i.test(text)&&text.includes(schema.formId);
    const sameVersion=html.includes(`\\"versionNumber\\":${schema.version}`)&&html.includes(schema.formId)&&html.includes('\\"closedDetails\\":null')&&html.includes('\\"isPublished\\":true');
    status=open&&sameVersion?'open':'review_required';
    reason=status==='open'?'Inscriptions ouvertes, version du formulaire concordante. Vérifier les critères et choix avec le candidat.':'Statut ou version modifié : contrôler le formulaire officiel et actualiser le contrat avant utilisation.';
  }catch{}
  return {event:'Destination Canada Forum Mobilité — Tunis 2026',status,reason,checkedAt:new Date().toISOString(),sourceUrl:DESTINATION_CANDIDATES_URL,applicationUrl:schema.officialUrl,deadline:{status:'not_published',value:null},schema,
    safeguards:['Préparation uniquement : aucune soumission, invitation ou admissibilité garantie.','Ne traiter que le profil ou la commande explicitement demandé.','Ne jamais recopier les données du fichier exemple d’un autre candidat.','Identité de passeport, citoyenneté, six compétences linguistiques, IRCC, présélection, date et consentements : réponses explicites du candidat, jamais déduites.','CNP uniquement confirmé et présent dans les choix du secteur officiel.','Motivation 250 caractères, expérience 350, dernier établissement 50.','Incohérence FR/EN connue du deuxième niveau d’études : validation humaine nécessaire.','Ne pas produire de faux fichier officiel de reprise GC Forms ni soumettre automatiquement.','Le conjoint doit effectuer sa propre inscription. Participation gratuite ; voyage et visa à la charge du candidat.']};
}
