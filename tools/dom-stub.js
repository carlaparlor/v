/**
 * Minimal DOM stub for tests. Dev-only: never referenced by index.html.
 *
 * Just enough of the DOM for Vinland's ui layer — createElement, replaceChildren,
 * appendChild, dataset, style, textContent. If a module needs more than this, that is a
 * signal it is doing too much in the DOM layer.
 */

export function makeElement(tagName = 'DIV') {
  return {
    tagName: String(tagName).toUpperCase(),
    className: '',
    id: '',
    textContent: '',
    dataset: {},
    style: {},
    children: [],
    parentNode: null,
    replaceChildren(...nodes) {
      this.children = nodes;
      for (const node of nodes) node.parentNode = this;
    },
    appendChild(node) {
      this.children.push(node);
      node.parentNode = this;
      return node;
    },
    addEventListener() {},
  };
}

export function makeDocument() {
  const shell = makeElement('MAIN');
  shell.id = 'shell';
  const documentElement = makeElement('HTML');
  return {
    shell,
    documentElement,
    readyState: 'complete',
    getElementById: (id) => (id === 'shell' ? shell : null),
    createElement: makeElement,
    addEventListener() {},
  };
}

/**
 * Install a stub document globally and capture console output.
 * @returns {{ doc: object, info: string[], errors: string[] }}
 */
export function installDocument(doc = makeDocument()) {
  globalThis.document = doc;
  const info = [];
  const errors = [];
  globalThis.console.info = (...args) => info.push(args.join(' '));
  globalThis.console.error = (...args) => errors.push(args.join(' '));
  return { doc, info, errors };
}

/** First descendant matching a class name, depth-first. */
export function findByClass(node, className) {
  if (!node) return null;
  if (String(node.className ?? '').split(/\s+/).includes(className)) return node;
  for (const child of node.children ?? []) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

/** All descendants matching a class name, depth-first, in document order. */
export function findAllByClass(node, className) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (String(n.className ?? '').split(/\s+/).includes(className)) out.push(n);
    for (const child of n.children ?? []) walk(child);
  };
  walk(node);
  return out;
}
