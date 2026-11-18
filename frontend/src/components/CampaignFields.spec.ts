import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { CAMPAIGN_COLORS, CAMPAIGN_ICONS } from "../types/campaign";
import CampaignFields from "./CampaignFields.vue";

enableAutoUnmount(afterEach);

const fields = (props: Record<string, unknown> = {}) =>
  mount(CampaignFields, {
    props: {
      idPrefix: "test",
      title: "Buch",
      color: null,
      icon: null,
      target: "",
      ...props,
    },
  });

describe("CampaignFields", () => {
  it("offers every colour and icon as a named radio, plus none", () => {
    const wrapper = fields();
    const [colors, icons] = wrapper.findAll("fieldset");
    expect(colors!.get("legend").text()).toBe("Farbe der Kampagne");
    expect(colors!.findAll('input[type="radio"]')).toHaveLength(
      CAMPAIGN_COLORS.length + 1,
    );
    expect(icons!.get("legend").text()).toBe("Symbol");
    expect(icons!.findAll('input[type="radio"]')).toHaveLength(
      CAMPAIGN_ICONS.length + 1,
    );
    // Every choice has a spoken name inside its label.
    for (const label of wrapper.findAll("fieldset label"))
      expect(label.get("span.visually-hidden").text()).not.toBe("");
    expect(colors!.text()).toContain("Schiefer");
    expect(icons!.text()).toContain("Hantel");
  });

  it("starts on the automatic colour and no icon", () => {
    const wrapper = fields();
    for (const group of wrapper.findAll("fieldset"))
      expect(
        group.findAll<HTMLInputElement>('input[type="radio"]')[0]!.element
          .checked,
      ).toBe(true);
    expect(wrapper.findAll("input:checked")).toHaveLength(2);
    expect(wrapper.text()).toContain("Automatisch aus dem Titel");
    expect(wrapper.text()).toContain("Kein Symbol");
  });

  it("reports the chosen colour, icon and hours", async () => {
    const wrapper = fields({ color: "slate", icon: "music", target: "2" });
    expect(wrapper.text()).toContain("Schiefer");
    expect(wrapper.text()).toContain("Musik");
    await wrapper.get('input[value="ochre"]').setValue(true);
    await wrapper.get('input[value="globe"]').setValue(true);
    await wrapper.get('input[name="weeklyTarget"]').setValue("4.5");
    expect(wrapper.emitted("update:color")).toEqual([["ochre"]]);
    expect(wrapper.emitted("update:icon")).toEqual([["globe"]]);
    expect(wrapper.emitted("update:target")).toEqual([[4.5]]);
  });

  it("lets the weekly goal go in half hours up to 100", () => {
    const input = fields().get('input[name="weeklyTarget"]');
    expect(input.attributes()).toMatchObject({
      type: "number",
      step: "0.5",
      min: "0.5",
      max: "100",
    });
    expect(input.attributes("aria-describedby")).toBe(
      "test-weekly-target-hint",
    );
  });
});
