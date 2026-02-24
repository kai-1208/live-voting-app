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
    
    // Creator / Edit Mode states
    const [isCreator, setIsCreator] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editQuestion, setEditQuestion] = useState("");
    const [editOptionLabels, setEditOptionLabels] = useState<string[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

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

    useEffect(() => {
        const createdPolls = JSON.parse(localStorage.getItem('my_created_polls') || '[]');
        if (createdPolls.includes(poll.id)) {
            setIsCreator(true);
        }
    }, [poll.id]);

    // Check if user has already voted on mount
    useEffect(() => {
        const voted = localStorage.getItem(`poll-voted-${poll.id}`);
        if (voted) {
            setHasVoted(true);
        }
    }, [poll.id]);

    // Handle Delete
    const handleDelete = async () => {
        if (!confirm("本当にこの投票を削除しますか？\n（この操作は取り消せません）")) return;
        
        setIsDeleting(true);
        try {
            const { error } = await supabase.from('polls').delete().eq('id', poll.id);
            if (error) {
                console.error("Delete failed:", error);
                alert("削除に失敗しました。詳細: " + error.message);
            }
            // Supabase Realtime will propagate changes so the list will update automatically,
            // but usually DELETE events need to be handled in the parent component
            // We can also trigger a reload or hide strictly.
            // Since we subscribe to INSERT in page.tsx but update local state here,
            // deleting from the database will not update parent state automatically unless we subscribe to DELETE globally in page.tsx!
            // But let's assume page.tsx handles it or we'll add a callback?
            // Actually, we are just relying on DB deletion.
        } catch (err) {
            console.error("Delete exec error:", err);
            alert("削除実行中にエラーが発生しました");
        } finally {
            setIsDeleting(false);
        }
    };

    // Handle Edit
    const startEdit = () => {
        setEditQuestion(currentPoll.question);
        setEditOptionLabels(currentPoll.options?.map(o => o.label) || []);
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setEditQuestion("");
        setEditOptionLabels([]);
    };

    const saveEdit = async () => {
        if (!editQuestion.trim() || editOptionLabels.some(l => !l.trim())) {
            alert("すべての項目を入力してください");
            return;
        }
        setIsSaving(true);
        try {
            // Reconstruct options with new labels but keep existing votes and colors
            const newOptions = currentPoll.options?.map((opt, idx) => ({
                ...opt,
                label: editOptionLabels[idx] || opt.label,
            })) || [];

            const { error } = await supabase
                .from('polls')
                .update({ 
                    question: editQuestion,
                    options: newOptions 
                })
                .eq('id', poll.id);
            
            if (error) throw error;
            setIsEditing(false);
            setCurrentPoll({ 
                ...currentPoll, 
                question: editQuestion,
                options: newOptions
            });
        } catch (err: unknown) {
             const message = err instanceof Error ? err.message : 'Unknown error';
            console.error("Update failed:", err);
            alert("更新に失敗しました: " + message);
        } finally {
            setIsSaving(false);
        }
    };

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
            {/* Owner Controls */}
            {isCreator && !isEditing && (
                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button 
                        onClick={startEdit}
                        className="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-200 rounded-md transition-colors"
                        title="編集"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25 A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                    </button>
                    <button 
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-md transition-colors"
                        title="削除"
                    >
                        {isDeleting ? (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                        )}
                    </button>
                </div>
            )}

            {isEditing ? (
                <div className="mb-4 space-y-2">
                    <input 
                        type="text" 
                        value={editQuestion} 
                        onChange={(e) => setEditQuestion(e.target.value)}
                        className="w-full bg-black/30 border border-white/20 rounded px-2 py-1 text-white font-bold text-lg focus:outline-none focus:border-purple-500 mb-2"
                        placeholder="質問を入力"
                        autoFocus
                    />
                    
                    {/* Editable Options */}
                    <div className="space-y-2">
                        {editOptionLabels.map((label, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${currentPoll.options?.[idx].color.replace('bg-', 'bg-') || 'bg-gray-500'}`}></span>
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => {
                                        const newLabels = [...editOptionLabels];
                                        newLabels[idx] = e.target.value;
                                        setEditOptionLabels(newLabels);
                                    }}
                                    className="flex-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-purple-500"
                                    placeholder={`選択肢 ${idx + 1}`}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                        <button 
                            onClick={cancelEdit}
                            className="text-xs px-2 py-1 text-gray-400 hover:text-white transition-colors"
                        >
                            キャンセル
                        </button>
                        <button 
                            onClick={saveEdit}
                            disabled={isSaving}
                            className="text-xs px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded transition-colors flex items-center"
                        >
                            {isSaving ? "保存中..." : "保存"}
                        </button>
                    </div>
                </div>
            ) : (
                <h2 className="text-xl font-bold text-white mb-2 text-center drop-shadow-md">
                    {currentPoll.question}
                </h2>
            )}
            
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