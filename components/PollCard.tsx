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
    
    // Animation states
    const [showPlusOneA, setShowPlusOneA] = useState(false);
    const [showPlusOneB, setShowPlusOneB] = useState(false);
    const prevVotesA = useRef(poll.votes_a);
    const prevVotesB = useRef(poll.votes_b);

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
        // Generate a unique channel ID for this specific subscription instance
        // This helps avoid collisions/race conditions in React Strict Mode
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
                    // Update local state when DB changes
                    const newPoll = payload.new as Poll;
                    setCurrentPoll(newPoll);

                    // Check for vote increases to trigger animations
                    if (newPoll.votes_a > prevVotesA.current) {
                        setShowPlusOneA(true);
                        setTimeout(() => setShowPlusOneA(false), 1000);
                    }
                    if (newPoll.votes_b > prevVotesB.current) {
                        setShowPlusOneB(true);
                        setTimeout(() => setShowPlusOneB(false), 1000);
                    }
                    
                    // Update refs
                    prevVotesA.current = newPoll.votes_a;
                    prevVotesB.current = newPoll.votes_b;
                }
            )
            .subscribe((status, err) => {
                console.log(`Poll ${poll.id} subscription status:`, status);
                if (err) {
                    console.error("Subscription error:", err);
                }
            });

        return () => {
             // Clean up subscription
            supabase.removeChannel(channel);
        };
    }, [poll.id]);

    // Handle vote submission
    const handleVote = async (option: "option_a" | "option_b") => {
        if (isVoting || hasVoted || isExpired) return;
        setIsVoting(true);

        const columnToUpdate = option === "option_a" ? "votes_a" : "votes_b";
        const currentVotes = option === "option_a" ? currentPoll.votes_a : currentPoll.votes_b;

        try {
            const { error } = await supabase
                .from("polls")
                .update({ [columnToUpdate]: currentVotes + 1 })
                .eq("id", currentPoll.id);

            if (error) {
                console.error("Error voting:", error);
            } else {
                // Mark as voted in local storage
                localStorage.setItem(`poll-voted-${poll.id}`, "true");
                setHasVoted(true);
            }
        } catch (err) {
            console.error("Unexpected error:", err);
        } finally {
            setIsVoting(false);
        }
    };

    const totalVotes = currentPoll.votes_a + currentPoll.votes_b;
    
    // Calculate percentages
    const percentA = totalVotes === 0 ? 50 : Math.round((currentPoll.votes_a / totalVotes) * 100);
    const percentB = totalVotes === 0 ? 50 : 100 - percentA;

    return (
        <motion.div 
            key={sortType}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.1 }}
            className="max-w-md w-full bg-white/90 backdrop-blur-sm rounded-xl shadow-lg run-off-border p-6 md:p-8 relative"
        >
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
                {currentPoll.question}
            </h2>
            {currentPoll.expires_at && (
                <div className="text-center mb-6">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${
                        isExpired 
                            ? "bg-red-100 text-red-800 border-red-200" 
                            : "bg-green-100 text-green-800 border-green-200"
                    }`}>
                        {isExpired ? "投票終了" : "投票受付中"} - {timeLeft}
                    </span>
                </div>
            )}
            {!currentPoll.expires_at && <div className="mb-6"></div>}

            <div className="flex flex-col space-y-6">
                
                {/* Voting Buttons */}
                <div className="flex justify-between gap-4 relative">
                    <div className="relative flex-1">
                        <button
                            onClick={() => handleVote("option_a")}
                            disabled={isVoting || hasVoted || isExpired}
                            className={`w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors 
                            ${(isVoting || hasVoted || isExpired) ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {currentPoll.option_a}
                        </button>
                        <AnimatePresence>
                            {showPlusOneA && (
                                <motion.div
                                    initial={{ opacity: 0, y: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, y: -20, scale: 1.2 }}
                                    exit={{ opacity: 0, y: -40 }}
                                    className="absolute top-0 right-0 transform -translate-y-full text-blue-600 font-bold text-xl pointer-events-none"
                                >
                                    +1
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="relative flex-1">
                        <button
                            onClick={() => handleVote("option_b")}
                            disabled={isVoting || hasVoted || isExpired}
                            className={`w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors 
                            ${(isVoting || hasVoted || isExpired) ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {currentPoll.option_b}
                        </button>
                        <AnimatePresence>
                            {showPlusOneB && (
                                <motion.div
                                    initial={{ opacity: 0, y: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, y: -20, scale: 1.2 }}
                                    exit={{ opacity: 0, y: -40 }}
                                    className="absolute top-0 right-0 transform -translate-y-full text-red-600 font-bold text-xl pointer-events-none"
                                >
                                    +1
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Unified Progress Bar */}
                <div className="mt-6">
                    <div className="flex justify-between text-sm font-semibold text-gray-600 mb-2">
                        <span className="text-blue-600">{percentA}% ({currentPoll.votes_a})</span>
                        <span className="text-red-600">{percentB}% ({currentPoll.votes_b})</span>
                    </div>
                    
                    <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
                        <div 
                            className="h-full bg-blue-500 transition-all duration-700 ease-in-out flex items-center justify-center text-xs text-white font-bold"
                            style={{ width: `${percentA}%` }}
                        >
                            {percentA > 15 && `${percentA}%`}
                        </div>
                        <div 
                            className="h-full bg-red-500 transition-all duration-700 ease-in-out flex items-center justify-center text-xs text-white font-bold"
                            style={{ width: `${percentB}%` }}
                        >
                            {percentB > 15 && `${percentB}%`}
                        </div>
                    </div>
                    <div className="text-center text-xs text-gray-500 mt-2">
                        Total Votes: {totalVotes}
                    </div>
                </div>

                {hasVoted && (
                    <p className="text-center text-green-600 font-semibold mt-2 animate-pulse">
                        Thanks for voting!
                    </p>
                )}
            </div>
        </motion.div>
    );
};

export default PollCard;