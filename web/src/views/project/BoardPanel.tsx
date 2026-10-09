import { writeDemoSetting } from '../../services/demoSettings';
import { CanvasContextToolbar } from './CanvasContextToolbar';
import {
  ArrowLeft,
  Edit3,
  Hand,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  Maximize2,
  MousePointer,
  Plus,
  Redo,
  Share2,
  StickyNote,
  Trash2,
  Type,
  Undo
} from 'lucide-solid';
import type { Component } from 'solid-js';
import { For, Show, createSignal, onCleanup } from 'solid-js';
import { getTextColorForBackground } from '../../services/theme';
import { getCurrentUser } from '../../services/user';
import { DynamicShapeIcon, SHAPE_OPTIONS, UnifiedMarkdownBlock, formatRelativeTime } from './canvas';
import type { ProjectController } from './useProjectController';
export const BoardPanel: Component<{ ctx: ProjectController }> = (props) => {
  const ctx = props.ctx; return (<Show when={ctx.activeTab() === 'board'}>
    <Show when={ctx.isBoardCanvasOpen()} fallback={<div class="board-gallery" style={{
      width: '100%',
      height: '100%',
      overflow: 'auto',
      background: 'var(--surface)',
      padding: '32px 40px',
      display: 'flex',
      "flex-direction": 'column',
      gap: '24px'
    }}>
      {/* Header: Title, Count, Subtitle, New Board Button */}
      <div style={{
        display: 'flex',
        "align-items": 'flex-start',
        "justify-content": 'space-between',
        gap: '16px',
        "padding-bottom": '20px',
        "border-bottom": '1px solid var(--border-subtle)'
      }}>
        <div>
          <div style={{ display: 'flex', "align-items": 'center', gap: '10px' }}>
            <h2 style={{ "font-size": '20px', "font-weight": '600', color: 'var(--text-main)', margin: 0 }}>
              Boards
            </h2>
            <span style={{
              "font-size": '12px',
              padding: '2px 8px',
              "border-radius": '4px',
              background: 'var(--surface-container-high)',
              color: 'var(--text-muted)',
              "font-family": 'var(--font-mono)'
            }}>
              {ctx.boards().length} board
            </span>
          </div>
          <p style={{ "font-size": '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Ruang kanvas visual untuk pemetaan ide, moodboard, dan perancangan proyek.
          </p>
        </div>

        <button type="button" onClick={() => {
          ctx.setNewBoardTitle(`Board ${ctx.boards().length + 1}`);
          ctx.setIsCreatingBoard(true);
        }} class="btn-primary" style={{
          display: 'flex',
          "align-items": 'center',
          gap: '6px',
          padding: '8px 16px',
          "font-size": '13px',
          "border-radius": '8px',
          cursor: 'pointer'
        }}>
          <Plus size={15} />
          <span>Board Baru</span>
        </button>
      </div>

      {/* Inline Creation Banner when isCreatingBoard() is true */}
      <Show when={ctx.isCreatingBoard()}>
        <div style={{
          display: 'flex',
          "align-items": 'center',
          gap: '12px',
          padding: '14px 20px',
          "border-radius": '4px',
          background: 'var(--surface-container-low)',
          border: '1px solid var(--primary)',
          "box-shadow": 'none'
        }}>
          <LayoutGrid size={16} color="var(--primary)" />
          <span style={{ "font-size": '13px', "font-weight": 500, color: 'var(--text-main)' }}>Nama Board:</span>
          <input type="text" placeholder="misal: Konsep Arsitektur, Moodboard..." value={ctx.newBoardTitle()} onInput={(e) => ctx.setNewBoardTitle(e.currentTarget.value)} onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              ctx.handleCreateBoard();
            }
            else if (e.key === 'Escape') {
              ctx.setIsCreatingBoard(false);
            }
          }} autofocus style={{
            flex: 1,
            "max-width": '360px',
            background: 'var(--surface)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-main)',
            "font-size": '13px',
            padding: '6px 12px',
            "border-radius": '6px',
            outline: 'none'
          }} />
          <button type="button" onClick={() => ctx.handleCreateBoard()} class="btn-primary" style={{ padding: '6px 14px', "font-size": '12px', "border-radius": '6px' }}>
            Buat & Buka Kanvas
          </button>
          <button type="button" onClick={() => ctx.setIsCreatingBoard(false)} class="btn-secondary" style={{ padding: '6px 12px', "font-size": '12px', "border-radius": '6px' }}>
            Batal
          </button>
        </div>
      </Show>

      {/* Responsive Grid of Board Cards */}
      <div style={{
        display: 'grid',
        "grid-template-columns": 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '22px'
      }}>
        <For each={ctx.boards()}>
          {(b) => {
            const [isCardHovered, setIsCardHovered] = createSignal(false);
            const [isRenaming, setIsRenaming] = createSignal(false);
            const [renameVal, setRenameVal] = createSignal(b.title);
            const count = () => b.block_count ?? 0;
            return (<div onMouseEnter={() => setIsCardHovered(true)} onMouseLeave={() => setIsCardHovered(false)} onClick={() => {
              if (!isRenaming()) {
                ctx.handleOpenBoard(b.id);
              }
            }} style={{
              display: 'flex',
              "flex-direction": 'column',
              background: 'var(--surface-container)',
              border: isCardHovered() ? '1px solid var(--secondary)' : '1px solid var(--border-default)',
              "border-radius": '4px',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
              transform: isCardHovered() ? 'translateY(-3px)' : 'none',
              "box-shadow": isCardHovered() ? '0 10px 24px rgba(0, 0, 0, 0.22)' : '0 2px 6px rgba(0, 0, 0, 0.08)',
              position: 'relative'
            }}>
              {/* CANVAS PREVIEW THUMBNAIL */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '150px',
                background: 'var(--surface-container-lowest, #0e1217)',
                "background-image": 'var(--surface-muted)',
                "background-size": '16px 16px',
                overflow: 'hidden',
                display: 'flex',
                "align-items": 'center',
                "justify-content": 'center',
                "border-bottom": '1px solid var(--border-subtle)'
              }}>
                <Show when={count() > 0} fallback={<div style={{
                  display: 'flex',
                  "flex-direction": 'column',
                  "align-items": 'center',
                  gap: '6px',
                  opacity: 0.35,
                  color: 'var(--text-muted)'
                }}>
                  <LayoutGrid size={22} />
                  <span style={{ "font-size": '12px', "letter-spacing": '0.3px' }}>Kanvas Kosong</span>
                </div>}>
                  {/* Simulated miniature spatial elements */}
                  <div style={{
                    position: 'relative',
                    width: '180px',
                    height: '110px',
                    "pointer-events": 'none'
                  }}>
                    {/* Miniature Sticky Note */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      width: '68px',
                      height: '56px',
                      background: 'var(--surface-muted)',
                      "border-radius": '4px',
                      "box-shadow": 'none',
                      transform: 'rotate(-4deg)',
                      padding: '6px',
                      display: 'flex',
                      "flex-direction": 'column',
                      gap: '3px'
                    }}>
                      <div style={{ width: '40px', height: '3px', background: 'var(--text-primary)', opacity: 0.7, "border-radius": '2px' }} />
                      <div style={{ width: '52px', height: '2px', background: 'var(--text-secondary)', opacity: 0.4, "border-radius": '1px' }} />
                      <div style={{ width: '34px', height: '2px', background: 'var(--text-secondary)', opacity: 0.4, "border-radius": '1px' }} />
                    </div>

                    {/* Miniature Card Node */}
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '12px',
                      width: '84px',
                      height: '54px',
                      background: 'var(--surface-container-high)',
                      border: '1px solid var(--primary)',
                      "border-radius": '6px',
                      "box-shadow": 'none',
                      padding: '6px',
                      display: 'flex',
                      "flex-direction": 'column',
                      gap: '3px'
                    }}>
                      <div style={{ display: 'flex', "align-items": 'center', gap: '4px' }}>
                        <div style={{ width: '6px', height: '6px', "border-radius": '50%', background: 'var(--primary)' }} />
                        <div style={{ width: '48px', height: '3px', background: 'var(--text-main)', opacity: 0.8, "border-radius": '2px' }} />
                      </div>
                      <div style={{ width: '64px', height: '2px', background: 'var(--text-muted)', opacity: 0.4, "border-radius": '1px' }} />
                      <div style={{ width: '42px', height: '2px', background: 'var(--text-muted)', opacity: 0.4, "border-radius": '1px' }} />
                    </div>

                    {/* Miniature Connector Curve */}
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                      <path d="M 75 40 Q 100 28, 115 50" fill="none" stroke="var(--secondary)" stroke-width="1.8" stroke-dasharray="3 2" opacity="0.85" />
                    </svg>
                  </div>
                </Show>

                {/* Item count tag on canvas corner */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  padding: '2px 8px',
                  "border-radius": '4px',
                  background: 'rgba(0,0,0,0.5)',
                  "backdrop-filter": 'none',
                  color: 'var(--text-muted)',
                  "font-size": '12px',
                  "font-family": 'var(--font-mono)',
                  display: 'flex',
                  "align-items": 'center',
                  gap: '4px'
                }}>
                  <LayoutGrid size={10} />
                  <span>{count()} item</span>
                </div>

                {/* Hover overlay with "Buka Kanvas" button */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.48)',
                  "backdrop-filter": 'none',
                  display: 'flex',
                  "align-items": 'center',
                  "justify-content": 'center',
                  opacity: isCardHovered() ? 1 : 0,
                  transition: 'opacity 0.18s ease',
                  "pointer-events": isCardHovered() ? 'auto' : 'none'
                }}>
                  <span style={{
                    padding: '6px 14px',
                    "border-radius": '4px',
                    background: 'var(--secondary)',
                    color: 'var(--action-primary-text)',
                    "font-size": '12px',
                    "font-weight": 600,
                    "box-shadow": 'none',
                    display: 'flex',
                    "align-items": 'center',
                    gap: '6px'
                  }}>
                    Buka Kanvas →
                  </span>
                </div>
              </div>

              {/* CARD DETAILS / FOOTER */}
              <div style={{
                padding: '12px 14px',
                display: 'flex',
                "flex-direction": 'column',
                gap: '6px'
              }}>
                <div style={{
                  display: 'flex',
                  "align-items": 'center',
                  "justify-content": 'space-between',
                  gap: '8px'
                }}>
                  <Show when={isRenaming()} fallback={<span style={{
                    "font-size": '14px',
                    "font-weight": 600,
                    color: 'var(--text-main)',
                    "white-space": 'nowrap',
                    overflow: 'hidden',
                    "text-overflow": 'ellipsis'
                  }} title={b.title}>
                    {b.title}
                  </span>}>
                    <input type="text" value={renameVal()} onClick={(e) => e.stopPropagation()} onInput={(e) => setRenameVal(e.currentTarget.value)} onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        ctx.handleRenameBoard(b.id, renameVal());
                        setIsRenaming(false);
                      }
                      else if (e.key === 'Escape') {
                        e.stopPropagation();
                        setIsRenaming(false);
                      }
                    }} onBlur={() => {
                      ctx.handleRenameBoard(b.id, renameVal());
                      setIsRenaming(false);
                    }} autofocus style={{
                      flex: 1,
                      background: 'var(--surface)',
                      border: '1px solid var(--primary)',
                      color: 'var(--text-main)',
                      "font-size": '13px',
                      padding: '2px 6px',
                      "border-radius": '4px',
                      outline: 'none'
                    }} />
                  </Show>

                  {/* Quick actions: Rename & Delete */}
                  <div style={{ display: 'flex', "align-items": 'center', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={(e) => {
                      e.stopPropagation();
                      setRenameVal(b.title);
                      setIsRenaming(!isRenaming());
                    }} style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '4px',
                      "border-radius": '4px',
                      display: 'flex',
                      "align-items": 'center',
                      opacity: 0.7,
                      transition: 'opacity 0.15s ease'
                    }} title="Ubah Nama Board">
                      <Edit3 size={13} />
                    </button>

                    <Show when={ctx.boards().length > 1}>
                      <button type="button" onClick={(e) => {
                        e.stopPropagation();
                        ctx.handleDeleteBoard(b.id);
                      }} style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '4px',
                        "border-radius": '4px',
                        display: 'flex',
                        "align-items": 'center',
                        opacity: 0.7,
                        transition: 'opacity 0.15s ease'
                      }} title="Hapus Board">
                        <Trash2 size={13} />
                      </button>
                    </Show>
                  </div>
                </div>

                {/* Relative Updated Timestamp */}
                <div style={{
                  display: 'flex',
                  "align-items": 'center',
                  "justify-content": 'space-between',
                  "font-size": '12px',
                  color: 'var(--text-dim)'
                }}>
                  <span>Diperbarui {formatRelativeTime(b.updated_at)}</span>
                </div>
              </div>
            </div>);
          }}
        </For>

        {/* CREATE BOARD CARD (Dashed Card) */}
        <div onClick={() => {
          ctx.setNewBoardTitle(`Board ${ctx.boards().length + 1}`);
          ctx.setIsCreatingBoard(true);
        }} style={{
          display: 'flex',
          "flex-direction": 'column',
          "align-items": 'center',
          "justify-content": 'center',
          gap: '10px',
          "min-height": '220px',
          border: '1.5px dashed var(--border-default)',
          "border-radius": '4px',
          background: 'transparent',
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          padding: '20px'
        }} onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--secondary)';
          e.currentTarget.style.backgroundColor = 'var(--surface-container-low)';
          e.currentTarget.style.transform = 'translateY(-3px)';
        }} onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.transform = 'none';
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            "border-radius": '50%',
            background: 'var(--surface-container-high)',
            display: 'flex',
            "align-items": 'center',
            "justify-content": 'center',
            color: 'var(--secondary)'
          }}>
            <Plus size={20} />
          </div>
          <div style={{ "text-align": 'center' }}>
            <div style={{ "font-size": '14px', "font-weight": 600, color: 'var(--text-main)' }}>
              Board Baru
            </div>
            <div style={{ "font-size": '12px', color: 'var(--text-muted)', "margin-top": '2px' }}>
              Mulai dari kanvas kosong
            </div>
          </div>
        </div>
      </div>
    </div>}>
      <div ref={(el) => {
        ctx.canvasContainerRef = el;
        el.addEventListener('wheel', ctx.handleCanvasWheel, { passive: false });
        el.addEventListener('touchstart', ctx.handleCanvasTouchStart, { passive: false });
        el.addEventListener('touchmove', ctx.handleCanvasTouchMove, { passive: false });
        el.addEventListener('touchend', ctx.handleCanvasTouchEnd);
        el.addEventListener('touchcancel', ctx.handleCanvasTouchEnd);
        onCleanup(() => {
          el.removeEventListener('wheel', ctx.handleCanvasWheel);
          el.removeEventListener('touchstart', ctx.handleCanvasTouchStart);
          el.removeEventListener('touchmove', ctx.handleCanvasTouchMove);
          el.removeEventListener('touchend', ctx.handleCanvasTouchEnd);
          el.removeEventListener('touchcancel', ctx.handleCanvasTouchEnd);
        });
      }} onMouseDown={ctx.handleCanvasMouseDown} onContextMenu={(e) => e.preventDefault()} onMouseLeave={() => {
        ctx.setCursorCanvasPos(null);
        ctx.setSnapGuides([]);
      }} style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        "background-color": 'var(--surface)',
        overflow: 'hidden',
        "touch-action": 'none',
        cursor: ctx.isActivelyPanning()
          ? 'grabbing'
          : ctx.isSelectingArea ? 'crosshair'
            : ['card', 'sticky', 'text', 'shape', 'connector'].includes(ctx.activeCanvasTool())
              ? 'crosshair'
              : (ctx.activeCanvasTool() === 'pan' || ctx.isSpacePressed() ? 'grab' : 'default')
      }}>
        {/* Top Navigation Bar: Back to Cards Gallery + Board Title + Count */}
        <div class="board-canvas-top-bar" style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          "z-index": 20,
          display: 'flex',
          "align-items": 'center',
          gap: '8px',
          padding: '6px 12px',
          "border-radius": '8px',
          "background-color": 'var(--surface-container-low)',
          border: '1px solid var(--border-default)',
          "box-shadow": 'none'
        }}>
          {/* Back to All Boards Button */}
          <button type="button" onClick={ctx.handleCloseBoardCanvas} style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            "align-items": 'center',
            gap: '6px',
            "font-size": '12px',
            "font-weight": 500,
            padding: '4px 8px',
            "border-radius": '6px',
            transition: 'all 0.12s ease'
          }} onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-main)';
            e.currentTarget.style.backgroundColor = 'var(--surface-container-high)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }} title="Kembali ke galeri board">
            <ArrowLeft size={14} />
            <span>Semua Board</span>
          </button>

          <span style={{ color: 'var(--border-default)', "font-size": '13px', "user-select": 'none' }}>/</span>

          {/* Active Board Title */}
          <span style={{
            "font-size": '13px',
            "font-weight": 600,
            color: 'var(--text-main)',
            padding: '2px 4px'
          }}>
            {ctx.currentBoard()?.title || 'Board'}
          </span>

          {/* Item count badge */}
          <span style={{
            "font-size": '12px',
            color: 'var(--text-dim)',
            "font-family": 'var(--font-mono)',
            padding: '2px 6px',
            "border-radius": '4px',
            background: 'var(--surface-container-high)'
          }}>
            {ctx.blocks().length} item
          </span>
        </div>

        {/* Dynamic Dot Grid Background moves with pan */}
        <div style={{
          position: 'absolute',
          inset: 0,
          "background-image": 'var(--surface-muted)',
          "background-size": '24px 24px',
          "background-position": `${ctx.pan().x}px ${ctx.pan().y}px`,
          "pointer-events": 'none'
        }} />

        {/* Scalable & Pannable Content Layer */}
        <div style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${ctx.pan().x}px, ${ctx.pan().y}px) scale(${ctx.zoom() / 100})`,
          "transform-origin": '0 0',
          "pointer-events": 'auto'
        }}>
          {/* Dynamic SVG Connector Curves */}
          <svg style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
            "pointer-events": 'none',
            "z-index": 25
          }}>
            <defs>
              <marker id="orca-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="var(--focus-ring)" />
              </marker>
              <marker id="orca-arrowhead-selected" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="var(--focus-ring)" />
              </marker>
            </defs>
            {ctx.renderConnectorCurves()}
          </svg>

          {/* Whimsical-style Smart Alignment Guides */}
          <Show when={ctx.snapGuides().length > 0}>
            <svg style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              "pointer-events": 'none',
              "z-index": 55
            }}>
              <For each={ctx.snapGuides()}>
                {(guide) => (<Show when={guide.type === 'vertical'} fallback={<line x1={guide.start} y1={guide.pos} x2={guide.end} y2={guide.pos} stroke="var(--secondary)" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.9" style={{ filter: 'drop-shadow(0 0 3px rgba(68, 225, 222, 0.75))' }} />}>
                  <line x1={guide.pos} y1={guide.start} x2={guide.pos} y2={guide.end} stroke="var(--secondary)" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.9" style={{ filter: 'drop-shadow(0 0 3px rgba(68, 225, 222, 0.75))' }} />
                </Show>)}
              </For>
            </svg>
          </Show>

          {/* Live Arrow Preview (canvas-space) when dragging a handle */}
          <Show when={ctx.dragArrowStart() && ctx.dragArrowEnd()}>
            {(() => {
              const s = ctx.dragArrowStart()!;
              const t = ctx.dragArrowEnd()!;
              const dx = t.x - s.x;
              const dy = t.y - s.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const ux = len > 0 ? dx / len : 1;
              const uy = len > 0 ? dy / len : 0;
              // Arrow tip retracted slightly
              const tipX = t.x - ux * 6;
              const tipY = t.y - uy * 6;
              const ctrl = Math.max(40, len * 0.4);
              const c1x = s.x + ux * ctrl;
              const c1y = s.y + uy * ctrl;
              const c2x = tipX - ux * ctrl;
              const c2y = tipY - uy * ctrl;
              return (<svg class="canvas-arrow-preview" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 'pointer-events': 'none', 'z-index': 60, overflow: 'visible' }}>
                <defs>
                  <marker id="arrow-preview-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill="var(--focus-ring)" />
                  </marker>
                </defs>
                <path d={`M ${s.x} ${s.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tipX} ${tipY}`} fill="none" stroke="var(--focus-ring)" stroke-width="2" stroke-dasharray="6 4" opacity="0.9" marker-end="url(#arrow-preview-head)" />
              </svg>);
            })()}
          </Show>

          {/* Multi-Select Area Marquee Box */}
          <Show when={ctx.selectionBox()}>
            <div class="canvas-selection-marquee" style={{
              left: `${ctx.selectionBox()!.x}px`,
              top: `${ctx.selectionBox()!.y}px`,
              width: `${ctx.selectionBox()!.width}px`,
              height: `${ctx.selectionBox()!.height}px`
            }} />
          </Show>

          {/* Ghost Preview Silhouette for active placement tool */}
          <Show when={ctx.cursorCanvasPos() && ['card', 'sticky', 'text', 'shape'].includes(ctx.activeCanvasTool())}>
            {(() => {
              const tool = ctx.activeCanvasTool();
              const pos = ctx.cursorCanvasPos()!;
              const isSticky = tool === 'sticky';
              const isShape = tool === 'shape';
              const isText = tool === 'text';
              const shapeKind = ctx.selectedShapeKind();
              let width = 310;
              let height = 74;
              if (isSticky) {
                width = 240;
                height = 130;
              }
              else if (isText) {
                width = 240;
                height = 36;
              }
              else if (isShape) {
                switch (shapeKind) {
                  case 'circle':
                    width = 140;
                    height = 100;
                    break;
                  case 'diamond':
                    width = 160;
                    height = 110;
                    break;
                  case 'triangle':
                    width = 160;
                    height = 120;
                    break;
                  case 'hexagon':
                    width = 170;
                    height = 85;
                    break;
                  default:
                    width = 180;
                    height = 70;
                    break;
                }
              }
              if (isShape && ['diamond', 'triangle', 'hexagon'].includes(shapeKind)) {
                return (<div class="canvas-ghost-preview" style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  border: 'none',
                  background: 'transparent',
                  "box-shadow": 'none'
                }}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                    <polygon points={shapeKind === 'diamond'
                      ? '50,2 98,50 50,98 2,50'
                      : shapeKind === 'triangle'
                        ? '50,2 98,98 2,98'
                        : '25,2 75,2 98,50 75,98 25,98 2,50'} fill="rgba(59, 130, 246, 0.08)" stroke="var(--focus-ring)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
                  </svg>
                </div>);
              }
              return (<div class="canvas-ghost-preview" style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
                width: `${width}px`,
                height: `${height}px`,
                border: isSticky
                  ? '2px dashed var(--focus-ring)'
                  : isShape
                    ? '1.5px solid var(--focus-ring)'
                    : isText
                      ? '1px dashed rgba(255,255,255,0.6)'
                      : '2px dashed var(--focus-ring)',
                background: isSticky
                  ? 'var(--surface-sticky)'
                  : isShape
                    ? 'var(--surface-card)'
                    : isText
                      ? 'transparent'
                      : 'var(--surface-card)',
                "border-radius": isShape ? (shapeKind === 'circle' ? '9999px' : '8px') : isSticky ? '4px' : '8px',
                "clip-path": isSticky ? 'polygon(0px 0px, calc(100% - 16px) 0px, 100% 16px, 100% 100%, 0px 100%)' : undefined,
                "box-shadow": 'none'
              }} />);
            })()}
          </Show>

          {/* Dynamic Blocks */}
          <For each={ctx.blocks()}>
            {(block) => {
              const isSelected = () => ctx.selectedBlockIds().includes(block.id) || ctx.selectedBlockId() === block.id;
              const isConnectingSource = () => ctx.connectingSourceId() === block.id;
              const blockTypeClass = () => {
                switch (block.type) {
                  case 'sticky': return 'canvas-block-sticky';
                  case 'text': return 'canvas-block-text';
                  case 'shape': return `canvas-block-shape canvas-shape-${block.content?.shape_kind || 'rectangle'}`;
                  default: return 'canvas-block-card';
                }
              };
              const isSvgShape = () => block.type === 'shape' && ['diamond', 'triangle', 'hexagon'].includes(block.content?.shape_kind);
              const isLocked = () => Boolean(block.content?.locked);
              const blockColor = () => block.content?.color;
              const borderStyle = () => block.content?.border_style || 'solid';
              const fillStyle = () => block.content?.fill_style || 'solid';
              const computedTextColor = () => getTextColorForBackground(blockColor(), fillStyle(), block.type);
              return (<div ref={(el) => {
                if (el) {
                  const updateH = () => {
                    const h = el.offsetHeight;
                    if (h > 0 && ctx.blockDomHeights()[block.id] !== h) {
                      ctx.setBlockDomHeights(prev => ({ ...prev, [block.id]: h }));
                    }
                  };
                  updateH();
                  const ro = new ResizeObserver(updateH);
                  ro.observe(el);
                  onCleanup(() => ro.disconnect());
                }
              }} onMouseDown={(e) => ctx.handleBlockMouseDown(e, block)} onDblClick={(e) => {
                e.stopPropagation();
                if (isLocked())
                  return;
                ctx.setEditingBlockId(block.id);
                ctx.setSelectedBlockId(block.id);
                ctx.setSelectedBlockIds([block.id]);
              }} class={`canvas-block ${blockTypeClass()} ${isSelected() ? 'selected' : ''} ${ctx.hoveredTargetBlockId() === block.id ? 'handle-drop-target' : ''} ${isLocked() ? 'locked' : ''}`} style={{
                left: `${block.pos_x}px`,
                top: `${block.pos_y}px`,
                width: `${ctx.getBlockWidth(block)}px`,
                height: block.height && block.height > 0 ? `${block.height}px` : 'auto',
                "min-width": `${block.type === 'card' || block.type === 'sticky' ? 180 : 60}px`,
                "min-height": block.height && block.height > 0
                  ? `${block.type === 'sticky' ? 120 : block.type === 'card' ? 74 : 36}px`
                  : block.type === 'shape'
                    ? (block.content?.shape_kind === 'circle' ? '100px'
                      : block.content?.shape_kind === 'diamond' ? '110px'
                        : block.content?.shape_kind === 'triangle' ? '120px'
                          : block.content?.shape_kind === 'hexagon' ? '85px'
                            : '70px')
                    : block.type === 'text' ? '36px' : block.type === 'sticky' ? '120px' : '74px',
                "border-color": !isSvgShape() ? (blockColor() || 'var(--border-medium)') : undefined,
                "border-style": !isSvgShape() && borderStyle() === 'dashed' ? 'dashed' : 'solid',
                background: !isSvgShape()
                  ? (fillStyle() === 'transparent' ? 'transparent' : (blockColor() || (block.type === 'sticky' ? 'var(--surface-sticky)' : 'var(--surface-card)')))
                  : undefined,
                color: computedTextColor(),
                outline: isConnectingSource() && !isSvgShape() ? '2px dashed var(--focus-ring)' : undefined
              }}>
                {/* Lock Badge */}
                <Show when={isLocked()}>
                  <div class="block-lock-badge" title="Locked (Click Unlock in toolbar above)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                </Show>

                {/* SVG frame for diamond, triangle, hexagon */}
                <Show when={isSvgShape()}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="shape-svg-border">
                    <polygon points={block.content?.shape_kind === 'diamond'
                      ? '50,2 98,50 50,98 2,50'
                      : block.content?.shape_kind === 'triangle'
                        ? '50,2 98,98 2,98'
                        : '25,2 75,2 98,50 75,98 25,98 2,50'} fill={fillStyle() === 'transparent'
                          ? 'transparent'
                          : (blockColor() || 'var(--surface-card)')} stroke={isSelected() || isConnectingSource() ? 'var(--focus-ring)' : (blockColor() || 'var(--border-medium)')} stroke-width={isSelected() || isConnectingSource() ? '2' : '1.5'} stroke-dasharray={borderStyle() === 'dashed' ? '6,4' : undefined} vector-effect="non-scaling-stroke" />
                  </svg>
                </Show>

                {/* Connection Handles are rendered in canvas world overlay below — not inside block */}

                <UnifiedMarkdownBlock block={block} isEditing={ctx.editingBlockId() === block.id} textColor={computedTextColor()} onStartEdit={() => {
                  if (isLocked())
                    return;
                  ctx.setEditingBlockId(block.id);
                  ctx.setSelectedBlockId(block.id);
                  ctx.setSelectedBlockIds([block.id]);
                }} onFinishEdit={(finalText) => ctx.handleFinishBlockEdit(block, finalText)} />

                {/* Author Footer (for sticky notes only) */}
                <Show when={block.type === 'sticky'}>
                  {(() => {
                    const author = () => block.content?.author || getCurrentUser();
                    const initials = () => {
                      const name = author()?.name || 'User';
                      return name
                        .split(' ')
                        .map((p: string) => p[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || 'U';
                    };
                    return (<div class="note-block-author-footer" style={{
                      color: computedTextColor(),
                      "border-top-color": fillStyle() === 'transparent' ? 'var(--border-subtle)' : 'rgba(128, 128, 128, 0.18)'
                    }}>
                      <div class="note-author-avatar-wrapper">
                        <Show when={author()?.avatar_url}>
                          <img src={author()?.avatar_url} alt={author()?.name || 'User'} class="note-author-avatar-img" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                        </Show>
                        <div class="note-author-avatar-fallback">
                          {initials()}
                        </div>
                      </div>
                      <span class="note-author-name" title={author()?.name || 'User'}>
                        {author()?.name || 'User'}
                      </span>
                    </div>);
                  })()}
                </Show>
              </div>);
            }}
          </For>

          {/* Canvas-space Connection Handles Overlay (outside blocks to avoid overflow:hidden clip) */}
          <div style={{ position: 'absolute', inset: 0, 'pointer-events': 'none', 'z-index': 35 }}>
            <div style={{ 'pointer-events': 'all' }}>
              {ctx.renderCanvasHandles()}
            </div>
          </div>

          {/* Contextual Action Bar above Selected Object */}
          <Show when={ctx.primarySelectedBlock() && !ctx.editingBlockId() && !ctx.isSelectingArea && !ctx.draggingBlockState && !ctx.resizingBlockState}>
            <CanvasContextToolbar ctx={ctx} />
          </Show>
        </div>

        {/* =========================================================
       FLOATING OBSIDIAN GLASS CANVAS TOOLBAR
       ========================================================= */}
        <div class="canvas-toolbar">
          {/* Pointer / Select */}
          <button class={`tool-btn ${ctx.activeCanvasTool() === 'select' ? 'active' : ''}`} onClick={() => ctx.setActiveCanvasTool('select')}>
            <MousePointer size={15} />
            <span class="tool-tooltip">
              Select & Move <span class="tool-tooltip-kbd">V</span>
            </span>
          </button>

          {/* Pan Tool */}
          <button class={`tool-btn ${ctx.activeCanvasTool() === 'pan' ? 'active' : ''}`} onClick={() => ctx.setActiveCanvasTool('pan')}>
            <Hand size={15} />
            <span class="tool-tooltip">
              Hand / Pan <span class="tool-tooltip-kbd">H</span>
            </span>
          </button>

          <div class="tool-divider"></div>

          {/* Undo Tool */}
          <button class={`tool-btn ${ctx.undoStack().length === 0 ? 'disabled' : ''}`} onClick={ctx.handleUndo} disabled={ctx.undoStack().length === 0} style={{ opacity: ctx.undoStack().length === 0 ? 0.35 : 1, cursor: ctx.undoStack().length === 0 ? 'not-allowed' : 'pointer' }}>
            <Undo size={15} />
            <span class="tool-tooltip">
              Undo <span class="tool-tooltip-kbd">Ctrl+Z</span>
            </span>
          </button>

          {/* Redo Tool */}
          <button class={`tool-btn ${ctx.redoStack().length === 0 ? 'disabled' : ''}`} onClick={ctx.handleRedo} disabled={ctx.redoStack().length === 0} style={{ opacity: ctx.redoStack().length === 0 ? 0.35 : 1, cursor: ctx.redoStack().length === 0 ? 'not-allowed' : 'pointer' }}>
            <Redo size={15} />
            <span class="tool-tooltip">
              Redo <span class="tool-tooltip-kbd">Ctrl+Y</span>
            </span>
          </button>

          <div class="tool-divider"></div>

          {/* Add Card */}
          <button class={`tool-btn ${ctx.activeCanvasTool() === 'card' ? 'active' : ''}`} onClick={() => ctx.setActiveCanvasTool(ctx.activeCanvasTool() === 'card' ? 'select' : 'card')}>
            <LayoutGrid size={15} />
            <span class="tool-tooltip">
              Card <span class="tool-tooltip-kbd">C</span>
            </span>
          </button>

          {/* Add Sticky Note */}
          <button class={`tool-btn ${ctx.activeCanvasTool() === 'sticky' ? 'active' : ''}`} onClick={() => ctx.setActiveCanvasTool(ctx.activeCanvasTool() === 'sticky' ? 'select' : 'sticky')}>
            <StickyNote size={15} />
            <span class="tool-tooltip">
              Sticky Note <span class="tool-tooltip-kbd">S</span>
            </span>
          </button>

          {/* Add Text Block */}
          <button class={`tool-btn ${ctx.activeCanvasTool() === 'text' ? 'active' : ''}`} onClick={() => ctx.setActiveCanvasTool(ctx.activeCanvasTool() === 'text' ? 'select' : 'text')}>
            <Type size={15} />
            <span class="tool-tooltip">
              Text Block <span class="tool-tooltip-kbd">T</span>
            </span>
          </button>

          {/* Add Shape Container & Popover */}
          <div class={`shape-tool-wrapper ${ctx.showShapePicker() ? 'popover-open' : ''}`}>
            <Show when={ctx.showShapePicker()}>
              <div class="shape-picker-popover" onClick={(e) => e.stopPropagation()}>
                <div class="shape-picker-header">Shapes</div>
                <div class="shape-picker-list">
                  <For each={SHAPE_OPTIONS}>
                    {(option) => {
                      const Icon = option.icon;
                      const isSelected = () => ctx.selectedShapeKind() === option.id;
                      return (<button type="button" class={`shape-option-btn ${isSelected() ? 'active' : ''}`} title={option.label} onClick={(e) => {
                        e.stopPropagation();
                        ctx.setSelectedShapeKind(option.id);
                        writeDemoSetting('last-shape-kind', option.id);
                        ctx.setActiveCanvasTool('shape');
                        ctx.setShowShapePicker(false);
                      }}>
                        <Icon size={16} />
                        <span class="shape-option-label">{option.label}</span>
                      </button>);
                    }}
                  </For>
                </div>
              </div>
            </Show>

            <button class={`tool-btn ${ctx.activeCanvasTool() === 'shape' ? 'active' : ''}`} onClick={(e) => {
              e.stopPropagation();
              if (ctx.activeCanvasTool() !== 'shape') {
                ctx.setActiveCanvasTool('shape');
                ctx.setShowShapePicker(true);
              }
              else {
                ctx.setShowShapePicker(prev => !prev);
              }
            }}>
              <DynamicShapeIcon kind={ctx.selectedShapeKind()} size={15} />
              <span class="tool-tooltip">
                {`Shape (${ctx.selectedShapeKind()})`} <span class="tool-tooltip-kbd">R</span>
              </span>
            </button>
          </div>

          {/* Connector Tool */}
          <button class={`tool-btn ${ctx.activeCanvasTool() === 'connector' ? 'active' : ''}`} onClick={() => {
            ctx.setActiveCanvasTool(ctx.activeCanvasTool() === 'connector' ? 'select' : 'connector');
            ctx.setConnectingSourceId(null);
          }}>
            <Share2 size={15} />
            <span class="tool-tooltip">
              Connect <span class="tool-tooltip-kbd">L</span>
            </span>
          </button>

          {/* Object Storage Image Upload Tool */}
          <label class="tool-btn" title="Unggah Gambar ke Object Storage" style={{ cursor: ctx.isUploadingCanvasImage() ? 'not-allowed' : 'pointer', position: 'relative', display: 'flex', "align-items": 'center', "justify-content": 'center' }}>
            <Show when={ctx.isUploadingCanvasImage()} fallback={<ImageIcon size={15} />}>
              <Loader2 size={15} class="spin" />
            </Show>
            <span class="tool-tooltip">
              Upload Image
            </span>
            <input type="file" accept="image/*" style={{ display: 'none' }} disabled={ctx.isUploadingCanvasImage()} onChange={ctx.handleUploadCanvasImage} />
          </label>

          <div class="tool-divider"></div>

          {/* Zoom Controls */}
          <div style={{ display: 'flex', "align-items": 'center', gap: '2px', "font-size": '12px', "font-family": 'var(--font-mono)' }}>
            <button onClick={() => ctx.setZoom(z => Math.max(20, z - 10))} class="tool-btn" style={{ width: '26px', height: '26px' }}>
              -
              <span class="tool-tooltip">
                Zoom Out <span class="tool-tooltip-kbd">-</span>
              </span>
            </button>
            <span class="tool-zoom-badge" onClick={() => { ctx.setZoom(100); ctx.setPan({ x: 0, y: 0 }); }} style={{ padding: '0 6px', color: 'var(--text-muted)', cursor: 'pointer', "user-select": 'none' }}>
              {ctx.zoom()}%
              <span class="tool-tooltip">
                Reset View <span class="tool-tooltip-kbd">100%</span>
              </span>
            </span>
            <button onClick={() => ctx.setZoom(z => Math.min(200, z + 10))} class="tool-btn" style={{ width: '26px', height: '26px' }}>
              +
              <span class="tool-tooltip">
                Zoom In <span class="tool-tooltip-kbd">+</span>
              </span>
            </button>
            <button onClick={() => { ctx.setZoom(100); ctx.setPan({ x: 0, y: 0 }); }} class="tool-btn" style={{ width: '26px', height: '26px' }}>
              <Maximize2 size={12} />
              <span class="tool-tooltip">
                Fit / Center
              </span>
            </button>
          </div>
        </div>
      </div>
    </Show>
  </Show>);
};
