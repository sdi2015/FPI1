import { useMemo, useState } from 'react';
import { downloadAviationTravelRiskReportHtml, getRiskBadgeClass, prepareAviationTravelRiskEmail, renderAviationTravelRiskReportHtml, renderAviationTravelRiskReportText, validateAviationTravelRiskReport, type AviationTravelRiskReportPayload } from '../../services/aviationTravelRiskReportService';

export function AviationTravelRiskReportPanel({ payload }: { payload: AviationTravelRiskReportPayload }) {
  const [generated, setGenerated] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const validation = useMemo(() => validateAviationTravelRiskReport(payload), [payload]);
  const html = useMemo(() => renderAviationTravelRiskReportHtml(payload), [payload]);
  const text = useMemo(() => renderAviationTravelRiskReportText(payload), [payload]);
  const riskBand = payload.scanHasRun ? payload.risk.band : 'Pending';

  async function copyPlainText() {
    await navigator.clipboard.writeText(text);
    setCopiedMessage('Plain-text report copied.');
  }

  async function copyHtml() {
    await navigator.clipboard.writeText(html);
    setCopiedMessage('HTML report copied. Paste into Outlook/Gmail/Teams where supported.');
  }

  function printReport() {
    const host = document.createElement('div');
    host.id = 'aviation-report-print-host';
    host.innerHTML = html;
    document.body.appendChild(host);
    document.body.classList.add('aviation-report-printing');
    const cleanup = () => {
      document.body.classList.remove('aviation-report-printing');
      host.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 50);
  }

  return (
    <section className="panel aviation-panel aviation-report-panel">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Report</p>
          <h2>Aviation Travel Risk Report</h2>
          <p className="aviation-caveat">Generate a color-coded executive-ready report for email, print, and leadership review.</p>
        </div>
        <span className={getRiskBadgeClass(riskBand)}>{riskBand}</span>
      </div>

      {payload.isDemo ? <p className="aviation-report-demo-label">Demo dataset - not for operational use.</p> : null}
      {!validation.canGenerate ? <section className="aviation-report-validation"><strong>Report prerequisites</strong>{validation.messages.map((message) => <p key={message}>{message}</p>)}</section> : null}

      <div className="report-action-bar no-print">
        <button type="button" className="ops-action-button" disabled={!validation.canGenerate} onClick={() => setGenerated(true)}>Generate Report</button>
        <button type="button" className="ops-action-button secondary" disabled={!generated} onClick={copyPlainText}>Copy Plain Text</button>
        <button type="button" className="ops-action-button secondary" disabled={!generated} onClick={copyHtml}>Copy HTML</button>
        <button type="button" className="ops-action-button secondary" disabled={!generated} onClick={() => downloadAviationTravelRiskReportHtml(payload)}>Download HTML</button>
        <button type="button" className="ops-action-button secondary" disabled={!generated} onClick={printReport}>Print / Save PDF</button>
        <button type="button" className="ops-action-button secondary" disabled={!generated} onClick={() => prepareAviationTravelRiskEmail(payload)}>Prepare Email</button>
      </div>
      {copiedMessage ? <p className="aviation-caveat">{copiedMessage}</p> : null}
      <p className="aviation-caveat">Use Copy Report or Download HTML to attach or paste the full formatted report.</p>

      {generated ? <ReportPreview html={html} /> : <section className="aviation-report-preview aviation-report-empty"><p className="aviation-empty">Generate the report to preview the color-coded executive-ready output.</p></section>}
    </section>
  );
}

function ReportPreview({ html }: { html: string }) {
  return <section className="aviation-report-preview" dangerouslySetInnerHTML={{ __html: html.replace(/^<!doctype html><html><head>[\s\S]*?<body>/i, '').replace(/<\/body><\/html>$/i, '') }} />;
}
