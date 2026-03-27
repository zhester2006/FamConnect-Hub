import React, { useState } from 'react';

export function PinModal({ members, onSubmit, onCancel }) {
  const [selected, setSelected] = useState('');
  const [pin, setPin] = useState('');

  const options = [];
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    options.push(
      <option key={m.user_id} value={m.user_id}>
        {m.name} ({m.role})
      </option>
    );
  }

  return (
    <div className="bg-slate-800/90 border border-violet-500/30 rounded-xl p-3 mb-3">
      <p className="text-xs text-violet-300 font-bold mb-2">Who is making this request?</p>
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mb-2"
        data-testid="pixie-pin-select"
      >
        <option value="">Select family member...</option>
        {options}
      </select>
      {selected && (
        <div>
          <input
            type="password"
            placeholder="Enter PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            maxLength={6}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mb-2"
            data-testid="pixie-pin-input"
          />
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 text-xs bg-slate-700 text-white py-2 rounded-lg">
              Cancel
            </button>
            <button
              onClick={() => onSubmit(selected, pin)}
              disabled={!pin}
              className="flex-1 text-xs bg-violet-600 text-white py-2 rounded-lg disabled:opacity-50"
              data-testid="pixie-pin-submit"
            >
              Verify & Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
