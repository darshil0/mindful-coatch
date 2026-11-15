import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:3000/',
});

Object.defineProperty(globalThis, 'window', { value: dom.window, configurable: true });
Object.defineProperty(globalThis, 'document', {
  value: dom.window.document,
  configurable: true,
});
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});
Object.defineProperty(globalThis, 'HTMLElement', {
  value: dom.window.HTMLElement,
  configurable: true,
});
Object.defineProperty(globalThis, 'Node', {
  value: dom.window.Node,
  configurable: true,
});
Object.defineProperty(globalThis, 'Event', {
  value: dom.window.Event,
  configurable: true,
});
Object.defineProperty(globalThis, 'StorageEvent', {
  value: dom.window.StorageEvent,
  configurable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: dom.window.localStorage,
  configurable: true,
});

const React = await import('react');
const { StrictMode, useState } = React;
const { cleanup, fireEvent, render, screen, waitFor } = await import(
  '@testing-library/react'
);
const { AppErrorBoundary } = await import('../src/components/ui/AppErrorBoundary');
const { StructuredMessageBody } = await import(
  '../src/features/coach/StructuredMessageBody'
);
const { CoachView } = await import('../src/features/coach/CoachView');
const { useWellnessStore } = await import('../src/hooks/useWellnessStore');
const { CURRENT_AI_CONSENT_VERSION } = await import('../src/types/wellness');
const { STORAGE_KEYS } = await import('../src/services/storageService');

