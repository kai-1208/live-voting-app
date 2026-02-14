import React, { useState, useEffect } from "react";
import { Poll } from "@/types/index";
import { supabase } from "@/lib/supabase";

interface PollCardProps {
    poll: Poll;
}

const PollCard: React.FC<PollCardProps> = ({ poll }) => {
    // Local state to manage poll data for real-time updates
    const [currentPoll, setCurrentPoll] = useState<Poll>(poll);
    const [isVoting, setIsVoting] = useState(false);
    const [hasVoted, setHasVoted] = useState(false);

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
                    setCurrentPoll(payload.new as Poll);
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
        if (isVoting || hasVoted) return;
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
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg run-off-border p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                {currentPoll.question}
            </h2>

            <div className="flex flex-col space-y-6">
                
                {/* Voting Buttons */}
                <div className="flex justify-between gap-4">
                    <button
                        onClick={() => handleVote("option_a")}
                        disabled={isVoting || hasVoted}
                        className={`flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors 
                        ${(isVoting || hasVoted) ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        {currentPoll.option_a}
                    </button>
                    <button
                        onClick={() => handleVote("option_b")}
                        disabled={isVoting || hasVoted}
                        className={`flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors 
                        ${(isVoting || hasVoted) ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        {currentPoll.option_b}
                    </button>
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
        </div>
    );
};

export default PollCard;