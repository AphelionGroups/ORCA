import {
  Circle,
  Diamond,
  Hexagon,
  Square,
  Triangle
} from 'lucide-solid';
import type { Component } from 'solid-js';
import { Show, createEffect, createSignal } from 'solid-js';
import type { NoteBlock } from '../../services/api';
export type ShapeKind = 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'hexagon';

export const SHAPE_OPTIONS: { id: ShapeKind; label: string; icon: Component<{ size?: number; class?: string }> }[] = [
  { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'diamond', label: 'Diamond', icon: Diamond },
  { id: 'triangle', label: 'Triangle', icon: Triangle },
  { id: 'hexagon', label: 'Hexagon', icon: Hexagon },
];

export const DynamicShapeIcon: Component<{ kind: ShapeKind; size?: number; class?: string }> = (props) => {
  switch (props.kind) {
    case 'circle': return <Circle size={props.size || 15} class={props.class} />;
    case 'diamond': return <Diamond size={props.size || 15} class={props.class} />;
    case 'triangle': return <Triangle size={props.size || 15} class={props.class} />;
    case 'hexagon': return <Hexagon size={props.size || 15} class={props.class} />;
    default: return <Square size={props.size || 15} class={props.class} />;
  }
};

export interface Connection {
  fromId: string;
  toId: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
}

export type CanvasAction =
  | {
    type: 'create_block';
    block: NoteBlock;
  }
  | {
    type: 'delete_blocks';
    blocks: NoteBlock[];
    connections: Connection[];
  }
  | {
    type: 'move_blocks';
    moves: Array<{ id: string; fromX: number; fromY: number; toX: number; toY: number }>;
  }
  | {
    type: 'update_text';
    blockId: string;
    prevContent: any;
    newContent: any;
  }
  | {
    type: 'create_connection';
    connection: Connection;
  }
  | {
    type: 'delete_connection';
    connection: Connection;
  }
  | {
    type: 'update_connection';
    prevConnection: Connection;
    newConnection: Connection;
  }
  | {
    type: 'resize_block';
    blockId: string;
    prevX: number;
    prevY: number;
    prevWidth: number;
    prevHeight?: number;
    newX: number;
    newY: number;
    newWidth: number;
    newHeight?: number;
  };

export function formatInlineMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:var(--text-main);">$1</strong>');
  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, '<em style="font-style:italic;color:var(--secondary);">$1</em>');
  // Inline code `code`
  html = html.replace(/`(.*?)`/g, '<code class="inline-code-badge">$1</code>');
  // Strikethrough ~~text~~
  html = html.replace(/~~(.*?)~~/g, '<del style="opacity:0.6;">$1</del>');
  return html;
}

