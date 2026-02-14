"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PollCard from "@/components/PollCard";

type Poll = {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  votes_a: number;
  votes_b: number;
  created_at: string;
};

export default function Home() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const { data, error } = await supabase.from("polls").select("*");

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

    fetchPolls();
  }, []);

  if (loading) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Live Polls</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {polls.map((poll) => (
          <PollCard key={poll.id} poll={poll} />
        ))}
      </div>
      {polls.length === 0 && (
        <p className="text-center text-gray-500">No polls found.</p>
      )}
    </div>
  );
}