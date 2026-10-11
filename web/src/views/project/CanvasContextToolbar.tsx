import { For, Show } from 'solid-js';
import type { useProjectController } from './useProjectController';

type ToolbarContext = Pick<ReturnType<typeof useProjectController>, 'getBlockWidth' | 'handleCopyBlock' | 'handleCutBlock' | 'handleDeleteBlocks' | 'handleDuplicateBlock' | 'handleUpdateBlockContent' | 'primarySelectedBlock' | 'setEditingBlockId' | 'setShowContextColorPicker' | 'setShowContextMoreMenu' | 'showContextColorPicker' | 'showContextMoreMenu'>;

export function CanvasContextToolbar(props: { ctx: ToolbarContext }) {
  const { getBlockWidth, handleCopyBlock, handleCutBlock, handleDeleteBlocks, handleDuplicateBlock, handleUpdateBlockContent, primarySelectedBlock, setEditingBlockId, setShowContextColorPicker, setShowContextMoreMenu, showContextColorPicker, showContextMoreMenu } = props.ctx;
  // Render contextual floating action bar above the selected object
  const render = () => {
    const block = primarySelectedBlock();
    if (!block) return null;

    const w = getBlockWidth(block);
    const posX = block.pos_x + w / 2;
    const posY = block.pos_y - 12;

    const isLocked = Boolean(block.content?.locked);
    const currentColor = block.content?.color || '#44e1de';
    const currentBorderStyle = block.content?.border_style || 'solid';
    const currentFillStyle = block.content?.fill_style || 'solid';

    const COLOR_PALETTE = [
      { name: 'Dark (Default)', value: '#1e2025' },
      { name: 'Pure White', value: '#ffffff' },
      { name: 'Ocean Blue', value: '#2563eb' },
      { name: 'Teal', value: '#0d9488' },
      { name: 'Purple', value: '#7c3aed' },
      { name: 'Rose Red', value: '#e11d48' },
      { name: 'Amber Orange', value: '#d97706' },
      { name: 'Emerald Green', value: '#16a34a' },
      { name: 'Slate Gray', value: '#475569' },
    ];

    return (
      <div
        class="canvas-context-toolbar"
        style={{
          left: `${posX}px`,
          top: `${posY}px`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Edit Text Tool */}
        <button
          class="ctx-btn"
          title="Edit text (or double-click block)"
          onClick={() => {
            setEditingBlockId(block.id);
            setShowContextColorPicker(false);
            setShowContextMoreMenu(false);
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>Edit</span>
        </button>

        <div class="ctx-divider" />

        {/* 2. Color Picker Tool */}
        <div style={{ position: 'relative' }}>
          <button
            class={`ctx-btn ${showContextColorPicker() ? 'active' : ''}`}
            title="Color / Warna"
            onClick={() => {
              setShowContextColorPicker(!showContextColorPicker());
              setShowContextMoreMenu(false);
            }}
          >
            <div
              style={{
                width: '13px',
                height: '13px',
                "border-radius": '50%',
                background: currentColor,
                border: '1.5px solid var(--surface-muted)',
              }}
            />
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {/* Color Popover */}
          <Show when={showContextColorPicker()}>
            <div class="ctx-popover" onClick={(e) => e.stopPropagation()}>
              <For each={COLOR_PALETTE}>
                {(c) => (
                  <div
                    class={`ctx-color-swatch ${block.content?.color === c.value ? 'active' : ''}`}
                    style={{ background: c.value }}
                    title={c.name}
                    onClick={() => {
                      handleUpdateBlockContent(block.id, { color: c.value });
                      setShowContextColorPicker(false);
                    }}
                  />
                )}
              </For>
              <div
                class="ctx-color-swatch"
                style={{
                  background: 'transparent',
                  border: '1.5px dashed var(--surface-muted)',
                  display: 'flex',
                  "align-items": 'center',
                  "justify-content": 'center',
                  "font-size": '12px',
                  color: '#94a3b8'
                }}
                title="Reset color"
                onClick={() => {
                  handleUpdateBlockContent(block.id, { color: undefined });
                  setShowContextColorPicker(false);
                }}
              >
                ✕
              </div>
            </div>
          </Show>
        </div>

        {/* 3. Outline Solid atau Dash */}
        <button
          class="ctx-btn"
          title={`Outline style: ${currentBorderStyle === 'dashed' ? 'Dashed' : 'Solid'}`}
          onClick={() => {
            const next = currentBorderStyle === 'dashed' ? 'solid' : 'dashed';
            handleUpdateBlockContent(block.id, { border_style: next });
          }}
        >
          <Show when={currentBorderStyle === 'dashed'} fallback={
            <svg width="16" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
          }>
            <svg width="16" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4,4">
              <line x1="2" y1="12" x2="22" y2="12" />
            </svg>
          </Show>
          <span>{currentBorderStyle === 'dashed' ? 'Dash' : 'Solid'}</span>
        </button>

        {/* 4. Fill Tool (Solid vs Transparent) */}
        <button
          class="ctx-btn"
          title={`Fill: ${currentFillStyle === 'transparent' ? 'Transparent' : 'Solid'}`}
          onClick={() => {
            const next = currentFillStyle === 'transparent' ? 'solid' : 'transparent';
            handleUpdateBlockContent(block.id, { fill_style: next });
          }}
        >
          <Show when={currentFillStyle === 'transparent'} fallback={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          }>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="4" y1="20" x2="20" y2="4" stroke-width="1.5" />
            </svg>
          </Show>
          <span>{currentFillStyle === 'transparent' ? 'Transparent' : 'Solid'}</span>
        </button>

        <div class="ctx-divider" />

        {/* 5. Duplicate Tool */}
        <button
          class="ctx-btn"
          title="Duplicate (Ctrl+D)"
          onClick={() => handleDuplicateBlock(block)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>

        {/* 6. Lock Tool Toggle */}
        <button
          class={`ctx-btn ${isLocked ? 'active' : ''}`}
          title={isLocked ? "Unlock object" : "Lock object"}
          onClick={() => handleUpdateBlockContent(block.id, { locked: !isLocked })}
          style={isLocked ? { color: 'var(--status-warning)', 'background-color': 'rgba(251, 191, 36, 0.15)', 'border-color': 'rgba(251, 191, 36, 0.3)' } : {}}
        >
          <Show when={isLocked} fallback={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          }>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </Show>
        </button>

        {/* 7. Tombol Titik 3 (... More Options) */}
        <div style={{ position: 'relative' }}>
          <button
            class={`ctx-btn ${showContextMoreMenu() ? 'active' : ''}`}
            title="More options"
            onClick={() => {
              setShowContextMoreMenu(!showContextMoreMenu());
              setShowContextColorPicker(false);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>

          {/* More Options Dropdown */}
          <Show when={showContextMoreMenu()}>
            <div class="ctx-menu-dropdown" onClick={(e) => e.stopPropagation()}>
              <button
                class="ctx-menu-item"
                onClick={() => handleCopyBlock(block)}
              >
                <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </span>
                <span class="ctx-menu-badge">Ctrl+C</span>
              </button>

              <button
                class="ctx-menu-item"
                onClick={() => handleCutBlock(block)}
              >
                <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <line x1="20" y1="4" x2="8.12" y2="15.88" />
                    <line x1="14.47" y1="14.48" x2="20" y2="20" />
                    <line x1="8.12" y1="8.12" x2="12" y2="12" />
                  </svg>
                  Cut
                </span>
                <span class="ctx-menu-badge">Ctrl+X</span>
              </button>

              <button
                class="ctx-menu-item"
                onClick={() => {
                  handleUpdateBlockContent(block.id, { locked: !isLocked });
                  setShowContextMoreMenu(false);
                }}
              >
                <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                  <Show when={isLocked} fallback={
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  }>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </svg>
                  </Show>
                  {isLocked ? 'Unlock' : 'Lock'}
                </span>
              </button>

              <div style={{ height: '1px', background: 'var(--surface-muted)', margin: '2px 0' }} />

              <button
                class="ctx-menu-item danger"
                onClick={() => {
                  setShowContextMoreMenu(false);
                  handleDeleteBlocks([block.id]);
                }}
              >
                <span style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </span>
                <span class="ctx-menu-badge">Del</span>
              </button>
            </div>
          </Show>
        </div>
      </div>
    );
  };

  return <>{render()}</>;
}
