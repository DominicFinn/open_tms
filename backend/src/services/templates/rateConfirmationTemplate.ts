/**
 * Default Rate Confirmation HTML Template
 * Carrier-facing document that shows the agreed carrier rate.
 * Does NOT show customer sell rate or broker margin.
 */
export const defaultRateConfirmationTemplate = `
{{#if branding.orgName}}
<div style="text-align:center;margin-bottom:8px;">
  <span style="font-size:20px;font-weight:bold;color:{{branding.primaryColor}};">{{branding.orgName}}</span>
</div>
{{/if}}
<h1>RATE CONFIRMATION</h1>
<table>
  <tr>
    <td><strong>Confirmation #:</strong> {{confirmationNumber}}</td>
    <td><strong>Date:</strong> {{date}}</td>
    <td><strong>Shipment Ref:</strong> {{shipment.reference}}</td>
  </tr>
</table>

<h2>Broker</h2>
<p>
  {{branding.orgName}}<br/>
  {{#if org.mcNumber}}MC# {{org.mcNumber}}<br/>{{/if}}
</p>

<h2>Carrier</h2>
<p>
  {{carrier.name}}<br/>
  {{#if carrier.mcNumber}}MC# {{carrier.mcNumber}}<br/>{{/if}}
  {{#if carrier.scacCode}}SCAC: {{carrier.scacCode}}<br/>{{/if}}
  {{#if carrier.contactName}}Contact: {{carrier.contactName}}<br/>{{/if}}
  {{#if carrier.contactPhone}}Phone: {{carrier.contactPhone}}<br/>{{/if}}
  {{#if carrier.contactEmail}}Email: {{carrier.contactEmail}}<br/>{{/if}}
</p>

<h2>Shipment Details</h2>
<table>
  <tr>
    <td><strong>Customer:</strong></td>
    <td>{{customer.name}}</td>
  </tr>
  <tr>
    <td><strong>Service Level:</strong></td>
    <td>{{serviceLevel}}</td>
  </tr>
  {{#if equipmentType}}
  <tr>
    <td><strong>Equipment:</strong></td>
    <td>{{equipmentType}}</td>
  </tr>
  {{/if}}
  {{#if pickupDate}}
  <tr>
    <td><strong>Pickup Date:</strong></td>
    <td>{{pickupDate}}</td>
  </tr>
  {{/if}}
  {{#if deliveryDate}}
  <tr>
    <td><strong>Delivery Date:</strong></td>
    <td>{{deliveryDate}}</td>
  </tr>
  {{/if}}
</table>

<h2>Origin</h2>
<p>
  {{shipment.origin.name}}<br/>
  {{shipment.origin.address1}}<br/>
  {{#if shipment.origin.address2}}{{shipment.origin.address2}}<br/>{{/if}}
  {{shipment.origin.city}}, {{shipment.origin.state}} {{shipment.origin.postalCode}}<br/>
  {{shipment.origin.country}}
</p>

<h2>Destination</h2>
<p>
  {{shipment.destination.name}}<br/>
  {{shipment.destination.address1}}<br/>
  {{#if shipment.destination.address2}}{{shipment.destination.address2}}<br/>{{/if}}
  {{shipment.destination.city}}, {{shipment.destination.state}} {{shipment.destination.postalCode}}<br/>
  {{shipment.destination.country}}
</p>

<h2>Agreed Rate</h2>
<table>
  <tr>
    <td><strong>Description</strong></td>
    <td><strong>Amount</strong></td>
  </tr>
  {{#each charges}}
  <tr>
    <td>{{this.description}}</td>
    <td>\${{this.amount}}</td>
  </tr>
  {{/each}}
  <tr>
    <td><strong>Total Carrier Rate</strong></td>
    <td><strong>\${{totalRate}}</strong></td>
  </tr>
</table>

{{#if specialInstructions}}
<h2>Special Instructions</h2>
<p>{{specialInstructions}}</p>
{{/if}}

<h2>Terms</h2>
<p>
  By accepting this load, carrier agrees to the rate and terms outlined above.
  Carrier is responsible for providing appropriate equipment and maintaining
  insurance coverage as required. Payment terms: Net {{paymentTermsDays}} days
  from receipt of signed proof of delivery.
</p>

<div style="margin-top:24px;">
<table>
  <tr>
    <td><strong>Carrier Signature:</strong> ____________________</td>
    <td><strong>Date:</strong> ____________________</td>
  </tr>
</table>
</div>
`;
