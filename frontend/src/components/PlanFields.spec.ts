import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import PlanFields from "./PlanFields.vue";

function mountFields(initialDate = "", initialTime = "") {
  const date = ref(initialDate);
  const time = ref(initialTime);
  const wrapper = mount(
    defineComponent({
      components: { PlanFields },
      setup: () => ({ date, time }),
      template:
        '<PlanFields v-model:date="date" v-model:time="time" id-prefix="t" />',
    }),
  );
  const chip = (label: string) =>
    wrapper.findAll("button").find((button) => button.text() === label)!;
  return { wrapper, date, time, chip };
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

  it("only offers a time once there is a day", async () => {
    const { wrapper, date } = mountFields();
    const time = wrapper.get<HTMLInputElement>('input[name="timeOfDay"]');
    expect(time.element.disabled).toBe(true);
    date.value = "2026-10-05";
    await wrapper.vm.$nextTick();
    expect(time.element.disabled).toBe(false);
  });

  it("drops the time when the day goes", async () => {
    const { wrapper, time } = mountFields("2026-10-05", "09:30");
    await wrapper.get('input[name="scheduledDate"]').setValue("");
    expect(time.value).toBe("");
  });
});
