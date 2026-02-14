"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Poll } from "@/types/index";

interface CreatePollFormProps {
  onPollCreated: () => void;
}

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
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [expiresAt, setExpiresAt] = useState(getDefaultExpiresAt());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !optionA || !optionB || !expiresAt) {
      setError("すべて入力してください");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase
        .from("polls")
        .insert([
          {
            question,
            option_a: optionA,
            option_b: optionB,
            votes_a: 0,
            votes_b: 0,
            expires_at: new Date(expiresAt).toISOString(),
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      // 入力欄クリア
      setQuestion("");
      setOptionA("");
      setOptionB("");
      setExpiresAt(getDefaultExpiresAt());
      setIsOpen(false);
      
      // 親コンポーネントに更新を通知
      onPollCreated();
    } catch (err: any) {
      console.error("Error creating poll:", err);
      setError(err.message || "作成に失敗しました");
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-blue-300 mb-1">
              選択肢 A (青)
            </label>
            <input
              type="text"
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              placeholder="例: きのこの山"
              className="w-full px-4 py-2 rounded-lg bg-black/40 border border-blue-500/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-gray-500 outline-none transition-all"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-300 mb-1">
              選択肢 B (赤)
            </label>
            <input
              type="text"
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              placeholder="例: たけのこの里"
              className="w-full px-4 py-2 rounded-lg bg-black/40 border border-red-500/30 focus:border-red-500 focus:ring-1 focus:ring-red-500 text-white placeholder-gray-500 outline-none transition-all"
              disabled={loading}
            />
          </div>
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
