export const URL_REFERENCE_ATTRIBUTES = [
  "clip-path",
  "fill",
  "filter",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "stroke"
] as const;

export const HASH_REFERENCE_ATTRIBUTES = [
  "href",
  "xlink:href",
  "aria-labelledby",
  "aria-describedby"
] as const;

const aria_reference_attributes = new Set<string>([
  "aria-labelledby",
  "aria-describedby"
]);

function svg_elements(svg: SVGSVGElement): Element[] {
  return [svg, ...svg.querySelectorAll("*")];
}

function rewrite_url_references(value: string, ids: ReadonlyMap<string, string>): string {
  return value.replace(
    /url\((\s*)#([^\s)]+)(\s*)\)/g,
    (reference, leading_space: string, id: string, trailing_space: string) => {
      const rewritten_id = ids.get(id);
      return rewritten_id === undefined
        ? reference
        : `url(${leading_space}#${rewritten_id}${trailing_space})`;
    }
  );
}

function rewrite_hash_tokens(
  value: string,
  ids: ReadonlyMap<string, string>,
  allow_plain_ids: boolean
): string {
  return value.replace(/\S+/g, (token) => {
    if (token.startsWith("#")) {
      const rewritten_id = ids.get(token.slice(1));
      return rewritten_id === undefined ? token : `#${rewritten_id}`;
    }

    if (allow_plain_ids) {
      return ids.get(token) ?? token;
    }

    return token;
  });
}

export function rewrite_svg_ids(svg: SVGSVGElement, prefix: string): void {
  const elements = svg_elements(svg);
  const ids = new Map<string, string>();

  for (const element of elements) {
    const id = element.getAttribute("id");
    if (id !== null) {
      ids.set(id, `${prefix}${id}`);
    }
  }

  for (const element of elements) {
    const id = element.getAttribute("id");
    if (id !== null) {
      element.setAttribute("id", ids.get(id)!);
    }

    for (const attribute of [...element.attributes]) {
      const url_rewritten = rewrite_url_references(attribute.value, ids);
      const rewritten = (HASH_REFERENCE_ATTRIBUTES as readonly string[]).includes(
        attribute.name
      )
        ? rewrite_hash_tokens(
            url_rewritten,
            ids,
            aria_reference_attributes.has(attribute.name)
          )
        : url_rewritten;

      if (rewritten !== attribute.value) {
        if (attribute.namespaceURI === null) {
          element.setAttribute(attribute.name, rewritten);
        } else {
          element.setAttributeNS(attribute.namespaceURI, attribute.name, rewritten);
        }
      }
    }

    if (element.localName === "style" && element.textContent !== null) {
      element.textContent = rewrite_url_references(element.textContent, ids);
    }
  }
}
