"use client";

import { useState } from "react";
import { logout } from "@/app/actions";
import type { Profile } from "@/game/store";
import { saveProfile } from "@/lib/profile";
import { JoinScreen } from "./JoinScreen";
import { Office } from "./Office";

export interface CurrentUser extends Profile {
  isAdmin: boolean;
  onboarded: boolean;
}

export function OfficeApp({ user }: { user: CurrentUser }) {
  const [profile, setProfile] = useState<Profile>({ name: user.name, avatar: user.avatar, look: user.look });
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
            await saveProfile(p);
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

  // Al volver del perfil la oficina se monta de nuevo y entra con un token con los datos nuevos.
  return (
    <Office
      isAdmin={user.isAdmin}
      profile={profile}
      onProfileChange={setProfile}
      onEditProfile={() => setEditing(true)}
    />
  );
}
