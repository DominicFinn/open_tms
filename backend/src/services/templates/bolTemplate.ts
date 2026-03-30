/**
 * Default Bill of Lading HTML Template
 * Uses Handlebars syntax for variable substitution.
 * This template is rendered to HTML, then converted to PDF via pdf-lib.
 * The HTML is also stored in the database and can be customized via the template management UI.
 */
export const defaultBolTemplate = `
<h1>BILL OF LADING</h1>
<table>
  <tr>
    <td><strong>BOL Number:</strong> {{bolNumber}}</td>
    <td><strong>Date:</strong> {{date}}</td>
    <td><strong>Shipment Ref:</strong> {{shipment.reference}}</td>
  </tr>
</table>

<h2>Shipper (Origin)</h2>
<p>
  {{shipment.origin.name}}<br/>
  {{shipment.origin.address1}}<br/>
  {{#if shipment.origin.address2}}{{shipment.origin.address2}}<br/>{{/if}}
  {{shipment.origin.city}}, {{shipment.origin.state}} {{shipment.origin.postalCode}}<br/>
  {{shipment.origin.country}}
</p>

<h2>Consignee (Destination)</h2>
<p>
  {{shipment.destination.name}}<br/>
  {{shipment.destination.address1}}<br/>
  {{#if shipment.destination.address2}}{{shipment.destination.address2}}<br/>{{/if}}
  {{shipment.destination.city}}, {{shipment.destination.state}} {{shipment.destination.postalCode}}<br/>
  {{shipment.destination.country}}
</p>

<h2>Carrier</h2>
<table>
  <tr>
    <td><strong>Carrier:</strong> {{carrier.name}}</td>
    <td><strong>MC#:</strong> {{carrier.mcNumber}}</td>
    <td><strong>DOT#:</strong> {{carrier.dotNumber}}</td>
  </tr>
  <tr>
    <td><strong>Contact:</strong> {{carrier.contactName}}</td>
    <td><strong>Phone:</strong> {{carrier.contactPhone}}</td>
    <td><strong>Email:</strong> {{carrier.contactEmail}}</td>
  </tr>
</table>

{{#if vehicle}}
<h2>Vehicle & Driver</h2>
<table>
  <tr>
    <td><strong>Vehicle:</strong> {{vehicle.plate}} ({{vehicle.type}})</td>
    <td><strong>Driver:</strong> {{driver.name}}</td>
    <td><strong>Driver Phone:</strong> {{driver.phone}}</td>
  </tr>
</table>
{{/if}}

<h2>Customer</h2>
<p>{{customer.name}} {{#if customer.contactEmail}}({{customer.contactEmail}}){{/if}}</p>

<h2>Shipment Details</h2>
<table>
  <tr>
    <td><strong>Pickup Date:</strong> {{shipment.pickupDate}}</td>
    <td><strong>Delivery Date:</strong> {{shipment.deliveryDate}}</td>
    <td><strong>Status:</strong> {{shipment.status}}</td>
  </tr>
</table>

{{#if stops.length}}
<h2>Stops</h2>
<table>
  <tr><th>#</th><th>Type</th><th>Location</th><th>City/State</th><th>Est. Arrival</th><th>Instructions</th></tr>
  {{#each stops}}
  <tr>
    <td>{{this.sequenceNumber}}</td>
    <td>{{this.stopType}}</td>
    <td>{{this.location.name}}</td>
    <td>{{this.location.city}}, {{this.location.state}}</td>
    <td>{{this.estimatedArrival}}</td>
    <td>{{this.instructions}}</td>
  </tr>
  {{/each}}
</table>
{{/if}}

<h2>Orders & Items</h2>
{{#each orders}}
<h3>Order: {{this.orderNumber}} {{#if this.poNumber}}(PO: {{this.poNumber}}){{/if}}</h3>
<table>
  <tr>
    <td><strong>Service:</strong> {{this.serviceLevel}}</td>
    <td><strong>Temp:</strong> {{this.temperatureControl}}</td>
    <td><strong>Hazmat:</strong> {{#if this.requiresHazmat}}YES{{else}}No{{/if}}</td>
  </tr>
</table>

{{#if this.trackableUnits.length}}
<p><strong>Units:</strong></p>
<table>
  <tr><th>ID</th><th>Type</th><th>Barcode</th></tr>
  {{#each this.trackableUnits}}
  <tr>
    <td>{{this.identifier}}</td>
    <td>{{this.unitType}}</td>
    <td>{{this.barcode}}</td>
  </tr>
  {{/each}}
</table>
{{/if}}

{{#if this.lineItems.length}}
<p><strong>Line Items:</strong></p>
<table>
  <tr><th>SKU</th><th>Description</th><th>Qty</th><th>Weight</th><th>Dimensions</th><th>Hazmat</th></tr>
  {{#each this.lineItems}}
  <tr>
    <td>{{this.sku}}</td>
    <td>{{this.description}}</td>
    <td>{{this.quantity}}</td>
    <td>{{this.weight}} {{this.weightUnit}}</td>
    <td>{{this.length}}x{{this.width}}x{{this.height}} {{this.dimUnit}}</td>
    <td>{{#if this.hazmat}}YES{{else}}-{{/if}}</td>
  </tr>
  {{/each}}
</table>
{{/if}}
{{/each}}

<h2>Totals</h2>
<table>
  <tr>
    <td><strong>Total Orders:</strong> {{totals.orderCount}}</td>
    <td><strong>Total Units:</strong> {{totals.unitCount}}</td>
    <td><strong>Total Items:</strong> {{totals.itemCount}}</td>
    <td><strong>Total Weight:</strong> {{totals.totalWeight}} kg</td>
  </tr>
</table>

{{#if specialInstructions}}
<h2>Special Instructions</h2>
<p>{{specialInstructions}}</p>
{{/if}}

<h2>Signatures</h2>
<table>
  <tr>
    <td style="width:33%"><strong>Shipper:</strong><br/><br/><br/>_________________________<br/>Signature / Date</td>
    <td style="width:33%"><strong>Carrier:</strong><br/><br/><br/>_________________________<br/>Signature / Date</td>
    <td style="width:33%"><strong>Consignee:</strong><br/><br/><br/>_________________________<br/>Signature / Date</td>
  </tr>
</table>
`;
