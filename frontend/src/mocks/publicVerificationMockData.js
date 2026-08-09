/**
 * publicVerificationMockData.js
 *
 * MOCK DATA
 * Replace with real MCA/GST/PAN registry API integration when one exists.
 *
 * No such integration exists today, and — for PAN and GST specifically —
 * neither does the underlying data: src/extraction/schema.py's Company model
 * has no `pan` or `gst_number` column, so there is nothing real to even
 * submit for those two fields. Company Name and CIN *are* real (Company.name
 * / Company.cin, now returned by GET /api/auth/me) and are used as the
 * "submitted" value for those two entries — only their "registry" match is
 * mocked. PAN and GST are mocked end-to-end.
 */

export function buildMockRegistryData({ companyName, cin }) {
  return {
    companyName: {
      submitted: companyName || 'Unknown Company',
      registry: companyName || 'Unknown Company',
      status: 'matched',
    },
    cin: {
      submitted: cin || 'Not on file',
      registry: cin || 'Not on file',
      status: cin ? 'matched' : 'mismatch',
    },
    pan: {
      submitted: 'AABCN1234F',
      registry: 'AABCN1234F',
      status: 'matched',
    },
    // Deliberately mismatched (last digit) so the widget demonstrates both
    // states, matching the reference spec's own example.
    gst: {
      submitted: '27AABCN1234F1Z5',
      registry: '27AABCN1234F1Z9',
      status: 'mismatch',
    },
  };
}
