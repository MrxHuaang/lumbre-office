"use client";

import { useEffect, useState } from "react";
import { JoinScreen } from "@/components/JoinScreen";
import { Office } from "@/components/Office";
import { loadProfile, saveProfile, type Profile } from "@/game/store";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    setSaved(loadProfile());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!profile) {
    return (
      <JoinScreen
        initial={saved}
        onJoin={(p) => {
          saveProfile(p);
          setSaved(p);
          setProfile(p);
        }}
      />
    );
  }

  return <Office profile={profile} onExit={() => setProfile(null)} />;
}
