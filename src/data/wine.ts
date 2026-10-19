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
    title: "Active Batches",
    description:
      "Follow physical batches in progress, with their recorded stage and next intervention.",
    label: "Open the production register",
    href: wineSources.register,
    icon: Wine,
    tone: "rose",
    category: "BATCH REGISTER",
    note: "Choose Active batches in Notion. Planned batches have their own view; a planned start is never a completed operation.",
  },
  {
    id: "archive",
    number: "02",
    title: "Batch History",
    description: "Revisit bottled, completed and abandoned batches, including their observations and lessons.",
    label: "Open the register for batch history",
    href: wineSources.register,
    icon: Archive,
    tone: "lilac",
    category: "PRODUCTION HISTORY",
    note: "Choose Batch history in Notion. Physical production stays in the same register; recipe instructions are not performed history.",
  },
  {
    id: "recipes",
    number: "03",
    title: "Recipe Library",
    description: "Find reusable methods, source notes and versions, linked to the batches that test them.",
    label: "Open Wine Making for the recipe library",
    href: wineSources.area,
    icon: BookOpen,
    tone: "amber",
    category: "REUSABLE METHODS",
    note: "Open Wine Recipe Library from the Wine Making dashboard. Recipes are separate from physical batches and retain their source evidence.",
  },
  {
    id: "approvals",
    number: "04",
    title: "Approval Status",
    description: "Review Draft, Testing, Approved and Archived recipes before choosing a method to repeat.",
    label: "Open Wine Making for approval review",
    href: wineSources.area,
    icon: ListChecks,
    tone: "mint",
    category: "VERIFICATION & REUSE",
    note: "Use Recipe Library — review and Approved recipes in Notion. Verify quantities, method and trial outcome, then record explicit producer approval. A successful batch alone does not approve a recipe.",
  },
  {
    id: "actions",
    number: "05",
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
    number: "06",
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
    number: "07",
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
    id: "ideas",
    number: "08",
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
