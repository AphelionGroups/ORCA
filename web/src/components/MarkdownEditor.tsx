import { createEffect, onMount, onCleanup, For } from 'solid-js';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { EditorView, Decoration, WidgetType, keymap, placeholder } from '@codemirror/view';
import type { DecorationSet } from '@codemirror/view';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';

const focused = StateEffect.define<boolean>();
const focusState = StateField.define({ create: () => false, update: (value, transaction) => {
  for (const effect of transaction.effects) if (effect.is(focused)) value = effect.value;
  return value;
} });

class Bullet extends WidgetType {
  toDOM() { const span = document.createElement('span'); span.textContent = '• '; span.className = 'md-bullet'; return span; }
}
class ImagePreview extends WidgetType {
  readonly url: string;
  readonly alt: string;
  constructor(url: string, alt: string) { super(); this.url = url; this.alt = alt; }
  eq(other: ImagePreview) { return this.url === other.url && this.alt === other.alt; }
  toDOM() {
    const image = document.createElement('img'); image.src = this.url; image.alt = this.alt;
    image.className = 'md-image'; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer';
    return image;
  }
}
class TablePreview extends WidgetType {
  constructor(readonlyData: { text: string; rows: { text: string; position: number }[][] }) { super(); this.data = readonlyData; }
  readonly data: { text: string; rows: { text: string; position: number }[][] };
  eq(other: TablePreview) { return JSON.stringify(this.data) === JSON.stringify(other.data); }
  toDOM(view: EditorView) {
    const table = document.createElement('table'); table.className = 'md-table';
    this.data.rows.forEach((row, index) => {
      const tr = table.insertRow();
      row.forEach(value => {
        const cell = document.createElement(index === 0 ? 'th' : 'td'); cell.textContent = value.text.trim();
        cell.tabIndex = 0; cell.title = 'Click or press Enter to edit table';
        const edit = () => { view.dispatch({ selection: { anchor: value.position } }); view.focus(); };
        cell.addEventListener('mousedown', event => { event.preventDefault(); edit(); });
        cell.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); edit(); } });
        tr.appendChild(cell);
      });
    });
    return table;
  }
  ignoreEvent() { return true; }
}
class Checkbox extends WidgetType {
  readonly position: number;
  readonly checked: boolean;
  constructor(position: number, checked: boolean) { super(); this.position = position; this.checked = checked; }
  eq(other: Checkbox) { return this.position === other.position && this.checked === other.checked; }
  toDOM(view: EditorView) {
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = this.checked;
    input.setAttribute('aria-label', 'Toggle checklist item');
    input.addEventListener('change', () => view.dispatch({ changes: { from: this.position + 1, to: this.position + 2, insert: input.checked ? 'x' : ' ' }, userEvent: 'input' }));
    return input;
  }
  ignoreEvent() { return true; }
}
const liveFormatting = StateField.define<DecorationSet>({
  create: state => decorate(state),
  update: (value, transaction) => transaction.docChanged || transaction.selection || syntaxTree(transaction.startState) !== syntaxTree(transaction.state) || transaction.effects.some(effect => effect.is(focused))
    ? decorate(transaction.state) : value,
  provide: field => EditorView.decorations.from(field),
});
function decorate(state: EditorState): DecorationSet {
  const ranges: ReturnType<Decoration['range']>[] = [];
  const active = (from: number, to: number) => state.field(focusState) && state.selection.ranges.some(range =>
    from <= state.doc.lineAt(range.to).to && to >= state.doc.lineAt(range.from).from);
  const hide = (from: number, to: number) => { if (to > from) ranges.push(Decoration.replace({}).range(from, to)); };
  syntaxTree(state).iterate({ enter(node) {
    const { name, from, to } = node;
    const line = state.doc.lineAt(from);
    const editing = active(from, to);
    if (name === 'Image' && !editing) {
      const match = /^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)$/.exec(state.doc.sliceString(from, to));
      if (match && /^(https?:\/\/|\/(?!\/))/i.test(match[2]!)) {
        ranges.push(Decoration.replace({ widget: new ImagePreview(match[2]!, match[1]!) }).range(from, to));
        return false;
      }
    }
    if (name === 'Table' && !editing) {
      const rows: { text: string; position: number }[][] = [];
      for (let row = node.node.firstChild; row; row = row.nextSibling) {
        if (row.name !== 'TableHeader' && row.name !== 'TableRow') continue;
        const cells: { text: string; position: number }[] = [];
        for (let cell = row.firstChild; cell; cell = cell.nextSibling) if (cell.name === 'TableCell') cells.push({ text: state.doc.sliceString(cell.from, cell.to), position: cell.from });
        rows.push(cells);
      }
      ranges.push(Decoration.replace({ block: true, widget: new TablePreview({ text: state.doc.sliceString(from, to), rows }) }).range(from, to));
      return false;
    }
    const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(name);
    if (heading) {
      ranges.push(Decoration.line({ class: `md-heading md-h${heading[1]}` }).range(line.from));
      if (!editing) {
        const marker = /^#{1,6}\s+/.exec(line.text); if (marker) hide(from, from + marker[0].length);
      }
    }
    if (name === 'HeaderMark' && !editing && node.node.parent?.name.startsWith('SetextHeading')) hide(from, to);
    if (name === 'StrongEmphasis' || name === 'Emphasis' || name === 'Strikethrough' || name === 'InlineCode') {
      ranges.push(Decoration.mark({ class: ({ StrongEmphasis: 'md-bold', Emphasis: 'md-italic', Strikethrough: 'md-strike', InlineCode: 'md-code' })[name] }).range(from, to));
      if (!editing) {
        const mark = name === 'InlineCode' ? /^`+/.exec(state.doc.sliceString(from, to))?.[0].length || 1 : name === 'StrongEmphasis' || name === 'Strikethrough' ? 2 : 1;
        hide(from, from + mark); hide(to - mark, to);
      }
    }
    if (name === 'Blockquote') {
      for (let number = line.number; number <= state.doc.lineAt(to).number; number++) {
        const quoteLine = state.doc.line(number);
        ranges.push(Decoration.line({ class: 'md-quote' }).range(quoteLine.from));
      }
    }
    if (name === 'QuoteMark' && !editing) hide(from, Math.min(to + (state.doc.sliceString(to, to + 1) === ' ' ? 1 : 0), line.to));
    if (name === 'ListMark' && !editing && !/^\d/.test(state.doc.sliceString(from, to))) {
      if (/^\s+\[[ xX]\]/.test(state.doc.sliceString(to, line.to))) hide(from, Math.min(to + 1, line.to));
      else ranges.push(Decoration.replace({ widget: new Bullet() }).range(from, to));
    }
    if (name === 'TaskMarker' && !editing) ranges.push(Decoration.replace({ widget: new Checkbox(from, /x/i.test(state.doc.sliceString(from, to))) }).range(from, to));
    if (name === 'FencedCode' || name === 'CodeBlock') {
      for (let number = line.number; number <= state.doc.lineAt(to).number; number++) ranges.push(Decoration.line({ class: 'md-code-block' }).range(state.doc.line(number).from));
    }
    if ((name === 'CodeMark' || name === 'CodeInfo') && !editing && node.node.parent?.name === 'FencedCode') hide(from, to);
    if (name === 'Link') {
      const text = state.doc.sliceString(from, to);
      const match = /^\[([^\]]+)\]\(([^\s)]+)(?:\s+"[^"]*")?\)$/.exec(text);
      if (match && /^(https?:\/\/|mailto:)/i.test(match[2]!)) {
        ranges.push(Decoration.mark({ class: 'md-link', attributes: { 'data-md-url': match[2]!, title: 'Ctrl/Cmd + click to open link' } }).range(from, to));
        if (!editing) { hide(from, from + 1); hide(from + 1 + match[1]!.length, to); }
      }
    }
    if (name === 'TableHeader') ranges.push(Decoration.line({ class: 'md-table-header' }).range(line.from));
    if (name === 'TableRow' || name === 'TableDelimiter') ranges.push(Decoration.line({ class: 'md-table-row' }).range(line.from));
  } });
  return Decoration.set(ranges, true);
}

interface MarkdownEditorProps {
  documentId: string; value: string; onChange: (value: string) => void; onSave: () => unknown;
}
export function MarkdownEditor(props: MarkdownEditorProps) {
  let host!: HTMLDivElement, view: EditorView | undefined, currentId = '';
  const wrap = (marker: string) => {
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.doc.sliceString(from, to);
    const surrounded = from >= marker.length && view.state.doc.sliceString(from - marker.length, from) === marker && view.state.doc.sliceString(to, to + marker.length) === marker;
    view.dispatch(surrounded
      ? { changes: { from: from - marker.length, to: to + marker.length, insert: selected }, selection: { anchor: from - marker.length, head: to - marker.length }, userEvent: 'input' }
      : { changes: { from, to, insert: `${marker}${selected}${marker}` }, selection: { anchor: from + marker.length, head: from + marker.length + selected.length }, userEvent: 'input' });
    view.focus();
  };
  const prefix = (text: string) => {
    if (!view) return;
    const from = view.state.doc.lineAt(view.state.selection.main.from).from;
    view.dispatch({ changes: { from, insert: text }, userEvent: 'input' }); view.focus();
  };
  const state = () => EditorState.create({ doc: props.value, extensions: [
    focusState, liveFormatting, markdown({ base: markdownLanguage }), history(), EditorView.lineWrapping,
    placeholder('Write a document… Use # for headings, **bold**, or - for lists.'),
    EditorView.contentAttributes.of({ 'aria-label': 'Document content', 'aria-multiline': 'true', spellcheck: 'true' }),
    keymap.of([{ key: 'Mod-s', run: () => { props.onSave(); return true; } },
      { key: 'Mod-b', run: () => { wrap('**'); return true; } }, { key: 'Mod-i', run: () => { wrap('*'); return true; } }, ...defaultKeymap, ...historyKeymap]),
    EditorView.updateListener.of(update => { if (update.docChanged) props.onChange(update.state.doc.toString()); }),
    EditorView.domEventHandlers({ focus: () => { view?.dispatch({ effects: focused.of(true) }); }, blur: () => { view?.dispatch({ effects: focused.of(false) }); props.onSave(); },
      click: event => {
        const link = (event.target as HTMLElement).closest<HTMLElement>('[data-md-url]');
        if (link && (event.ctrlKey || event.metaKey)) { window.open(link.dataset.mdUrl, '_blank', 'noopener,noreferrer'); event.preventDefault(); return true; }
        return false;
      },
    }),
  ] });
  onMount(() => { currentId = props.documentId; view = new EditorView({ state: state(), parent: host }); });
  createEffect(() => {
    const id = props.documentId, value = props.value;
    if (!view) return;
    if (id !== currentId) { currentId = id; view.setState(state()); }
    else if (view.state.doc.toString() !== value) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  });
  onCleanup(() => { view?.destroy(); view = undefined; });
  const tools = [
    { label: 'Bold (Ctrl/Cmd+B)', text: 'B', run: () => wrap('**') },
    { label: 'Italic (Ctrl/Cmd+I)', text: 'I', run: () => wrap('*') },
    { label: 'Inline code', text: '</>', run: () => wrap('`') },
    { label: 'Heading', text: 'H', run: () => prefix('## ') },
    { label: 'Bullet list', text: '•', run: () => prefix('- ') },
    { label: 'Checklist', text: '☑', run: () => prefix('- [ ] ') },
    { label: 'Undo', text: '↶', run: () => { if (view) undo(view); view?.focus(); } },
    { label: 'Redo', text: '↷', run: () => { if (view) redo(view); view?.focus(); } },
  ];
  return <div class="markdown-editor"><div class="markdown-tools" role="group" aria-label="Document formatting">
    <For each={tools}>{tool => <button type="button" class="btn-secondary" aria-label={tool.label} title={tool.label} onMouseDown={event => event.preventDefault()} onClick={tool.run}>{tool.text}</button>}</For>
    </div><div ref={host} class="markdown-surface" /></div>;
}
