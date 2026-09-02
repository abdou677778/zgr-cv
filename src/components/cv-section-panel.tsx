import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Award,
  BadgeCheck,
  BookOpen,
  BookOpenText,
  Brain,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleUserRound,
  Code2,
  Crown,
  Dumbbell,
  EyeOff,
  FileBadge,
  FileText,
  Flag,
  FolderKanban,
  Gamepad2,
  Gem,
  Github,
  Globe2,
  GraduationCap,
  HandHeart,
  Heart,
  Languages,
  Library,
  Lightbulb,
  Linkedin,
  Link,
  ListChecks,
  Mail,
  MapPin,
  Medal,
  Megaphone,
  MessageSquareText,
  Music2,
  NotebookTabs,
  Palette,
  PenTool,
  PlayCircle,
  Plus,
  Puzzle,
  Rocket,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  UsersRound,
  Upload,
  Wrench,
  X,
  icons as LucideIcons,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const SECTION_ICON_COMPONENTS = {
  profile: CircleUserRound,
  user: UserRound,
  document: FileText,
  message: MessageSquareText,
  target: Target,
  briefcase: BriefcaseBusiness,
  building: Building2,
  education: GraduationCap,
  book: BookOpen,
  reading: BookOpenText,
  skills: Lightbulb,
  tools: Wrench,
  code: Code2,
  languages: Languages,
  interests: Heart,
  volunteering: HandHeart,
  certification: FileBadge,
  award: Award,
  medal: Medal,
  trophy: Trophy,
  star: Star,
  projects: FolderKanban,
  checklist: ListChecks,
  users: UsersRound,
  verified: BadgeCheck,
  shield: ShieldCheck,
  calendar: CalendarDays,
  location: MapPin,
  mail: Mail,
  link: Link,
  flag: Flag,
  palette: Palette,
  sparkles: Sparkles,
  brain: Brain,
  chart: ChartNoAxesCombined,
  crown: Crown,
  sport: Dumbbell,
  gaming: Gamepad2,
  gem: Gem,
  github: Github,
  globe: Globe2,
  library: Library,
  linkedin: Linkedin,
  announcement: Megaphone,
  music: Music2,
  notebook: NotebookTabs,
  design: PenTool,
  play: PlayCircle,
  puzzle: Puzzle,
  rocket: Rocket,
  share: Share2,
} satisfies Record<string, LucideIcon>;

const EXTRA_ICON_COMPONENTS = Object.fromEntries(
  Object.entries(LucideIcons)
    .filter(
      ([name, component]) =>
        !name.startsWith("Lucide") &&
        !name.endsWith("Icon") &&
        typeof component === "object" &&
        !(name.toLowerCase() in SECTION_ICON_COMPONENTS),
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 300),
) as Record<string, LucideIcon>;

const ICON_CATALOG: Record<string, LucideIcon> = {
  ...SECTION_ICON_COMPONENTS,
  ...EXTRA_ICON_COMPONENTS,
};

export type SectionIconName = string;

export type SectionCustomIcon = {
  dataUrl: string;
  name: string;
  format: "svg" | "png" | "webp";
  width: number;
  height: number;
};

export type SectionAppearance = {
  title: string;
  icon: SectionIconName;
  customIcon?: SectionCustomIcon;
};

export type SectionAppearanceMap = Record<string, SectionAppearance>;

export const DEFAULT_SECTION_APPEARANCE: SectionAppearanceMap = {
  personal: { title: "", icon: "profile" },
  objective: { title: "", icon: "document" },
  experience: { title: "", icon: "briefcase" },
  training: { title: "", icon: "education" },
  education: { title: "", icon: "book" },
  skills: { title: "", icon: "skills" },
  languages: { title: "", icon: "languages" },
  volunteering: { title: "", icon: "volunteering" },
  certifications: { title: "", icon: "certification" },
  interests: { title: "", icon: "interests" },
  references: { title: "", icon: "users" },
  letter: { title: "", icon: "mail" },
  development: { title: "", icon: "target" },
};

