import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import AppointmentFields from "./AppointmentFields.vue";

enableAutoUnmount(afterEach);

function mountFields(initialDate = "", initialTime = "") {
  const date = ref(initialDate);
  const time = ref(initialTime);
  const wrapper = mount(
    defineComponent({
      components: { AppointmentFields },
      setup: () => ({ date, time }),
      template:
        '<AppointmentFields v-model:time="time" :date="date" id-prefix="t" />',
    }),
    { attachTo: document.body },
  );
  const toggle = () => wrapper.get("button[aria-expanded]");
  const input = () => wrapper.get<HTMLInputElement>('input[name="timeOfDay"]');
  return { wrapper, date, time, toggle, input };
}

describe("AppointmentFields", () => {
  it("waits closed behind “Termin (feste Uhrzeit)” while there is no time", () => {
    const { toggle, input } = mountFields("2026-10-05");
    expect(toggle().text()).toBe("Termin (feste Uhrzeit)");
    expect(toggle().attributes("aria-expanded")).toBe("false");
    expect(input().isVisible()).toBe(false);
  });

  it("opens in place with the focus on the time", async () => {
    const { toggle, input, time } = mountFields("2026-10-05");
    await toggle().trigger("click");
    expect(toggle().attributes("aria-expanded")).toBe("true");
    expect(input().isVisible()).toBe(true);
    expect(document.activeElement).toBe(input().element);
    await input().setValue("09:30");
    expect(time.value).toBe("09:30");
    // Closed again, the button still names the time.
    await toggle().trigger("click");
    expect(toggle().text()).toContain("09:30 Uhr");
  });

  it("starts open when the quest is an appointment", () => {
    const { toggle, input } = mountFields("2026-10-05", "10:00");
    expect(toggle().attributes("aria-expanded")).toBe("true");
    expect(input().isVisible()).toBe(true);
    expect(input().element.value).toBe("10:00");
  });

  it("only offers a time once there is a day", async () => {
    const { wrapper, date, input } = mountFields();
    expect(input().element.disabled).toBe(true);
    expect(wrapper.text()).toContain("Ein Termin braucht einen Tag");
    date.value = "2026-10-05";
    await nextTick();
    expect(input().element.disabled).toBe(false);
  });

  it("drops the time when the day goes", async () => {
    const { date, time } = mountFields("2026-10-05", "09:30");
    date.value = "";
    await nextTick();
    expect(time.value).toBe("");
  });
});
