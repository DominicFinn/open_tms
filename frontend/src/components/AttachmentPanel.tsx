import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../api';

interface Attachment {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storageBackend: string;
  uploadedBy?: string;
  description?: string;
  createdAt: string;
}

interface AttachmentPanelProps {
  entityType: string;
  entityId: string;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AttachmentPanel({ entityType, entityId }: AttachmentPanelProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (entityType && entityId) {
      loadAttachments();
    }
  }, [entityType, entityId]);

  const loadAttachments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ entityType, entityId });
      const response = await fetch(`${API_URL}/api/v1/attachments?${params}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setAttachments(result.data || []);
    } catch {
      setError('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);

      const response = await fetch(`${API_URL}/api/v1/attachments`, {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setAttachments(prev => [result.data, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleDownload = (attachment: Attachment) => {
    window.open(`${API_URL}/api/v1/attachments/${attachment.id}/download`, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await fetch(`${API_URL}/api/v1/attachments/${id}`, { method: 'DELETE' });
      setAttachments(prev => prev.filter(a => a.id !== id));
    } catch {
      setError('Failed to delete attachment');
    }
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>Attachments</h3>

      {/* Upload zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--md-primary)' : 'var(--md-outline-variant)'}`,
          borderRadius: '12px',
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'var(--md-primary-container)' : 'var(--md-surface-variant)',
          transition: 'all 0.2s ease',
          marginBottom: '16px',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        {uploading ? (
          <span style={{ color: 'var(--md-on-surface-variant)' }}>Uploading...</span>
        ) : (
          <span style={{ color: 'var(--md-on-surface-variant)' }}>
            Drop a file here or click to upload
          </span>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--md-error)', marginBottom: '12px', fontSize: '14px' }}>{error}</div>
      )}

      {/* Attachment list */}
      {loading ? (
        <p style={{ color: 'var(--md-on-surface-variant)', fontSize: '14px' }}>Loading...</p>
      ) : attachments.length === 0 ? (
        <p style={{ color: 'var(--md-on-surface-variant)', fontSize: '14px' }}>No attachments yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {attachments.map(att => (
            <div
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'var(--md-surface)',
                border: '1px solid var(--md-outline-variant)',
                borderRadius: '8px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {att.fileName}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>
                  {formatSize(att.fileSize)} &middot; {new Date(att.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                <button
                  onClick={() => handleDownload(att)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--md-outline)',
                    background: 'var(--md-surface)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Download
                </button>
                <button
                  onClick={() => handleDelete(att.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--md-error)',
                    color: 'var(--md-error)',
                    background: 'var(--md-surface)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
