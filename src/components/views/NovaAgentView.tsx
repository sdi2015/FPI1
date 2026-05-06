import { useEffect, useMemo, useState } from 'react';
import { approveNovaTask, createNovaMessage, sendNovaMessage } from '../../data/novaAgentService';
import { novaSuggestedPrompts } from '../../data/novaAgentPrompts';
import { checkNovaHealth, connectToNovaAgent, stopNovaAgent } from '../../data/codePuppyCliBridge';
import type { NovaConnectionState } from '../../data/novaConnectionTypes';
import type { NovaContext, NovaMessage, NovaTaskPlan, NovaTaskStatus } from '../../data/novaAgentTypes';

export type NovaAgentViewProps = {
  context: NovaContext;
  compact?: boolean;
  onClose?: () => void;
  onRestoreFloatingButton?: () => void;
};

const welcomeMessage: NovaMessage = {
  id: 'nova-welcome',
  role: 'nova',
  timestamp: new Date().toISOString(),
  content: 'NOVA is standing by. Activate NOVA to connect to the local Code Puppy CLI bridge or enter clearly labeled demo mode for the FPI walkthrough.',
  sections: [
    {
      title: 'Operating Guardrails',
      items: [
        'I can summarize, explain, and recommend immediately using the active dashboard context.',
        'I will request approval before creating artifacts, assigning work, exporting files, changing data, modifying code, or routing Code Puppy CLI tasks.',
        'If the local bridge is unavailable, NOVA can run in Demo Mode with mock responses and no real CLI execution.',
      ],
    },
  ],
};

