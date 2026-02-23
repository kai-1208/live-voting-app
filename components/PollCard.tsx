import React, { useState, useEffect, useRef } from "react";
import { Poll } from "@/types/index";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

interface PollCardProps {
    poll: Poll;
    index?: number;
    sortType?: string;
}

const PollCard: React.FC<PollCardProps> = ({ poll, index = 0, sortType = "default" }) => {
    // Local state to manage poll data for real-time updates
    const [currentPoll, setCurrentPoll] = useState<Poll>(poll);
    const [isVoting, setIsVoting] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);
    
    // Animation states: track which option index just got a vote
    const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
    const prevVotes = useRef<number[]>(poll.options ? poll.options.map(o => o.votes) : [0, 0]);

    // Check for expiration
    const [isExpired, setIsExpired] = useState(false);
    const [timeLeft, setTimeLeft] = useState("");
    
    useEffect(() => {
        if (currentPoll.expires_at) {
            const checkExpiration = () => {
                const now = new Date();
                const expirationDate = new Date(currentPoll.expires_at!);
                const diff = expirationDate.getTime() - now.getTime();
                
                if (diff <= 0) {
                    setIsExpired(true);
                    setTimeLeft("終了");
                } else {
                    setIsExpired(false);
                    const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const diffHours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const diffMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    
                    if (diffDays > 0) {
                        setTimeLeft(`あと${diffDays}日`);
                    } else if (diffHours > 0) {
                        setTimeLeft(`あと${diffHours}時間${diffMinutes}分`);
                    } else if (diffMinutes > 0) {
                        setTimeLeft(`あと${diffMinutes}分`);
                    } else {
                        setTimeLeft("まもなく終了");
                    }
                }
            };
            
            checkExpiration();
            // Check every minute if still mounted
            const timer = setInterval(checkExpiration, 60000);
            return () => clearInterval(timer);
        }
    }, [currentPoll.expires_at]);

    // Check if user has already voted on mount
    useEffect(() => {
        const voted = localStorage.getItem(`poll-voted-${poll.id}`);
        if (voted) {
            setHasVoted(true);
        }
    }, [poll.id]);

    // Subscribe to real-time changes
    useEffect(() => {
        const channelId = `poll-${poll.id}-${Date.now()}`;
        const channel = supabase
            .channel(channelId)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "polls",
                    filter: `id=eq.${poll.id}`,
                },
                (payload) => {
                    const newPoll = payload.new as Poll;
                    setCurrentPoll(newPoll);

                    // Check for vote increases
                    if (newPoll.options) {
                        newPoll.options.forEach((opt, idx) => {
                            const prev = prevVotes.current[idx] || 0;
                            if (opt.votes > prev) {
                                setAnimatingIndex(idx);
                                setTimeout(() => setAnimatingIndex(null), 1000);
                            }
                        });
                        prevVotes.current = newPoll.options.map(o => o.votes);
                    }
                }
            )
            .subscribe((status, err) => {
                if (err) console.error("Subscription error:", err);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [poll.id]);

    // Handle vote submission
    const handleVote = async (optionIndex: number) => {
        if (isVoting || hasVoted || isExpired) return;
        setIsVoting(true);

        // Optimistic UI Update: Immediately reflect the vote locally
        // This ensures the animation and progress bar update instantly without waiting for the network roundtrip
        const optimisticPoll = { 
            ...currentPoll, 
            options: currentPoll.options?.map((opt, idx) => 
                idx === optionIndex ? { ...opt, votes: opt.votes + 1 } : opt
            )
        };
        setCurrentPoll(optimisticPoll);
        
        // Trigger visual effects immediately
        setAnimatingIndex(optionIndex);
        setTimeout(() => setAnimatingIndex(null), 1000);

        // Update ref to prevent duplicate animation triggered by incoming subscription update
        if (prevVotes.current) {
             const newVotes = [...prevVotes.current];
             newVotes[optionIndex] = (newVotes[optionIndex] || 0) + 1;
             prevVotes.current = newVotes;
        }

        try {
            const { error } = await supabase.rpc('vote_for_option', {
                poll_id: String(currentPoll.id),
                option_index: optionIndex
            });

            if (error) {
                console.error("Error voting:", error);
                // Rollback on error (optional, but good practice)
                setCurrentPoll(currentPoll); 
            } else {
                localStorage.setItem(`poll-voted-${poll.id}`, "true");
                setHasVoted(true);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
            setCurrentPoll(currentPoll);
        } finally {
            setIsVoting(false);
        }
    };

    // Calculate totals
    const options = currentPoll.options || []; // Fallback empty array
    const totalVotes = options.reduce((sum, opt) => sum + opt.votes, 0);

    return (
        <motion.div 
            layout
            key={poll.id} 
            variants={{
                hidden: { opacity: 0, y: 50 },
                show: { opacity: 1, y: 0 }
            }}
            transition={{ duration: 0.5 }}
            className="w-full mx-auto bg-white/5 backdrop-blur-[1px] rounded-xl shadow-lg shadow-black/20 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 p-5 relative overflow-hidden group"
        >
            <h2 className="text-xl font-bold text-white mb-2 text-center drop-shadow-md">
                {currentPoll.question}
            </h2>
            {currentPoll.expires_at ? (
                <div className="text-center mb-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${
                        isExpired 
                            ? "bg-red-500/20 text-red-100 border-red-400/30" 
                            : "bg-green-500/20 text-green-100 border-green-400/30"
                    }`}>
                        {isExpired ? "投票終了" : "投票受付中"} - {timeLeft}
                    </span>
                </div>
            ) : <div className="mb-6"></div>}

            <div className="flex flex-col space-y-4">
                {/* Voting Buttons List */}
                <div className="space-y-3">
                    {options.map((option, idx) => (
                        <div key={idx} className="relative">
                            <button
                                onClick={() => handleVote(idx)}
                                disabled={isVoting || hasVoted || isExpired}
                                className={`w-full relative overflow-hidden text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg transform hover:-translate-y-0.5 flex justify-between items-center group
                                ${option.color} 
                                ${(isVoting || hasVoted || isExpired) ? "opacity-60 cursor-not-allowed transform-none hover:shadow-none grayscale-[0.3]" : "hover:opacity-90 hover:shadow-current/40"}`}
                            >
                                <span className="z-10 relative">{option.label}</span>
                                <span className="z-10 relative font-mono tabular-nums">{option.votes}票</span>
                            </button>
                             <AnimatePresence>
                                {animatingIndex === idx && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, y: -20, scale: 1.2 }}
                                        exit={{ opacity: 0, y: -40 }}
                                        className="absolute top-0 right-4 transform -translate-y-full text-white font-bold text-xl pointer-events-none drop-shadow-lg z-10"
                                    >
                                        +1
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>

                {/* Unified Progress Bar */}
                <div className="mt-4">
                    <div className="w-full h-4 bg-gray-700/50 rounded-full overflow-hidden flex shadow-inner border border-white/5">
                        {options.map((option, idx) => {
                            const percent = totalVotes === 0 ? 0 : (option.votes / totalVotes) * 100;
                            if (percent === 0) return null;
                            return (
                                <div 
                                    key={idx}
                                    className={`h-full ${option.color} transition-all duration-700 ease-in-out`}
                                    style={{ width: `${percent}%` }}
                                    title={`${option.label}: ${Math.round(percent)}%`}
                                />
                            );
                        })}
                        {totalVotes === 0 && (
                            <div className="w-full h-full bg-gray-600/30" />
                        )}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                        <span>Total Votes: {totalVotes}</span>
                        {hasVoted && <span className="text-green-400 animate-pulse">Voted!</span>}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default PollCard;