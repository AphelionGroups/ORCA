import type { Component } from 'solid-js';
import { createSignal, onMount, For } from 'solid-js';
import { Bolt, X, Link, Folder } from 'lucide-solid';
import { api } from '../services/api';
import type { Space } from '../services/api';

interface QuickCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onItemCreated?: () => void;
}

export const QuickCaptureModal: Component<QuickCaptureModalProps> = (props) => {
  const [type, setType] = createSignal<'Document' | 'Task'>('Task');
  const [title, setTitle] = createSignal('');
  const [note, setNote] = createSignal('');
  const [spaces, setSpaces] = createSignal<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal('');

  onMount(async () => {
    try {
      const data = await api.getSpaces();
      if (data && data.length > 0) {
        setSpaces(data);
        setSelectedSpaceId(data[0].id);
      }
    } catch (_) {}
  });

  const handleSave = async () => {
    if (!title().trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const spaceId = selectedSpaceId() || (spaces()[0]?.id || '');
      if (!spaceId) {
        throw new Error('No active space found to associate item with.');
      }

      if (type() === 'Task') {
        await api.createTask({
          title: title().trim(),
          description: note().trim() || undefined,
          space_id: spaceId,
          status: 'todo',
          priority: 'medium',
        });
      } else {
        await api.createDocument({
          title: title().trim(),
          content: note().trim() || 'Quick captured document draft...',
          space_id: spaceId,
          doc_type: 'notes',
          is_pinned: false,
        });
      }

      setTitle('');
      setNote('');
      props.onClose();
      if (props.onItemCreated) props.onItemCreated();
    } catch (err: any) {
      setError(err.message || 'Failed to capture item');
    } finally {
      setLoading(false);
    }
  };

  if (!props.isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        "z-index": 50,
        display: 'flex',
        "align-items": 'center',
        "justify-content": 'center',
        "background-color": 'rgba(0, 0, 0, 0.6)',
        "backdrop-filter": 'blur(4px)',
        padding: '16px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div 
        style={{
          position: 'relative',
          width: '100%',
          "max-width": '448px',
          "background-color": '#181a20',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          "box-shadow": '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          "border-radius": '8px',
          padding: '20px'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "padding-bottom": '12px', "margin-bottom": '12px', "border-bottom": '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
            <Bolt size={16} color="var(--secondary)" />
            <h3 style={{ "font-size": '12px', "font-weight": 600, color: '#fff', "letter-spacing": '0.05em', "text-transform": 'uppercase', "font-family": 'var(--font-mono)', margin: 0 }}>
              Quick Capture & Ingestion
            </h3>
          </div>
          <button 
            onClick={props.onClose} 
            style={{ color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', "align-items": 'center' }}
          >
            <X size={16} />
          </button>
        </div>

        {error() && (
          <div style={{ "margin-bottom": '12px', padding: '6px 10px', "background-color": 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', "border-radius": '4px', color: '#fca5a5', "font-size": '11px' }}>
            {error()}
          </div>
        )}

        <div style={{ display: 'flex', "flex-direction": 'column', gap: '14px' }}>
          {/* Target Type switcher */}
          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
            <span style={{ "font-size": '11px', color: 'var(--text-dim)', "text-transform": 'uppercase', "font-family": 'var(--font-mono)', "letter-spacing": '0.05em' }}>Target Type</span>
            <div style={{ display: 'flex', gap: '4px', padding: '2px', "border-radius": '4px', "background-color": '#111317', border: '1px solid var(--border-default)', "font-size": '11px' }}>
              <button 
                type="button"
                onClick={() => setType('Task')}
                style={{
                  padding: '4px 12px',
                  "border-radius": '4px',
                  border: 'none',
                  "background-color": type() === 'Task' ? 'rgba(68, 225, 222, 0.2)' : 'transparent',
                  color: type() === 'Task' ? 'var(--secondary)' : 'var(--text-muted)',
                  "font-weight": type() === 'Task' ? 500 : 400,
                  cursor: 'pointer'
                }}
              >
                Task
              </button>
              <button 
                type="button"
                onClick={() => setType('Document')}
                style={{
                  padding: '4px 12px',
                  "border-radius": '4px',
                  border: 'none',
                  "background-color": type() === 'Document' ? 'rgba(139, 141, 248, 0.2)' : 'transparent',
                  color: type() === 'Document' ? 'var(--primary)' : 'var(--text-muted)',
                  "font-weight": type() === 'Document' ? 500 : 400,
                  cursor: 'pointer'
                }}
              >
                Document
              </button>
            </div>
          </div>

          {/* Space Selector */}
          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between' }}>
            <span style={{ "font-size": '11px', color: 'var(--text-dim)', "text-transform": 'uppercase', "font-family": 'var(--font-mono)' }}>Space</span>
            <select
              value={selectedSpaceId()}
              onChange={e => setSelectedSpaceId(e.currentTarget.value)}
              style={{
                "background-color": '#111317',
                color: '#fff',
                border: '1px solid var(--border-default)',
                "border-radius": '4px',
                padding: '4px 8px',
                "font-size": '11px',
                outline: 'none'
              }}
            >
              <For each={spaces()}>
                {(sp) => (
                  <option value={sp.id}>{sp.name}</option>
                )}
              </For>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase' }}>Title</label>
            <input 
              autofocus
              type="text" 
              value={title()} 
              onInput={e => setTitle(e.currentTarget.value)}
              placeholder={type() === 'Task' ? "e.g., Finalize CAD Export..." : "e.g., Packaging Visual Specs..."}
              style={{
                width: '100%',
                "background-color": '#111317',
                border: '1px solid var(--border-default)',
                "border-radius": '4px',
                padding: '6px 12px',
                "font-size": '12px',
                color: '#fff',
                outline: 'none',
                "box-sizing": 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', "font-size": '10px', color: 'var(--text-dim)', "margin-bottom": '4px', "font-family": 'var(--font-mono)', "text-transform": 'uppercase' }}>
              {type() === 'Task' ? 'Task Details / Context' : 'Document Markdown Content'}
            </label>
            <textarea 
              rows={3} 
              value={note()}
              onInput={e => setNote(e.currentTarget.value)}
              placeholder="Key thoughts, architectural reference, or markdown bullet points..."
              style={{
                width: '100%',
                "background-color": '#111317',
                border: '1px solid var(--border-default)',
                "border-radius": '4px',
                padding: '6px 12px',
                "font-size": '12px',
                color: 'var(--text-muted)',
                outline: 'none',
                resize: 'none',
                "box-sizing": 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', "align-items": 'center', "justify-content": 'space-between', "padding-top": '8px', "border-top": '1px solid rgba(255,255,255,0.1)', "font-size": '12px' }}>
            <div style={{ display: 'flex', "align-items": 'center', gap: '6px', color: 'var(--text-dim)', "font-family": 'var(--font-mono)', "font-size": '11px' }}>
              <Folder size={13} />
              <span>{type() === 'Task' ? 'Inbox Triage' : 'Document Store'}</span>
            </div>
            <div style={{ display: 'flex', "align-items": 'center', gap: '8px' }}>
              <button 
                type="button" 
                onClick={props.onClose} 
                style={{ padding: '4px 12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', "font-size": '12px' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSave}
                disabled={loading()}
                style={{
                  padding: '5px 14px',
                  "background-color": '#fff',
                  color: '#000',
                  "font-weight": 500,
                  "border-radius": '4px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  "align-items": 'center',
                  gap: '4px',
                  "font-size": '12px'
                }}
              >
                <Link size={13} />
                <span>{loading() ? 'Saving...' : `Capture ${type()}`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
