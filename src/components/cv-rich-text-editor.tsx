import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RotateCcw,
  Sparkles,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeObjectiveFormat } from "@/lib/cv-objective-format";
import type { ObjectiveFormat, ObjectiveTextAlignment } from "@/lib/cv-types";

type EditorCommand =
  | "bold"
  | "italic"
  | "underline"
  | "strikeThrough"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "formatBlock"
  | "undo"
  | "redo";

type ToolbarButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  active?: boolean;
};

function ToolbarButton({ label, onClick, children, className, active }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition",
        "hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        active && "bg-violet-100 text-violet-700",
        className,
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-1.5 h-8 w-px shrink-0 bg-slate-300" />;
}

const SAFE_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "DEL",
  "DIV",
  "EM",
  "I",
  "LI",
  "OL",
  "P",
  "S",
  "STRIKE",
  "STRONG",
  "U",
  "UL",
]);

const PROFILE_COLORS = [
  { value: "#0f172a", label: "Noir" },
  { value: "#b91c1c", label: "Rouge" },
  { value: "#1d4ed8", label: "Bleu" },
  { value: "#047857", label: "Vert" },
  { value: "#7c3aed", label: "Violet" },
] as const;

function sanitizeEditorHtml(html: string) {
  if (!html || typeof DOMParser === "undefined") return "";
  const documentNode = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  for (const element of [...documentNode.body.querySelectorAll("*")]) {
    if (!SAFE_TAGS.has(element.tagName)) {
      element.replaceWith(documentNode.createTextNode(element.textContent || ""));
      continue;
    }
    const href = element.tagName === "A" ? element.getAttribute("href") || "" : "";
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
    if (href && /^(https?:|mailto:)/i.test(href)) element.setAttribute("href", href);
  }
  return documentNode.body.innerHTML.slice(0, 12_000);
}

