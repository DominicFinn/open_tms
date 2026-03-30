/**
 * Default Customs / Commercial Invoice Template
 * Includes blank fill-in fields for data not yet in the schema (HS codes, declared values, etc.)
 */
export const defaultCustomsTemplate = `
<h1>COMMERCIAL INVOICE / CUSTOMS DECLARATION</h1>

<table>
  <tr>
    <td><strong>Date:</strong> {{date}}</td>
    <td><strong>Shipment Ref:</strong> {{shipment.reference}}</td>
    <td><strong>Invoice #:</strong> {{invoiceNumber}}</td>
  </tr>
</table>

<h2>Exporter / Shipper</h2>
<p>
  {{customer.name}}<br/>
  {{shipment.origin.name}}<br/>
  {{shipment.origin.address1}}<br/>
  {{#if shipment.origin.address2}}{{shipment.origin.address2}}<br/>{{/if}}
  {{shipment.origin.city}}, {{shipment.origin.state}} {{shipment.origin.postalCode}}<br/>
  {{shipment.origin.country}}<br/>
  {{#if customer.contactEmail}}Email: {{customer.contactEmail}}{{/if}}
</p>

<h2>Importer / Consignee</h2>
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
    <td><strong>Name:</strong> {{carrier.name}}</td>
    <td><strong>MC#:</strong> {{carrier.mcNumber}}</td>
  </tr>
</table>

<h2>Shipment</h2>
<table>
  <tr>
    <td><strong>Pickup:</strong> {{shipment.pickupDate}}</td>
    <td><strong>Delivery:</strong> {{shipment.deliveryDate}}</td>
  </tr>
</table>

<h2>Goods Description</h2>
<table>
  <tr>
    <th>SKU</th>
    <th>Description</th>
    <th>Qty</th>
    <th>Weight</th>
    <th>Dimensions</th>
    <th>Country of Origin</th>
    <th>HS Code</th>
    <th>Declared Value</th>
  </tr>
  {{#each lineItems}}
  <tr>
    <td>{{this.sku}}</td>
    <td>{{this.description}}</td>
    <td>{{this.quantity}}</td>
    <td>{{this.weight}} {{this.weightUnit}}</td>
    <td>{{this.length}}x{{this.width}}x{{this.height}} {{this.dimUnit}}</td>
    <td>________________</td>
    <td>________________</td>
    <td>________________</td>
  </tr>
  {{/each}}
</table>

<h2>Totals</h2>
<table>
  <tr>
    <td><strong>Total Pieces:</strong> {{totals.itemCount}}</td>
    <td><strong>Total Weight:</strong> {{totals.totalWeight}} kg</td>
    <td><strong>Total Declared Value:</strong> ________________</td>
  </tr>
</table>

<h2>Additional Information</h2>
<table>
  <tr><td style="width:50%"><strong>Incoterms:</strong> ________________</td><td><strong>Export License #:</strong> ________________</td></tr>
  <tr><td><strong>Reason for Export:</strong> ________________</td><td><strong>Currency:</strong> ________________</td></tr>
</table>

<h2>Declaration</h2>
<p>
  I hereby declare that the information contained in this invoice is true and correct, and that the
  contents of this shipment are as stated above.
</p>

<table>
  <tr>
    <td style="width:50%"><br/><br/>_________________________<br/>Authorized Signature</td>
    <td><br/><br/>_________________________<br/>Date</td>
  </tr>
</table>
`;
