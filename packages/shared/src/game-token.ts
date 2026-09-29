import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { Look } from "./look";
import { HUMAN_AVATARS } from "./protocol";

/**
 * Token corto que la web (con sesión de Auth.js) emite para entrar al servidor de juego.
 * Así el servidor Colyseus no depende de las cookies de Next: solo comparte `GAME_TOKEN_SECRET`.
 */
export const GameTokenClaims = z.object({
  sub: z.string().min(1), // User.id
  name: z.string().trim().min(1).max(40),
  avatar: z.enum(HUMAN_AVATARS),
  /** Personaje personalizado (si no hay, se usa `avatar`). */
  look: Look.optional(),
  role: z.enum(["ADMIN", "MEMBER"]),
  /** Cuándo entró por primera vez (ms): a quien recién llegó lo recibe Doña Aurora (historia.ts). */
  onboardedAt: z.number().optional(),
});
export type GameTokenClaims = z.infer<typeof GameTokenClaims>;

const ISSUER = "hyvento-web";
const AUDIENCE = "hyvento-game";

const key = (secret: string) => {
  if (!secret || secret.length < 32) throw new Error("GAME_TOKEN_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(secret);
};

export async function signGameToken(claims: GameTokenClaims, secret: string, ttl = "5m"): Promise<string> {
  const { sub, ...rest } = GameTokenClaims.parse(claims);
  return new SignJWT(rest)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(key(secret));
}

export async function verifyGameToken(token: string, secret: string): Promise<GameTokenClaims> {
  const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
  return GameTokenClaims.parse(payload);
}