export function CvRichTextEditor({
  value,
  format,
  onChange,
  onFormatChange,
  onAi,
  defaultAlignment = "left",
  maxLength = 800,
  placeholder = "Rédigez votre profil professionnel…",
}: {
  value: string;
  format?: ObjectiveFormat;
  onChange: (value: string, html: string) => void;
  onFormatChange: (format: ObjectiveFormat) => void;
  onAi: () => void;
  defaultAlignment?: Exclude<ObjectiveTextAlignment, "">;
  maxLength?: number;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const normalizedFormat = normalizeObjectiveFormat(format);
  const effectiveAlignment = normalizedFormat.alignment || defaultAlignment;
  const effectiveColor = normalizedFormat.color || "#0f172a";
  const wordCount = useMemo(() => {
    const normalized = value.trim();
    return normalized ? normalized.split(/\s+/u).length : 0;
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const safeHtml = sanitizeEditorHtml(normalizedFormat.html);
    if (safeHtml) {
      if (editor.innerHTML !== safeHtml) editor.innerHTML = safeHtml;
    } else if (editor.innerText !== value) {
      editor.textContent = value;
    }
  }, [normalizedFormat.html, value]);

  const syncPlainText = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextValue = editor.innerText.replace(/\u00a0/g, " ").slice(0, maxLength);
    if (editor.innerText.length > maxLength) editor.textContent = nextValue;
    onChange(nextValue, sanitizeEditorHtml(editor.innerHTML));
  };

  const runCommand = (command: EditorCommand, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    syncPlainText();
  };

  const addLink = () => {
    const url = window.prompt("Adresse du lien (https://…)");
    if (!url) return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, url.trim());
    syncPlainText();
  };

  const updateFormat = (patch: Partial<ObjectiveFormat>) =>
    onFormatChange(normalizeObjectiveFormat({ ...normalizedFormat, ...patch }));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-400 bg-white shadow-sm shadow-slate-900/5">
      <div
        role="toolbar"
        aria-label="Mise en forme du profil professionnel"
        className="flex min-h-14 flex-nowrap items-center gap-0 border-b border-slate-300 bg-white px-3 py-2"
      >
        <ToolbarButton label="Gras" onClick={() => runCommand("bold")}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Italique" onClick={() => runCommand("italic")}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Souligné" onClick={() => runCommand("underline")}>
          <Underline className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Barré" onClick={() => runCommand("strikeThrough")}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarDivider />

        <ToolbarButton label="Liste à puces" onClick={() => runCommand("insertUnorderedList")}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Liste numérotée" onClick={() => runCommand("insertOrderedList")}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton label="Ajouter un lien" onClick={addLink}>
          <Link className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Citation" onClick={() => runCommand("formatBlock", "blockquote")}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton label="Annuler" onClick={() => runCommand("undo")}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Rétablir" onClick={() => runCommand("redo")}>
          <Redo2 className="h-4 w-4 text-slate-300" />
        </ToolbarButton>

        <span className="ml-auto h-8 w-px shrink-0 bg-slate-300" />
        <button
          type="button"
          onClick={onAi}
          className="ml-1 inline-flex h-10 shrink-0 items-center gap-1 rounded-lg px-2 font-semibold text-violet-600 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          aria-label="Améliorer le profil avec l’intelligence artificielle"
          title="Améliorer avec l’IA"
        >
          <Sparkles className="h-5 w-5" />
          <span>AI</span>
        </button>
      </div>

      <div className="flex min-h-12 flex-wrap items-center gap-1 border-b border-slate-300 bg-slate-50/80 px-3 py-1.5">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Alignement
        </span>
        <ToolbarButton
          label="Aligner à gauche"
          active={effectiveAlignment === "left"}
          onClick={() => updateFormat({ alignment: "left" })}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Centrer le texte"
          active={effectiveAlignment === "center"}
          onClick={() => updateFormat({ alignment: "center" })}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Aligner à droite"
          active={effectiveAlignment === "right"}
          onClick={() => updateFormat({ alignment: "right" })}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarDivider />

        <label className="flex h-9 items-center gap-2 rounded-lg px-1 text-xs font-medium text-slate-600">
          Taille
          <select
            value={normalizedFormat.fontSize}
            onChange={(event) => updateFormat({ fontSize: Number(event.target.value) })}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Taille du texte du profil"
          >
            {[12, 13, 14, 15, 16, 18, 20, 22].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <ToolbarDivider />

        <label className="flex h-9 items-center gap-2 rounded-lg px-1 text-xs font-medium text-slate-600">
          Couleur
          <input
            type="color"
            value={effectiveColor}
            onChange={(event) => updateFormat({ color: event.target.value })}
            className="h-7 w-8 cursor-pointer rounded-md border border-slate-300 bg-white p-0.5"
            aria-label="Couleur du texte du profil"
          />
        </label>
        <div className="flex items-center gap-1" aria-label="Couleurs rapides du profil">
          {PROFILE_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => updateFormat({ color: color.value })}
              className={cn(
                "h-5 w-5 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-300 transition hover:scale-110",
                normalizedFormat.color === color.value && "ring-2 ring-violet-500 ring-offset-1",
              )}
              style={{ backgroundColor: color.value }}
              aria-label={`Couleur ${color.label.toLocaleLowerCase("fr")}`}
              title={color.label}
            />
          ))}
        </div>
        {normalizedFormat.color && (
          <ToolbarButton
            label="Rétablir la couleur du modèle"
            onClick={() => updateFormat({ color: "" })}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </ToolbarButton>
        )}
      </div>

      <div className="px-5 pt-5">
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label="Profil professionnel"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={syncPlainText}
          onBlur={syncPlainText}
          onPaste={(event) => {
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain").slice(0, maxLength);
            document.execCommand("insertText", false, text);
            syncPlainText();
          }}
          style={{
            textAlign: effectiveAlignment,
            fontSize: `${normalizedFormat.fontSize}px`,
            color: effectiveColor,
          }}
          className={cn(
            "min-h-40 whitespace-pre-wrap leading-[1.45] outline-none",
            "empty:before:pointer-events-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]",
            "[&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3",
            "[&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6",
          )}
        />
        <div className="mt-4 flex items-center justify-end border-t border-slate-200 py-2 text-[11px] text-slate-500">
          {value.length} caractères, {wordCount} mots
        </div>
      </div>
    </div>
  );
}
