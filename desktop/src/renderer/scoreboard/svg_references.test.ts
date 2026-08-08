import { describe, expect, test } from "vitest";
import {
  HASH_REFERENCE_ATTRIBUTES,
  URL_REFERENCE_ATTRIBUTES,
  rewrite_svg_ids
} from "./svg_references";

function parse_svg(source: string): SVGSVGElement {
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const svg = document.documentElement;

  if (!(svg instanceof SVGSVGElement)) {
    throw new Error("Fixture did not parse as an SVG");
  }

  return svg;
}

describe("rewrite_svg_ids", () => {
  test("rewrites IDs and every supported local reference location", () => {
    const svg = parse_svg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="paint"><stop offset="1" /></linearGradient>
          <clipPath id="crop"><rect width="10" height="10" /></clipPath>
          <filter id="blur" />
          <marker id="arrow" />
          <mask id="fade" />
          <style>
            .panel { fill: url(#paint); clip-path: url( #crop ); }
          </style>
        </defs>
        <title id="title">Score</title>
        <desc id="description">Current score</desc>
        <rect
          id="panel"
          clip-path="url(#crop)"
          fill="url(#paint)"
          filter="url(#blur)"
          marker-end="url(#arrow)"
          marker-mid="url(#arrow)"
          marker-start="url(#arrow)"
          mask="url(#fade)"
          stroke="url(#paint)"
          style="fill: url(#paint); stroke: url( #paint )"
          aria-labelledby="title description"
          aria-describedby="description"
        />
        <use id="copy" href="#panel" xlink:href="#panel" xmlns:xlink="http://www.w3.org/1999/xlink" />
      </svg>
    `);

    rewrite_svg_ids(svg, "fixture-");

    expect([...svg.querySelectorAll("[id]")].map((element) => element.id)).toEqual([
      "fixture-paint",
      "fixture-crop",
      "fixture-blur",
      "fixture-arrow",
      "fixture-fade",
      "fixture-title",
      "fixture-description",
      "fixture-panel",
      "fixture-copy"
    ]);

    const panel = svg.querySelector("#fixture-panel");
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute("clip-path")).toBe("url(#fixture-crop)");
    expect(panel?.getAttribute("fill")).toBe("url(#fixture-paint)");
    expect(panel?.getAttribute("filter")).toBe("url(#fixture-blur)");
    expect(panel?.getAttribute("marker-end")).toBe("url(#fixture-arrow)");
    expect(panel?.getAttribute("marker-mid")).toBe("url(#fixture-arrow)");
    expect(panel?.getAttribute("marker-start")).toBe("url(#fixture-arrow)");
    expect(panel?.getAttribute("mask")).toBe("url(#fixture-fade)");
    expect(panel?.getAttribute("stroke")).toBe("url(#fixture-paint)");
    expect(panel?.getAttribute("style")).toBe(
      "fill: url(#fixture-paint); stroke: url( #fixture-paint )"
    );
    expect(panel?.getAttribute("aria-labelledby")).toBe(
      "fixture-title fixture-description"
    );
    expect(panel?.getAttribute("aria-describedby")).toBe("fixture-description");

    const copy = svg.querySelector("#fixture-copy");
    expect(copy?.getAttribute("href")).toBe("#fixture-panel");
    expect(copy?.getAttribute("xlink:href")).toBe("#fixture-panel");
    expect(svg.querySelector("style")?.textContent).toContain("url(#fixture-paint)");
    expect(svg.querySelector("style")?.textContent).toContain("url( #fixture-crop )");
  });

  test("leaves external and unknown references unchanged", () => {
    const svg = parse_svg(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <rect id="known" fill="url(https://example.test/art.svg#paint)" />
        <use href="#missing" aria-labelledby="known missing" />
      </svg>
    `);

    rewrite_svg_ids(svg, "local-");

    expect(svg.querySelector("rect")?.getAttribute("fill")).toBe(
      "url(https://example.test/art.svg#paint)"
    );
    expect(svg.querySelector("use")?.getAttribute("href")).toBe("#missing");
    expect(svg.querySelector("use")?.getAttribute("aria-labelledby")).toBe(
      "local-known missing"
    );
  });

  test("exports all reference-bearing attributes used by the rewriter", () => {
    expect(URL_REFERENCE_ATTRIBUTES).toEqual([
      "clip-path",
      "fill",
      "filter",
      "marker-end",
      "marker-mid",
      "marker-start",
      "mask",
      "stroke"
    ]);
    expect(HASH_REFERENCE_ATTRIBUTES).toEqual([
      "href",
      "xlink:href",
      "aria-labelledby",
      "aria-describedby"
    ]);
  });
});
