import { useEffect, useMemo, useState } from 'react';
import { checkNovaHealth, connectToNovaAgent } from '../data/codePuppyCliBridge';
import { createNovaMessage, sendNovaMessage } from '../data/novaAgentService';
import type { NovaConnectionState } from '../data/novaConnectionTypes';
import type { NovaContext, NovaMessage } from '../data/novaAgentTypes';

const floatingPrompts = ['Summarize posture', 'Show high-risk stores', 'Review Fire & Life Safety', 'Recommend actions'];

const initialConnection: NovaConnectionState = {
  status: 'offline',
  mode: 'unknown',
  endpoint: 'http://localhost:8787/api/nova/health',
  message: 'NOVA requires the local agent service to be active.',
  manualStartCommand: 'npm run nova:start',
};

const welcomeMessage: NovaMessage = {
  id: 'floating-nova-welcome',
  role: 'nova',
  timestamp: new Date().toISOString(),
  content: 'Hi, I’m NOVA. I can help summarize FPI risk, explain store issues, and prepare next actions.',
};

export type FloatingNovaAssistantProps = {
  context: NovaContext;
  open: boolean;
  dismissed: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDismiss: () => void;
};

export function FloatingNovaAssistant({ context, open, dismissed, onOpen, onClose, onDismiss }: FloatingNovaAssistantProps) {
  const [connection, setConnection] = useState<NovaConnectionState>(initialConnection);
  const [messages, setMessages] = useState<NovaMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = connection.status === 'online' || connection.status === 'demo';
  const statusLabel = useMemo(() => {
    if (connection.status === 'online') return 'Online';
    if (connection.status === 'demo') return 'Demo';
    if (connection.status === 'connecting') return 'Connecting';
    if (connection.status === 'error') return 'Error';
    return 'Offline';
  }, [connection.status]);

  useEffect(() => {
    let cancelled = false;
    checkNovaHealth().then((health) => {
      if (!cancelled) setConnection(health);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed) return null;

  async function activateNova() {
    setError(null);
    setConnection((current) => ({ ...current, status: 'connecting', message: 'Connecting to local Code Puppy CLI bridge...' }));
    const nextConnection = await connectToNovaAgent();
    setConnection(nextConnection);
  }

  async function submitMessage(messageText: string) {
    const trimmed = messageText.trim();
    if (!trimmed || sending || !ready) return;

    const userMessage = createNovaMessage('user', trimmed);
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const response = await sendNovaMessage({ message: trimmed, context, history: nextHistory });
      setMessages((current) => [...current, response.message]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'NOVA could not process the request.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="nova-floating-wrap">
      {open ? (
        <section className="nova-chat-widget" aria-label="NOVA compact chat">
          <header className="nova-widget-header">
            <div>
              <p>NOVA</p>
              <span className={`nova-widget-status status-${connection.status}`}>{statusLabel}</span>
            </div>
            <button type="button" onClick={onClose} aria-label="Close NOVA chat">×</button>
          </header>

          <div className="nova-widget-body">
            <p className="nova-widget-welcome">Hi, I’m NOVA. I can help summarize FPI risk, explain store issues, and prepare next actions.</p>
            {!ready ? (
              <div className="nova-widget-offline">
                <strong>NOVA is offline.</strong>
                <span>Activate NOVA to start.</span>
                <button type="button" onClick={activateNova} disabled={connection.status === 'connecting'}>{connection.status === 'connecting' ? 'Connecting...' : 'Activate NOVA'}</button>
              </div>
            ) : null}
            <div className="nova-widget-messages" aria-live="polite">
              {messages.map((message) => <CompactMessage message={message} key={message.id} />)}
              {sending ? <div className="nova-widget-thinking">NOVA is reviewing context...</div> : null}
              {error ? <div className="nova-widget-error" role="alert">{error}</div> : null}
            </div>
            <div className="nova-widget-prompts" aria-label="Suggested NOVA prompts">
              {floatingPrompts.map((prompt) => (
                <button type="button" key={prompt} onClick={() => submitMessage(prompt)} disabled={!ready || sending}>{prompt}</button>
              ))}
            </div>
          </div>

          <form className="nova-widget-footer" onSubmit={(event) => { event.preventDefault(); submitMessage(input); }}>
            <input value={input} onChange={(event) => setInput(event.target.value)} disabled={!ready || sending} placeholder={ready ? 'Ask NOVA...' : 'Activate NOVA to start'} />
            <button type="submit" disabled={!ready || sending || !input.trim()}>Send</button>
          </form>
        </section>
      ) : null}

      <button type="button" className="nova-floating-button" onClick={onOpen} aria-label="Open NOVA assistant">
        <span className="nova-floating-orb" aria-hidden="true">✦</span>
        <span className="nova-floating-copy"><strong>Ask NOVA</strong><small>{statusLabel}</small></span>
        <span className={`nova-floating-status status-${connection.status}`} aria-hidden="true" />
        <span
          role="button"
          tabIndex={0}
          className="nova-floating-dismiss"
          aria-label="Dismiss Ask NOVA button"
          onClick={(event) => { event.stopPropagation(); onDismiss(); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              onDismiss();
            }
          }}
        >×</span>
      </button>
    </div>
  );
}

function CompactMessage({ message }: { message: NovaMessage }) {
  const previewItems = message.sections?.slice(0, 2).flatMap((section) => section.items.slice(0, 2)) ?? [];
  return (
    <article className={`nova-widget-message nova-widget-message-${message.role}`}>
      <strong>{message.role === 'user' ? 'You' : 'NOVA'}</strong>
      <p>{message.content}</p>
      {previewItems.length > 0 ? <ul>{previewItems.map((item) => <li key={item}>{item}</li>)}</ul> : null}
    </article>
  );
}
