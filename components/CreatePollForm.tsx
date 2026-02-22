"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface CreatePollFormProps {
  onPollCreated: () => void;
}

const OPTION_COLORS = [
  { name: '赤', class: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
  { name: '青', class: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-500' },
  { name: '緑', class: 'bg-green-500', border: 'border-green-500', text: 'text-green-500' },
  { name: '黄', class: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-500' },
  { name: '紫', class: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-500' },
];

export default function CreatePollForm({ onPollCreated }: CreatePollFormProps) {
  // デフォルトで24時間後の日時を設定
  const getDefaultExpiresAt = () => {
    const now = new Date();
    now.setHours(now.getHours() + 24);
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [question, setQuestion] = useState("");
  // 初期状態は2つの選択肢
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [expiresAt, setExpiresAt] = useState(getDefaultExpiresAt());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    if (options.length < 5) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || options.some(opt => !opt.trim()) || !expiresAt) {
      setError("すべての項目を入力してください");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 選択肢データを構築
      const optionsData = options.map((label, index) => ({
        label,
        votes: 0,
        color: OPTION_COLORS[index].class
      }));

      const { error } = await supabase
        .from("polls")
        .insert([
          {
            question,
            options: optionsData,
            // 既存カラムへの互換性のためダミーデータを入れる場合もあるが、
            // RPC実行済と仮定して options カラムのみに注力する
            // もし NOT NULL 制約が残っているとエラーになるため、API側で対処済み前提
            expires_at: new Date(expiresAt).toISOString(),
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      // 入力欄クリア
      setQuestion("");
      setOptions(["", ""]);
      setExpiresAt(getDefaultExpiresAt());
      setIsOpen(false);
      
      // 親コンポーネントに更新を通知
      onPollCreated();
    } catch (err: unknown) {
      console.error("Error creating poll:", err);
      if (err instanceof Error) {
        setError(err.message || "作成に失敗しました");
      } else {
        setError("作成に失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="flex justify-center mb-8">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform transform hover:scale-105 backdrop-blur-sm bg-opacity-80 border border-white/20"
        >
          ＋ 新しい対決を作成する
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto mb-10 p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-2xl animate-fade-in-down">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">新しい対決テーマを作成</h2>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            対決のテーマ（質問）
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例: きのこの山 vs たけのこの里"
            className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-white placeholder-gray-500 outline-none transition-all"
            disabled={loading}
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            選択肢 (2〜5個)
          </label>
          
          {options.map((option, index) => (
            <div key={index} className="flex gap-2 items-center animate-fade-in">
              <span className={`text-sm font-bold w-6 ${OPTION_COLORS[index].text}`}>
                {index + 1}.
              </span>
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`選択肢 ${index + 1} (${OPTION_COLORS[index].name})`}
                className={`flex-1 px-4 py-2 rounded-lg bg-black/40 border focus:ring-1 text-white placeholder-gray-500 outline-none transition-all ${OPTION_COLORS[index].border} ring-opacity-50`}
                disabled={loading}
                style={{ borderColor: `var(--color-${OPTION_COLORS[index].class.split('-')[1]}-500)` }}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  aria-label="削除"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {options.length < 5 && (
            <button
              type="button"
              onClick={addOption}
              className="text-sm text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 transition-colors ml-8"
            >
              ＋ 選択肢を追加
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            投票期限
          </label>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 text-white placeholder-gray-500 outline-none transition-all [color-scheme:dark]"
            disabled={loading}
          />
          <p className="text-xs text-gray-400 mt-1">
            ※ デフォルトは24時間後です
          </p>
        </div>

        <div className="pt-2 flex justify-end gap-3">
            <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
                disabled={loading}
            >
                キャンセル
            </button>
            <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-lg hover:shadow-purple-500/30 transition-all transform hover:scale-105
                ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
                {loading ? "作成中..." : "作成する"}
            </button>
        </div>
      </form>
    </div>
  );
}
