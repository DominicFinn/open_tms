import React, { useState } from 'react';

export default function StyleGuide() {
  const [checkA, setCheckA] = useState(true);
  const [checkB, setCheckB] = useState(false);
  const [checkC, setCheckC] = useState(false);
  const [radio, setRadio] = useState('option1');
  const [switchA, setSwitchA] = useState(true);
  const [switchB, setSwitchB] = useState(false);
  const [rangeVal, setRangeVal] = useState(60);
  const [selectVal, setSelectVal] = useState('');
  const [textVal, setTextVal] = useState('');

  return (
    <div>
      <div className="page-header">
        <h1>Style Guide</h1>
        <p style={{ color: 'var(--on-surface-variant)', marginTop: 'var(--spacing-1)' }}>
          Reference for all form controls and UI components. Review styling here before rolling out.
        </p>
      </div>

      {/* Checkboxes */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Checkboxes</h2>
        <p style={{ color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-2)' }}>
          Material Design 3 checkboxes with custom check mark, hover ripple effect, and focus ring.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="check-field">
            <input type="checkbox" checked={checkA} onChange={(e) => setCheckA(e.target.checked)} />
            <span>Checked by default</span>
          </label>
          <label className="check-field">
            <input type="checkbox" checked={checkB} onChange={(e) => setCheckB(e.target.checked)} />
            <span>Unchecked by default</span>
          </label>
          <label className="check-field">
            <input type="checkbox" checked={checkC} onChange={(e) => setCheckC(e.target.checked)} />
            <span>Another option</span>
          </label>
          <label className="check-field">
            <input type="checkbox" disabled checked />
            <span>Disabled checked</span>
          </label>
          <label className="check-field">
            <input type="checkbox" disabled />
            <span>Disabled unchecked</span>
          </label>
        </div>
        <div style={{ marginTop: 'var(--spacing-2)', padding: 'var(--spacing-1)', backgroundColor: 'var(--surface-container-low)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
          {'<label className="check-field"><input type="checkbox" /><span>Label</span></label>'}
        </div>
      </div>

      {/* Radio Buttons */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Radio Buttons</h2>
        <p style={{ color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-2)' }}>
          Material Design 3 radio buttons with filled inner circle, hover ripple, and focus ring.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label className="check-field">
            <input type="radio" name="demo-radio" value="option1" checked={radio === 'option1'} onChange={(e) => setRadio(e.target.value)} />
            <span>Option 1 (selected)</span>
          </label>
          <label className="check-field">
            <input type="radio" name="demo-radio" value="option2" checked={radio === 'option2'} onChange={(e) => setRadio(e.target.value)} />
            <span>Option 2</span>
          </label>
          <label className="check-field">
            <input type="radio" name="demo-radio" value="option3" checked={radio === 'option3'} onChange={(e) => setRadio(e.target.value)} />
            <span>Option 3</span>
          </label>
          <label className="check-field">
            <input type="radio" name="demo-disabled" disabled checked />
            <span>Disabled selected</span>
          </label>
          <label className="check-field">
            <input type="radio" name="demo-disabled2" disabled />
            <span>Disabled unselected</span>
          </label>
        </div>
        <div style={{ marginTop: 'var(--spacing-2)', padding: 'var(--spacing-1)', backgroundColor: 'var(--surface-container-low)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
          {'<label className="check-field"><input type="radio" name="group" /><span>Label</span></label>'}
        </div>
      </div>

      {/* Toggle Switches */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Toggle Switches</h2>
        <p style={{ color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-2)' }}>
          Material Design 3 toggle switches with animated thumb resize on hover/press.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
          <label className="switch">
            <input type="checkbox" checked={switchA} onChange={(e) => setSwitchA(e.target.checked)} />
            <span className="slider"></span>
            <span>Enabled (on)</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={switchB} onChange={(e) => setSwitchB(e.target.checked)} />
            <span className="slider"></span>
            <span>Disabled feature (off)</span>
          </label>
          <label className="switch">
            <input type="checkbox" disabled checked />
            <span className="slider"></span>
            <span>Disabled on</span>
          </label>
          <label className="switch">
            <input type="checkbox" disabled />
            <span className="slider"></span>
            <span>Disabled off</span>
          </label>
        </div>
        <div style={{ marginTop: 'var(--spacing-2)', padding: 'var(--spacing-1)', backgroundColor: 'var(--surface-container-low)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
          {'<label className="switch"><input type="checkbox" /><span className="slider"></span><span>Label</span></label>'}
        </div>
      </div>

      {/* Range Slider */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Range Slider</h2>
        <p style={{ color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-2)' }}>
          Material Design 3 range slider with themed thumb, ripple on hover/press, and value display.
        </p>
        <div className="range-field">
          <label>Volume</label>
          <div className="range-row">
            <input type="range" min="0" max="100" value={rangeVal} onChange={(e) => setRangeVal(Number(e.target.value))} />
            <div className="range-value">{rangeVal}%</div>
          </div>
        </div>
        <div className="range-field">
          <label>Disabled slider</label>
          <input type="range" min="0" max="100" value={40} disabled />
        </div>
        <div style={{ marginTop: 'var(--spacing-2)', padding: 'var(--spacing-1)', backgroundColor: 'var(--surface-container-low)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
          {'<div className="range-field"><label>Label</label><div className="range-row"><input type="range" /><div className="range-value">60%</div></div></div>'}
        </div>
      </div>

      {/* Select Dropdown */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Select Dropdown</h2>
        <p style={{ color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-2)' }}>
          Styled native select with custom chevron, hover highlight, and floating label.
        </p>
        <div style={{ maxWidth: '400px' }}>
          <div className="text-field">
            <select value={selectVal} onChange={(e) => setSelectVal(e.target.value)}>
              <option value="" disabled>Select an option...</option>
              <option value="carrier">Carrier</option>
              <option value="customer">Customer</option>
              <option value="location">Location</option>
              <option value="shipment">Shipment</option>
              <option value="order">Order</option>
            </select>
            <label>Entity Type</label>
          </div>
        </div>
        <div style={{ marginTop: 'var(--spacing-1)', padding: 'var(--spacing-1)', backgroundColor: 'var(--surface-container-low)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
          {'<div className="text-field"><select>...</select><label>Label</label></div>'}
        </div>
      </div>

      {/* Text Input */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Text Input</h2>
        <p style={{ color: 'var(--on-surface-variant)', marginBottom: 'var(--spacing-2)' }}>
          Standard text input with floating label, focus ring, and error state.
        </p>
        <div style={{ maxWidth: '400px' }}>
          <div className="text-field">
            <input type="text" placeholder=" " value={textVal} onChange={(e) => setTextVal(e.target.value)} />
            <label>Company Name</label>
          </div>
          <div className="text-field field-error">
            <input type="email" placeholder=" " defaultValue="bad-email" />
            <label>Email Address</label>
            <span className="field-hint">Please enter a valid email address</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Buttons</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="button">Primary</button>
          <button className="button button-outline">Outline</button>
          <button className="button button-success">Success</button>
          <button className="button button-danger">Danger</button>
          <button className="button small">Small</button>
          <button className="button" disabled>Disabled</button>
          <button className="icon-btn" title="Icon button">
            <span className="material-icons">edit</span>
          </button>
        </div>
      </div>

      {/* Chips */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Chips</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }}>
          <span className="chip chip-primary">Primary</span>
          <span className="chip chip-secondary">Secondary</span>
          <span className="chip chip-success">Success</span>
          <span className="chip chip-warning">Warning</span>
          <span className="chip chip-error">Error</span>
          <span className="chip chip-info">Info</span>
          <span className="chip chip-outline">Outline</span>
        </div>
      </div>

      {/* Alerts */}
      <div className="card" style={{ marginBottom: 'var(--spacing-3)' }}>
        <h2 style={{ marginTop: 0 }}>Alerts</h2>
        <div className="alert alert-success">This is a success alert.</div>
        <div className="alert alert-error">This is an error alert.</div>
        <div className="alert alert-warning">This is a warning alert.</div>
        <div className="alert alert-info">This is an info alert.</div>
      </div>
    </div>
  );
}
