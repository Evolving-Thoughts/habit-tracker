import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import PlanFields from "./PlanFields.vue";

function mountFields(initialDate = "") {
  const date = ref(initialDate);
  const wrapper = mount(
    defineComponent({
      components: { PlanFields },
      setup: () => ({ date }),
      template: '<PlanFields v-model:date="date" id-prefix="t" />',
    }),
  );
  const chip = (label: string) =>
    wrapper.findAll("button").find((button) => button.text() === label)!;
  return { wrapper, date, chip };
}

describe("PlanFields", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Late evening in Berlin: still the 2nd there, already the 3rd in UTC.
    vi.setSystemTime(new Date("2026-10-02T22:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("plans today or tomorrow with one tap, in Berlin days", async () => {
    const { date, chip } = mountFields();
    await chip("Heute").trigger("click");
    expect(date.value).toBe("2026-10-03");
    expect(chip("Heute").attributes("aria-pressed")).toBe("true");
    await chip("Morgen").trigger("click");
    expect(date.value).toBe("2026-10-04");
    expect(chip("Heute").attributes("aria-pressed")).toBe("false");
  });

  it("takes the day back on a second tap", async () => {
    const { date, chip } = mountFields("2026-10-03");
    await chip("Heute").trigger("click");
    expect(date.value).toBe("");
  });

  it("says where a quest without a day lives only while no day is set", async () => {
    const { wrapper, chip } = mountFields();
    const input = () => wrapper.get('input[name="scheduledDate"]');
    expect(wrapper.get("#t-date-hint").text()).toBe(
      "Ohne Tag liegt die Quest im Questlog.",
    );
    expect(input().attributes("aria-describedby")).toBe("t-date-hint");
    await chip("Heute").trigger("click");
    expect(wrapper.find("#t-date-hint").exists()).toBe(false);
    expect(input().attributes("aria-describedby")).toBeUndefined();
  });

  it("asks for the day only; the time belongs to an appointment", () => {
    const { wrapper } = mountFields();
    expect(wrapper.find('input[name="timeOfDay"]').exists()).toBe(false);
    expect(wrapper.get("label").text()).toBe("Tag · optional");
  });
});
