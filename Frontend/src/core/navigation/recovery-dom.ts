type Child = Node | string | null | undefined;

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = "", ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children.filter((child): child is Node | string => child != null));
  return node;
}

export function attributes<T extends Element>(node: T, values: Record<string, string | number | boolean>) {
  for (const [key, value] of Object.entries(values)) node.setAttribute(key, String(value));
  return node;
}

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K, values: Record<string, string | number | boolean>, ...children: (Node | string)[]
): SVGElementTagNameMap[K] {
  const node = attributes(document.createElementNS("http://www.w3.org/2000/svg", tag), values);
  node.append(...children);
  return node;
}

export function replaceKeepingFocus(host: HTMLElement, content: Node) {
  const focus = document.activeElement;
  const key = focus instanceof HTMLElement && host.contains(focus) ? focus.dataset.recoveryFocus : undefined;
  host.replaceChildren(content);
  if (key) host.querySelector<HTMLElement>(`[data-recovery-focus="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
}
