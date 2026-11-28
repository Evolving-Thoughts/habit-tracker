import { TODO_FIELDS } from "../types/fixtures";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory, getCategories } from "../api/categories.api";
import { createTodo } from "../api/day-planner.api";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import type { TodoResponse } from "../types/todo";
import { choose } from "../test/combobox";
import { hierarchyTodo } from "../test/hierarchy";
import { MicStub, dictate, micStart } from "../test/mic-stub";
import { colorOfName } from "../utils/category-mark";
import CreateTodoForm from "./CreateTodoForm.vue";

vi.mock("../api/day-planner.api", () => ({
  createTodo: vi.fn(),
}));
vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn(async () => []),
  createCategory: vi.fn(),
}));
vi.mock("../api/todo-hierarchy.api", () => ({
  getTodoHierarchy: vi.fn(async () => []),
}));

enableAutoUnmount(afterEach);

const createTodoMock = vi.mocked(createTodo);

const response: TodoResponse = {
  ...TODO_FIELDS,
  id: 1,
  parentId: null,
  title: "NestJS lernen",
  completed: false,
  completedAt: null,
  scheduledDate: null,
  timeOfDay: null,
  plannedDurationMinutes: null,
  timerEligible: true,
};

describe("CreateTodoForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createTodoMock.mockResolvedValue(response);
  });

  it("gives a new campaign colour, icon and weekly goal", async () => {
    const wrapper = mount(CreateTodoForm, { props: { campaign: true } });
    await wrapper.get('input[name="title"]').setValue("Buch");
    await wrapper.get('input[type="radio"][value="pine"]').setValue(true);
    await wrapper.get('input[type="radio"][value="pen"]').setValue(true);
    await wrapper.get('input[name="weeklyTarget"]').setValue("6");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodoMock).toHaveBeenCalledWith({
      title: "Buch",
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      parentId: null,
      categoryId: null,
      color: "pine",
      icon: "pen",
      weeklyTargetMinutes: 360,
    });
  });

  it("offers campaign fields only for a new campaign, without day and duration", () => {
    const wrapper = mount(CreateTodoForm);
    expect(wrapper.find('input[name="weeklyTarget"]').exists()).toBe(false);
    const campaign = mount(CreateTodoForm, { props: { campaign: true } });
    expect(campaign.find('input[name="scheduledDate"]').exists()).toBe(false);
    expect(campaign.find('input[name="duration"]').exists()).toBe(false);
    expect(campaign.find("#todo-parent").exists()).toBe(false);
    expect(campaign.text()).toContain(
      "Eine oberste Quest wird zur Kampagne, sobald sie Unter-Quests hat",
    );
  });

  it("creates an unscheduled todo and resets the form", async () => {
    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("  NestJS lernen  ");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createTodoMock).toHaveBeenCalledWith({
      title: "NestJS lernen",
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      parentId: null,
      categoryId: null,
    });

    expect(wrapper.emitted("created")).toHaveLength(1);

    expect(
      wrapper.get<HTMLInputElement>('input[name="title"]').element.value,
    ).toBe("");
  });

  it("plans an appointment for a day and a time", async () => {
    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("Arzttermin");
    await wrapper.get('input[name="scheduledDate"]').setValue("2026-10-02");
    await wrapper.get('input[name="timeOfDay"]').setValue("10:00");
    await wrapper.get('input[name="duration"]').setValue("30");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createTodoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Arzttermin",
        scheduledDate: "2026-10-02",
        timeOfDay: "10:00",
        plannedDurationMinutes: 30,
      }),
    );
  });

  it("plans a quest for a day without a time", async () => {
    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("Aufräumen");
    await wrapper.get('input[name="scheduledDate"]').setValue("2026-10-02");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createTodoMock).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledDate: "2026-10-02", timeOfDay: null }),
    );
  });

  it("sends a chosen category", async () => {
    vi.mocked(getCategories).mockResolvedValue([{ id: 7, name: "Sport" }]);
    createTodoMock.mockResolvedValue(response);
    const wrapper = mount(CreateTodoForm);
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Laufen");
    await choose(wrapper, "#todo-category", "Spo");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodoMock).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 7 }),
    );
  });

  it("creates a category from what was typed and chooses it", async () => {
    vi.mocked(createCategory).mockResolvedValue({ id: 9, name: "Lesen" });
    const wrapper = mount(CreateTodoForm);
    await flushPromises();
    await wrapper.get('input[name="title"]').setValue("Roman");
    await choose(wrapper, "#todo-category", "Lesen");
    expect(createCategory).toHaveBeenCalledWith("Lesen");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodoMock).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 9 }),
    );
  });

  it("belongs to a chosen quest: inherits its why and takes the campaign's category", async () => {
    vi.mocked(getTodoHierarchy).mockResolvedValue([
      hierarchyTodo({ id: 4, title: "Buch", why: "Erzählen", categoryId: 7 }),
      hierarchyTodo({
        id: 5,
        title: "Kapitel 2",
        parentId: 4,
        inheritedWhy: { text: "Erzählen", fromId: 4, fromTitle: "Buch" },
      }),
    ]);
    const wrapper = mount(CreateTodoForm);
    await flushPromises();
    await choose(wrapper, "#todo-parent", "Kapitel");
    expect(wrapper.get<HTMLInputElement>("#todo-parent").element.value).toBe(
      "Buch › Kapitel 2",
    );
    expect(wrapper.get("blockquote").text()).toContain("Erzählen");
    await wrapper.get('input[name="title"]').setValue("Szene");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodoMock).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 5, categoryId: 7 }),
    );
    expect(createTodoMock.mock.calls[0]![0]).not.toHaveProperty("why");
  });

  it("creates a new campaign from a typed name and puts the quest below it", async () => {
    createTodoMock
      .mockResolvedValueOnce({ ...response, id: 30, title: "Garten" })
      .mockResolvedValueOnce(response);
    const wrapper = mount(CreateTodoForm);
    await flushPromises();
    await choose(wrapper, "#todo-parent", "Garten");
    const campaign = createTodoMock.mock.calls[0]![0];
    expect(campaign).toMatchObject({ title: "Garten", scheduledDate: null });
    expect(campaign.color).toBeTruthy();
    await wrapper.get('input[name="title"]').setValue("Beet umgraben");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodoMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Beet umgraben", parentId: 30 }),
    );
  });

  it("sends a trimmed why", async () => {
    createTodoMock.mockResolvedValue(response);
    const wrapper = mount(CreateTodoForm);
    await wrapper.get('input[name="title"]').setValue("Laufen");
    await wrapper.get('textarea[name="why"]').setValue("  Fit bleiben ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodoMock).toHaveBeenCalledWith(
      expect.objectContaining({ why: "Fit bleiben" }),
    );
  });

  it("inherits the parent's why unless an own one is written", async () => {
    createTodoMock.mockResolvedValue(response);
    const parent = hierarchyTodo({
      id: 4,
      title: "Fit",
      why: "Gesund bleiben",
    });
    const wrapper = mount(CreateTodoForm, { props: { parent } });
    // Quoted, not offered as text to edit.
    expect(wrapper.find('textarea[name="why"]').exists()).toBe(false);
    expect(wrapper.get("blockquote").text()).toContain("Gesund bleiben");
    await wrapper.get('input[name="title"]').setValue("Laufen");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    // Nothing is copied: the new quest keeps inheriting.
    expect(createTodoMock.mock.calls[0]![0]).not.toHaveProperty("why");

    await wrapper.get('input[name="title"]').setValue("Schwimmen");
    await wrapper.get('[data-test="why-write-own"]').trigger("click");
    await wrapper.get('textarea[name="why"]').setValue("Schulter stärken");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createTodoMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ parentId: 4, why: "Schulter stärken" }),
    );
    // The reset form quotes the inherited reason again.
    expect(wrapper.find('textarea[name="why"]').exists()).toBe(false);
  });

  it("shows title, day, duration and Warum; Termin and Kategorie wait closed", async () => {
    vi.mocked(getCategories).mockResolvedValue([{ id: 7, name: "Sport" }]);
    const wrapper = mount(CreateTodoForm, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.get("#todo-parent").isVisible()).toBe(true);
    for (const field of ["title", "scheduledDate", "duration"])
      expect(wrapper.get(`input[name="${field}"]`).isVisible()).toBe(true);
    expect(wrapper.get('textarea[name="why"]').isVisible()).toBe(true);
    const toggles = wrapper.findAll("button[aria-expanded]");
    expect(toggles.map((button) => button.text())).toEqual([
      "Termin (feste Uhrzeit)",
      "Kategorie",
    ]);
    expect(wrapper.get('input[name="timeOfDay"]').isVisible()).toBe(false);
    expect(wrapper.get("#todo-category").isVisible()).toBe(false);
    await toggles[1]!.trigger("click");
    expect(document.activeElement).toBe(wrapper.get("#todo-category").element);
    await choose(wrapper, "#todo-category", "Sport");
    await toggles[1]!.trigger("click");
    expect(toggles[1]!.text()).toBe("Kategorie Sport");
    wrapper.unmount();
  });

  it("rejects a blank title", async () => {
    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("   ");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createTodoMock).not.toHaveBeenCalled();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Bitte gib einen Titel ein.",
    );
  });

  it.each(["0", "-1", "1.5"])(
    "rejects invalid duration %s",
    async (duration) => {
      const wrapper = mount(CreateTodoForm);

      await wrapper.get('input[name="title"]').setValue("Sport");

      await wrapper.get('input[name="duration"]').setValue(duration);

      await wrapper.get("form").trigger("submit");
      await flushPromises();

      expect(createTodoMock).not.toHaveBeenCalled();

      expect(wrapper.get('[role="alert"]').text()).toBe(
        "Die Dauer muss eine ganze Zahl ab 1 Minute sein.",
      );
    },
  );

  it("keeps the input when the request fails", async () => {
    createTodoMock.mockRejectedValueOnce(new Error("Backend nicht erreichbar"));

    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("NestJS lernen");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Backend nicht erreichbar",
    );

    expect(
      wrapper.get<HTMLInputElement>('input[name="title"]').element.value,
    ).toBe("NestJS lernen");

    expect(wrapper.emitted("created")).toBeUndefined();

    expect(wrapper.get<HTMLFieldSetElement>("fieldset").element.disabled).toBe(
      false,
    );
  });

  it("prevents duplicate submissions while saving", async () => {
    let resolveRequest!: (value: TodoResponse) => void;

    createTodoMock.mockReturnValueOnce(
      new Promise<TodoResponse>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const wrapper = mount(CreateTodoForm);

    await wrapper.get('input[name="title"]').setValue("NestJS lernen");

    await wrapper.get("form").trigger("submit");

    expect(wrapper.get<HTMLFieldSetElement>("fieldset").element.disabled).toBe(
      true,
    );

    // Auch ein programmatisch erneut ausgelöstes
    // Submit darf keinen zweiten Request erzeugen.
    await wrapper.get("form").trigger("submit");

    expect(createTodoMock).toHaveBeenCalledTimes(1);

    resolveRequest(response);
    await flushPromises();

    expect(wrapper.get<HTMLFieldSetElement>("fieldset").element.disabled).toBe(
      false,
    );
  });

  // What the text fills over the form's own values is told in
  // useQuestFromText.spec.ts (`fieldsFromText`); these prove the wiring.
  describe("day and duration from the title", () => {
    // Tuesday, 24 Nov 2026, in Berlin: "morgen" is Wednesday the 25th.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    const mountForm = (props: Record<string, unknown> = {}) =>
      mount(CreateTodoForm, {
        props,
        global: { stubs: { MicButton: MicStub } },
      });
    const value = (wrapper: ReturnType<typeof mountForm>, name: string) =>
      wrapper.get<HTMLInputElement>(`input[name="${name}"]`).element.value;

    it("leaves a typed title as typed: the form has its own day and duration", async () => {
      const wrapper = mountForm();
      await wrapper.get('input[name="title"]').setValue("Heute schreiben");
      expect(value(wrapper, "scheduledDate")).toBe("");
      expect(wrapper.find(".parse-chip").exists()).toBe(false);
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(createTodoMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Heute schreiben",
          scheduledDate: null,
        }),
      );
    });

    it("fills untouched day and duration from dictation, shows chips, and takes the words out only on creating", async () => {
      const wrapper = mountForm();
      await dictate(wrapper, "Arzt anrufen morgen 15 Minuten");
      expect(value(wrapper, "scheduledDate")).toBe("2026-11-25");
      expect(value(wrapper, "duration")).toBe("15");
      expect(
        wrapper
          .findAll(".parse-chip")
          .map((chip) => chip.attributes("aria-label")),
      ).toEqual(["Tag: morgen, entfernen", "Dauer: 15 Min., entfernen"]);
      expect(value(wrapper, "title")).toBe("Arzt anrufen morgen 15 Minuten");

      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(createTodoMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Arzt anrufen",
          scheduledDate: "2026-11-25",
          plannedDurationMinutes: 15,
        }),
      );
    });

    it("leaves a field set by hand alone, and its words in the title", async () => {
      const wrapper = mountForm();
      await wrapper.get('input[name="scheduledDate"]').setValue("2026-12-01");
      await dictate(wrapper, "Wäsche morgen 20 Minuten");
      expect(value(wrapper, "scheduledDate")).toBe("2026-12-01");
      expect(value(wrapper, "duration")).toBe("20");
      expect(wrapper.findAll(".parse-chip").map((chip) => chip.text())).toEqual(
        ["20 Min."],
      );

      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(createTodoMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Wäsche morgen",
          scheduledDate: "2026-12-01",
          plannedDurationMinutes: 20,
        }),
      );
    });

    it("stops following the title once the duration is typed", async () => {
      const wrapper = mountForm();
      await dictate(wrapper, "Laufen 20 Minuten");
      await wrapper.get('input[name="duration"]').setValue("45");
      await wrapper.get('input[name="title"]').setValue("Laufen 30 Minuten");
      expect(value(wrapper, "duration")).toBe("45");
    });

    it("reads nothing out of a campaign's title", async () => {
      const wrapper = mountForm({ campaign: true });
      await dictate(wrapper, "Marathon in 3 Stunden");
      expect(wrapper.find(".parse-chip").exists()).toBe(false);
    });

    it("dictates into the title, and starts at once when asked", async () => {
      micStart.mockClear();
      const quiet = mountForm();
      await flushPromises();
      expect(micStart).not.toHaveBeenCalled();
      await quiet.get('input[name="title"]').setValue("Steuer");
      await dictate(quiet, "erklärung morgen");
      expect(value(quiet, "title")).toBe("Steuer erklärung morgen");
      expect(value(quiet, "scheduledDate")).toBe("2026-11-25");

      mountForm({ dictate: true });
      await flushPromises();
      expect(micStart).toHaveBeenCalledTimes(1);
    });
  });
  describe("campaign and category from the title", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-24T10:00:00Z"));
      vi.mocked(getTodoHierarchy).mockResolvedValue([
        hierarchyTodo({
          id: 1,
          title: "Buch schreiben",
          icon: "book",
          color: "pine",
          categoryId: 11,
          why: "Eine Geschichte erzählen",
        }),
        hierarchyTodo({ id: 2, title: "Kapitel 3", parentId: 1 }),
        hierarchyTodo({ id: 5, title: "Garten", color: "plum" }),
      ]);
      vi.mocked(getCategories).mockResolvedValue([
        { id: 10, name: "Sport" },
        { id: 11, name: "Schreiben" },
      ]);
    });
    afterEach(() => vi.useRealTimers());

    const mountForm = async (props: Record<string, unknown> = {}) => {
      const wrapper = mount(CreateTodoForm, {
        props,
        global: { stubs: { MicButton: MicStub } },
      });
      await flushPromises();
      return wrapper;
    };
    type Form = Awaited<ReturnType<typeof mountForm>>;
    const value = (wrapper: Form, selector: string) =>
      wrapper.get<HTMLInputElement>(selector).element.value;
    const chipNames = (wrapper: Form) =>
      wrapper
        .findAll(".parse-chip")
        .map((chip) => chip.attributes("aria-label"));
    const submit = async (wrapper: Form) => {
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      return createTodoMock.mock.calls.at(-1)![0];
    };

    it("fills Gehört zu and the campaign's category from dictation", async () => {
      const wrapper = await mountForm();
      await dictate(wrapper, "Kapitel 4 gliedern morgen Kampagne Buch schreiben");
      expect(chipNames(wrapper)).toEqual([
        "Tag: morgen, entfernen",
        "Kampagne: Buch schreiben, entfernen",
      ]);
      expect(value(wrapper, "#todo-parent")).toBe("Buch schreiben");
      expect(value(wrapper, "#todo-category")).toBe("Schreiben");
      expect(wrapper.get("blockquote").text()).toContain(
        "Eine Geschichte erzählen",
      );
      expect(await submit(wrapper)).toMatchObject({
        title: "Kapitel 4 gliedern",
        scheduledDate: "2026-11-25",
        parentId: 1,
        categoryId: 11,
      });
    });

    it("empties both again when the campaign's chip is discarded", async () => {
      const wrapper = await mountForm();
      await dictate(wrapper, "Notizen Kampagne Buch schreiben");
      await wrapper
        .get('[aria-label="Kampagne: Buch schreiben, entfernen"]')
        .trigger("click");
      expect(value(wrapper, "#todo-parent")).toBe("Keine");
      expect(value(wrapper, "#todo-category")).toBe("Keine");
      expect(wrapper.find("blockquote").exists()).toBe(false);
      expect(await submit(wrapper)).toMatchObject({
        title: "Notizen Kampagne Buch schreiben",
        parentId: null,
        categoryId: null,
      });
    });

    it("gives back the category a chosen place brought when the named one goes", async () => {
      const wrapper = await mountForm();
      await choose(wrapper, "#todo-parent", "Kapitel 3");
      expect(value(wrapper, "#todo-category")).toBe("Schreiben");
      await dictate(wrapper, "Szene Kategorie Sport");
      expect(value(wrapper, "#todo-category")).toBe("Sport");
      await wrapper
        .get('[aria-label="Kategorie: Sport, entfernen"]')
        .trigger("click");
      expect(value(wrapper, "#todo-category")).toBe("Schreiben");
    });

    it("leaves a place chosen by hand alone, and the campaign's words in the title", async () => {
      const wrapper = await mountForm();
      await choose(wrapper, "#todo-parent", "Garten");
      await dictate(wrapper, "Hecke Kampagne Buch schreiben Kategorie Sport");
      expect(chipNames(wrapper)).toEqual(["Kategorie: Sport, entfernen"]);
      expect(value(wrapper, "#todo-parent")).toBe("Garten");
      expect(await submit(wrapper)).toMatchObject({
        title: "Hecke Kampagne Buch schreiben",
        parentId: 5,
        categoryId: 10,
      });
    });

    it("leaves a category chosen by hand alone", async () => {
      const wrapper = await mountForm();
      await wrapper.get(".form-disclosure__toggle").trigger("click");
      await choose(wrapper, "#todo-category", "Sport");
      await dictate(wrapper, "Kapitel Kampagne Buch schreiben Kategorie Schreiben");
      expect(chipNames(wrapper)).toEqual([
        "Kampagne: Buch schreiben, entfernen",
      ]);
      expect(await submit(wrapper)).toMatchObject({
        title: "Kapitel Kategorie Schreiben",
        parentId: 1,
        categoryId: 10,
      });
    });

    it("reads only the category inside a campaign: the place is set", async () => {
      const garden = hierarchyTodo({ id: 5, title: "Garten", color: "plum" });
      const wrapper = await mountForm({ parent: garden });
      await dictate(wrapper, "Hecke Kampagne Buch schreiben Kategorie Sport");
      expect(chipNames(wrapper)).toEqual(["Kategorie: Sport, entfernen"]);
      expect(await submit(wrapper)).toMatchObject({
        title: "Hecke Kampagne Buch schreiben",
        parentId: 5,
        categoryId: 10,
      });
    });

    it("leaves a typed title as typed", async () => {
      const wrapper = await mountForm();
      await wrapper
        .get('input[name="title"]')
        .setValue("Kapitel Kampagne Buch schreiben");
      expect(wrapper.find(".parse-chip").exists()).toBe(false);
      expect(await submit(wrapper)).toMatchObject({
        title: "Kapitel Kampagne Buch schreiben",
        parentId: null,
        categoryId: null,
      });
    });

    describe("a name that matches none", () => {
      const campaignRow = (id: number, title: string) => ({
        ...response,
        id,
        title,
        color: colorOfName(title),
      });

      it("shows a new campaign and category pending in their pickers and creates both first", async () => {
        vi.mocked(createCategory).mockResolvedValue({ id: 12, name: "Haushalt" });
        createTodoMock
          .mockResolvedValueOnce(campaignRow(40, "Umzug"))
          .mockResolvedValueOnce(response);
        const changed = vi.fn();
        window.addEventListener("timer-data-changed", changed);
        const wrapper = await mountForm();
        await dictate(wrapper, "Kisten packen morgen Kampagne Umzug Kategorie Haushalt");
        expect(chipNames(wrapper)).toEqual([
          "Tag: morgen, entfernen",
          "Neue Kampagne: Umzug, wird beim Anlegen erstellt, entfernen",
          "Neue Kategorie: Haushalt, wird beim Anlegen erstellt, entfernen",
        ]);
        expect(value(wrapper, "#todo-parent")).toBe("Neue Kampagne: Umzug");
        expect(value(wrapper, "#todo-category")).toBe("Neue Kategorie: Haushalt");
        // Nothing exists before saving.
        expect(createCategory).not.toHaveBeenCalled();
        expect(createTodoMock).not.toHaveBeenCalled();

        await wrapper.get("form").trigger("submit");
        await flushPromises();
        expect(createCategory).toHaveBeenCalledWith("Haushalt");
        expect(createTodoMock).toHaveBeenNthCalledWith(1, {
          title: "Umzug",
          scheduledDate: null,
          timeOfDay: null,
          plannedDurationMinutes: null,
          color: colorOfName("Umzug"),
          categoryId: 12,
        });
        expect(createTodoMock).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            title: "Kisten packen",
            scheduledDate: "2026-11-25",
            parentId: 40,
            categoryId: 12,
          }),
        );
        expect(changed).toHaveBeenCalled();
        window.removeEventListener("timer-data-changed", changed);
        expect(wrapper.emitted("created")).toHaveLength(1);
      });

      it("gives a new campaign the category named that exists", async () => {
        createTodoMock
          .mockResolvedValueOnce(campaignRow(40, "Umzug"))
          .mockResolvedValueOnce(response);
        const wrapper = await mountForm();
        await dictate(wrapper, "Kisten Kampagne Umzug Kategorie Sport");
        expect(value(wrapper, "#todo-category")).toBe("Sport");
        await wrapper.get("form").trigger("submit");
        await flushPromises();
        expect(createTodoMock).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({ title: "Umzug", categoryId: 10 }),
        );
        expect(createTodoMock).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ parentId: 40, categoryId: 10 }),
        );
        expect(createCategory).not.toHaveBeenCalled();
      });

      it("takes a pending category over the one a chosen place brought, and gives it back", async () => {
        const wrapper = await mountForm();
        await choose(wrapper, "#todo-parent", "Kapitel 3");
        expect(value(wrapper, "#todo-category")).toBe("Schreiben");
        await dictate(wrapper, "Szene Kategorie Lektorat");
        expect(value(wrapper, "#todo-category")).toBe("Neue Kategorie: Lektorat");
        await wrapper
          .get(
            '[aria-label="Neue Kategorie: Lektorat, wird beim Anlegen erstellt, entfernen"]',
          )
          .trigger("click");
        expect(value(wrapper, "#todo-category")).toBe("Schreiben");
        expect(await submit(wrapper)).toMatchObject({
          title: "Szene Kategorie Lektorat",
          parentId: 2,
          categoryId: 11,
        });
        expect(createCategory).not.toHaveBeenCalled();
      });

      it("drops the pending campaign once a place is chosen by hand", async () => {
        const wrapper = await mountForm();
        await dictate(wrapper, "Hecke schneiden Kampagne Vorgarten");
        expect(value(wrapper, "#todo-parent")).toBe("Neue Kampagne: Vorgarten");
        await choose(wrapper, "#todo-parent", "Garten");
        expect(wrapper.find(".parse-chip").exists()).toBe(false);
        expect(await submit(wrapper)).toMatchObject({
          title: "Hecke schneiden Kampagne Vorgarten",
          parentId: 5,
        });
        expect(createTodoMock).toHaveBeenCalledTimes(1);
      });

      it("creates no quest when the campaign fails, and creates the category only once", async () => {
        vi.mocked(createCategory).mockResolvedValue({ id: 12, name: "Haushalt" });
        createTodoMock.mockRejectedValueOnce(new Error("Offline"));
        const wrapper = await mountForm();
        await dictate(wrapper, "Kisten Kampagne Umzug Kategorie Haushalt");
        await wrapper.get("form").trigger("submit");
        await flushPromises();
        expect(wrapper.get('[role="alert"]').text()).toBe(
          "Die Kampagne „Umzug“ konnte nicht angelegt werden, die Quest ist nicht erstellt. Offline",
        );
        expect(createTodoMock).toHaveBeenCalledTimes(1);
        expect(value(wrapper, 'input[name="title"]')).toBe(
          "Kisten Kampagne Umzug Kategorie Haushalt",
        );
        expect(wrapper.emitted("created")).toBeUndefined();

        createTodoMock
          .mockResolvedValueOnce(campaignRow(40, "Umzug"))
          .mockResolvedValueOnce(response);
        await wrapper.get("form").trigger("submit");
        await flushPromises();
        expect(createCategory).toHaveBeenCalledTimes(1);
        expect(createTodoMock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            title: "Kisten",
            parentId: 40,
            categoryId: 12,
          }),
        );
      });

      it("offers no new campaign inside a campaign: the place is set", async () => {
        const garden = hierarchyTodo({ id: 5, title: "Garten", color: "plum" });
        const wrapper = await mountForm({ parent: garden });
        await dictate(wrapper, "Hecke Kampagne Vorgarten");
        expect(wrapper.find(".parse-chip").exists()).toBe(false);
      });

      it("offers no new names while the lists could not be read", async () => {
        vi.mocked(getTodoHierarchy).mockRejectedValue(new Error("Offline"));
        vi.mocked(getCategories).mockRejectedValue(new Error("Offline"));
        const wrapper = await mountForm();
        await dictate(wrapper, "Kisten Kampagne Umzug Kategorie Haushalt");
        expect(wrapper.find(".parse-chip").exists()).toBe(false);
      });
    });
  });
});