export function NovaAgentView({ context, compact = false, onClose, onRestoreFloatingButton }: NovaAgentViewProps) {
  const [messages, setMessages] = useState<NovaMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskPlan, setTaskPlan] = useState<NovaTaskPlan | null>(null);
  const [connection, setConnection] = useState<NovaConnectionState>({
    status: 'offline',
    mode: 'unknown',
    endpoint: 'http://localhost:8787/api/nova/health',
    message: 'NOVA requires the local agent service to be active.',
    manualStartCommand: 'npm run nova:start',
  });

  const feedback = useMemo(() => buildFeedback(taskPlan, context, connection), [taskPlan, context, connection]);
  const novaReady = connection.status === 'online' || connection.status === 'demo';
  const novaConnecting = connection.status === 'connecting';

  useEffect(() => {
    let cancelled = false;
    setConnection((current) => ({ ...current, status: 'connecting', message: 'Checking local NOVA agent bridge...' }));
    checkNovaHealth().then((health) => {
      if (!cancelled) setConnection(health);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function activateNova() {
    setError(null);
    setConnection((current) => ({ ...current, status: 'connecting', message: 'Starting NOVA agent... Connecting to local Code Puppy CLI bridge...' }));
    const nextConnection = await connectToNovaAgent();
    setConnection(nextConnection);
    if (nextConnection.status === 'demo') {
      setMessages((current) => [...current, createNovaMessage('system', 'NOVA activated in Demo Mode. Chat is enabled, but no real Code Puppy CLI bridge is connected and no real automation will run.')]);
    }
  }

  async function disconnectNova() {
    setConnection((current) => ({ ...current, status: 'connecting', message: 'Disconnecting NOVA UI session...' }));
    setConnection(await stopNovaAgent(connection));
  }

  async function submitMessage(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed || loading || !novaReady) return;

    const userMessage = createNovaMessage('user', trimmed);
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await sendNovaMessage({ message: trimmed, context, history: nextHistory });
      setMessages((current) => [...current, response.message]);
      if (response.taskPlan) setTaskPlan(response.taskPlan);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'NOVA could not process the request.');
    } finally {
      setLoading(false);
    }
  }

  async function approveTask() {
    if (!taskPlan || taskPlan.status !== 'awaiting-approval') return;
    setTaskPlan({ ...taskPlan, status: 'running' });
    setError(null);
    try {
      const completedPlan = await approveNovaTask(taskPlan);
      setTaskPlan(completedPlan);
      setMessages((current) => [
        ...current,
        {
          id: `nova-result-${Date.now()}`,
          role: 'nova',
          timestamp: new Date().toISOString(),
          content: completedPlan.status === 'completed' ? 'Approved task completed in demo mode.' : 'Approved task did not complete successfully.',
          taskPlan: completedPlan,
          sections: [
            { title: 'Task Performed', items: [completedPlan.title] },
            { title: 'Result', items: [completedPlan.resultSummary ?? completedPlan.error ?? 'No result summary available.'] },
            { title: 'Follow-Up Needed', items: ['Review the result summary and connect the backend Code Puppy runner before enabling real automation.'] },
          ],
        },
      ]);
    } catch (approvalError) {
      const message = approvalError instanceof Error ? approvalError.message : 'The approved task failed.';
      setError(message);
      setTaskPlan({ ...taskPlan, status: 'failed', error: message });
    }
  }

  function rejectTask() {
    if (!taskPlan) return;
    setTaskPlan({ ...taskPlan, status: 'idle', resultSummary: 'User did not approve execution. No task was run.' });
  }

  return (
    <section className={compact ? 'nova-page nova-page-compact' : 'nova-page'} aria-label="NOVA operational AI assistant">
      <header className="nova-hero">
        <div>
          <p className="nova-eyebrow">NOVA • Operational Intelligence Agent</p>
          <h1>NOVA Command Intelligence</h1>
          <p>Embedded FPI assistant for dashboard explanation, store-risk summaries, remediation planning, report drafting, and controlled Code Puppy task preparation.</p>
        </div>
        <div className="nova-hero-status">
          <span>STATUS</span>
          <strong>{connection.status === 'online' ? 'NOVA Online' : connection.status === 'demo' ? 'NOVA Online — Demo Mode' : connection.status === 'connecting' ? 'NOVA Connecting' : connection.status === 'error' ? 'NOVA Error' : 'NOVA Offline'}</strong>
          <small>{connection.mode === 'live-cli' ? 'Connected to Code Puppy CLI' : connection.mode === 'demo' ? 'Demo Mode' : 'Not Connected'}</small>
        </div>
        <div className="nova-header-actions">
          {onRestoreFloatingButton ? <button type="button" className="nova-secondary-button" onClick={onRestoreFloatingButton}>Show NOVA Assistant</button> : null}
          {onClose ? <button type="button" className="nova-close" onClick={onClose} aria-label="Close NOVA chat">×</button> : null}
        </div>
      </header>

      <NovaConnectionPanel connection={connection} onActivate={activateNova} onDisconnect={disconnectNova} />

      <div className="nova-grid">
        <section className="nova-card nova-chat-panel" aria-label="NOVA chat panel">
          <div className="nova-card-heading">
            <div>
              <p className="nova-eyebrow">Chat Panel</p>
              <h2>Ask NOVA</h2>
            </div>
            <button type="button" className="nova-secondary-button" onClick={() => { setMessages([welcomeMessage]); setTaskPlan(null); setError(null); }}>Clear Conversation</button>
          </div>

          <div className="nova-suggested-prompts" aria-label="Suggested NOVA prompts">
            {novaSuggestedPrompts.map((prompt) => (
              <button type="button" key={prompt} onClick={() => submitMessage(prompt)} disabled={!novaReady || novaConnecting}>{prompt}</button>
            ))}
          </div>

          <div className="nova-conversation" aria-live="polite">
            {messages.map((message) => <NovaMessageBubble message={message} key={message.id} />)}
            {loading ? <div className="nova-thinking"><span />NOVA is reviewing dashboard context...</div> : null}
            {error ? <div className="nova-error" role="alert">{error}</div> : null}
          </div>

          <form className="nova-input-row" onSubmit={(event) => { event.preventDefault(); submitMessage(input); }}>
            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={novaReady ? 'Ask NOVA about posture, stores, charts, vendors, remediation, or task plans...' : 'Activate NOVA to enable the AI agent for this demo...'} disabled={!novaReady || novaConnecting} />
            <button type="submit" disabled={loading || !input.trim() || !novaReady || novaConnecting}>Send</button>
          </form>
        </section>

        <aside className="nova-side-stack">
          <ContextPanel context={context} />
          <TaskExecutionPanel taskPlan={taskPlan} onApprove={approveTask} onReject={rejectTask} />
          <FeedbackPanel feedback={feedback} />
        </aside>
      </div>
    </section>
  );
}

