"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PollCard from "@/components/PollCard";
import CreatePollForm from "@/components/CreatePollForm";
import { Poll } from "@/types/index";

export default function Home() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortType, setSortType] = useState<'newest' | 'popular' | 'expiring'>('newest');

  const fetchPolls = async () => {
    try {
      // Order by created_at descending to show newest first
      const { data, error } = await supabase
        .from("polls")
        .select("*")
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching polls:", error);
      } else {
        setPolls(data || []);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  if (loading) {
    return <div className="text-center mt-10 text-white">Loading polls...</div>;
  }

  return (
    <div className="container mx-auto p-4 relative z-10">
      <h1 className="text-4xl font-extrabold mb-8 text-center text-white drop-shadow-lg tracking-wider">
        🚀 Live Voting Arena
      </h1>
      
      <CreatePollForm onPollCreated={fetchPolls} />

      {/* Sort Buttons */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setSortType('newest')}
          className={`px-4 py-2 rounded-full font-semibold transition-all ${
            sortType === 'newest'
              ? 'bg-white text-purple-900 shadow-lg scale-105'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          ✨ 新着順
        </button>
        <button
          onClick={() => setSortType('popular')}
          className={`px-4 py-2 rounded-full font-semibold transition-all ${
            sortType === 'popular'
              ? 'bg-white text-purple-900 shadow-lg scale-105'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          🔥 人気順
        </button>
        <button
          onClick={() => setSortType('expiring')}
          className={`px-4 py-2 rounded-full font-semibold transition-all ${
            sortType === 'expiring'
              ? 'bg-white text-purple-900 shadow-lg scale-105'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          ⏳ 期限が近い順
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...polls].sort((a, b) => {
            if (sortType === 'popular') {
              return (b.votes_a + b.votes_b) - (a.votes_a + a.votes_b);
            }
            if (sortType === 'expiring') {
               // 期限がないものは後ろへ
               if (!a.expires_at && !b.expires_at) return 0;
               if (!a.expires_at) return 1;
               if (!b.expires_at) return -1;
               return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
            }
            // default: newest
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }).map((poll, index) => (
          <PollCard key={poll.id} poll={poll} index={index} sortType={sortType} />
        ))}
      </div>
      {polls.length === 0 && (
        <p className="text-center text-gray-300 mt-8">No polls found. Be the first to create one!</p>
      )}
    </div>
  );
}