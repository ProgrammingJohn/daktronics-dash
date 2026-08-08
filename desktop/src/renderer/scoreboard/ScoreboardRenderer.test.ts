import { describe, expect, test } from "vitest";
import type { SvgBinding } from "../sports/types";
import { ScoreboardRenderer } from "./ScoreboardRenderer";

interface ScoreboardView {
  home_score: number;
  panel_color: string;
  show_possession: boolean;
  scale: number;
}

const svg_fixture = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">
    <defs>
      <linearGradient id="score-gradient"><stop offset="1" stop-color="#fff" /></linearGradient>
      <clipPath id="score-clip"><rect width="100" height="40" /></clipPath>
      <style>.score-panel { fill: url(#score-gradient); clip-path: url(#score-clip); }</style>
    </defs>
    <rect id="panel" data-score-field="panel" class="score-panel" style="stroke: url(#score-gradient)" />
    <use data-score-field="panel-copy" href="#panel" />
    <text data-score-field="home_score">0</text>
    <circle data-score-field="possession" />
    <g data-score-field="scaled" />
  </svg>
`;

const bindings: readonly SvgBinding<ScoreboardView>[] = [
  {
    operation: "text",
    selector: '[data-score-field="home_score"]',
    value: (view) => String(view.home_score)
  },
  {
    operation: "attribute",
    selector: '[data-score-field="panel"]',
    attribute: "data-color",
    value: (view) => view.panel_color
  },
  {
    operation: "visibility",
    selector: '[data-score-field="possession"]',
    visible: (view) => view.show_possession
  },
  {
    operation: "style",
    selector: '[data-score-field="scaled"]',
    property: "--score-scale",
    value: (view) => String(view.scale)
  }
];

function create_renderer(): { host: HTMLDivElement; renderer: ScoreboardRenderer } {
  const host = document.createElement("div");
  document.body.append(host);
  return { host, renderer: new ScoreboardRenderer(host) };
}

describe("ScoreboardRenderer", () => {
  test("isolates SVG definitions and updates to each renderer ShadowRoot", () => {
    const first = create_renderer();
    const second = create_renderer();

    first.renderer.mount(svg_fixture, bindings);
    second.renderer.mount(svg_fixture, bindings);

    expect(first.host.shadowRoot).toBe(first.renderer.shadowRoot);
    expect(second.host.shadowRoot).toBe(second.renderer.shadowRoot);

    const first_gradient = first.renderer.shadowRoot.querySelector("linearGradient")?.id;
    const second_gradient = second.renderer.shadowRoot.querySelector("linearGradient")?.id;
    const first_clip = first.renderer.shadowRoot.querySelector("clipPath")?.id;
    const second_clip = second.renderer.shadowRoot.querySelector("clipPath")?.id;

    expect(first_gradient).toMatch(/^dakdash-\d+-score-gradient$/);
    expect(second_gradient).toMatch(/^dakdash-\d+-score-gradient$/);
    expect(first_gradient).not.toBe(second_gradient);
    expect(first_clip).not.toBe(second_clip);

    const first_panel = first.renderer.shadowRoot.querySelector('[data-score-field="panel"]');
    const second_panel = second.renderer.shadowRoot.querySelector('[data-score-field="panel"]');
    expect(first_panel?.getAttribute("style")).toBe(`stroke: url(#${first_gradient})`);
    expect(second_panel?.getAttribute("style")).toBe(`stroke: url(#${second_gradient})`);
    expect(
      first.renderer.shadowRoot.querySelector('[data-score-field="panel-copy"]')?.getAttribute("href")
    ).toBe(`#${first_panel?.id}`);
    expect(
      second.renderer.shadowRoot.querySelector('[data-score-field="panel-copy"]')?.getAttribute("href")
    ).toBe(`#${second_panel?.id}`);
    expect(first.renderer.shadowRoot.querySelector("svg style")?.textContent).toContain(
      `url(#${first_gradient})`
    );
    expect(first.renderer.shadowRoot.querySelector("svg style")?.textContent).toContain(
      `url(#${first_clip})`
    );

    first.renderer.render({
      home_score: 7,
      panel_color: "blue",
      show_possession: false,
      scale: 1.25
    });

    expect(
      first.renderer.shadowRoot.querySelector('[data-score-field="home_score"]')?.textContent
    ).toBe("7");
    expect(
      second.renderer.shadowRoot.querySelector('[data-score-field="home_score"]')?.textContent
    ).toBe("0");
  });

  test("applies text, attribute, visibility, and style bindings", () => {
    const { renderer } = create_renderer();
    renderer.mount(svg_fixture, bindings);

    renderer.render({
      home_score: 21,
      panel_color: "gold",
      show_possession: false,
      scale: 1.5
    });

    expect(renderer.shadowRoot.querySelector('[data-score-field="home_score"]')).toHaveTextContent(
      "21"
    );
    expect(
      renderer.shadowRoot.querySelector('[data-score-field="panel"]')?.getAttribute("data-color")
    ).toBe("gold");
    expect(renderer.shadowRoot.querySelector('[data-score-field="possession"]')).toHaveProperty(
      "hidden",
      true
    );
    expect(
      (renderer.shadowRoot.querySelector('[data-score-field="scaled"]') as SVGElement).style.getPropertyValue(
        "--score-scale"
      )
    ).toBe("1.5");
  });

  test.each([
    {
      name: "missing",
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text data-score-field="other" /></svg>',
      found: 0
    },
    {
      name: "duplicate",
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text data-score-field="home_score" /><text data-score-field="home_score" /></svg>',
      found: 2
    }
  ])("rejects a $name semantic field", ({ svg, found }) => {
    const { renderer } = create_renderer();
    const selector = '[data-score-field="home_score"]';

    expect(() => renderer.mount(svg, [bindings[0]!])).toThrow(
      `Invalid SVG binding ${selector}: expected 1, found ${found}`
    );
  });

  test.each([
    ["malformed XML", "<svg><g></svg>"],
    ["no SVG", "<root />"],
    ["multiple SVGs", '<root xmlns="http://www.w3.org/2000/svg"><svg /><svg /></root>']
  ])("rejects %s", (_name, source) => {
    const { renderer } = create_renderer();
    expect(() => renderer.mount(source, [])).toThrow();
  });

  test("dispose empties the ShadowRoot and makes rendering unavailable", () => {
    const { renderer } = create_renderer();
    renderer.mount(svg_fixture, bindings);

    renderer.dispose();

    expect(renderer.shadowRoot.childNodes).toHaveLength(0);
    expect(() =>
      renderer.render({
        home_score: 3,
        panel_color: "red",
        show_possession: true,
        scale: 1
      })
    ).toThrow("ScoreboardRenderer is not mounted");
  });
});
