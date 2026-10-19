import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WinePage from "./WinePage";
import { homePagePath, wineSources } from "./data/wine";
import { sources } from "./data/navigation";

describe("Wine Production navigation", () => {
  it("offers production and recipe routes with only approved external destinations", () => {
    render(<WinePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Wine Production." }),
    ).toBeVisible();
    for (const title of [
      "Active Batches",
      "Batch History",
      "Recipe Library",
      "Approval Status",
      "Production Actions",
      "Methods & Guides",
      "Photos & Documents",
      "Ideas & Experiments",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeVisible();
    }
    const allowed = new Set([
      ...Object.values(wineSources),
      sources.root,
      sources.home,
    ]);
    // The only task URL is the existing shared Tasks entry point.
    allowed.add(sources.tasks);
    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href")!;
      if (href === homePagePath) {
        expect(link).not.toHaveAttribute("target");
      } else if (href.startsWith("https://")) {
        expect(allowed.has(href)).toBe(true);
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(link).toHaveAttribute("target", "_blank");
      } else if (href.startsWith("#"))
        expect(document.getElementById(href.slice(1))).not.toBeNull();
      else expect(href.startsWith(homePagePath)).toBe(true);
    }
    expect(
      screen.getByRole("link", { name: "Back to LifeOS Home" }),
    ).toHaveAttribute("href", homePagePath);
    expect(screen.getByText(/other areas may also appear/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Open Wine Making for the recipe library/ })).toHaveAttribute("href", wineSources.area);
    expect(screen.getByRole("link", { name: /Open Wine Making for approval review/ })).toHaveAttribute("href", wineSources.area);
    expect(screen.getByText(/A successful batch alone does not approve a recipe/)).toBeVisible();
  });

  it("keeps private content out and does not fetch live records", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const storageSpy = vi.spyOn(Storage.prototype, "getItem");
    render(<WinePage />);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/doesn’t display live batch status/)).toBeVisible();
    vi.unstubAllGlobals();
  });
});