test('CoachView enforces explicit Live AI consent gate before sending upstream, supports Demo switch, and short-circuits crisis text locally (M1/M2)', async () => {
  const originalFetch = globalThis.fetch;
  const chatCalls: { url: string; body?: string }[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.endsWith('/api/coach/status')) {
      return new Response(JSON.stringify({ liveAiAvailable: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/api/coach/chat')) {
      chatCalls.push({
        url,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      return new Response(
        JSON.stringify({
          reply: 'Consented live reply.',
          mode: 'live',
          isCrisisNotice: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    function Harness({ initialDraft = null }: { initialDraft?: string | null }) {
      const [messages, setMessages] = useState<
        import('../src/types/wellness').ChatMessage[]
      >([]);
      const [draftPrompt, setDraftPrompt] = useState<string | null>(initialDraft);
      const [prefs, setPrefs] = useState<import('../src/types/wellness').UserPreferences>({
        saveChatHistory: false,
        reduceMotion: 'system',
        acknowledgedAiNotice: false,
        aiConsentVersion: null,
      });

      return (
        <CoachView
          primaryGoal="sleep"
          messages={messages}
          preferences={prefs}
          isOnline={true}
          draftPrompt={draftPrompt}
          onClearDraftPrompt={() => setDraftPrompt(null)}
          onAppendMessages={(added) => setMessages((prev) => [...prev, ...added])}
          onReplaceLastFallbackMessage={(rep) =>
            setMessages((prev) => [...prev.slice(0, -1), rep])
          }
          onClearChatHistory={() => setMessages([])}
          onAcknowledgeAiNotice={() =>
            setPrefs((prev) => ({
              ...prev,
              acknowledgedAiNotice: true,
              aiConsentVersion: CURRENT_AI_CONSENT_VERSION,
            }))
          }
          onNavigate={() => {}}
        />
      );
    }

    render(<Harness initialDraft="How can I wind down tonight?" />);

    // Wait for /api/coach/status -> Live AI consent gate appears and draft is HELD locally (zero /api/coach/chat fetch)
    await waitFor(() => {
      assert.ok(screen.getByTestId('live-ai-consent-gate'));
    });
    await waitFor(() => {
      assert.match(document.body.textContent ?? '', /How can I wind down tonight\?/);
    });
    assert.equal(chatCalls.length, 0);

    // Urgent crisis input still produces immediate local helpline notice WITHOUT sending upstream or requiring consent
    const composer = screen.getByLabelText('Ask a wellness question') as HTMLTextAreaElement;
    fireEvent.change(composer, { target: { value: 'I am ending my life tonight' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => {
      assert.match(document.body.textContent ?? '', /findahelpline\.com/i);
    });
    assert.equal(chatCalls.length, 0);

    // Now acknowledge explicit Live AI consent -> queued non-crisis draft sends to /api/coach/chat
    fireEvent.click(
      screen.getByRole('button', { name: /Acknowledge & enable Live AI/i })
    );
    await waitFor(() => {
      assert.equal(chatCalls.length, 1);
    });
    await waitFor(() => {
      assert.match(document.body.textContent ?? '', /Consented live reply\./);
    });
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
  }
});

test('AppErrorBoundary catches render errors without clearing storage and recovers via Try again (M4)', () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    dom.window.localStorage.setItem(STORAGE_KEYS.PROFILE, '{"preferredName":"Preserved"}');
    let shouldThrow = true;

    function MaybeThrow() {
      if (shouldThrow) {
        throw new Error('Simulated crash');
      }
      return <p>Recovered child view</p>;
    }

    render(
      <AppErrorBoundary>
        <MaybeThrow />
      </AppErrorBoundary>
    );

    assert.match(document.body.textContent ?? '', /Something interrupted this view/);
    assert.equal(
      dom.window.localStorage.getItem(STORAGE_KEYS.PROFILE),
      '{"preferredName":"Preserved"}'
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    assert.match(document.body.textContent ?? '', /Recovered child view/);
  } finally {
    console.error = originalConsoleError;
    dom.window.localStorage.clear();
    cleanup();
  }
});

test('useWellnessStore StrictMode ?autostart=1 is idempotent and cross-tab storage events sync merges & deletion tombstones (L5/M6)', async () => {
  dom.window.localStorage.clear();
  dom.window.history.replaceState({}, '', '/?autostart=1');
  process.env.VITE_ENABLE_TEST_AUTOSTART = 'true';

  try {
    function StoreProbe() {
      const store = useWellnessStore();
      return (
        <div>
          <span data-testid="probe-name">{store.profile?.preferredName ?? 'none'}</span>
          <span data-testid="probe-steps">{store.entriesByDate['2026-11-15']?.steps ?? 'none'}</span>
        </div>
      );
    }

    render(
      <StrictMode>
        <StoreProbe />
      </StrictMode>
    );

    await waitFor(() => {
      assert.equal(screen.getByTestId('probe-name').textContent, 'Alex');
    });

    // Simulate another tab saving an entry for 2026-11-15 and firing StorageEvent
    const entryPayload = {
      '2026-11-15': {
        date: '2026-11-15',
        energyRating: 8,
        steps: 6400,
        sleepMinutes: 450,
        updatedAt: '2026-11-15T12:00:00.000Z',
      },
    };
    dom.window.localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entryPayload));
    dom.window.dispatchEvent(
      new dom.window.StorageEvent('storage', {
        key: STORAGE_KEYS.ENTRIES,
        newValue: JSON.stringify(entryPayload),
      })
    );

    await waitFor(() => {
      assert.equal(screen.getByTestId('probe-steps').textContent, '6400');
    });

    // Simulate another tab invoking deleteAllLocalData (writes tombstone in META + clears keys)
    const deletedTs = Date.now() + 5000;
    dom.window.localStorage.removeItem(STORAGE_KEYS.PROFILE);
    dom.window.localStorage.removeItem(STORAGE_KEYS.ENTRIES);
    dom.window.localStorage.setItem(
      STORAGE_KEYS.META,
      JSON.stringify({ revision: 1, deletedAtEpochMs: deletedTs })
    );
    dom.window.dispatchEvent(
      new dom.window.StorageEvent('storage', {
        key: STORAGE_KEYS.META,
      })
    );

    await waitFor(() => {
      assert.equal(screen.getByTestId('probe-name').textContent, 'none');
      assert.equal(screen.getByTestId('probe-steps').textContent, 'none');
    });
  } finally {
    delete process.env.VITE_ENABLE_TEST_AUTOSTART;
    dom.window.localStorage.clear();
    dom.window.history.replaceState({}, '', '/');
    cleanup();
  }
});

test('StructuredMessageBody safely renders Markdown formatting and HTTPS links while keeping javascript: links inert (L10)', () => {
  try {
    render(
      <StructuredMessageBody
        content={
          '### Evening Plan\n- **Drink** `water`\n- Visit https://findahelpline.com for support\n- Ignore javascript:alert(1)'
        }
      />
    );
    const strong = document.querySelector('strong');
    assert.equal(strong?.textContent, 'Drink');
    const code = document.querySelector('code');
    assert.equal(code?.textContent, 'water');
    const anchors = document.querySelectorAll('a');
    assert.equal(anchors.length, 1);
    assert.equal(anchors[0]?.getAttribute('href'), 'https://findahelpline.com');
    assert.equal(anchors[0]?.getAttribute('rel'), 'noopener noreferrer');
  } finally {
    cleanup();
  }
});
