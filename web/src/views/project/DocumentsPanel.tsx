import {
  Download,
  Edit3,
  Eye,
  FileText,
  Plus,
  Save,
  Trash2,
  Upload
} from 'lucide-solid';
import type { Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { formatInlineMarkdown } from './canvas';
import type { ProjectController } from './useProjectController';
export const DocumentsPanel: Component<{ ctx: ProjectController }> = (props) => {
  const ctx = props.ctx; return (<Show when={ctx.activeTab() === 'docs'}>
    <div class="documents-layout" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <aside class="documents-list" style={{ width: '280px', "background-color": 'var(--surface-container-low)', "border-right": '1px solid var(--border-default)', padding: '16px', display: 'flex', "flex-direction": 'column', gap: '8px' }}>
        <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": '6px' }}>
          <span style={{ "font-size": '12px', "font-weight": 600, color: 'var(--text-main)' }}>
            Documents ({ctx.docs().length})
          </span>
          <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
            <label class="btn-secondary" style={{ padding: '4px 8px', "font-size": '12px', display: 'flex', "align-items": 'center', gap: '4px', cursor: 'pointer' }} title="Import markdown/text file">
              <Upload size={12} />
              <span>Import</span>
              <input type="file" accept=".md,.txt,.markdown" style={{ display: 'none' }} onChange={ctx.handleImportDoc} />
            </label>

            <button onClick={ctx.handleCreateNewDoc} title="Add new document" class="btn-primary" style={{ padding: '4px 8px', "font-size": '12px', display: 'flex', "align-items": 'center', gap: '4px' }}>
              <Plus size={12} />
              <span>New</span>
            </button>
          </div>
        </div>

        <Show when={!ctx.loadingSubData()} fallback={<div style={{ "font-size": '12px', color: 'var(--text-dim)', padding: '12px 0' }}>Loading documents...</div>}>
          <Show when={ctx.docs().length > 0} fallback={<div style={{ "font-size": '12px', color: 'var(--text-dim)', padding: '16px 0', "text-align": 'center' }}>
            No documents created yet. Click New or Import to start.
          </div>}>
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '3px', "overflow-y": 'auto' }}>
              <For each={ctx.docs()}>
                {(doc) => (<div onClick={() => ctx.setSelectedDocId(doc.id)} style={{
                  padding: '8px 10px',
                  "border-radius": '6px',
                  "background-color": ctx.selectedDocId() === doc.id ? 'var(--surface-container-high)' : 'transparent',
                  border: ctx.selectedDocId() === doc.id ? '1px solid var(--border-default)' : '1px solid transparent',
                  color: ctx.selectedDocId() === doc.id ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  "font-size": '13px',
                  display: 'flex',
                  "align-items": 'center',
                  "justify-content": 'space-between',
                  gap: '8px',
                  transition: 'background-color 0.12s ease'
                }}>
                  <div style={{ display: 'flex', "align-items": 'center', gap: '8px', overflow: 'hidden' }}>
                    <FileText size={14} color={ctx.selectedDocId() === doc.id ? 'var(--primary)' : 'var(--text-dim)'} />
                    <span style={{ overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>{doc.title || 'Untitled'}</span>
                  </div>
                  <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    ctx.handleDeleteDoc(doc.id);
                  }} title="Delete document" style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                    "align-items": 'center'
                  }}>
                    <Trash2 size={12} />
                  </button>
                </div>)}
              </For>
            </div>
          </Show>
        </Show>
      </aside>

      <main class="document-workspace" style={{ flex: 1, "overflow-y": 'auto', padding: '32px 48px', "background-color": 'var(--surface)' }}>
        <Show when={ctx.currentDoc()} fallback={<div style={{ color: 'var(--text-dim)', padding: '60px 0', "text-align": 'center' }}>
          Select or create a document to view contents.
        </div>}>
          <div style={{ "max-width": '840px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '20px' }}>
            {/* Document Header & Action Bar */}
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', gap: '16px', "padding-bottom": '12px', "border-bottom": '1px solid var(--border-default)' }}>
              <input type="text" value={ctx.editingDocTitle()} onInput={e => ctx.setEditingDocTitle(e.currentTarget.value)} onBlur={ctx.handleSaveDoc} aria-label="Document title" placeholder="Document Title..." style={{
                flex: 1,
                "font-size": '24px',
                "font-weight": 700,
                color: 'var(--text-main)',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                "letter-spacing": '-0.02em',
                padding: '4px 0'
              }} />

              <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                {/* Edit / Preview switch */}
                <div class="segmented-control">
                  <button type="button" onClick={() => ctx.setDocViewMode('edit')} class={`seg-btn ${ctx.docViewMode() === 'edit' ? 'active' : ''}`} style={{ display: 'flex', "align-items": 'center', gap: '4px', padding: '5px 10px', "font-size": '12px' }}>
                    <Edit3 size={12} />
                    <span>Edit</span>
                  </button>
                  <button type="button" onClick={() => ctx.setDocViewMode('preview')} class={`seg-btn ${ctx.docViewMode() === 'preview' ? 'active' : ''}`} style={{ display: 'flex', "align-items": 'center', gap: '4px', padding: '5px 10px', "font-size": '12px' }}>
                    <Eye size={12} />
                    <span>Preview</span>
                  </button>
                </div>

                {/* Export / Download */}
                <button type="button" class="btn-secondary" onClick={ctx.handleDownloadDoc} style={{ display: 'flex', "align-items": 'center', gap: '5px', padding: '6px 12px', "font-size": '12px' }} title="Download document as Markdown (.md)">
                  <Download size={13} />
                  <span>Export .md</span>
                </button>

                {/* Delete */}
                <button type="button" class="btn-ghost-danger" onClick={() => ctx.handleDeleteDoc()} style={{ padding: '6px 10px', "font-size": '12px', display: 'flex', "align-items": 'center', gap: '4px' }} title="Delete current document">
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>

                {/* Save */}
                <button type="button" class="btn-primary" onClick={ctx.handleSaveDoc} disabled={ctx.isSavingDoc()} style={{ display: 'flex', "align-items": 'center', gap: '5px', padding: '6px 16px', "font-size": '12px' }}>
                  <Save size={13} />
                  <span>{ctx.isSavingDoc() ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Document Content View / Editor */}
            <Show when={ctx.docViewMode() === 'edit'} fallback={<div style={{ "font-size": '15px', "line-height": 1.75, color: 'var(--text-main)', "white-space": 'pre-wrap', padding: '8px 0' }} innerHTML={formatInlineMarkdown(ctx.editingDocContent() || '(Empty document)')} />}>
              <textarea aria-label="Document content" rows={20} value={ctx.editingDocContent()} onInput={e => ctx.setEditingDocContent(e.currentTarget.value)} onBlur={ctx.handleSaveDoc} placeholder="Write strategic architecture guidelines, specifications, or notes in Markdown..." style={{
                width: '100%',
                "min-height": '520px',
                border: '1px solid var(--border-default)',
                "border-radius": '8px',
                "background-color": 'var(--surface-container-low)',
                padding: '20px',
                color: 'var(--text-main)',
                "font-size": '14px',
                "line-height": 1.7,
                "font-family": 'inherit',
                resize: 'vertical',
                outline: 'none',
                "box-sizing": 'border-box'
              }} />
            </Show>
          </div>
        </Show>
      </main>
    </div>
  </Show>);
};