const ACCENTS: Record<string, { tile: string; icon: string }> = {
  personal: { tile: "bg-blue-100", icon: "text-blue-600" },
  objective: { tile: "bg-teal-100", icon: "text-teal-600" },
  experience: { tile: "bg-indigo-100", icon: "text-indigo-600" },
  training: { tile: "bg-violet-100", icon: "text-violet-600" },
  education: { tile: "bg-fuchsia-100", icon: "text-fuchsia-600" },
  skills: { tile: "bg-amber-100", icon: "text-amber-600" },
  languages: { tile: "bg-cyan-100", icon: "text-cyan-600" },
  volunteering: { tile: "bg-emerald-100", icon: "text-emerald-600" },
  certifications: { tile: "bg-sky-100", icon: "text-sky-600" },
  interests: { tile: "bg-rose-100", icon: "text-rose-600" },
  references: { tile: "bg-slate-200", icon: "text-slate-600" },
  letter: { tile: "bg-orange-100", icon: "text-orange-600" },
  development: { tile: "bg-lime-100", icon: "text-lime-700" },
};

function normalizeCustomIcon(value: unknown): SectionCustomIcon | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<SectionCustomIcon>;
  const format = candidate.format;
  const dataUrl = typeof candidate.dataUrl === "string" ? candidate.dataUrl : "";
  const allowedPrefix =
    format === "svg"
      ? "data:image/svg+xml"
      : format === "png"
        ? "data:image/png;base64,"
        : format === "webp"
          ? "data:image/webp;base64,"
          : "";
  if (!allowedPrefix || !dataUrl.startsWith(allowedPrefix) || dataUrl.length > 220_000) {
    return undefined;
  }
  const width = Number(candidate.width);
  const height = Number(candidate.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width !== height) return undefined;
  return {
    dataUrl,
    format: format as SectionCustomIcon["format"],
    width,
    height,
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 80) : "Icône personnalisée",
  };
}

export function normalizeSectionAppearance(value: unknown): SectionAppearanceMap {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_SECTION_APPEARANCE).map(([id, fallback]) => {
      const candidate =
        source[id] && typeof source[id] === "object"
          ? (source[id] as Partial<SectionAppearance>)
          : {};
      return [
        id,
        {
          title:
            typeof candidate.title === "string" ? candidate.title.slice(0, 60) : fallback.title,
          icon:
            typeof candidate.icon === "string" && candidate.icon in ICON_CATALOG
              ? (candidate.icon as SectionIconName)
              : fallback.icon,
          customIcon: normalizeCustomIcon(candidate.customIcon),
        },
      ];
    }),
  );
}

function SectionGlyph({
  name,
  customIcon,
  className,
}: {
  name: SectionIconName;
  customIcon?: SectionCustomIcon;
  className?: string;
}) {
  if (customIcon) {
    return <img src={customIcon.dataUrl} alt="" className={cn("object-contain", className)} />;
  }
  const Icon = ICON_CATALOG[name] || FileText;
  return <Icon className={className} strokeWidth={1.9} />;
}

const CUSTOM_ICON_MAX_BYTES = 150 * 1024;

function fileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

async function validateRasterIcon(file: File): Promise<SectionCustomIcon> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("L’image ne peut pas être décodée."));
      image.src = objectUrl;
    });
    if (dimensions.width !== dimensions.height) {
      throw new Error("L’icône doit être parfaitement carrée (largeur = hauteur).");
    }
    if (dimensions.width < 128 || dimensions.width > 512) {
      throw new Error("Dimensions requises : entre 128 × 128 et 512 × 512 px.");
    }
    return {
      dataUrl: await fileAsDataUrl(file),
      name: file.name,
      format: file.type === "image/png" ? "png" : "webp",
      width: dimensions.width,
      height: dimensions.height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function validateSvgIcon(file: File): Promise<SectionCustomIcon> {
  const documentNode = new DOMParser().parseFromString(await file.text(), "image/svg+xml");
  const root = documentNode.documentElement;
  if (root.tagName.toLowerCase() !== "svg" || documentNode.querySelector("parsererror")) {
    throw new Error("Le fichier SVG est invalide.");
  }
  documentNode
    .querySelectorAll("script, foreignObject, iframe, object, embed, image, style")
    .forEach((node) => node.remove());
  documentNode.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "style") element.removeAttribute(attribute.name);
      if ((name === "href" || name === "xlink:href") && !attribute.value.startsWith("#")) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  const viewBox = (root.getAttribute("viewBox") || "").trim().split(/[ ,]+/).map(Number);
  const width =
    viewBox.length === 4 ? viewBox[2] : Number.parseFloat(root.getAttribute("width") || "");
  const height =
    viewBox.length === 4 ? viewBox[3] : Number.parseFloat(root.getAttribute("height") || "");
  if (!Number.isFinite(width) || !Number.isFinite(height) || width !== height) {
    throw new Error("Le SVG doit posséder un viewBox carré.");
  }
  if (width < 24 || width > 512)
    throw new Error("ViewBox SVG requis : carré, entre 24 et 512 unités.");
  root.setAttribute("width", "128");
  root.setAttribute("height", "128");
  const safeSvg = new XMLSerializer().serializeToString(root);
  return {
    dataUrl: await fileAsDataUrl(new Blob([safeSvg], { type: "image/svg+xml" })),
    name: file.name,
    format: "svg",
    width,
    height,
  };
}

