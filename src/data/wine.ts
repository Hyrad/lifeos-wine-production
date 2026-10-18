import {
  Archive,
  BookOpen,
  FlaskConical,
  FolderOpen,
  ListChecks,
  Wine,
} from "lucide-react";
import { notion, sources } from "./navigation";

export const homePagePath = "https://hyrad.github.io/lifeos-home/";
export const winePagePath = import.meta.env.BASE_URL;

// Generic entry-point URLs explicitly approved for publication on 2026-10-18.
// Individual batch, inventory, task, photo, and idea URLs are intentionally absent.
export const wineSources = {
  area: notion("472be780ce1a8247b9ed8166a00fb5ad"),
  register: notion("5a4be780ce1a82b1a032819846b76317"),
  guide: notion("3a2be780ce1a812d8785f5d971da276e"),
  documents:
    "https://drive.google.com/drive/folders/1tyjh5dS6DLKhm1A3bweBlqqgUn0p_pJV",
} as const;

export const wineSections = [
  {
    id: "batches",
    number: "01",
    title: "My Wine Batches",
    description:
      "Find your batches and their original production records in one place.",
    label: "Open the wine register",
    href: wineSources.register,
    icon: Wine,
    tone: "rose",
    category: "BATCH REGISTER",
    note: "Measurements and recorded stages stay in the register. Check each record for its latest update.",
  },
  {
    id: "actions",
    number: "02",
    title: "Production Actions",
    description:
      "Return to your tasks to review wine-related work and plan the next intervention.",
    label: "Open LifeOS Tasks",
    href: sources.tasks,
    icon: ListChecks,
    tone: "mint",
    category: "TASKS",
    note: "This opens the shared Tasks database. Find your wine-related actions there; other areas may also appear.",
  },
  {
    id: "methods",
    number: "03",
    title: "Methods & Guides",
    description:
      "Consult your established batch-management workflow and production guidance.",
    label: "Open batch-management guide",
    href: wineSources.guide,
    icon: BookOpen,
    tone: "amber",
    category: "REFERENCE",
    note: "Use the original guide to navigate procedures and relevant batch instructions.",
  },
  {
    id: "documents",
    number: "04",
    title: "Photos & Documents",
    description:
      "Find archived instructions, batch photographs, and supporting documents.",
    label: "Open Wine Production in Drive",
    href: wineSources.documents,
    icon: FolderOpen,
    tone: "blue",
    category: "DOCUMENT ARCHIVE",
    note: "Your original files stay in the existing Wine Production folder. Google Drive access may be required.",
  },
  {
    id: "archive",
    number: "05",
    title: "Wine Archive",
    description:
      "Explore earlier production and revisit the records behind previous batches.",
    label: "Browse history in the register",
    href: wineSources.register,
    icon: Archive,
    tone: "lilac",
    category: "HISTORY",
    note: "The same canonical register holds batch history. This is not a separate archive or a live stock inventory.",
  },
  {
    id: "ideas",
    number: "06",
    title: "Ideas & Experiments",
    description:
      "Return to your Wine Making area for related notes, references, and ideas.",
    label: "Open the Wine Making area",
    href: wineSources.area,
    icon: FlaskConical,
    tone: "rose",
    category: "EXPLORE",
    note: "Browse the existing area for context. Exploratory ideas are not approved production actions.",
  },
] as const;
