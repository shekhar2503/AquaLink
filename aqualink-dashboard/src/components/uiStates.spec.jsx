import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataProvenance from "./DataProvenance";
import Sidebar from "./Sidebar";
import YearSelector from "./YearSelector";
import { EmptyState, LoadingState } from "./ui";
import YearProvider from "../context/YearProvider";

const metadata = {
  source: "fallback", synthetic: true, selectedYear: 2025, latestYear: 2025,
  lastUpdated: null, scoringVersion: "score-v1", yearRange: { minimum: 2020, maximum: 2025 },
  riskThresholds: {
    Low: { minimum: 0, maximum: 25 }, Moderate: { minimum: 25, maximum: 45 },
    High: { minimum: 45, maximum: 65 }, Critical: { minimum: 65, maximum: 100, maximum_inclusive: true },
  },
};

describe("accessibility-critical UI states", () => {
  it("announces loading, error, and empty states with suitable roles", () => {
    const { rerender } = render(<LoadingState title="Loading records" />);
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Loading records");
    rerender(<EmptyState error title="Load failed" description="Try again" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Load failed");
    rerender(<EmptyState title="No records" description="Change filters" />);
    expect(screen.getByRole("status")).toHaveTextContent("No records");
  });

  it("exposes fallback provenance as a visible alert", () => {
    render(<DataProvenance metadata={metadata} recordCount={250} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Local fallback active");
    expect(screen.getByLabelText("Dataset provenance")).toHaveTextContent("Bundled local CSV");
  });

  it("provides labelled year and theme controls", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    render(<MemoryRouter><YearProvider><Sidebar theme="dark" onToggleTheme={toggle} /><YearSelector metadata={metadata} /></YearProvider></MemoryRouter>);
    expect(screen.getByRole("combobox", { name: "Analysis year" })).toHaveValue("2025");
    await user.click(screen.getAllByRole("button", { name: "Switch to light mode" })[0]);
    expect(toggle).toHaveBeenCalledOnce();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
  });
});
