import { useRef, useState } from "react";
import { Button } from "./ui/button";
import {
  buildTechRenewalMessage,
  defaultMessageLines,
  hasOtherActiveSubscription,
  safeTechContactUrl,
  type MessageGender,
} from "@/lib/tech-renewal-message";
import type { TechOrder } from "@/lib/tech-orders";
import { techContactAt, techLineStatus } from "@/lib/tech-orders";
import { TechContactBadge } from "./tech-contact-badge";

export function TechRenewalMessage({
  order,
  orders,
  today,
  onClose,
  onConfirmContact,
  busy,
}: {
  order: TechOrder;
  orders: TechOrder[];
  today: string;
  onClose: () => void;
  onConfirmContact: (ids: string[], contacted: boolean) => Promise<void>;
  busy: boolean;
}) {
  const [gender, setGender] = useState<MessageGender>("neutral");
  const [ids, setIds] = useState(() => defaultMessageLines(order, today));
  const [custom, setCustom] = useState<string>();
  const [status, setStatus] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const text = custom ?? buildTechRenewalMessage(order, ids, gender, today);
  const contact = safeTechContactUrl(order.facebookUrl);
  const expired = order.lines.filter(
    (line) => ids.includes(line.id) && techLineStatus(line, today) === "Expiré",
  );
  const update = (action: () => void) => {
    if (
      custom !== undefined &&
      !window.confirm("Remplacer votre texte modifié par le message actualisé ?")
    )
      return;
    action();
    setCustom(undefined);
    setStatus("");
  };
  return (
    <section
      id="tech-renewal-message"
      aria-label="Message de renouvellement"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Message de renouvellement</h2>
          <p className="text-sm text-slate-500">
            Client : {order.client}
            <span className="hidden sm:inline"> · TECH-{order.id.slice(0, 8).toUpperCase()}</span>
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Fermer
        </Button>
      </div>
      <p className="text-sm text-slate-600">
        Proposition en darija algérienne. Vérifiez les services, les dates et la formule d’adresse
        avant de copier. Le sexe n’est jamais déduit du prénom ni lu depuis les dossiers CV.
      </p>
      <label className="grid gap-1 text-sm font-semibold">
        Formule d’adresse
        <select
          className="h-10 rounded-xl border bg-white px-3"
          value={gender}
          onChange={(e) => update(() => setGender(e.target.value as MessageGender))}
        >
          <option value="neutral">Neutre — sexe non renseigné</option>
          <option value="male">Masculin — confirmé par vous</option>
          <option value="female">Féminin — confirmé par vous</option>
        </select>
      </label>
      <fieldset className="grid min-w-0 gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Services à mentionner</legend>
        {order.lines.map((line) => (
          <label key={line.id} className="flex items-center gap-2 rounded-xl border p-3 text-sm">
            <input
              type="checkbox"
              checked={ids.includes(line.id)}
              onChange={(e) =>
                update(() =>
                  setIds((current) =>
                    e.target.checked
                      ? [...current, line.id]
                      : current.filter((id) => id !== line.id),
                  ),
                )
              }
            />
            <span className="min-w-0 break-words">
              {line.name}
              <small className="block text-slate-500">
                Du {line.start} au {line.end} · fin exclusive
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      {hasOtherActiveSubscription(order, ids, orders, today) && (
        <p
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Attention : une autre vente de ce client comporte déjà un abonnement actif au même
          service. Vérifiez qu’il n’a pas déjà renouvelé avant de le contacter.
        </p>
      )}
      {!ids.length && <p className="text-sm text-amber-800">Sélectionnez au moins un service.</p>}
      <label className="grid gap-2 text-sm font-semibold">
        Texte à vérifier et modifier
        <textarea
          ref={area}
          dir="rtl"
          lang="ar-DZ"
          className="min-h-72 w-full rounded-xl border p-4 text-right text-base leading-8 font-normal focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={text}
          onChange={(e) => {
            setCustom(e.target.value);
            setStatus("");
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!text.trim() || !ids.length}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setStatus(
                "Message copié. Collez-le dans la conversation du client, vérifiez puis envoyez vous-même.",
              );
            } catch {
              area.current?.focus();
              area.current?.select();
              setStatus(
                "Copie automatique indisponible : le texte est sélectionné. Utilisez Copier ou Ctrl+C.",
              );
            }
          }}
        >
          Copier le message
        </Button>
        {contact && (
          <a
            className="inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
            href={contact}
            target="_blank"
            rel="noreferrer noopener"
          >
            Ouvrir le profil du client
          </a>
        )}
        <Button variant="outline" onClick={() => update(() => {})}>
          Régénérer le texte
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Aucun envoi automatique. Le bouton de profil n’envoie pas le texte à Facebook ; copiez puis
        collez votre message dans la bonne conversation. Les prix ne sont pas proposés
        automatiquement.
      </p>
      {!!expired.length && (
        <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-sm font-semibold">Suivi du contact — services expirés sélectionnés</p>
          {expired.map((line) => (
            <div key={line.id} className="text-xs">
              {line.name} <TechContactBadge line={line} />
            </div>
          ))}
          <p className="text-xs text-slate-600">
            Après avoir envoyé le message vous-même, validez ici. Copier ne confirme pas l’envoi.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || expired.every((line) => !!techContactAt(line))}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Confirmez-vous avoir envoyé le message de renouvellement pour les services expirés sélectionnés ?",
                  )
                )
                  return;
                try {
                  await onConfirmContact(
                    expired.map((line) => line.id),
                    true,
                  );
                  setStatus("Contact confirmé et sauvegardé dans le cloud.");
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : String(error));
                }
              }}
            >
              ✓ Valider : client contacté
            </Button>
            {expired.some((line) => techContactAt(line)) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Annuler la confirmation de contact pour les services expirés sélectionnés ?",
                    )
                  )
                    return;
                  try {
                    await onConfirmContact(
                      expired.map((line) => line.id),
                      false,
                    );
                    setStatus("Confirmation annulée.");
                  } catch (error) {
                    setStatus(error instanceof Error ? error.message : String(error));
                  }
                }}
              >
                Annuler la confirmation
              </Button>
            )}
          </div>
        </div>
      )}
      {status && (
        <p role="status" className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800">
          {status}
        </p>
      )}
    </section>
  );
}