async function validateCustomIcon(file: File) {
  if (file.size > CUSTOM_ICON_MAX_BYTES) {
    throw new Error("Le fichier dépasse 150 Ko.");
  }
  if (file.type === "image/svg+xml") return validateSvgIcon(file);
  if (file.type === "image/png" || file.type === "image/webp") return validateRasterIcon(file);
  throw new Error("Formats acceptés : SVG, PNG ou WebP uniquement.");
}

function IconPicker({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: SectionAppearance;
  onChange: (value: SectionAppearance) => void;
}) {
  const [search, setSearch] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const icons = useMemo(() => {
    const query = search.trim().toLowerCase();
    return Object.keys(ICON_CATALOG).filter((name) => !query || name.toLowerCase().includes(query));
  }, [search]);

  const importCustomIcon = async (file?: File) => {
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const customIcon = await validateCustomIcon(file);
      onChange({ ...value, customIcon });
      onOpenChange(false);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Import de l’icône impossible.");
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88vh,780px)] max-w-3xl flex-col overflow-hidden border-slate-200 p-0">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
              <Sparkles className="h-5 w-5" />
            </span>
            Choisir une icône
          </DialogTitle>
          <DialogDescription>
            351 icônes vectorielles professionnelles ou une icône personnalisée contrôlée.
          </DialogDescription>
        </DialogHeader>
        <div className="shrink-0 border-b border-slate-200 px-5 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Rechercher parmi ${Object.keys(ICON_CATALOG).length} icônes…`}
              className="h-11 rounded-xl border-slate-300 pl-10"
              autoFocus
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="mb-5 rounded-2xl border border-dashed border-cyan-300 bg-cyan-50/60 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white text-cyan-600 shadow-sm">
                {value.customIcon ? (
                  <SectionGlyph
                    name={value.icon}
                    customIcon={value.customIcon}
                    className="h-7 w-7"
                  />
                ) : (
                  <Upload className="h-5 w-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-800">Importer une icône personnalisée</p>
                <p className="text-xs leading-relaxed text-slate-500">
                  SVG carré 24–512 unités, ou PNG/WebP carré 128–512 px · 150 Ko maximum.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => uploadRef.current?.click()}
                className="rounded-xl bg-white"
              >
                <Upload className="mr-2 h-4 w-4" /> {uploading ? "Validation…" : "Importer"}
              </Button>
              <input
                ref={uploadRef}
                type="file"
                aria-label="Fichier d’icône personnalisée"
                accept="image/svg+xml,image/png,image/webp,.svg,.png,.webp"
                className="hidden"
                onChange={(event) => void importCustomIcon(event.target.files?.[0])}
              />
            </div>
            {uploadError && <p className="mt-3 text-sm font-medium text-rose-600">{uploadError}</p>}
          </div>

          <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Icônes professionnelles</span>
            <span className="rounded-full bg-slate-100 px-2 py-1">{icons.length}</span>
          </div>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
            {icons.map((name) => (
              <button
                key={name}
                type="button"
                aria-label={`Icône ${name}`}
                title={name}
                onClick={() => {
                  onChange({ ...value, icon: name, customIcon: undefined });
                  onOpenChange(false);
                }}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-xl border text-slate-500 transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-600",
                  !value.customIcon && value.icon === name
                    ? "border-cyan-400 bg-cyan-50 text-cyan-600 shadow-sm"
                    : "border-transparent bg-slate-50",
                )}
              >
                <SectionGlyph name={name} className="h-5 w-5" />
                {!value.customIcon && value.icon === name && (
                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            ))}
          </div>
          {!icons.length && (
            <p className="py-12 text-center text-sm text-slate-500">Aucune icône correspondante.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CvSectionPanel({
  id,
  fallbackTitle,
  appearance,
  onAppearanceChange,
  open,
  onOpenChange,
  visible,
  onVisibleChange,
  count,
  complete,
  onAdd,
  children,
}: {
  id: string;
  fallbackTitle: string;
  appearance: SectionAppearance;
  onAppearanceChange: (appearance: SectionAppearance) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  count?: number;
  complete?: boolean;
  onAdd?: () => void;
  children: ReactNode;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);
  const title = appearance.title.trim() || fallbackTitle;
  const accent = ACCENTS[id] || ACCENTS.personal;
  if (!visible) return null;

  return (
    <section
      id={`cv-editor-section-${id}`}
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 transition",
        open && "shadow-md shadow-slate-900/7",
      )}
    >
      <div className="flex min-h-[68px] items-center gap-3 px-4 sm:px-5">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-expanded={open}
        >
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              accent.tile,
              accent.icon,
            )}
          >
            <SectionGlyph
              name={appearance.icon}
              customIcon={appearance.customIcon}
              className="h-5 w-5"
            />
          </span>
          <span className="truncate text-[15px] font-semibold text-slate-950">{title}</span>
          {typeof count === "number" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {count}
            </span>
          )}
          {complete && (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
              title="Section complétée"
            >
              <Check className="h-4 w-4" />
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={`Paramètres de la section ${title}`}
            title="Paramètres de section"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          {onAdd && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600"
              aria-label={`Ajouter dans ${title}`}
              onClick={() => {
                onAdd();
                onOpenChange(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label={open ? `Replier ${title}` : `Déplier ${title}`}
            onClick={() => onOpenChange(!open)}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-slate-50/55 p-4 sm:p-5">{children}</div>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md overflow-hidden border-slate-200 p-0">
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <DialogTitle className="text-sm font-semibold uppercase tracking-wide text-slate-600">
              Paramètres de section
            </DialogTitle>
            <DialogDescription className="sr-only">
              Modifier le nom, l’icône et la visibilité de la section.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5 py-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Nom de la section
              </Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIconsOpen(true)}
                  className={cn(
                    "flex h-11 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-cyan-400",
                    accent.tile,
                    accent.icon,
                  )}
                  aria-label="Changer l’icône"
                  title="Changer l’icône"
                >
                  <SectionGlyph
                    name={appearance.icon}
                    customIcon={appearance.customIcon}
                    className="h-5 w-5"
                  />
                </button>
                <Input
                  value={appearance.title}
                  onChange={(event) =>
                    onAppearanceChange({ ...appearance, title: event.target.value.slice(0, 60) })
                  }
                  placeholder={fallbackTitle}
                  className="h-11 rounded-xl bg-slate-50"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Laissez vide pour utiliser le nom standard du formulaire.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {visible ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <X className="h-4 w-4 text-rose-500" />
                )}
                {visible ? "Visible dans le document" : "Masquée dans le document"}
              </div>
              <Switch
                checked={visible}
                onCheckedChange={onVisibleChange}
                aria-label={`Visibilité de ${title}`}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <IconPicker
        open={iconsOpen}
        onOpenChange={setIconsOpen}
        value={appearance}
        onChange={onAppearanceChange}
      />
    </section>
  );
}

export function HiddenSectionTray({
  sections,
}: {
  sections: Array<{
    id: string;
    title: string;
    appearance: SectionAppearance;
    onRestore: () => void;
  }>;
}) {
  if (!sections.length) return null;
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        <EyeOff className="h-3.5 w-3.5" /> Sections masquées
      </div>
      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={section.onRestore}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-sm text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <Plus className="h-4 w-4" />
            <SectionGlyph
              name={section.appearance.icon}
              customIcon={section.appearance.customIcon}
              className="h-4 w-4"
            />
            {section.appearance.title.trim() || section.title}
          </button>
        ))}
      </div>
    </section>
  );
}
