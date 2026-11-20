import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import CampaignChip from "./CampaignChip.vue";

enableAutoUnmount(afterEach);

describe("CampaignChip", () => {
  it("names the campaign with its icon on a badge in its colour", () => {
    const wrapper = mount(CampaignChip, {
      props: {
        campaign: { title: "Halbmarathon", color: "navy", icon: "bike" },
      },
    });
    expect(wrapper.get(".campaign-chip__name").text()).toBe("Halbmarathon");
    // Cut short on a narrow card, the tooltip and the spoken name keep it whole.
    expect(wrapper.attributes("title")).toBe("Halbmarathon");
    expect(wrapper.text()).toBe("Kampagne Halbmarathon");
    expect(wrapper.attributes("style")).toContain(
      "--mark: var(--color-mark-navy)",
    );
    expect(wrapper.get(".campaign-chip__badge").attributes("aria-hidden")).toBe(
      "true",
    );
    expect(wrapper.find(".campaign-chip__badge svg").exists()).toBe(true);
  });

  it("falls back to the title's colour and the campaign icon", () => {
    const wrapper = mount(CampaignChip, {
      props: { campaign: { title: "Buch", color: "orange", icon: "rocket" } },
    });
    expect(wrapper.attributes("style")).toMatch(
      /--mark: var\(--color-mark-[a-z]+\)/,
    );
    expect(wrapper.find(".campaign-chip__badge svg").exists()).toBe(true);
  });
});
