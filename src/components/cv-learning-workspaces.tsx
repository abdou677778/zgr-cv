import type { ComponentType, ReactNode } from "react";
import {
  ArrowLeft,
  Award,
  BookOpenCheck,
  Building2,
  CalendarRange,
  Eye,
  EyeOff,
  GraduationCap,
  GripVertical,
  ListChecks,
  MapPin,
  Pencil,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Education, Formation } from "@/lib/cv-types";
import { cn } from "@/lib/utils";

type LearningBase = {
  id: string;
  date: string;
  lieu: string;
  titre: string;
  institution: string;
};

type LearningLabels = {
  date: string;
  place: string;
  title: string;
  institution: string;
  delete: string;
};

type ExtraField<T extends LearningBase> = {
  key: keyof T & string;
  label: string;
  maxLength: number;
  multiline?: boolean;
  icon: ComponentType<{ className?: string }>;
};

type LearningWorkspaceProps<T extends LearningBase> = {
  items: T[];
  editingId: string | null;
  labels: LearningLabels;
  sectionPrefix: "formation" | "education";
  singular: string;
  emptyTitle: string;
  emptyHint: string;
  icon: ComponentType<{ className?: string }>;
  extraFields: ExtraField<T>[];
  onEdit: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<T>) => void;
  onRemove: (id: string, index: number) => void;
  isVisible: (path: string) => boolean;
  onToggleVisibility: (path: string) => void;
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

