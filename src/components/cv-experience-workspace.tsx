import type { ReactNode } from "react";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarRange,
  Eye,
  EyeOff,
  GripVertical,
  ListChecks,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Experience } from "@/lib/cv-types";
import { cn } from "@/lib/utils";

type ExperienceWorkspaceLabels = {
  dates: string;
  place: string;
  title: string;
  employer: string;
  achievements: string;
  addLine: string;
  delete: string;
};

type ExperienceWorkspaceProps = {
  experiences: Experience[];
  editingId: string | null;
  labels: ExperienceWorkspaceLabels;
  onEdit: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Experience>) => void;
  onRemove: (id: string, index: number) => void;
  isVisible: (path: string) => boolean;
  onToggleVisibility: (path: string) => void;
  onRemoveIndexedVisibility: (prefix: string, index: number) => void;
  onAi: (label: string, value: string, onApply: (next: string) => void) => void;
};

function VisibilityButton({
  label,
  visible,
  onToggle,
}: {
  label: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const action = visible ? `Masquer ${label}` : `Afficher ${label}`;
  return (
    <button
      type="button"
      aria-label={action}
      aria-pressed={!visible}
      title={action}
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
        visible
          ? "border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-800"
          : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100",
      )}
    >
      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

function AiButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Améliorer ${label} avec l’IA`}
      title={`Améliorer ${label} avec l’IA`}
      onClick={onClick}
      className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 px-1.5 text-[10px] font-bold text-violet-700 transition hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      <Sparkles className="mr-0.5 h-3 w-3" /> AI
    </button>
  );
}

function ExperienceField({
  label,
  visible,
  onToggleVisibility,
  onAi,
  children,
}: {
  label: string;
  visible: boolean;
  onToggleVisibility: () => void;
  onAi: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <Label className="text-xs font-semibold text-slate-500">{label}</Label>
        <div className="flex items-center gap-1">
          <AiButton label={label} onClick={onAi} />
          <VisibilityButton label={label} visible={visible} onToggle={onToggleVisibility} />
        </div>
      </div>
      <div className={visible ? undefined : "opacity-55 grayscale-[20%]"}>{children}</div>
    </div>
  );
}

export function ExperienceWorkspace({
  experiences,
  editingId,
  labels,
  onEdit,
  onUpdate,
  onRemove,
  isVisible,
  onToggleVisibility,
  onRemoveIndexedVisibility,
  onAi,
}: ExperienceWorkspaceProps) {
  const experienceIndex = experiences.findIndex((item) => item.id === editingId);
  const experience = experienceIndex >= 0 ? experiences[experienceIndex] : null;

  if (!experience) {
    if (!experiences.length) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <Briefcase className="mx-auto mb-3 h-8 w-8 text-indigo-400" />
          <p className="font-semibold text-slate-800">Aucune expérience ajoutée</p>
          <p className="mt-1 text-sm text-slate-500">
            Utilisez le bouton + de la section pour créer votre première expérience.
          </p>
        </div>
      );
    }

    return (
      <div className="-m-4 overflow-hidden bg-white sm:-m-5">
        <div className="divide-y divide-slate-200">
          {experiences.map((item, index) => {
            const itemTitle = item.titre.trim() || "Nouvelle expérience";
            const itemEmployer = item.employeur.trim() || "Employeur à compléter";
            return (
              <div
                key={item.id}
                className="group flex min-h-[74px] items-center gap-3 px-4 py-3 transition hover:bg-indigo-50/45 sm:px-5"
              >
                <GripVertical className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => onEdit(item.id)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label={`Modifier l’expérience ${itemTitle}`}
                >
                  <span className="block truncate text-[15px] font-semibold text-slate-950">
                    {itemTitle}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-slate-500">
                    {itemEmployer}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(item.id)}
                  className="h-9 w-9 rounded-xl text-slate-400 hover:bg-indigo-100 hover:text-indigo-600"
                  aria-label={`Éditer ${itemTitle}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(item.id, index)}
                  className="h-9 w-9 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Supprimer ${itemTitle}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const completionParts = [
    experience.titre.trim(),
    experience.employeur.trim(),
    experience.dates.trim(),
    experience.lieu.trim(),
    experience.descriptions.some((item) => item.trim()),
  ];
  const completion = Math.round(
    (completionParts.filter((part) => Boolean(part)).length / completionParts.length) * 100,
  );
  const title = experience.titre.trim() || "Nouvelle expérience";
  const employer = experience.employeur.trim() || "Employeur à compléter";
  const fieldPath = (field: "dates" | "lieu" | "titre" | "employeur") =>
    `experience.${experienceIndex}.${field}`;

  return (
    <div className="-m-4 overflow-hidden bg-white sm:-m-5">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onEdit(null)}
            className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
            aria-label="Retour à la liste des expériences"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-bold text-slate-950">{title}</h3>
            <p className="mt-0.5 truncate text-sm text-slate-500">{employer}</p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onRemove(experience.id, experienceIndex)}
            className="shrink-0 rounded-lg"
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> {labels.delete}
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${completion}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold text-emerald-700">
            Complétude {completion}%
          </span>
        </div>
      </div>

      <div className="space-y-6 bg-slate-50/55 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <ExperienceField
            label={labels.title}
            visible={isVisible(fieldPath("titre"))}
            onToggleVisibility={() => onToggleVisibility(fieldPath("titre"))}
            onAi={() =>
              onAi(labels.title, experience.titre, (value) =>
                onUpdate(experience.id, { titre: value.slice(0, 120) }),
              )
            }
          >
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
              <Input
                value={experience.titre}
                onChange={(event) =>
                  onUpdate(experience.id, { titre: event.target.value.slice(0, 120) })
                }
                className="h-11 rounded-xl bg-white pl-10"
              />
            </div>
          </ExperienceField>
          <ExperienceField
            label={labels.employer}
            visible={isVisible(fieldPath("employeur"))}
            onToggleVisibility={() => onToggleVisibility(fieldPath("employeur"))}
            onAi={() =>
              onAi(labels.employer, experience.employeur, (value) =>
                onUpdate(experience.id, { employeur: value.slice(0, 120) }),
              )
            }
          >
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
              <Input
                value={experience.employeur}
                onChange={(event) =>
                  onUpdate(experience.id, { employeur: event.target.value.slice(0, 120) })
                }
                className="h-11 rounded-xl bg-white pl-10"
              />
            </div>
          </ExperienceField>
          <ExperienceField
            label={labels.dates}
            visible={isVisible(fieldPath("dates"))}
            onToggleVisibility={() => onToggleVisibility(fieldPath("dates"))}
            onAi={() =>
              onAi(labels.dates, experience.dates, (value) =>
                onUpdate(experience.id, { dates: value.slice(0, 40) }),
              )
            }
          >
            <div className="relative">
              <CalendarRange className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
              <Input
                value={experience.dates}
                placeholder="Ex. Mai 2025 – Présent"
                onChange={(event) =>
                  onUpdate(experience.id, { dates: event.target.value.slice(0, 40) })
                }
                className="h-11 rounded-xl bg-white pl-10"
              />
            </div>
          </ExperienceField>
          <ExperienceField
            label={labels.place}
            visible={isVisible(fieldPath("lieu"))}
            onToggleVisibility={() => onToggleVisibility(fieldPath("lieu"))}
            onAi={() =>
              onAi(labels.place, experience.lieu, (value) =>
                onUpdate(experience.id, { lieu: value.slice(0, 80) }),
              )
            }
          >
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
              <Input
                value={experience.lieu}
                placeholder="Ville, région ou télétravail"
                onChange={(event) =>
                  onUpdate(experience.id, { lieu: event.target.value.slice(0, 80) })
                }
                className="h-11 rounded-xl bg-white pl-10"
              />
            </div>
          </ExperienceField>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <ListChecks className="h-4 w-4" />
              </span>
              <div>
                <Label className="font-semibold text-slate-800">{labels.achievements}</Label>
                <p className="text-[11px] text-slate-400">Une réalisation précise par ligne</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
              {experience.descriptions.length}
            </span>
          </div>
          <div className="space-y-3 p-4">
            {experience.descriptions.map((description, index) => {
              const descriptionPath = `experience.${experienceIndex}.description.${index}`;
              const descriptionLabel = `${labels.achievements} ${index + 1}`;
              return (
                <div key={index} className="flex items-start gap-2">
                  <span className="mt-3.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <Textarea
                      value={description}
                      onChange={(event) => {
                        const next = [...experience.descriptions];
                        next[index] = event.target.value.slice(0, 300);
                        onUpdate(experience.id, { descriptions: next });
                      }}
                      className={cn(
                        "min-h-[70px] resize-y rounded-xl bg-white leading-relaxed",
                        !isVisible(descriptionPath) && "opacity-55 grayscale-[20%]",
                      )}
                    />
                    <div className="mt-1 text-right text-[10px] text-slate-400">
                      {description.length}/300
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <AiButton
                      label={descriptionLabel}
                      onClick={() =>
                        onAi(descriptionLabel, description, (value) => {
                          const next = [...experience.descriptions];
                          next[index] = value.slice(0, 300);
                          onUpdate(experience.id, { descriptions: next });
                        })
                      }
                    />
                    <VisibilityButton
                      label={descriptionLabel}
                      visible={isVisible(descriptionPath)}
                      onToggle={() => onToggleVisibility(descriptionPath)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        onRemoveIndexedVisibility(
                          `experience.${experienceIndex}.description`,
                          index,
                        );
                        onUpdate(experience.id, {
                          descriptions: experience.descriptions.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        });
                      }}
                      className="h-7 w-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Supprimer ${descriptionLabel}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onUpdate(experience.id, {
                  descriptions: [...experience.descriptions, ""],
                })
              }
              className="rounded-xl border-dashed"
            >
              <Plus className="mr-2 h-4 w-4" /> {labels.addLine}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
