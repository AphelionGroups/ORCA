import type { Component } from 'solid-js';
import { createSignal, For } from 'solid-js';

interface DocumentsScreenProps {
  onNavigate: (route: string) => void;
  onOpenQuickCapture: () => void;
}

export const DocumentsScreen: Component<DocumentsScreenProps> = (props) => {
  const [selectedDoc, setSelectedDoc] = createSignal('Brand Identity & Strategy');

  const docs = [
    { title: 'Brand Identity & Strategy', words: '2,840 words', updated: '14m ago', status: 'Published' },
    { title: 'Packaging Visual Hierarchy & Specs', words: '1,420 words', updated: 'Yesterday', status: 'In Review' },
    { title: 'Q3 Product Lineup Blueprint', words: '860 words', updated: '3 days ago', status: 'Draft' },
    { title: 'Market Positioning Whitepaper', words: '4,910 words', updated: 'May 12', status: 'Published' }
  ];

  return (
    <div style={{ display: 'flex', "flex-direction": 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <header class="orca-header">
        <div class="header-breadcrumbs">
          <span style={{ "font-size": '14px', "font-weight": 500, color: 'var(--text-main)' }}>Bisnis A</span>
          <span style={{ color: 'var(--text-dim)' }}>/</span>
          <span style={{ "font-size": '14px', color: 'var(--text-muted)' }}>Rebranding & Launch</span>
        </div>

        {/* Segmented Tab Switcher */}
        <div class="segmented-tab-group">
          <button class="segmented-tab-btn" onClick={() => props.onNavigate('canvas')}>
            <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>gesture</span>
            <span>Canvas</span>
          </button>
          <button class="segmented-tab-btn active">
            <span class="material-symbols-outlined" style={{ "font-size": '14px', color: 'var(--tertiary)' }}>description</span>
            <span>Documents</span>
          </button>
          <button class="segmented-tab-btn" onClick={() => props.onNavigate('tasks')}>
            <span class="material-symbols-outlined" style={{ "font-size": '14px' }}>check_circle</span>
            <span>Tasks</span>
          </button>
        </div>

        <div class="header-actions">
          <button class="btn-pill-white" onClick={() => props.onOpenQuickCapture()}>
            <span class="material-symbols-outlined" style={{ "font-size": '15px' }}>add</span>
            <span>New</span>
          </button>
        </div>
      </header>

      {/* Split Pane */}
      <div class="docs-viewport">
        {/* LEFT PANEL: Document Index */}
        <aside class="docs-index-panel">
          <div style={{ display: 'flex', "flex-direction": 'column', gap: '16px' }}>
            <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
              <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', "letter-spacing": '0.15em', color: 'var(--text-dim)' }}>
                  Documents
                </span>
                <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', "border-radius": '4px', color: 'white' }}>
                  4
                </span>
              </div>
              <button 
                onClick={() => props.onOpenQuickCapture()}
                style={{ display: 'flex', "align-items": 'center', gap: '4px', padding: '4px 10px', "border-radius": '4px', background: 'var(--surface-container)', border: 'none', color: 'white', "font-size": '12px', cursor: 'pointer' }}
              >
                <span class="material-symbols-outlined" style={{ "font-size": '14px', color: 'var(--primary)' }}>add</span>
                <span>New Doc</span>
              </button>
            </div>

            <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px' }}>
              <For each={docs}>
                {(doc) => (
                  <div
                    onClick={() => setSelectedDoc(doc.title)}
                    class={`doc-list-item ${selectedDoc() === doc.title ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', "align-items": 'flex-start', "justify-content": 'space-between', gap: '8px', "margin-bottom": '4px' }}>
                      <span style={{ "font-size": '12.5px', "font-weight": 500, overflow: 'hidden', "text-overflow": 'ellipsis', "white-space": 'nowrap' }}>
                        {doc.title}
                      </span>
                      <span style={{ "font-size": '9px', padding: '2px 6px', "border-radius": '4px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', background: 'rgba(68,225,222,0.1)', color: 'var(--secondary)' }}>
                        {doc.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "font-size": '11px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                      <span>{doc.words}</span>
                      <span>{doc.updated}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Referenced Canvas Anchors */}
            <div style={{ "margin-top": '16px', "padding-top": '16px', "border-top": '1px solid rgba(255,255,255,0.06)', display: 'flex', "flex-direction": 'column', gap: '8px' }}>
              <span style={{ "font-size": '10px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', "letter-spacing": '0.15em', color: 'var(--text-dim)' }}>
                Referenced Canvas Anchors
              </span>
              <div 
                style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 0' }}
                onClick={() => props.onNavigate('canvas')}
              >
                <div style={{ display: 'flex', "align-items": 'center', gap: '6px', "font-size": '12px' }}>
                  <span style={{ width: '6px', height: '6px', "border-radius": '50%', background: 'var(--secondary)' }} />
                  <span>#node-441-moodboard</span>
                </div>
                <span class="material-symbols-outlined" style={{ "font-size": '13px' }}>arrow_outward</span>
              </div>
              <div 
                style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px 0' }}
                onClick={() => props.onNavigate('canvas')}
              >
                <div style={{ display: 'flex', "align-items": 'center', gap: '6px', "font-size": '12px' }}>
                  <span style={{ width: '6px', height: '6px', "border-radius": '50%', background: 'var(--primary)' }} />
                  <span>#spec-packaging-diecut</span>
                </div>
                <span class="material-symbols-outlined" style={{ "font-size": '13px' }}>arrow_outward</span>
              </div>
            </div>
          </div>

          <div style={{ padding: '12px', "border-radius": '6px', background: 'var(--surface-container-low)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
            <div>
              <div style={{ color: 'var(--text-dim)', "font-size": '10px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase' }}>Workspace Corpus</div>
              <div style={{ color: 'white', "font-weight": 500, "font-size": '12.5px' }}>10,030 words</div>
            </div>
            <span class="material-symbols-outlined" style={{ "font-size": '20px', color: 'var(--secondary)' }}>auto_stories</span>
          </div>
        </aside>

        {/* RIGHT PANEL: Editorial Content */}
        <section class="docs-editor-panel">
          <div class="docs-article-wrapper">
            {/* Meta Header */}
            <div style={{ display: 'flex', "flex-wrap": 'wrap', "align-items": 'center', "justify-content": 'space-between', gap: '16px', "border-bottom": '1px solid var(--border-subtle)', "padding-bottom": '16px' }}>
              <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                <span style={{ padding: '3px 8px', "border-radius": '4px', "font-size": '11px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase', background: 'rgba(68,225,222,0.15)', color: 'var(--secondary)' }}>
                  Published v2.4
                </span>
                <span style={{ padding: '3px 8px', "border-radius": '4px', "font-size": '11px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>@Strategy</span>
                <span style={{ padding: '3px 8px', "border-radius": '4px', "font-size": '11px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>@DesignSystem</span>
              </div>
              <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                <button 
                  onClick={() => props.onNavigate('canvas')}
                  style={{ display: 'flex', "align-items": 'center', gap: '6px', padding: '6px 12px', "border-radius": '4px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-subtle)', color: 'white', "font-size": '12px', cursor: 'pointer' }}
                >
                  <span class="material-symbols-outlined" style={{ "font-size": '14px', color: 'var(--secondary)' }}>gesture</span>
                  <span>View on Canvas</span>
                </button>
                <button 
                  style={{ display: 'flex', "align-items": 'center', gap: '6px', padding: '6px 12px', "border-radius": '4px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-subtle)', color: 'white', "font-size": '12px', cursor: 'pointer' }}
                >
                  <span class="material-symbols-outlined" style={{ "font-size": '14px', color: 'var(--primary)' }}>share</span>
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Document Title & Author */}
            <div>
              <h1 style={{ "font-size": '28px', "font-weight": 500, color: 'var(--text-main)', "letter-spacing": '-0.4px', "margin-bottom": '8px' }}>
                {selectedDoc()}
              </h1>
              <div style={{ display: 'flex', "align-items": 'center', gap: '10px', "font-size": '12px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Nurhabib A.</span>
                <span>•</span>
                <span>Last synchronized 14m ago</span>
                <span>•</span>
                <span>11 min read</span>
              </div>
            </div>

            {/* Callout Box */}
            <div style={{ padding: '16px', "border-radius": '6px', background: 'var(--surface-container-low)', border: '1px solid var(--border-subtle)', display: 'flex', gap: '12px', "align-items": 'flex-start' }}>
              <span class="material-symbols-outlined" style={{ "font-size": '20px', color: 'var(--primary)', "margin-top": '2px' }}>flag</span>
              <div style={{ "font-size": '13px', "line-height": 1.6, color: 'var(--text-muted)' }}>
                <span style={{ color: 'white', "font-weight": 500, "margin-right": '8px' }}>Executive Objective:</span>
                Transition Bisnis A into an industrial-grade spatial lifestyle collective. Connected directly with live Canvas node{' '}
                <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => props.onNavigate('canvas')}>@node-441-moodboard</span>.
              </div>
            </div>

            {/* Editorial Body */}
            <div style={{ display: 'flex', "flex-direction": 'column', gap: '16px', "font-size": '14px', color: 'var(--text-muted)', "line-height": 1.7 }}>
              <h2 style={{ "font-size": '18px', "font-weight": 500, color: 'white' }}>01. Core Philosophies & Vision</h2>
              <p>
                Bisnis A operates on the principle of volumetric restraint. We reject ornamental excess in packaging, interaction, and physical retail. Every contact point must convey absolute weight, quiet tactile friction, and intentional space.
              </p>
              <blockquote style={{ padding: '16px', "border-radius": '4px', background: 'var(--surface-container-low)', "border-left": '3px solid var(--primary)', color: 'white', "font-style": 'italic' }}>
                “Form does not merely follow function; form recedes until only utility and quiet dignity remain.”
              </blockquote>

              <h2 style={{ "font-size": '18px', "font-weight": 500, color: 'white', "padding-top": '8px' }}>02. Typographic Scale & Chromatic Palette</h2>
              <p>
                To preserve structural purity across printed collateral and spatial web interfaces, strictly two typeface families are approved for global production: Geist Sans for architectural titles and Inter for data-dense tabular indexes.
              </p>

              <div style={{ display: 'grid', "grid-template-columns": 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', "padding-top": '8px' }}>
                <div style={{ padding: '10px', "border-radius": '4px', background: 'var(--surface-container-low)', border: '1px solid var(--border-subtle)', display: 'flex', "align-items": 'center', gap: '8px' }}>
                  <span style={{ width: '18px', height: '18px', "border-radius": '4px', background: '#111317', border: '1px solid rgba(255,255,255,0.2)' }} />
                  <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'white' }}>#111317</span>
                </div>
                <div style={{ padding: '10px', "border-radius": '4px', background: 'var(--surface-container-low)', border: '1px solid var(--border-subtle)', display: 'flex', "align-items": 'center', gap: '8px' }}>
                  <span style={{ width: '18px', height: '18px', "border-radius": '4px', background: '#8b8df8' }} />
                  <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'white' }}>#8b8df8</span>
                </div>
                <div style={{ padding: '10px', "border-radius": '4px', background: 'var(--surface-container-low)', border: '1px solid var(--border-subtle)', display: 'flex', "align-items": 'center', gap: '8px' }}>
                  <span style={{ width: '18px', height: '18px', "border-radius": '4px', background: '#44e1de' }} />
                  <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'white' }}>#44e1de</span>
                </div>
                <div style={{ padding: '10px', "border-radius": '4px', background: 'var(--surface-container-low)', border: '1px solid var(--border-subtle)', display: 'flex', "align-items": 'center', gap: '8px' }}>
                  <span style={{ width: '18px', height: '18px', "border-radius": '4px', background: '#cebdff' }} />
                  <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'white' }}>#cebdff</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
