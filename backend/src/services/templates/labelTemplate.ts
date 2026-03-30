/**
 * Default Shipping Label HTML Template
 * One label per trackable unit. Designed for 4x6 inch labels.
 */
export const defaultLabelTemplate = `
{{#each units}}
<div style="page-break-after: always; width: 4in; height: 6in; border: 1px solid #000; padding: 8px; font-family: monospace;">
  <div style="text-align: center; font-size: 14px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 8px;">
    SHIPPING LABEL
  </div>

  <div style="margin-bottom: 8px;">
    <strong>FROM:</strong><br/>
    {{../origin.name}}<br/>
    {{../origin.address1}}<br/>
    {{../origin.city}}, {{../origin.state}} {{../origin.postalCode}}
  </div>

  <div style="margin-bottom: 8px; font-size: 16px; font-weight: bold; border: 2px solid #000; padding: 6px;">
    <strong>TO:</strong><br/>
    {{../destination.name}}<br/>
    {{../destination.address1}}<br/>
    {{../destination.city}}, {{../destination.state}} {{../destination.postalCode}}<br/>
    {{../destination.country}}
  </div>

  <table style="width: 100%; margin-bottom: 6px;">
    <tr>
      <td><strong>Order:</strong> {{../orderNumber}}</td>
      <td><strong>PO:</strong> {{../poNumber}}</td>
    </tr>
    <tr>
      <td><strong>Shipment:</strong> {{../shipmentReference}}</td>
      <td><strong>Carrier:</strong> {{../carrierName}}</td>
    </tr>
  </table>

  <div style="border: 1px solid #000; padding: 6px; margin-bottom: 6px;">
    <strong>Unit:</strong> {{this.identifier}} ({{this.unitType}})<br/>
    <strong>Unit #:</strong> {{this.sequenceNumber}} of {{../unitTotal}}<br/>
    {{#if this.barcode}}<strong>Barcode:</strong> {{this.barcode}}<br/>{{/if}}
  </div>

  {{#if ../temperatureControl}}
    {{#unless (eq ../temperatureControl "ambient")}}
    <div style="border: 2px solid #000; padding: 4px; text-align: center; font-weight: bold;">
      TEMPERATURE: {{../temperatureControl}}
    </div>
    {{/unless}}
  {{/if}}

  {{#if ../requiresHazmat}}
  <div style="border: 2px solid #000; padding: 4px; text-align: center; font-weight: bold; background: #fff3cd;">
    HAZMAT
  </div>
  {{/if}}

  {{#if ../specialInstructions}}
  <div style="font-size: 10px; margin-top: 4px;">
    <strong>Instructions:</strong> {{../specialInstructions}}
  </div>
  {{/if}}
</div>
{{/each}}
`;
