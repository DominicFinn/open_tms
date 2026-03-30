import { useState, useEffect } from 'react';
import { API_URL } from '../api';

interface FieldDefinition {
  fieldKey: string;
  label: string;
  description?: string;
  fieldType: string;
  required: boolean;
  defaultValue?: string;
  config?: Record<string, any>;
}

interface CustomFieldRendererProps {
  entityType: string;
  /** Current custom field version ID (from entity record). If null, loads active version. */
  versionId?: string | null;
  /** Current values from entity's customFieldValues */
  values: Record<string, any>;
  /** Called when values change (edit mode) */
  onChange?: (values: Record<string, any>, versionId: string) => void;
  /** If true, fields are editable. If false, read-only display. */
  editable?: boolean;
}

export default function CustomFieldRenderer({ entityType, versionId, values, onChange, editable = false }: CustomFieldRendererProps) {
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loadedVersionId, setLoadedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFields();
  }, [entityType, versionId]);

  const loadFields = async () => {
    setLoading(true);
    try {
      let url: string;
      if (versionId) {
        url = `${API_URL}/api/v1/custom-fields/versions/${versionId}`;
      } else {
        url = `${API_URL}/api/v1/custom-fields/${entityType}`;
      }
      const res = await fetch(url);
      const result = await res.json();
      if (result.data) {
        setFields(result.data.fields || []);
        setLoadedVersionId(result.data.id);
      } else {
        setFields([]);
      }
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (fieldKey: string, value: any) => {
    if (!onChange || !loadedVersionId) return;
    onChange({ ...values, [fieldKey]: value }, loadedVersionId);
  };

  if (loading) return null;
  if (fields.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--spacing-2)' }}>
      <h4 style={{ marginBottom: 'var(--spacing-1)', color: 'var(--on-surface-variant)' }}>Custom Fields</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-1)' }}>
        {fields.map((field) => {
          const value = values?.[field.fieldKey] ?? field.defaultValue ?? '';
          const config = field.config || {};

          if (!editable) {
            // Read-only display
            return (
              <div key={field.fieldKey} style={{ padding: '8px 0' }}>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>{field.label}</span>
                <div>
                  {field.fieldType === 'boolean'
                    ? (value === true ? 'Yes' : value === false ? 'No' : '-')
                    : field.fieldType === 'multi_list' && Array.isArray(value)
                    ? value.join(', ') || '-'
                    : String(value || '-')
                  }
                </div>
              </div>
            );
          }

          // Editable fields
          switch (field.fieldType) {
            case 'text':
              return (
                <div key={field.fieldKey} className="input-wrapper">
                  <input
                    className="input"
                    value={value}
                    onChange={(e) => handleChange(field.fieldKey, e.target.value)}
                    required={field.required}
                    minLength={config.minLength}
                    maxLength={config.maxLength}
                    pattern={config.pattern}
                    placeholder=" "
                  />
                  <label>{field.label}{field.required ? ' *' : ''}</label>
                  {config.formatMask && <span className="text-muted" style={{ fontSize: '0.75rem' }}>Format: {config.formatMask}</span>}
                </div>
              );
            case 'decimal':
            case 'integer':
              return (
                <div key={field.fieldKey} className="input-wrapper">
                  <input
                    className="input"
                    type="number"
                    value={value}
                    onChange={(e) => handleChange(field.fieldKey, e.target.value !== '' ? Number(e.target.value) : '')}
                    required={field.required}
                    min={config.minValue}
                    max={config.maxValue}
                    step={field.fieldType === 'decimal' ? (config.decimalPlaces ? Math.pow(10, -config.decimalPlaces) : 'any') : 1}
                    placeholder=" "
                  />
                  <label>{field.label}{field.required ? ' *' : ''}</label>
                </div>
              );
            case 'date':
              return (
                <div key={field.fieldKey} className="input-wrapper">
                  <input
                    className="input"
                    type="date"
                    value={value}
                    onChange={(e) => handleChange(field.fieldKey, e.target.value)}
                    required={field.required}
                    placeholder=" "
                  />
                  <label>{field.label}{field.required ? ' *' : ''}</label>
                </div>
              );
            case 'boolean':
              return (
                <div key={field.fieldKey} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)', padding: '8px 0' }}>
                  <input
                    type="checkbox"
                    checked={value === true}
                    onChange={(e) => handleChange(field.fieldKey, e.target.checked)}
                  />
                  <span>{field.label}{field.required ? ' *' : ''}</span>
                </div>
              );
            case 'list':
              return (
                <div key={field.fieldKey} className="input-wrapper">
                  <select
                    className="input"
                    value={value}
                    onChange={(e) => handleChange(field.fieldKey, e.target.value)}
                    required={field.required}
                  >
                    <option value="">-- Select --</option>
                    {(config.options || []).map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <label>{field.label}{field.required ? ' *' : ''}</label>
                </div>
              );
            case 'multi_list': {
              const selectedValues = Array.isArray(value) ? value : [];
              return (
                <div key={field.fieldKey} style={{ gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>{field.label}{field.required ? ' *' : ''}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {(config.options || []).map((opt: string) => (
                      <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--outline-variant)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedValues.includes(opt)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selectedValues, opt]
                              : selectedValues.filter((v: string) => v !== opt);
                            handleChange(field.fieldKey, next);
                          }}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              );
            }
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
