"use client";

import { useState } from "react";
import { logout } from "@/app/actions";
import type { Profile } from "@/game/store";
import { JoinScreen } from "./JoinScreen";
import { Office } from "./Office";

export interface CurrentUser extends Profile {
  isAdmin: boolean;
  onboarded: boolean;
}

export function OfficeApp({ user }: { user: CurrentUser }) {
  const [profile, setProfile] = useState<Profile>({ name: user.name, avatar: user.avatar });
  const [onboarded, setOnboarded] = useState(user.onboarded);
  const [editing, setEditing] = useState(!user.onboarded);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (editing) {
    return (
      <JoinScreen
        initial={profile}
        firstTime={!onboarded}
        onBack={() => (onboarded ? setEditing(false) : void logout())}
        saving={saving}
        error={error}
        onJoin={async (p) => {
          setSaving(true);
          setError(null);
          try {
            const res = await fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(p),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "No se pudo guardar");
            setProfile(p);
            setOnboarded(true);
            setEditing(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar");
          } finally {
            setSaving(false);
          }
        }}
      />
    );
  }

  return <Office key={`${profile.name}-${profile.avatar}`} isAdmin={user.isAdmin} onEditProfile={() => setEditing(true)} />;
}
