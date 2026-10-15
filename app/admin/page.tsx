'use client';

import React, { useEffect, useState } from 'react';
import { Sparkles, Send, CheckCircle2, RefreshCw, Edit3 } from 'lucide-react';

export default function AdminPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/campaigns');
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const authorize = async (id: string, text?: string) => {
    await fetch('/api/admin/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipelineId: id, updatedDraft: text }),
    });
    setItems(prev => prev.filter(i => i.id !== id));
    setEditId(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            5% Operations Console
          </h1>
          <p className="text-xs text-neutral-400">Review staged AI outreach & authorize broadcasts</p>
        </div>
        <button onClick={load} className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg">
          <RefreshCw className={`w-4 h-4 text-neutral-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="text-xs text-neutral-500 font-mono">Loading queue...</p>
        ) : items.length === 0 ? (
          <div className="p-8 bg-neutral-900/40 border border-neutral-850 rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="text-sm font-medium text-neutral-300">Queue Clear</p>
            <p className="text-xs text-neutral-500">No communications pending review</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-400 uppercase">{item.channel}</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING</span>
              </div>
              {editId === item.id ? (
                <textarea
                  value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  className="w-full h-36 bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-xs text-neutral-200 focus:outline-none"
                />
              ) : (
                <p className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed bg-neutral-950 p-3 rounded-lg border border-neutral-850">
                  {item.suggestedDraft}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                {editId === item.id ? (
                  <button
                    onClick={() => authorize(item.id, editDraft)}
                    className="px-3 py-1.5 bg-emerald-500 text-neutral-950 text-xs font-semibold rounded-lg"
                  >
                    Save & Broadcast
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditId(item.id); setEditDraft(item.suggestedDraft); }}
                      className="px-3 py-1.5 bg-neutral-800 text-neutral-300 text-xs rounded-lg flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => authorize(item.id)}
                      className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-950 text-xs font-semibold rounded-lg flex items-center gap-1"
                    >
                      <Send className="w-3 h-3" /> Authorize Broadcast
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
