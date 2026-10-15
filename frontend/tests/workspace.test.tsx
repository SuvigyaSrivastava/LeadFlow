import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Workspace } from "@/components/workspace";
import { api, ApiError } from "@/lib/api";
import type { Lead } from "@/types";

import {
  makeDetail,
  makeDiscussion,
  makeFollowUp,
  makeLead,
  makeQueueItem,
  minutesAgo,
  minutesFromNow,
  OVERVIEW,
} from "./fixtures";

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  const fn = () => vi.fn();
  return {
    ...actual,
    api: {
      getConfig: fn(),
      listLeads: fn(),
      getOverview: fn(),
      getLead: fn(),
      createLead: fn(),
      updateLeadStatus: fn(),
      listDiscussions: fn(),
      createDiscussion: fn(),
      listFollowUps: fn(),
      rescheduleFollowUp: fn(),
      closeFollowUp: fn(),
      createBrief: fn(),
    },
  };
});

const mocked = vi.mocked(api);

const priya = makeLead({ id: "lead-priya", name: "Priya Nair", company: "Meridian Wealth", status: "Proposal Sent" });
const hank = makeLead({
  id: "lead-hank",
  name: "Hank Scorpio",
  company: "Globex",
  status: "New",
  discussion_count: 0,
  last_discussion_note: null,
  last_discussion_at: null,
});

function renderWorkspace() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Workspace />
    </QueryClientProvider>,
  );
}

function arrange(leads: Lead[] = [priya, hank]) {
  mocked.getConfig.mockResolvedValue({ timezone: "Asia/Kolkata", ai_mode: "demo", ai_provider: "demo" });
  mocked.getOverview.mockResolvedValue(OVERVIEW);
  mocked.listFollowUps.mockResolvedValue([]);
  mocked.listLeads.mockImplementation(async ({ q, status }) => {
    const items = leads.filter(
      (l) =>
        (!status || status === "All" || l.status === status) &&
        (!q || `${l.name} ${l.company ?? ""}`.toLowerCase().includes(q.toLowerCase())),
    );
    return { items, total: items.length, limit: 100, offset: 0 };
  });
  mocked.getLead.mockImplementation(async (id) => makeDetail(leads.find((l) => l.id === id) ?? priya));
  mocked.listDiscussions.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  arrange();
});

describe("lead list", () => {
  it("shows name, status, last note and time since the last discussion", async () => {
    renderWorkspace();
    const row = await screen.findByRole("button", { name: /Open Priya Nair/ });
    expect(within(row).getByText("Priya Nair")).toBeInTheDocument();
    expect(within(row).getByTestId("status-badge")).toHaveTextContent("Proposal Sent");
    expect(within(row).getByText("Sent the pricing PDF.")).toBeInTheDocument();
    expect(within(row).getByText("2 hours ago")).toBeInTheDocument();

    const empty = screen.getByRole("button", { name: /Open Hank Scorpio/ });
    expect(within(empty).getByText("No discussions yet")).toBeInTheDocument();
  });

  it("derives the overview numbers from the API", async () => {
    renderWorkspace();
    await waitFor(() => expect(screen.getByText("Active leads").nextSibling).toHaveTextContent("5"));
    expect(screen.getByText("Overdue", { selector: "dt" }).nextSibling).toHaveTextContent("2");
  });

  it("searches by name and combines the search with the status filter", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText("Hank Scorpio");

    await user.type(screen.getByRole("searchbox"), "hank");
    await waitFor(() => expect(screen.queryByRole("button", { name: /Open Priya Nair/ })).not.toBeInTheDocument());
    expect(mocked.listLeads).toHaveBeenLastCalledWith({ q: "hank", status: "All", limit: 100 }, expect.anything());

    await user.click(screen.getByRole("button", { name: /^New/ }));
    await waitFor(() =>
      expect(mocked.listLeads).toHaveBeenLastCalledWith({ q: "hank", status: "New", limit: 100 }, expect.anything()),
    );
    expect(screen.getByRole("button", { name: /Open Hank Scorpio/ })).toBeInTheDocument();
  });

  it("filters by status and marks the active filter", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText("Priya Nair");
    const chip = screen.getByRole("button", { name: /^Proposal Sent/ });
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.queryByText("Hank Scorpio")).not.toBeInTheDocument());
    expect(screen.getByText("Priya Nair", { selector: "span" })).toBeInTheDocument();
  });

  it("shows a designed empty state with a way to clear the filters", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByText("Priya Nair");
    await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(await screen.findByText("No leads match these filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByRole("button", { name: /Open Priya Nair/ })).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("explains a first-run empty state", async () => {
    arrange([]);
    renderWorkspace();
    expect(await screen.findByText("Add your first lead")).toBeInTheDocument();
  });

  it("shows an error state with a retry that does not invent data", async () => {
    mocked.listLeads.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "Can't reach the server."));
    const user = userEvent.setup();
    renderWorkspace();
    expect(await screen.findByText("Couldn't load your leads")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /Open Priya Nair/ })).toBeInTheDocument();
  });

  it("flags overdue and due-today follow-ups with text, not just colour", async () => {
    const overdue = makeLead({
      id: "lead-od",
      name: "Overdue Olive",
      next_follow_up_at: minutesAgo(60 * 50),
      follow_up_state: "overdue",
      pending_follow_up_count: 1,
      overdue_follow_up_count: 1,
    });
    const today = makeLead({
      id: "lead-td",
      name: "Today Tom",
      next_follow_up_at: minutesFromNow(90),
      follow_up_state: "today",
      pending_follow_up_count: 1,
    });
    arrange([overdue, today]);
    mocked.listFollowUps.mockImplementation(async (scope) =>
      scope === "attention"
        ? [
            makeQueueItem(overdue, { scheduled_at: overdue.next_follow_up_at!, state: "overdue" }),
            makeQueueItem(today, { scheduled_at: today.next_follow_up_at!, state: "today" }),
          ]
        : [],
    );
    renderWorkspace();
    const rows = await screen.findAllByTestId("queue-row");
    expect(rows.map((r) => r.getAttribute("data-state"))).toEqual(["overdue", "today"]);
    expect(within(rows[0]!).getByText(/Overdue 2 days/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Due today")).toBeInTheDocument();
  });

  it("completes a follow-up only after an explicit click", async () => {
    const lead = makeLead({ id: "lead-q", name: "Queue Quinn" });
    arrange([lead]);
    const item = makeQueueItem(lead, { scheduled_at: minutesAgo(300), state: "overdue" });
    mocked.listFollowUps.mockImplementation(async (scope) => (scope === "attention" ? [item] : []));
    mocked.closeFollowUp.mockResolvedValue({ ...item, status: "completed", state: null });
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByTestId("queue-row");
    expect(mocked.closeFollowUp).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Mark follow-up with Queue Quinn as done/ }));
    expect(mocked.closeFollowUp).toHaveBeenCalledWith(item.id, "completed");
  });
});

