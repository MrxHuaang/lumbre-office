import { OfficeApp } from "@/components/OfficeApp";
import { asAvatar, requireUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  return (
    <OfficeApp
      user={{
        name: user.name,
        avatar: asAvatar(user.avatar),
        isAdmin: user.role === "ADMIN",
        onboarded: Boolean(user.onboardedAt),
      }}
    />
  );
}
