import type { Component } from 'solid-js';
import { createSignal, For } from 'solid-js';
import { 
  Inbox, 
  Plus, 
  Check, 
  Trash2, 
  Clock, 
  FolderKanban
} from 'lucide-solid';

interface InboxItem {
  id: string;
  title: string;
  note?: string;
  type: 'task' | 'thought' | 'draft';
  createdAt: string;
  spaceName?: string;
}

interface InboxViewProps {
  onNavigate: (route: string, spaceId?: string | null) => void;
  onOpenQuickCapture: () => void;
}

export const InboxView: Component<InboxViewProps> = (props) => {
  const [quickInput, setQuickInput] = createSignal('');
  const [items, setItems] = createSignal<InboxItem[]>([
    {
      id: 'inbox-1',
      title: 'Review packaging cardboard tensile test specifications',
      note: 'Confirm spot varnishes and embossed foil clearances before sending CAD to factory.',
      type: 'task',
      createdAt: '12m ago',
      spaceName: 'Bisnis A'
    },
    {
      id: 'inbox-2',
      title: 'Idea: Single-stroke Bézier smoothing algorithm for stylus pen',
      note: 'Explore Catmull-Rom spline tension parameter vs Chaikin corner rounding.',
      type: 'thought',
      createdAt: '1h ago',
      spaceName: 'Kantor'
    },
    {
      id: 'inbox-3',
      title: 'Draft Q3 personal biometric health review notes',
      note: 'Sleep latency metrics and VO2 max trend analysis.',
      type: 'draft',
      createdAt: '3h ago',
      spaceName: 'Pribadi'
    },
    {
      id: 'inbox-4',
      title: 'API Gateway rate-limiting policy discussion with cloud team',
      note: 'Evaluate Token Bucket vs Leaky Bucket for client-side offline sync buffer.',
      type: 'task',
      createdAt: 'Yesterday',
      spaceName: 'Bisnis B'
    }
  ]);

  const handleAddItem = (e: Event) => {
    e.preventDefault();
    const val = quickInput().trim();
    if (!val) return;

    setItems([
      {
        id: `inbox-${Date.now()}`,
        title: val,
        type: 'task',
        createdAt: 'Just now',
        spaceName: 'Bisnis A'
      },
      ...items()
    ]);
    setQuickInput('');
  };

  const handleRemove = (id: string) => {
    setItems(items().filter(item => item.id !== id));
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', "flex-direction": 'column', "background-color": 'var(--surface)', overflow: 'hidden' }}>
      {/* Header */}
      <header class="orca-header">
        <div class="header-breadcrumbs">
          <div class="breadcrumb-title">
            <Inbox size={17} color="var(--secondary)" />
            <span>Inbox</span>
          </div>
          <span class="breadcrumb-sep">/</span>
          <span class="badge-outline">
            Triage & Ingestion
          </span>
        </div>

        <div class="header-actions">
          <span style={{ "font-size": '11px', "font-family": 'var(--font-mono)', color: 'var(--text-dim)' }}>
            {items().length} items awaiting triage
          </span>
          <button 
            onClick={props.onOpenQuickCapture}
            class="btn-pill-white"
          >
            <Plus size={14} />
            <span>Quick Capture</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, "overflow-y": 'auto', padding: '32px', "background-color": '#111317' }}>
        <div style={{ "max-width": '880px', margin: '0 auto', display: 'flex', "flex-direction": 'column', gap: '20px' }}>
          
          {/* Quick Input Bar */}
          <form onSubmit={handleAddItem}>
            <div style={{
              display: 'flex',
              "align-items": 'center',
              gap: '10px',
              padding: '8px 14px',
              "background-color": 'var(--surface-container-low)',
              border: '1px solid var(--border-default)',
              "border-radius": '8px',
              "box-shadow": '0 4px 20px rgba(0, 0, 0, 0.25)'
            }}>
              <Plus size={16} color="var(--text-dim)" />
              <input 
                type="text"
                value={quickInput()}
                onInput={e => setQuickInput(e.currentTarget.value)}
                placeholder="Type a thought, task, or raw note... press Enter to capture"
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  "font-size": '13px',
                  outline: 'none'
                }}
              />
              <span class="kbd-badge">Enter</span>
            </div>
          </form>

          {/* Inbox List */}
          <div style={{ display: 'flex', "flex-direction": 'column', gap: '8px' }}>
            <For each={items()}>
              {(item) => (
                <div 
                  style={{
                    padding: '16px',
                    "border-radius": '8px',
                    "background-color": 'rgba(24, 26, 32, 0.8)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    "align-items": 'flex-start',
                    "justify-content": 'space-between',
                    gap: '16px',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', "flex-direction": 'column', gap: '6px', flex: 1 }}>
                    <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 6px',
                        "border-radius": '4px',
                        "font-size": '10px',
                        "font-family": 'var(--font-mono)',
                        "text-transform": 'uppercase',
                        background: item.type === 'task' ? 'rgba(68, 225, 222, 0.12)' : item.type === 'thought' ? 'rgba(139, 141, 248, 0.12)' : 'rgba(206, 189, 255, 0.12)',
                        color: item.type === 'task' ? 'var(--secondary)' : item.type === 'thought' ? 'var(--primary)' : 'var(--tertiary)'
                      }}>
                        {item.type}
                      </span>
                      {item.spaceName && (
                        <span style={{ "font-size": '11px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)' }}>
                          {item.spaceName}
                        </span>
                      )}
                      <span style={{ "font-size": '11px', color: 'var(--text-dim)', display: 'flex', "align-items": 'center', gap: '4px' }}>
                        <Clock size={11} />
                        {item.createdAt}
                      </span>
                    </div>

                    <h3 style={{ "font-size": '13px', "font-weight": 500, color: '#fff', margin: 0, "line-height": 1.4 }}>
                      {item.title}
                    </h3>

                    {item.note && (
                      <p style={{ "font-size": '12px', color: 'var(--text-muted)', margin: 0, "line-height": 1.5 }}>
                        {item.note}
                      </p>
                    )}
                  </div>

                  {/* Triage Action Buttons */}
                  <div style={{ display: 'flex', "align-items": 'center', gap: '6px' }}>
                    <button 
                      title="Promote to Project Task"
                      onClick={() => {
                        props.onNavigate('projects');
                      }}
                      style={{
                        padding: '5px 10px',
                        "border-radius": '4px',
                        "background-color": 'var(--surface-container-high)',
                        color: '#fff',
                        "font-size": '11px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        "align-items": 'center',
                        gap: '4px'
                      }}
                    >
                      <FolderKanban size={12} color="var(--primary)" />
                      <span>To Project</span>
                    </button>

                    <button 
                      title="Archive / Done"
                      onClick={() => handleRemove(item.id)}
                      style={{
                        padding: '5px 8px',
                        "border-radius": '4px',
                        background: 'none',
                        color: 'var(--text-dim)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={14} />
                    </button>

                    <button 
                      title="Discard"
                      onClick={() => handleRemove(item.id)}
                      style={{
                        padding: '5px 8px',
                        "border-radius": '4px',
                        background: 'none',
                        color: 'var(--text-dim)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </main>
    </div>
  );
};
