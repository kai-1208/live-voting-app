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
  
  // New features state
  const [searchTerm, setSearchTerm] = useState("");
  const [showExpired, setShowExpired] = useState(false);

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

    // Subscribe to new polls
    const channel = supabase
      .channel('public:polls')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'polls' },
        (payload) => {
          const newPoll = payload.new as Poll;
          setPolls((prevPolls) => {
            // Check if the poll is already in the list to avoid duplicates
            if (prevPolls.some(p => p.id === newPoll.id)) {
              return prevPolls;
            }
            return [newPoll, ...prevPolls];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <div className="text-center mt-10 text-white">Loading polls...</div>;
  }

  // Filter logic
  const filteredPolls = polls.filter((poll) => {
    // 1. Search term
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (poll.question || "").toLowerCase().includes(term) || 
      String(poll.id).toLowerCase().includes(term);

    // 2. Expiration filter
    let isExpired = false;
    if (poll.expires_at) {
      isExpired = new Date(poll.expires_at).getTime() < new Date().getTime();
    }
    // If showExpired is true, show everything.
    // If showExpired is false, only show not expired.
    const matchesExpiration = showExpired ? true : !isExpired;

    return matchesSearch && matchesExpiration;
  });

  return (
    <div className="container mx-auto p-4 relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-4xl font-extrabold text-white drop-shadow-lg tracking-wider">
          🚀 Live Voting App
        </h1>
        
        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-black/30 p-3 rounded-xl backdrop-blur-sm border border-white/10 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-auto">
                <input
                    type="text"
                    placeholder="キーワード検索 (ID/質問)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            {/* Expired Toggle */}
            <label className="flex items-center cursor-pointer select-none whitespace-nowrap">
                <div className="relative">
                    <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={showExpired} 
                        onChange={(e) => setShowExpired(e.target.checked)} 
                    />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${showExpired ? 'bg-purple-600' : 'bg-gray-600'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showExpired ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <span className="ml-2 text-sm text-gray-300 font-medium">期限切れを表示</span>
            </label>
        </div>
      </div>
      
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
        {[...filteredPolls].sort((a, b) => {
            if (sortType === 'popular') {
              const totalA = a.options ? a.options.reduce((sum, opt) => sum + opt.votes, 0) : 0;
              const totalB = b.options ? b.options.reduce((sum, opt) => sum + opt.votes, 0) : 0;
              return totalB - totalA;
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
        
        {filteredPolls.length === 0 && (
            <div className="col-span-full text-center py-20 text-gray-400 bg-white/5 rounded-xl backdrop-blur-sm border border-white/5">
                <p className="text-xl">該当する投票が見つかりませんでした 😢</p>
                <button 
                    onClick={() => {setSearchTerm(""); setShowExpired(true);}}
                    className="mt-4 text-purple-400 hover:text-purple-300 underline"
                >
                    検索条件をクリア
                </button>
            </div>
        )}
      </div>
    </div>
  );
}