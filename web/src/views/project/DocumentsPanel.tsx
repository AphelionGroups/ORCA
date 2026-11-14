import {
  Download,
  FileText,
  Plus,
  Save,
  Trash2,
  Upload
} from 'lucide-solid';
import type { Component } from 'solid-js';
import { For, Show, lazy, Suspense } from 'solid-js';
const MarkdownEditor = lazy(() => import('../../components/MarkdownEditor').then(module => ({ default: module.MarkdownEditor })));
import type { ProjectController } from './useProjectController';
export const DocumentsPanel: Component<{ ctx: ProjectController }> = (props) => {
  const ctx = props.ctx; return (<Show when={ctx.activeTab() === 'docs'}>
    <div class="documents-layout context-panel" role="tabpanel" id="project-docs-panel" aria-labelledby="project-docs-tab" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <aside class="document-sidebar" style={{ width: '280px', "background-color": 'var(--surface-container-low)', "border-right": '1px solid var(--border-default)', padding: "var(--space-4)", display: 'flex', "flex-direction": 'column', gap: "var(--space-2)" }}>
        <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "margin-bottom": "var(--space-2)" }}>
          <span style={{ "font-size": '12px', "font-weight": 600, color: 'var(--text-main)' }}>
            Documents ({ctx.docs().length})
          </span>
          <div style={{ display: 'flex', "align-items": 'center', gap: "var(--space-2)" }}>
            <label class="btn-secondary" style={{ padding: "var(--space-1) var(--space-2)", "font-size": '12px', display: 'flex', "align-items": 'center', gap: "var(--space-1)", cursor: 'pointer' }} title="Import markdown/text file">
              <Upload size={12} />
              <span>Import</span>
              <input type="file" accept=".md,.txt,.markdown" class="accessible-file-input" aria-label="Import document" onChange={ctx.handleImportDoc} />
            </label>

            <button onClick={ctx.handleCreateNewDoc} title="Add new document" class="btn-primary" style={{ padding: "var(--space-1) var(--space-2)", "font-size": '12px', display: 'flex', "align-items": 'center', gap: "var(--space-1)" }}>
              <Plus size={12} />
              <span>New</span>
            </button>
          </div>
        </div>

        <Show when={!ctx.loadingSubData()} fallback={<div style={{ "font-size": '12px', color: 'var(--text-dim)', padding: "var(--space-3) 0" }}>Loading documents...</div>}>
          <Show when={ctx.docs().length > 0} fallback={<div style={{ "font-size": '12px', color: 'var(--text-dim)', padding: "var(--space-4) 0", "text-align": 'center' }}>
            No documents created yet. Click New or Import to start.
          </div>}>
            <div style={{ display: 'flex', "flex-direction": 'column', gap: "var(--space-1)", "overflow-y": 'auto' }}>
              <For each={ctx.docs()}>
                {(doc) => (<div onClick={() => ctx.setSelectedDocId(doc.id)} style={{
                  padding: "var(--space-2) var(--space-3)",
                  "border-radius": '6px',
                  "background-color": ctx.selectedDocId() === doc.id ? 'var(--surface-container-high)' : 'transparent',
                  border: ctx.selectedDocId() === doc.id ? '1px solid var(--border-default)' : '1px solid transparent',
                  color: ctx.selectedDocId() === doc.id ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  "font-size": '13px',
                  display: 'flex',
                  "align-items": 'center',
                  "justify-content": 'space-between',
                  gap: "var(--space-2)",
                  transition: 'background-color 0.12s ease'
                }}>
                  <button type="button" class="document-list-button" aria-pressed={ctx.selectedDocId() === doc.id} style={{ display: 'flex', "align-items": 'center', gap: "var(--space-2)", overflow: 'hidden' }}>
                    <FileText size={14} color={ctx.selectedDocId() === doc.id ? 'var(--primary)' : 'var(--text-dim)'} />
                    <span style={{ overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>{doc.title || 'Untitled'}</span>
                  </button>
                  <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    ctx.handleDeleteDoc(doc.id);
                  }} title="Delete document" style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    padding: "var(--space-1)",
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

      <main class="document-editor" style={{ flex: 1, "overflow-y": 'auto', padding: "var(--space-8) var(--space-12)", "background-color": 'var(--surface)' }}>
        <Show when={ctx.currentDoc()} fallback={<div style={{ color: 'var(--text-dim)', padding: "var(--space-15) 0", "text-align": 'center' }}>
          Select or create a document to view contents.
        </div>}>
          <div style={{ "max-width": '840px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: "var(--space-5)" }}>
            {/* Document Header & Action Bar */}
            <div class="document-toolbar" style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', gap: "var(--space-4)", "padding-bottom": "var(--space-3)", "border-bottom": '1px solid var(--border-default)' }}>
              <input type="text" value={ctx.editingDocTitle()} onInput={e => ctx.setEditingDocTitle(e.currentTarget.value)} onBlur={ctx.handleSaveDoc} aria-label="Document title" placeholder="Document Title..." style={{
                flex: 1,
                "font-size": '24px',
                "font-weight": 700,
                color: 'var(--text-main)',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                "letter-spacing": '-0.02em',
                padding: "var(--space-1) 0"
              }} />

              <div class="document-actions" style={{ display: 'flex', "align-items": 'center', gap: "var(--space-2)" }}>
                {/* Export / Download */}
                <button type="button" class="btn-secondary" onClick={ctx.handleDownloadDoc} style={{ display: 'flex', "align-items": 'center', gap: "var(--space-1)", padding: "var(--space-2) var(--space-3)", "font-size": '12px' }} title="Download document as Markdown (.md)">
                  <Download size={13} />
                  <span>Export .md</span>
                </button>

                {/* Delete */}
                <button type="button" class="btn-ghost-danger" onClick={() => ctx.handleDeleteDoc()} style={{ padding: "var(--space-2) var(--space-3)", "font-size": '12px', display: 'flex', "align-items": 'center', gap: "var(--space-1)" }} title="Delete current document">
                  <Trash2 size={13} />
                  <span>Delete</span>
                </button>

                {/* Save */}
                <button type="button" class="btn-primary" onClick={ctx.handleSaveDoc} disabled={ctx.isSavingDoc()} style={{ display: 'flex', "align-items": 'center', gap: "var(--space-1)", padding: "var(--space-2) var(--space-4)", "font-size": '12px' }}>
                  <Save size={13} />
                  <span>{ctx.isSavingDoc() ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Document Content View / Editor */}
            <Show when={ctx.docSaveError()}><p role="alert" class="modal-error-badge">{ctx.docSaveError()} Save again to retry.</p></Show>
            <Suspense fallback={<p role="status">Loading editor…</p>}><MarkdownEditor documentId={ctx.currentDoc()!.id} value={ctx.editingDocContent()} onChange={ctx.setEditingDocContent} onSave={ctx.handleSaveDoc} /></Suspense>
          </div>
        </Show>
      </main>
    </div>
  </Show>);
};
