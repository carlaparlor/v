/**
 * Minimal DOM stub for tests. Dev-only: never referenced by index.html.
 *
 * Just enough of the DOM for Vinland's ui layer — createElement, replaceChildren,
 * appendChild, dataset, style, textContent. If a module needs more than this, that is a
 * signal it is doing too much in the DOM layer.
 *
 * Upgraded for click-based interactables: adds classList, setAttribute, event listeners,
 * and click simulation helper.
 */
export function makeElement(tagName = 'DIV') {
  const el = {
    tagName: String(tagName).toUpperCase(),
    className: '',
    id: '',
    dataset: {},
    style: {},
    children: [],
    parentNode: null,
    attributes: {},
    _listeners: {},
    _text: '',
    replaceChildren(...nodes) {
      this.children = nodes;
      for (const node of nodes) node.parentNode = this;
    },
    appendChild(node) {
      this.children.push(node);
      node.parentNode = this;
      return node;
    },
    addEventListener(type, fn) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (!this._listeners[type]) return;
      this._listeners[type] = this._listeners[type].filter((f) => f !== fn);
    },
    dispatchEvent(event) {
      const list = this._listeners[event.type] || [];
      for (const fn of list) fn(event);
      // bubble to document if present
      if (globalThis.document && globalThis.document !== this && typeof globalThis.document.dispatchEvent === 'function') {
        // Only bubble click etc that document listens for? Let document also get it
        // Avoid infinite by not re-bubbling if already document
      }
      return true;
    },
    click() {
      const e = { type: 'click', target: this, stopPropagation() {} };
      this.dispatchEvent(e);
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      // The SVG panel sets classes via setAttribute('class', …); mirror it onto
      // className so findByClass/findAllByClass can see SVG nodes too.
      if (name === 'class') this.className = String(value);
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
  };
  Object.defineProperty(el, 'textContent', {
    get() {
      if (this.children && this.children.length > 0) {
        let t = this._text || '';
        for (const c of this.children) {
          t += c.textContent || '';
        }
        return t;
      }
      return this._text || '';
    },
    set(v) {
      this._text = String(v ?? '');
    },
    configurable: true,
    enumerable: true,
  });
  // classList shim tied to className
  el.classList = {
    add(cls) {
      const parts = el.className.split(/\s+/).filter(Boolean);
      if (!parts.includes(cls)) parts.push(cls);
      el.className = parts.join(' ');
    },
    remove(cls) {
      const parts = el.className.split(/\s+/).filter(Boolean).filter((p) => p !== cls);
      el.className = parts.join(' ');
    },
    contains(cls) {
      return el.className.split(/\s+/).includes(cls);
    },
  };
  return el;
}

export function makeDocument() {
  const shell = makeElement('MAIN');
  shell.id = 'shell';
  shell.dataset = {};
  shell.style = {};
  shell.classList = {
    add(cls) {
      const parts = shell.className.split(/\s+/).filter(Boolean);
      if (!parts.includes(cls)) parts.push(cls);
      shell.className = parts.join(' ');
    },
    remove(cls) {
      const parts = shell.className.split(/\s+/).filter(Boolean).filter((p) => p !== cls);
      shell.className = parts.join(' ');
    },
    contains(cls) {
      return shell.className.split(/\s+/).includes(cls);
    },
  };
  const documentElement = makeElement('HTML');
  const body = makeElement('BODY');
  const doc = {
    shell,
    body,
    documentElement,
    readyState: 'complete',
    _listeners: {},
    getElementById: (id) => (id === 'shell' ? shell : null),
    createElement: makeElement,
    createElementNS: (_namespace, tagName) => makeElement(tagName),
    addEventListener(type, fn) {
      if (!doc._listeners[type]) doc._listeners[type] = [];
      doc._listeners[type].push(fn);
    },
    dispatchEvent(event) {
      const list = doc._listeners[event.type] || [];
      for (const fn of list) fn(event);
    },
  };
  return doc;
}

/**
 * Install a stub document globally and capture console output.
 * @returns {{ doc: object, info: string[], errors: string[] }}
 */
export function installDocument(doc = makeDocument()) {
  globalThis.document = doc;
  // Provide getComputedStyle fallback for game fade timing
  if (!globalThis.getComputedStyle) {
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  }
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

/** Find by data attribute (for tests) */
export function findByDataset(node, key, value) {
  if (!node) return null;
  if (node.dataset && node.dataset[key] === value) return node;
  for (const child of node.children ?? []) {
    const found = findByDataset(child, key, value);
    if (found) return found;
  }
  return null;
}

export function findAllByDataset(node, key) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if (n.dataset && n.dataset[key] !== undefined) out.push(n);
    for (const child of n.children ?? []) walk(child);
  };
  walk(node);
  return out;
}