function NovaConnectionPanel({ connection, onActivate, onDisconnect }: { connection: NovaConnectionState; onActivate: () => void; onDisconnect: () => void }) {
  const ready = connection.status === 'online' || connection.status === 'demo';
  const connecting = connection.status === 'connecting';
  return (
    <section className={`nova-connection-card status-${connection.status}`} aria-label="NOVA connection status">
      <div className="nova-connection-main">
        <span className="nova-connection-dot" />
        <div>
          <p className="nova-eyebrow">Agent Connection</p>
          <h2>{connection.status === 'online' ? 'NOVA Online' : connection.status === 'demo' ? 'NOVA Online — Demo Mode' : connection.status === 'connecting' ? 'NOVA Connecting' : connection.status === 'error' ? 'NOVA Error' : 'NOVA Offline / Not Connected'}</h2>
          <p>{connecting ? 'Starting NOVA agent... Connecting to local Code Puppy CLI bridge...' : connection.message}</p>
        </div>
      </div>
      <div className="nova-connection-actions">
        {!ready ? <button type="button" className="nova-activate-button" onClick={onActivate} disabled={connecting}>{connecting ? 'Connecting...' : 'Activate NOVA'}</button> : null}
        {ready ? <button type="button" className="nova-activate-button online" disabled><span />NOVA Online</button> : null}
        {ready ? <button type="button" className="nova-secondary-button" onClick={onActivate}>Restart NOVA</button> : <button type="button" className="nova-secondary-button" onClick={onActivate} disabled={connecting}>Reconnect</button>}
        {ready ? <button type="button" className="nova-secondary-button" onClick={onDisconnect}>Disconnect UI</button> : null}
      </div>
      {connecting ? <div className="nova-connection-progress"><span />Connecting to local Code Puppy CLI bridge...</div> : null}
      <details className="nova-connection-details">
          <summary>View Connection Details</summary>
          <div>
            <ContextRow label="Connection Status" value={connection.status} />
            <ContextRow label="Endpoint Used" value={connection.endpoint} />
            <ContextRow label="Last Health Check" value={connection.lastHealthCheck ? formatTime(connection.lastHealthCheck) : 'Not checked'} />
            <ContextRow label="Current Mode" value={connection.mode} />
            <ContextRow label="Manual Startup" value={connection.manualStartCommand} />
            {connection.error ? <ContextRow label="Error Details" value={connection.error} /> : null}
          </div>
          <p>NOVA could not start automatically if the local bridge is unavailable. Open a terminal and run <code>{connection.manualStartCommand}</code>, then click Reconnect. Demo Mode never performs real CLI execution.</p>
        </details>
    </section>
  );
}

function NovaMessageBubble({ message }: { message: NovaMessage }) {
  return (
    <article className={`nova-message nova-message-${message.role}`}>
      <div className="nova-message-meta"><strong>{message.role === 'user' ? 'You' : 'NOVA'}</strong><span>{formatTime(message.timestamp)}</span></div>
      <p>{message.content}</p>
      {message.sections?.map((section) => (
        <div className="nova-response-section" key={section.title}>
          <h3>{section.title}</h3>
          <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ))}
    </article>
  );
}