describe("lead timeline dialog", () => {
  it("opens in a dialog without navigating, newest discussion first", async () => {
    mocked.listDiscussions.mockResolvedValue([
      makeDiscussion(priya.id, "Third: sent pricing", 60),
      makeDiscussion(priya.id, "Second: demo call", 60 * 24),
      makeDiscussion(priya.id, "First: intro", 60 * 48),
    ]);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: /Open Priya Nair/ }));

    const dialog = await screen.findByRole("dialog");
    expect(window.location.pathname).toBe("/"); // a dialog, not a new page
    const entries = await within(dialog).findAllByTestId("timeline-entry");
    expect(entries.map((e) => e.textContent)).toEqual([
      expect.stringContaining("Third: sent pricing"),
      expect.stringContaining("Second: demo call"),
      expect.stringContaining("First: intro"),
    ]);
    expect(within(dialog).getByRole("combobox", { name: "Lead status" })).toHaveValue("Proposal Sent");
  });

  it("validates the discussion note and does not call the API when it is blank", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: /Open Priya Nair/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Log a discussion"), "   ");
    await user.click(within(dialog).getByRole("button", { name: "Save discussion" }));
    expect(await within(dialog).findByText("Write a note before saving")).toBeInTheDocument();
    expect(mocked.createDiscussion).not.toHaveBeenCalled();
  });

  it("saves a discussion with a follow-up and updates the visible timeline and list at once", async () => {
    const saved = makeDiscussion(priya.id, "Agreed next steps.", 0);
    saved.follow_up = makeFollowUp({ lead_id: priya.id, scheduled_at: minutesFromNow(60 * 30) });
    const updatedLead = {
      ...priya,
      discussion_count: 2,
      last_discussion_note: "Agreed next steps.",
      last_discussion_at: saved.created_at,
    };
    mocked.createDiscussion.mockResolvedValue({ discussion: saved, lead: updatedLead });
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: /Open Priya Nair/ }));
    const dialog = await screen.findByRole("dialog");

    // The list and refetches now return the post-save state.
    mocked.listLeads.mockResolvedValue({ items: [updatedLead, hank], total: 2, limit: 100, offset: 0 });
    mocked.listDiscussions.mockResolvedValue([saved]);

    await user.type(within(dialog).getByLabelText("Log a discussion"), "  Agreed next steps.  ");
    const tomorrow = new Date(Date.now() + 2 * 24 * 3600_000).toISOString().slice(0, 10);
    await user.type(within(dialog).getByLabelText(/Follow-up date/), tomorrow);
    await user.type(within(dialog).getByLabelText(/Follow-up time/), "14:30");
    await user.click(within(dialog).getByRole("button", { name: "Save discussion" }));

    await waitFor(() => expect(mocked.createDiscussion).toHaveBeenCalledTimes(1));
    expect(mocked.createDiscussion).toHaveBeenCalledWith("lead-priya", {
      note: "Agreed next steps.",
      follow_up_at: `${tomorrow}T14:30`,
    });
    expect(await within(dialog).findByText("Agreed next steps.", { selector: "p" })).toBeInTheDocument();
    expect(await within(dialog).findByTestId("discussion-count")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByLabelText("Log a discussion")).toHaveValue(""));
  });

  it("shows an error and keeps the typed note when saving fails", async () => {
    mocked.createDiscussion.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "Can't reach the server."));
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: /Open Priya Nair/ }));
    const dialog = await screen.findByRole("dialog");
    const note = within(dialog).getByLabelText("Log a discussion");
    await user.type(note, "Do not lose me");
    await user.click(within(dialog).getByRole("button", { name: "Save discussion" }));
    await waitFor(() => expect(mocked.createDiscussion).toHaveBeenCalled());
    expect(note).toHaveValue("Do not lose me");
    const { toast } = await import("sonner");
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not double-submit on repeated clicks", async () => {
    let resolve!: (v: Awaited<ReturnType<typeof api.createDiscussion>>) => void;
    mocked.createDiscussion.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: /Open Priya Nair/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Log a discussion"), "Once only");
    const save = within(dialog).getByRole("button", { name: "Save discussion" });
    await user.click(save);
    await user.click(save);
    await user.click(save);
    expect(mocked.createDiscussion).toHaveBeenCalledTimes(1);
    resolve({ discussion: makeDiscussion(priya.id, "Once only", 0), lead: priya });
  });

  it("persists a status change through the API", async () => {
    mocked.updateLeadStatus.mockResolvedValue({ ...priya, status: "Won" });
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: /Open Priya Nair/ }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Lead status" }), "Won");
    expect(mocked.updateLeadStatus).toHaveBeenCalledWith("lead-priya", "Won");
  });

  it("asks before discarding an unsaved note", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: /Open Priya Nair/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Log a discussion"), "half written");
    await user.keyboard("{Escape}");
    expect(await screen.findByText("Discard this note?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText("Log a discussion")).toHaveValue("half written");
  });

  it("shows the empty timeline state", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: /Open Hank Scorpio/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("No discussions yet")).toBeInTheDocument();
  });
});

