import {
  Archive,
  BookOpen,
  CalendarDays,
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
  // Direct saved views approved for the three production cards, November 13, 2026.
  planned: "https://app.notion.com/p/5a4be780ce1a82b1a032819846b76317?v=3febe780ce1a8156819c000c933e332a",
  active: "https://app.notion.com/p/5a4be780ce1a82b1a032819846b76317?v=3febe780ce1a81f0aeae000cc4c191a3",
  history: "https://app.notion.com/p/5a4be780ce1a82b1a032819846b76317?v=3febe780ce1a81dca1a0000ce9e8a66b",
  guide: notion("3a2be780ce1a812d8785f5d971da276e"),
  documents:
    "https://drive.google.com/drive/folders/1tyjh5dS6DLKhm1A3bweBlqqgUn0p_pJV",
} as const;

export const productionSections = [
  {
    id: "planned",
    title: "Planned Batches",
    description:
      "Prepare future production. These batches have not started yet.",
    label: "Open planned batches",
    href: wineSources.planned,
    icon: CalendarDays,
    tone: "amber",
    category: "BEFORE YOU START",
    note: "Opens the filtered Planned batches view directly. A plan is not a production start.",
  },
  {
    id: "batches",
    title: "Active Batches",
    description:
      "Follow fermentation and processing already underway, from the current stage to the next intervention.",
    label: "Open active batches",
    href: wineSources.active,
    icon: Wine,
    tone: "rose",
    category: "IN PRODUCTION",
    note: "Opens the filtered Active batches view directly for current stages and next actions.",
  },
  {
    id: "archive",
    title: "Production History",
    description: "Revisit bottled, completed and historical batches, with their observations and lessons.",
    label: "Open production history",
    href: wineSources.history,
    icon: Archive,
    tone: "lilac",
    category: "PRODUCTION HISTORY",
    note: "Opens the filtered Batch history view directly: completed or discontinued production, not unstarted plans.",
  },
] as const;

export const libraryAndSupportSections = [
  {
    id: "recipes",
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

// Keep the existing fragment IDs, including #batches and #archive, bookmarkable.
export const wineSections = [
  ...productionSections,
  ...libraryAndSupportSections,
] as const;