export function renderFullMarkdown(raw: string): string {
  if (!raw || !raw.trim()) return '';

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      result.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      result.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeLists();
      result.push('<div class="md-empty-spacer"></div>');
      continue;
    }

    if (line.startsWith('# ')) {
      closeLists();
      result.push(`<div class="md-render-h1">${formatInlineMarkdown(line.slice(2))}</div>`);
    } else if (line.startsWith('## ')) {
      closeLists();
      result.push(`<div class="md-render-h2">${formatInlineMarkdown(line.slice(3))}</div>`);
    } else if (line.startsWith('### ')) {
      closeLists();
      result.push(`<div class="md-render-h3">${formatInlineMarkdown(line.slice(4))}</div>`);
    } else if (line.startsWith('> ')) {
      closeLists();
      result.push(`<div class="md-render-quote">${formatInlineMarkdown(line.slice(2))}</div>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (inOl) {
        result.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        result.push('<ul class="md-render-ul">');
        inUl = true;
      }
      result.push(`<li class="md-render-li">${formatInlineMarkdown(line.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(line)) {
      if (inUl) {
        result.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        result.push('<ol class="md-render-ol">');
        inOl = true;
      }
      result.push(`<li class="md-render-li">${formatInlineMarkdown(line.replace(/^\d+\.\s/, ''))}</li>`);
    } else {
      closeLists();
      result.push(`<div class="md-render-p">${formatInlineMarkdown(line)}</div>`);
    }
  }

  closeLists();
  return result.join('');
}

export interface UnifiedMarkdownBlockProps {
  block: NoteBlock;
  isEditing: boolean;
  textColor?: string;
  onStartEdit: () => void;
  onFinishEdit: (finalText?: string) => void;
}

export const UnifiedMarkdownBlock: Component<UnifiedMarkdownBlockProps> = (props) => {
  const getRaw = () => {
    const c = props.block.content;
    if (!c) return '';
    if (typeof c === 'string') return c;
    if (typeof c === 'object') {
      if (typeof c.text === 'string') return c.text;
      const parts = [c.title, c.body].filter(Boolean);
      return parts.join('\n\n');
    }
    return '';
  };

  const [text, setText] = createSignal<string>(getRaw());

  // Keep local text in sync when not actively editing
  createEffect(() => {
    if (!props.isEditing) {
      setText(getRaw());
    }
  });

  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    const minH = props.block.type === 'shape' || props.block.type === 'text' ? 24 : 50;
    el.style.height = `${Math.max(minH, el.scrollHeight)}px`;
  };

  const placeholderText = () => {
    switch (props.block.type) {
      case 'shape': return '';
      case 'text': return 'Double-click to type text...';
      case 'sticky': return 'Double-click to write note...';
      default: return 'Double-click to write (# heading, - list)...';
    }
  };

  if (props.block.type === 'image') {
    return (
      <div class="canvas-block-content" style={{ padding: '6px' }}>
        <img
          src={props.block.content?.url}
          alt={props.block.content?.caption || 'Canvas Image'}
          style={{ width: '100%', height: 'auto', display: 'block', "border-radius": '6px', "object-fit": 'contain', "max-height": '400px' }}
          draggable={false}
        />
        <Show when={props.block.content?.caption}>
          <div style={{ "font-size": '11px', color: props.textColor || 'var(--text-dim)', padding: '6px 2px 2px 2px', "text-align": 'center' }}>
            {props.block.content?.caption}
          </div>
        </Show>
      </div>
    );
  }

  return (
    <div
      class="canvas-block-content"
      style={{ color: props.textColor || 'inherit' }}
      onDblClick={(e) => {
        e.stopPropagation();
        if (!props.isEditing) {
          props.onStartEdit();
        }
      }}
    >
      <Show
        when={props.isEditing}
        fallback={
          <Show
            when={text().trim().length > 0}
            fallback={
              <Show when={placeholderText().length > 0}>
                <div class="canvas-block-placeholder" style={{ color: props.textColor || 'inherit' }}>
                  {placeholderText()}
                </div>
              </Show>
            }
          >
            <div
              class="canvas-block-formatted"
              style={{ color: props.textColor || 'inherit' }}
              innerHTML={renderFullMarkdown(text())}
            />
          </Show>
        }
      >
        <textarea
          ref={(el) => {
            if (el) {
              setTimeout(() => {
                el.focus();
                autoResizeTextarea(el);
                el.setSelectionRange(el.value.length, el.value.length);
              }, 10);
            }
          }}
          class="canvas-block-unified-editor"
          style={{ color: props.textColor || 'inherit', "caret-color": props.textColor || 'currentColor' }}
          value={text()}
          onMouseDown={(e) => e.stopPropagation()}
          onInput={(e) => {
            const val = e.currentTarget.value;
            setText(val);
            autoResizeTextarea(e.currentTarget);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              props.onFinishEdit(e.currentTarget.value);
            }
          }}
          onBlur={(e) => props.onFinishEdit(e.currentTarget.value)}
          placeholder={props.block.type === 'shape' ? 'Type text...' : placeholderText()}
        />
      </Show>
    </div>
  );
};

export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Baru saja';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}j lalu`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}h lalu`;
    return d.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
  } catch {
    return 'Baru saja';
  }
}
