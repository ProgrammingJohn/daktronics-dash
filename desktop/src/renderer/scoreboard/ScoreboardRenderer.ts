import type { SvgBinding } from "../sports/types";
import { rewrite_svg_ids } from "./svg_references";
import { install_scoreboard_fonts } from "./scoreboard_fonts";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const RESET_STYLE = `
  :host {
    display: block;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
  }

  [hidden] {
    display: none !important;
  }
`;

let next_instance_number = 1;

type BindingUpdate = (view: unknown) => void;

function parse_svg(svg_text: string): SVGSVGElement {
  const document = new DOMParser().parseFromString(svg_text, "image/svg+xml");

  if (document.querySelector("parsererror") !== null) {
    throw new Error("Invalid SVG: failed to parse");
  }

  const root = document.documentElement;
  const svg_elements = [
    ...(root.namespaceURI === SVG_NAMESPACE && root.localName === "svg" ? [root] : []),
    ...root.querySelectorAll("svg")
  ];

  if (svg_elements.length !== 1) {
    throw new Error(`Invalid SVG: expected 1 svg, found ${svg_elements.length}`);
  }

  const svg = svg_elements[0];
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error("Invalid SVG: expected an SVG element");
  }

  return svg;
}

function create_binding_update<TView>(
  binding: SvgBinding<TView>,
  element: Element
): BindingUpdate {
  return (untyped_view: unknown): void => {
    const view = untyped_view as TView;

    switch (binding.operation) {
      case "text":
        element.textContent = binding.value(view);
        break;
      case "attribute":
        element.setAttribute(binding.attribute, binding.value(view));
        break;
      case "visibility": {
        const hidden = !binding.visible(view);
        (element as Element & { hidden: boolean }).hidden = hidden;
        element.toggleAttribute("hidden", hidden);
        break;
      }
      case "style":
        (element as SVGElement).style.setProperty(binding.property, binding.value(view));
        break;
    }
  };
}

export class ScoreboardRenderer {
  readonly shadowRoot: ShadowRoot;

  private readonly id_prefix: string;
  private binding_updates: BindingUpdate[] = [];
  private mounted_svg: SVGSVGElement | null = null;

  constructor(host: HTMLElement) {
    install_scoreboard_fonts(host.ownerDocument);
    this.shadowRoot = host.attachShadow({ mode: "open" });
    this.id_prefix = `dakdash-${next_instance_number}-`;
    next_instance_number += 1;
  }

  mount<TView>(svg_text: string, bindings: readonly SvgBinding<TView>[]): void {
    const svg = parse_svg(svg_text);
    rewrite_svg_ids(svg, this.id_prefix);

    const binding_updates = bindings.map((binding) => {
      const matches = svg.querySelectorAll(binding.selector);
      if (matches.length !== 1) {
        throw new Error(
          `Invalid SVG binding ${binding.selector}: expected 1, found ${matches.length}`
        );
      }

      return create_binding_update(binding, matches[0]!);
    });

    const reset_style = document.createElement("style");
    reset_style.textContent = RESET_STYLE;
    this.shadowRoot.replaceChildren(reset_style, svg);
    this.binding_updates = binding_updates;
    this.mounted_svg = svg;
  }

  render<TView>(view: TView): void {
    if (this.mounted_svg === null) {
      throw new Error("ScoreboardRenderer is not mounted");
    }

    for (const update of this.binding_updates) {
      update(view);
    }
  }

  dispose(): void {
    this.shadowRoot.replaceChildren();
    this.binding_updates = [];
    this.mounted_svg = null;
  }
}
