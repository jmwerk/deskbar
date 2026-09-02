import { settings, type ConfigField, type SettingsContext } from '@bridgething/client/settings';
import { useEffect, useState, type FormEvent, type InputEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

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
          const onInput = (e: InputEvent<HTMLInputElement | HTMLSelectElement>) =>
            setValues({ ...values, [key]: (e.target as HTMLInputElement).value });
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
                <input id={key} type={fieldInputType(field)} value={value} onInput={onInput} />
              )}
            </div>
          );
        })}

        <div className="row">
          <button type="submit">Save settings</button>
          <button type="button" className="secondary" onClick={() => settings.done()}>
            Done
          </button>
        </div>
      </form>

      <p className="status">{status}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Settings />);
