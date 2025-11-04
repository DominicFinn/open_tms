import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../api';

interface ImportResult {
  success: boolean;
  ordersCreated: number;
  errors: Array<{ row: number; message: string }>;
  orders: Array<{ orderNumber: string; id: string }>;
}

export default function OrderImportCSV() {
  const navigate = useNavigate();
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent) {
      alert('Please upload a CSV file first');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/orders/import/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ csvContent })
      });

      const result = await response.json();

      if (result.data) {
        setResult(result.data);
      } else if (result.error) {
        alert(`Import failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the console for details.');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `Order Number,PO Number,Customer Name,Origin Name,Origin Address,Origin City,Origin State,Origin Postal Code,Origin Country,Destination Name,Destination Address,Destination City,Destination State,Destination Postal Code,Destination Country,Order Date,Pickup Date,Delivery Date,Service Level,Temperature Control,Requires Hazmat,Unit ID,Unit Type,Custom Type Name,SKU,Description,Quantity,Weight,Weight Unit,Length,Width,Height,Dim Unit,Item Hazmat,Temperature
ORD-001,PO-12345,ACME Corp,Warehouse A,123 Main St,Los Angeles,CA,90001,US,Customer Site B,456 Oak Ave,New York,NY,10001,US,2025-01-15,2025-01-20,2025-01-25,LTL,ambient,No,PALLET-001,PALLET,,SKU-001,Widget A,100,500,kg,120,100,150,cm,No,
ORD-001,PO-12345,ACME Corp,Warehouse A,123 Main St,Los Angeles,CA,90001,US,Customer Site B,456 Oak Ave,New York,NY,10001,US,2025-01-15,2025-01-20,2025-01-25,LTL,ambient,No,PALLET-001,PALLET,,SKU-002,Widget B,50,250,kg,120,100,150,cm,No,
ORD-002,PO-67890,GlobalTech,Distribution Center,789 Industrial Blvd,Chicago,IL,60601,US,Retail Store,321 Commerce St,Miami,FL,33101,US,2025-01-16,,2025-01-30,FTL,refrigerated,No,PALLET-002,PALLET,,SKU-003,Perishable Item,200,800,kg,120,100,150,cm,No,chilled`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'order_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setCsvContent('');
    setFileName('');
    setResult(null);
  };

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
          <div>
            <h2>Import Orders from CSV</h2>
            <p style={{ color: 'var(--color-grey)', marginTop: 'var(--spacing-1)' }}>
              Upload a CSV file containing orders with trackable units (pallets, totes, etc.) and inventory line items
            </p>
          </div>
          <Link to="/orders" className="button button-outline">
            <span className="material-icons" style={{ fontSize: '18px' }}>arrow_back</span>
            Back to Orders
          </Link>
        </div>

        {!result && (
          <>
            {/* Download Template */}
            <div style={{
              backgroundColor: 'var(--color-info-light)',
              borderLeft: '4px solid var(--color-info)',
              padding: 'var(--spacing-2)',
              marginBottom: 'var(--spacing-2)',
              borderRadius: 'var(--border-radius)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                <span className="material-icons" style={{ color: 'var(--color-info)' }}>info</span>
                <div style={{ flex: 1 }}>
                  <strong>First time importing?</strong> Download the template to see the required CSV format.
                </div>
                <button onClick={downloadTemplate} className="button button-sm">
                  <span className="material-icons" style={{ fontSize: '16px' }}>download</span>
                  Download Template
                </button>
              </div>
            </div>

            {/* CSV Format Info */}
            <div style={{ marginBottom: 'var(--spacing-3)' }}>
              <h3 style={{ marginBottom: 'var(--spacing-1)' }}>CSV Format Requirements</h3>
              <ul style={{ marginLeft: 'var(--spacing-3)', color: 'var(--color-grey)' }}>
                <li>Each row represents one line item within a trackable unit</li>
                <li>Orders with the same <strong>Order Number</strong> will be grouped together</li>
                <li>Line items with the same <strong>Unit ID</strong> will be grouped into a trackable unit (pallet, tote, etc.)</li>
                <li>Required columns: Order Number, Customer Name, Unit ID, SKU, Quantity</li>
                <li>Locations (origin/destination) will be matched by name and city, or created if not found</li>
                <li>Service Level: FTL or LTL (default: LTL)</li>
                <li>Temperature Control: ambient, refrigerated, or frozen (default: ambient)</li>
              </ul>
            </div>

            {/* File Upload */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                border: '2px dashed var(--color-border)',
                borderRadius: 'var(--border-radius)',
                padding: 'var(--spacing-4)',
                textAlign: 'center',
                backgroundColor: 'var(--color-surface)',
                marginBottom: 'var(--spacing-2)'
              }}
            >
              <span className="material-icons" style={{ fontSize: '48px', color: 'var(--color-grey)', marginBottom: 'var(--spacing-1)' }}>
                cloud_upload
              </span>
              <h3>Drop CSV file here or click to upload</h3>
              <p style={{ color: 'var(--color-grey)', marginBottom: 'var(--spacing-2)' }}>
                Supported format: .csv
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="csv-file-input"
              />
              <label htmlFor="csv-file-input" className="button">
                <span className="material-icons" style={{ fontSize: '18px' }}>folder_open</span>
                Choose File
              </label>

              {fileName && (
                <div style={{
                  marginTop: 'var(--spacing-2)',
                  padding: 'var(--spacing-2)',
                  backgroundColor: 'var(--color-success-light)',
                  borderRadius: 'var(--border-radius)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-1)'
                }}>
                  <span className="material-icons" style={{ color: 'var(--color-success)' }}>check_circle</span>
                  <span style={{ fontWeight: '500' }}>{fileName}</span>
                  <button
                    onClick={resetForm}
                    className="icon-btn"
                    style={{ marginLeft: 'var(--spacing-1)' }}
                  >
                    <span className="material-icons" style={{ fontSize: '18px' }}>close</span>
                  </button>
                </div>
              )}
            </div>

            {/* CSV Preview */}
            {csvContent && (
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-1)' }}>CSV Preview</h3>
                <div style={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--border-radius)',
                  padding: 'var(--spacing-2)',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap'
                }}>
                  {csvContent.split('\n').slice(0, 10).join('\n')}
                  {csvContent.split('\n').length > 10 && '\n... (and more rows)'}
                </div>
              </div>
            )}

            {/* Import Button */}
            {csvContent && (
              <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end' }}>
                <button onClick={resetForm} className="button button-outline">
                  Cancel
                </button>
                <button onClick={handleImport} disabled={importing} className="button button-primary">
                  {importing ? (
                    <>
                      <span className="loading-spinner" style={{ width: '16px', height: '16px', marginRight: '8px' }}></span>
                      Importing...
                    </>
                  ) : (
                    <>
                      <span className="material-icons" style={{ fontSize: '18px' }}>upload</span>
                      Import Orders
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* Import Results */}
        {result && (
          <div>
            <div style={{
              backgroundColor: result.success && result.errors.length === 0 ? 'var(--color-success-light)' : 'var(--color-warning-light)',
              borderLeft: `4px solid ${result.success && result.errors.length === 0 ? 'var(--color-success)' : 'var(--color-warning)'}`,
              padding: 'var(--spacing-2)',
              marginBottom: 'var(--spacing-2)',
              borderRadius: 'var(--border-radius)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-1)' }}>
                <span className="material-icons" style={{ color: result.success && result.errors.length === 0 ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {result.success && result.errors.length === 0 ? 'check_circle' : 'warning'}
                </span>
                <strong>Import Complete</strong>
              </div>
              <p style={{ marginTop: 'var(--spacing-1)', marginBottom: 0 }}>
                Successfully created {result.ordersCreated} order(s)
                {result.errors.length > 0 && ` with ${result.errors.length} error(s)`}
              </p>
            </div>

            {/* Successfully Imported Orders */}
            {result.orders.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-1)' }}>Successfully Imported Orders</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order Number</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.orders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <Link to={`/orders/${order.id}`} style={{ fontWeight: '500', color: 'var(--color-primary)' }}>
                              {order.orderNumber}
                            </Link>
                          </td>
                          <td>
                            <Link to={`/orders/${order.id}`} className="button button-sm button-outline">
                              <span className="material-icons" style={{ fontSize: '16px' }}>visibility</span>
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-2)' }}>
                <h3 style={{ marginBottom: 'var(--spacing-1)', color: 'var(--color-error)' }}>
                  Errors ({result.errors.length})
                </h3>
                <div style={{
                  backgroundColor: 'var(--color-error-light)',
                  border: '1px solid var(--color-error)',
                  borderRadius: 'var(--border-radius)',
                  padding: 'var(--spacing-2)',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {result.errors.map((error, index) => (
                    <div key={index} style={{ marginBottom: index < result.errors.length - 1 ? 'var(--spacing-1)' : 0 }}>
                      <strong>Row {error.row}:</strong> {error.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 'var(--spacing-1)', justifyContent: 'flex-end' }}>
              <button onClick={resetForm} className="button button-outline">
                Import Another File
              </button>
              <Link to="/orders" className="button button-primary">
                <span className="material-icons" style={{ fontSize: '18px' }}>list</span>
                View All Orders
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