describe("add lead", () => {
  it("requires a name and shows the message next to the field", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: "Add lead" }));
    const dialog = await screen.findByRole("dialog", { name: "Add lead" });
    await user.click(within(dialog).getByRole("button", { name: "Add lead" }));
    expect(await within(dialog).findByText("Name is required")).toBeInTheDocument();
    expect(mocked.createLead).not.toHaveBeenCalled();
  });

  it("creates a lead with only a name, defaulting to New, then closes and opens it", async () => {
    const created = makeLead({ id: "lead-new", name: "Grace Hopper", company: null, phone: null, status: "New" });
    mocked.createLead.mockResolvedValue(created);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: "Add lead" }));
    const dialog = await screen.findByRole("dialog", { name: "Add lead" });
    expect(within(dialog).getByLabelText("Status")).toHaveValue("New");
    await user.type(within(dialog).getByLabelText(/Full name/), "  Grace Hopper ");
    await user.click(within(dialog).getByRole("button", { name: "Add lead" }));

    await waitFor(() => expect(mocked.createLead).toHaveBeenCalledTimes(1));
    expect(mocked.createLead).toHaveBeenCalledWith({
      name: "Grace Hopper",
      company: null,
      phone: null,
      status: "New",
    });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add lead" })).not.toBeInTheDocument());
    expect(mocked.getLead).toHaveBeenCalledWith("lead-new", expect.anything());
  });

  it("shows server-side field errors inline", async () => {
    mocked.createLead.mockRejectedValue(
      new ApiError(422, "VALIDATION_ERROR", "Enter a valid phone number", [
        { field: "phone", message: "Enter a valid phone number" },
      ]),
    );
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(await screen.findByRole("button", { name: "Add lead" }));
    const dialog = await screen.findByRole("dialog", { name: "Add lead" });
    await user.type(within(dialog).getByLabelText(/Full name/), "Ada");
    await user.type(within(dialog).getByLabelText(/Phone/), "555-0123");
    await user.click(within(dialog).getByRole("button", { name: "Add lead" }));
    expect(await within(dialog).findByText("Enter a valid phone number")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Add lead" })).toBeInTheDocument();
  });
});
