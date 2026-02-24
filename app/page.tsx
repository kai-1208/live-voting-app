"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PollCard from "@/components/PollCard";
import CreatePollForm from "@/components/CreatePollForm";
import { Poll } from "@/types/index";
import { useBackground } from "@/components/BackgroundProvider";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortType, setSortType] = useState<'newest' | 'popular' | 'expiring'>('newest');
  
  // New features state
  const [searchTerm, setSearchTerm] = useState("");
  const [showExpired, setShowExpired] = useState(false);
  
  // Modal state for CreatePollForm
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { background, toggleBackground } = useBackground(); // For toggle button

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

    // Subscribe to changes (INSERT, UPDATE, DELETE)
    const channelId = `main-polls-${Math.random()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newPoll = payload.new as Poll;
            setPolls((prevPolls) => {
              if (prevPolls.some(p => p.id === newPoll.id)) return prevPolls;
              return [newPoll, ...prevPolls];
            });
          } else if (payload.eventType === 'DELETE') {
            setPolls((prevPolls) => prevPolls.filter((p) => p.id !== (payload.old as { id: string }).id));
          } else if (payload.eventType === 'UPDATE') {
             // Only update if critical fields changed (to avoid re-rendering list on every vote)
             const updatedPoll = payload.new as Poll;
             const oldPoll = payload.old as Poll;
             
             // Check if question or expires_at changed. We ignore vote updates here to prevent heavy re-renders.
             // Note: payload.old only contains ID in some configs unless replica identity is full.
             // But usually payload.new has everything. 
             // We can compare with current state in setPolls callback.
             setPolls((prevPolls) => {
                 return prevPolls.map(p => {
                     if (p.id === updatedPoll.id) {
                         // Only if question or critical metadata changed
                         if (p.question !== updatedPoll.question || p.expires_at !== updatedPoll.expires_at) {
                             return updatedPoll;
                         }
                         // Otherwise return existing object reference to avoid re-renders
                         return p;
                     }
                     return p;
                 });
             });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
        <div className="flex justify-center items-center min-h-screen text-white/80">
            <div className="text-xl font-light tracking-wide animate-pulse">Loading Live Votes...</div>
        </div>
    );
  }

  // Filter logic
  const filteredAndSortedPolls = polls
    .filter((poll) => {
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
    })
    .sort((a, b) => {
        if (sortType === 'newest') {
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        } else if (sortType === 'popular') {
            const votesA = a.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0;
            const votesB = b.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0;
            return votesB - votesA;
        } else if (sortType === 'expiring') {
            const timeA = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
            const timeB = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
            return timeA - timeB;
        }
        return 0;
    });

  return (
    <div className="min-h-screen relative z-10 pb-20">
      {/* 1. Sticky Header */}
      <header className="sticky top-0 z-40 w-full bg-black/50 backdrop-blur-md border-b border-white/5 shadow-lg shadow-black/20">
        <div className="container mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            
            {/* Left Group: Title & Segmented Control */}
            <div className="flex flex-col sm:flex-row items-center gap-8 w-full md:w-auto">
                <h1 className="text-4xl font-bold text-white tracking-wider flex items-center gap-3">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">Live</span> Voting
                </h1>

                {/* 3. Segmented Control Sort */}
                <div className="bg-white/10 p-1.5 rounded-xl flex items-center">
                    <button
                        onClick={() => setSortType('newest')}
                        className={`px-6 py-2.5 rounded-lg text-base font-medium transition-all ${
                            sortType === 'newest'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-300 hover:text-white'
                        }`}
                    >
                        新着
                    </button>
                    <button
                        onClick={() => setSortType('popular')}
                        className={`px-6 py-2.5 rounded-lg text-base font-medium transition-all ${
                            sortType === 'popular'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-300 hover:text-white'
                        }`}
                    >
                        人気
                    </button>
                    <button
                        onClick={() => setSortType('expiring')}
                        className={`px-6 py-2.5 rounded-lg text-base font-medium transition-all ${
                            sortType === 'expiring'
                             ? 'bg-white text-gray-900 shadow-sm'
                             : 'text-gray-300 hover:text-white'
                        }`}
                    >
                        期限間近
                    </button>
                </div>
            </div>

            {/* Right Group: Search, Filter, Mode Toggle */}
            <div className="flex items-center gap-6 w-full md:w-auto justify-end">
                {/* Search Input */}
                <div className="relative group">
                    <input
                        type="text"
                        placeholder="検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-48 sm:w-64 pl-10 pr-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-white placeholder-gray-400 text-base focus:outline-none focus:ring-1 focus:ring-white/30 focus:bg-white/10 transition-all"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                {/* Expired Toggle */}
                <label className="flex items-center gap-3 cursor-pointer select-none text-sm text-gray-300 hover:text-white transition-colors">
                    <div className="relative">
                        <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={showExpired} 
                            onChange={(e) => setShowExpired(e.target.checked)} 
                        />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${showExpired ? 'bg-purple-500' : 'bg-white/20'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showExpired ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <span>期限切れを表示</span>
                </label>

                {/* Background Toggle Button */}
                <button
                    onClick={toggleBackground}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-yellow-300 transition-colors"
                    title="背景切り替え"
                >
                    {background === 'night_sky' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                    )}
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="container mx-auto p-4 pt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            
            {/* 4. Create Poll Button (Card Style) */}
            <motion.button
                onClick={() => setIsModalOpen(true)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.5)" }}
                className="w-full min-h-[250px] mx-auto flex flex-col justify-center items-center bg-white/5 backdrop-blur-[1px] border border-white/10 border-dashed rounded-xl text-white/50 hover:text-white/90 hover:bg-white/10 hover:border-white/30 transition-all group"
            >
                <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-white/20 flex items-center justify-center mb-4 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </div>
                <span className="text-base font-medium">新しい対決を作成</span>
            </motion.button>
            
            {/* Poll Cards */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`${sortType}-${showExpired}-${polls.length}-${searchTerm}`}
                    initial="hidden"
                    animate="show"
                    exit="hidden"
                    variants={{
                        hidden: {},
                        show: {
                            transition: {
                                staggerChildren: 0.1
                            }
                        }
                    }}
                    className="contents"
                >
                    {filteredAndSortedPolls.map((poll, index) => (
                        <PollCard 
                            key={poll.id} 
                            poll={poll} 
                            index={index} 
                        />
                    ))}
                </motion.div>
            </AnimatePresence>
        </div>
      </main>

      {/* Create Poll Modal */}
      <AnimatePresence>
        {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsModalOpen(false)}
                />
                <motion.div
                    className="relative w-full max-w-2xl bg-[#1a1f3c] rounded-2xl shadow-2xl overflow-hidden"
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                >
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-bold text-white">新しい対決を作成</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <CreatePollForm onPollCreated={() => {
                            fetchPolls();
                            setIsModalOpen(false);
                        }} />
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}