function LearningField({
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

function LearningWorkspace<T extends LearningBase>({
  items,
  editingId,
  labels,
  sectionPrefix,
  singular,
  emptyTitle,
  emptyHint,
  icon: SectionIcon,
  extraFields,
  onEdit,
  onUpdate,
  onRemove,
  isVisible,
  onToggleVisibility,
  onAi,
}: LearningWorkspaceProps<T>) {
  const itemIndex = items.findIndex((item) => item.id === editingId);
  const item = itemIndex >= 0 ? items[itemIndex] : null;

  if (!item) {
    if (!items.length) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
          <SectionIcon className="mx-auto mb-3 h-8 w-8 text-indigo-400" />
          <p className="font-semibold text-slate-800">{emptyTitle}</p>
          <p className="mt-1 text-sm text-slate-500">{emptyHint}</p>
        </div>
      );
    }

    return (
      <div className="-m-4 overflow-hidden bg-white sm:-m-5">
        <div className="divide-y divide-slate-200">
          {items.map((entry, index) => {
            const title = entry.titre.trim() || `Nouvelle ${singular}`;
            const subtitle =
              [entry.institution, entry.lieu].filter((value) => value.trim()).join(", ") ||
              "Institution à compléter";
            return (
              <div
                key={entry.id}
                className="group flex min-h-[74px] items-center gap-3 px-4 py-3 transition hover:bg-indigo-50/45 sm:px-5"
              >
                <GripVertical className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => onEdit(entry.id)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label={`Modifier ${singular} ${title}`}
                >
                  <span className="block truncate text-[15px] font-semibold text-slate-950">
                    {title}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-slate-500">{subtitle}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(entry.id)}
                  className="h-9 w-9 rounded-xl text-slate-400 hover:bg-indigo-100 hover:text-indigo-600"
                  aria-label={`Éditer ${title}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(entry.id, index)}
                  className="h-9 w-9 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Supprimer ${title}`}
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

  const requiredValues = [item.titre, item.institution, item.date, item.lieu];
  const extraValues = extraFields.map((field) => String(item[field.key] || ""));
  const completionValues = [...requiredValues, ...extraValues];
  const completion = Math.round(
    (completionValues.filter((value) => value.trim()).length / completionValues.length) * 100,
  );
  const title = item.titre.trim() || `Nouvelle ${singular}`;
  const subtitle = item.institution.trim() || "Institution à compléter";
  const fieldPath = (field: string) => `${sectionPrefix}.${itemIndex}.${field}`;
  const updateField = (key: keyof T & string, value: string, maxLength: number) =>
    onUpdate(item.id, { [key]: value.slice(0, maxLength) } as Partial<T>);

  const coreFields: Array<{
    key: keyof T & string;
    label: string;
    maxLength: number;
    icon: ComponentType<{ className?: string }>;
  }> = [
    { key: "titre", label: labels.title, maxLength: 120, icon: SectionIcon },
    { key: "institution", label: labels.institution, maxLength: 120, icon: Building2 },
    { key: "date", label: labels.date, maxLength: 40, icon: CalendarRange },
    { key: "lieu", label: labels.place, maxLength: 80, icon: MapPin },
  ];

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
            aria-label={`Retour à la liste des ${singular}s`}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-bold text-slate-950">{title}</h3>
            <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onRemove(item.id, itemIndex)}
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

      <div className="space-y-5 bg-slate-50/55 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {coreFields.map((field) => {
            const Icon = field.icon;
            const value = String(item[field.key] || "");
            return (
              <LearningField
                key={field.key}
                label={field.label}
                visible={isVisible(fieldPath(field.key))}
                onToggleVisibility={() => onToggleVisibility(fieldPath(field.key))}
                onAi={() =>
                  onAi(field.label, value, (next) => updateField(field.key, next, field.maxLength))
                }
              >
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-400" />
                  <Input
                    value={value}
                    onChange={(event) =>
                      updateField(field.key, event.target.value, field.maxLength)
                    }
                    className="h-11 rounded-xl bg-white pl-10"
                  />
                </div>
              </LearningField>
            );
          })}
        </div>

        {extraFields.map((field) => {
          const Icon = field.icon;
          const value = String(item[field.key] || "");
          return (
            <LearningField
              key={field.key}
              label={field.label}
              visible={isVisible(fieldPath(field.key))}
              onToggleVisibility={() => onToggleVisibility(fieldPath(field.key))}
              onAi={() =>
                onAi(field.label, value, (next) => updateField(field.key, next, field.maxLength))
              }
            >
              <div className="relative">
                <Icon
                  className={cn(
                    "absolute left-3 h-4 w-4 text-indigo-400",
                    field.multiline ? "top-3.5" : "top-1/2 -translate-y-1/2",
                  )}
                />
                {field.multiline ? (
                  <Textarea
                    rows={3}
                    value={value}
                    onChange={(event) =>
                      updateField(field.key, event.target.value, field.maxLength)
                    }
                    className="min-h-24 rounded-xl bg-white pl-10"
                  />
                ) : (
                  <Input
                    value={value}
                    onChange={(event) =>
                      updateField(field.key, event.target.value, field.maxLength)
                    }
                    className="h-11 rounded-xl bg-white pl-10"
                  />
                )}
              </div>
            </LearningField>
          );
        })}
      </div>
    </div>
  );
}

type SharedProps<T extends LearningBase> = Pick<
  LearningWorkspaceProps<T>,
  | "items"
  | "editingId"
  | "labels"
  | "onEdit"
  | "onUpdate"
  | "onRemove"
  | "isVisible"
  | "onToggleVisibility"
  | "onAi"
>;

export function FormationWorkspace(
  props: SharedProps<Formation> & { acquiredSkillsLabel: string },
) {
  const { acquiredSkillsLabel, ...shared } = props;
  return (
    <LearningWorkspace
      {...shared}
      sectionPrefix="formation"
      singular="formation"
      emptyTitle="Aucune formation ajoutée"
      emptyHint="Utilisez le bouton + de la section pour créer votre première formation."
      icon={BookOpenCheck}
      extraFields={[
        {
          key: "competences",
          label: acquiredSkillsLabel,
          maxLength: 400,
          multiline: true,
          icon: ListChecks,
        },
      ]}
    />
  );
}

export function EducationWorkspace(
  props: SharedProps<Education> & { optionLabel: string; equivalenceLabel: string },
) {
  const { optionLabel, equivalenceLabel, ...shared } = props;
  return (
    <LearningWorkspace
      {...shared}
      sectionPrefix="education"
      singular="éducation"
      emptyTitle="Aucune éducation ajoutée"
      emptyHint="Utilisez le bouton + de la section pour ajouter votre premier diplôme."
      icon={GraduationCap}
      extraFields={[
        { key: "option", label: optionLabel, maxLength: 120, icon: Target },
        {
          key: "equivalence",
          label: equivalenceLabel,
          maxLength: 200,
          multiline: true,
          icon: Award,
        },
      ]}
    />
  );
}