function ContextPanel({ context }: { context: NovaContext }) {
  return (
    <section className="nova-card nova-context-panel" aria-label="NOVA active context">
      <div className="nova-card-heading"><div><p className="nova-eyebrow">Context Panel</p><h2>Active FPI Context</h2></div></div>
      <div className="nova-context-list">
        <ContextRow label="Active Module" value={context.activeModule} />
        <ContextRow label="Current Scope" value={context.selectedScope} />
        <ContextRow label="Selected Stores" value={context.selectedStoreIds.length > 0 ? context.selectedStoreIds.join(', ') : 'Scope-driven / all visible'} />
        <ContextRow label="Selected Filters" value={context.selectedFilters.join(' • ')} />
        <ContextRow label="Portfolio Posture" value={context.portfolioPosture} />
      </div>
      <div className="nova-signal-grid">
        {[...context.kpis, ...context.riskSignals].slice(0, 8).map((signal) => <SignalPill key={signal.label} label={signal.label} value={signal.value} tone={signal.tone} />)}
      </div>
      <div className="nova-top-stores">
        <h3>Stores in NOVA focus</h3>
        {context.topStores.length > 0 ? context.topStores.slice(0, 5).map((store) => (
          <article key={store.id}>
            <strong>{store.id}</strong>
            <span>{store.name} • {store.location}</span>
            <em>{store.riskLevel ?? 'Unrated'} {store.riskScore ?? ''}</em>
          </article>
        )) : <p>No store-level context available in the current scope.</p>}
      </div>
    </section>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function SignalPill({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <span className={`nova-signal-pill tone-${tone}`}><small>{label}</small><strong>{value}</strong></span>;
}

function TaskExecutionPanel({ taskPlan, onApprove, onReject }: { taskPlan: NovaTaskPlan | null; onApprove: () => void; onReject: () => void }) {
  const status = taskPlan?.status ?? 'idle';
  return (
    <section className="nova-card nova-task-panel" aria-label="NOVA task execution panel">
      <div className="nova-card-heading"><div><p className="nova-eyebrow">Task Execution</p><h2>Approval Workflow</h2></div><TaskStatusBadge status={status} /></div>
      {taskPlan ? (
        <>
          <h3>{taskPlan.title}</h3>
          <p>{taskPlan.approvalReason ?? 'Task plan generated.'}</p>
          <ol>{taskPlan.steps.map((step) => <li key={step}>{step}</li>)}</ol>
          <div className="nova-task-actions">
            <button type="button" onClick={onApprove} disabled={taskPlan.status !== 'awaiting-approval'}>Approve Task</button>
            <button type="button" onClick={onReject} disabled={taskPlan.status !== 'awaiting-approval'}>Do Not Run</button>
          </div>
          {taskPlan.resultSummary ? <p className="nova-task-result">{taskPlan.resultSummary}</p> : null}
          {taskPlan.error ? <p className="nova-error">{taskPlan.error}</p> : null}
        </>
      ) : <p>No controlled task is staged. Ask NOVA to draft, export, assign, modify, or run Code Puppy and it will create an approval-required plan.</p>}
    </section>
  );
}

function TaskStatusBadge({ status }: { status: NovaTaskStatus }) {
  return <span className={`nova-task-status status-${status}`}>{status.replace('-', ' ')}</span>;
}

function FeedbackPanel({ feedback }: { feedback: Array<{ title: string; value: string }> }) {
  return (
    <section className="nova-card nova-feedback-panel" aria-label="NOVA feedback and results panel">
      <div className="nova-card-heading"><div><p className="nova-eyebrow">Feedback / Results</p><h2>Operational Readout</h2></div></div>
      <div className="nova-feedback-list">
        {feedback.map((item) => <article key={item.title}><span>{item.title}</span><p>{item.value}</p></article>)}
      </div>
    </section>
  );
}

function buildFeedback(taskPlan: NovaTaskPlan | null, context: NovaContext, connection: NovaConnectionState): Array<{ title: string; value: string }> {
  return [
    { title: 'Agent connection', value: `${connection.status.toUpperCase()} • ${connection.mode}. ${connection.mode === 'demo' ? 'Demo responses are enabled; real CLI execution is not connected.' : connection.message}` },
    { title: 'What NOVA reviewed', value: `${context.activeModule}, ${context.selectedScope}, ${context.kpis.length} KPI signals, ${context.riskSignals.length} risk signals, and ${context.topStores.length} ranked stores.` },
    { title: 'What NOVA found', value: context.relevantAlerts.length > 0 ? context.relevantAlerts.map((alert) => `${alert.label}: ${alert.value}`).join(' • ') : 'No watch/critical alerts in the current NOVA context.' },
    { title: 'What NOVA prepared', value: taskPlan ? `${taskPlan.title} is ${taskPlan.status}.` : 'No task artifact has been prepared yet.' },
    { title: 'What still needs attention', value: 'Connect the real backend/Code Puppy task runner before enabling production automation. Keep approval gates enabled for all changes, exports, and assignments.' },
    { title: 'Recommended next steps', value: 'Ask for a store-level risk brief, remediation plan, vendor recommendation, or executive summary using the active dashboard scope.' },
  ];
}

function formatTime(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Now';
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
}
