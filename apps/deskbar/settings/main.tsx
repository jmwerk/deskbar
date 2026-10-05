import { settings, type ConfigField, type SettingsContext } from '@bridgething/client/settings';
import { useEffect, useState, type FormEvent, type InputEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { normalizeJiraUrl } from '../src/jiraUrl';
import './style.css';

const TOKEN_PAGE = 'https://id.atlassian.com/manage-profile/security/api-tokens';

function fieldHint(key: string): ReactNode {
  if (key === 'jiraApiToken') {
    return (
      <>
        Create one at{' '}
        <a href={TOKEN_PAGE} target="_blank" rel="noreferrer">
          {TOKEN_PAGE}
        </a>
      </>
    );
  }
  return null;
}

function utf8ToBase64(input: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(input)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function statusAdvice(status: number): string {
  if (status === 401 || status === 403) return ' Check the email and API token.';
  if (status === 404) return ' Check the site URL.';
  return '';
}

/** Checks the form's current values, saved or not, against Jira. */
async function testConnection(values: Record<string, string>): Promise<string> {
  const base = normalizeJiraUrl(values.jiraBaseUrl ?? '');
  const email = (values.jiraEmail ?? '').trim();
  const token = (values.jiraApiToken ?? '').trim();
  if (!base || !email || !token) return 'Fill in the Jira site URL, email and API token first.';
  let res: Response;
  try {
    res = await settings.fetch(`${base}/rest/api/3/myself`, {
      headers: { Authorization: `Basic ${utf8ToBase64(`${email}:${token}`)}`, Accept: 'application/json' },
      timeoutMs: 15000,
    });
  } catch (err) {
    return `Couldn't reach ${base}: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (!res.ok) return `Jira turned it down (HTTP ${res.status}).${statusAdvice(res.status)}`;
  const me = (await res.json()) as { displayName: string };
  return `Connected to Jira as ${me.displayName}.`;
}

function fieldMeta(field: ConfigField): { key: string; label: string } {
  return { key: field.data.key, label: field.data.label };
}

function fieldInputType(field: ConfigField): 'number' | 'password' | 'text' {
  if (field.type === 'number') return 'number';
  if (field.type === 'secret') return 'password';
  return 'text';
}

function Settings() {
  const [ctx, setCtx] = useState<SettingsContext | null>(null);
  const [fields, setFields] = useState<ConfigField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);

  async function runTest() {
    setTesting(true);
    setTestResult('Testing…');
    setTestResult(await testConnection(values));
    setTesting(false);
  }

  useEffect(() => {
    (async () => {
      try {
        setCtx(await settings.context());
        const [schema, entries] = await Promise.all([settings.config.fields(), settings.config.list()]);
        setFields(schema);
        setValues(Object.fromEntries(entries.map(e => [e.key, e.value])));
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('saving...');
    try {
      for (const field of fields) {
        const { key } = fieldMeta(field);
        await settings.config.set(key, values[key] ?? '');
      }
      setStatus('settings saved');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main>
      <h1>{ctx?.name ?? 'Deskbar'} settings</h1>
      <p className="hint">{ctx ? `${ctx.webappId} on ${ctx.deviceId}` : 'connecting to the companion host...'}</p>

      <form onSubmit={saveConfig}>
        {fields.length === 0 && <p className="hint">this webapp declares no config fields yet.</p>}
        {fields.map(field => {
          const { key, label } = fieldMeta(field);
          const value = values[key] ?? '';
          const hint = fieldHint(key);
          const onInput = (e: InputEvent<HTMLInputElement | HTMLSelectElement>) =>
            setValues({ ...values, [key]: (e.target as HTMLInputElement).value });
          // A pasted issue or board link becomes the site address as soon as the field is left.
          const onBlur =
            key === 'jiraBaseUrl' ? () => setValues(v => ({ ...v, [key]: normalizeJiraUrl(v[key] ?? '') })) : undefined;
          return (
            <div className="field" key={key}>
              <label htmlFor={key}>{label}</label>
              {field.type === 'enum' ? (
                <select id={key} value={value} onInput={onInput}>
                  {field.data.choices.map(choice => (
                    <option value={choice} key={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              ) : (
                <input id={key} type={fieldInputType(field)} value={value} onInput={onInput} onBlur={onBlur} />
              )}
              {hint && <p className="field-hint">{hint}</p>}
            </div>
          );
        })}

        <div className="row">
          <button type="button" className="secondary" disabled={testing} onClick={() => void runTest()}>
            Test connection
          </button>
          <span className="test-result" role="status">
            {testResult}
          </span>
        </div>

        <div className="row">
          <button type="submit">Save settings</button>
          <button type="button" className="secondary" onClick={() => settings.done()}>
            Done
          </button>
        </div>
      </form>

      <p className="status" role="status">
        {status}
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Settings />);
