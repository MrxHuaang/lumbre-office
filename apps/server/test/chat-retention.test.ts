import type { ColyseusTestServer } from "@colyseus/testing";
import { ROOM_NAME, type ChatEvent } from "@hyvento/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRepository } from "../src/repo/memory";
import { CHAT_PRUNE_EVERY_MS, CHAT_RETENTION_DAYS, chatCutoff, pruneOldChat, startChatRetention } from "../src/rooms/chatRetention";
import { OfficeRoom } from "../src/rooms/OfficeRoom";
import type { OfficeState } from "../src/state";
import { bootServer, until } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 28, 12);

const msg = (id: string, ts: number): ChatEvent => ({ id, fromId: "user:u1", fromName: "Ana", text: id, scope: "global", zoneId: null, ts });

describe("retención del chat", () => {
  it("el corte es N días antes de ahora", () => {
    expect(chatCutoff(NOW).getTime()).toBe(NOW - CHAT_RETENTION_DAYS * DAY);
    expect(chatCutoff(NOW, 7).getTime()).toBe(NOW - 7 * DAY);
  });

  it("borra solo lo que pasó el límite, y dos veces seguidas no borra de más", async () => {
    const repo = new MemoryRepository();
    repo.chat = [msg("viejo", NOW - 100 * DAY), msg("justo", NOW - CHAT_RETENTION_DAYS * DAY), msg("nuevo", NOW - DAY)];
    expect(await pruneOldChat(repo, NOW)).toBe(1);
    expect(repo.chat.map((m) => m.id)).toEqual(["justo", "nuevo"]);
    expect(await pruneOldChat(repo, NOW)).toBe(0);
    expect(repo.chat).toHaveLength(2);
  });

  it("si la base falla, lo anota y sigue", async () => {
    const repo = new MemoryRepository();
    repo.pruneChatBefore = () => Promise.reject(new Error("sin base"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await pruneOldChat(repo, NOW)).toBe(0);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("[juego] chatRetention"), expect.any(Error));
    } finally {
      spy.mockRestore();
    }
  });

  it("poda al empezar y después cada tanto", async () => {
    const repo = new MemoryRepository();
    const calls: Date[] = [];
    repo.pruneChatBefore = async (cutoff) => {
      calls.push(cutoff);
      return 0;
    };
    let tick: (() => void) | null = null;
    let every = 0;
    let now = NOW;
    startChatRetention({ setInterval: (fn, ms) => ((tick = fn), (every = ms)) }, () => repo, () => now);
    expect(calls).toHaveLength(1);
    expect(every).toBe(CHAT_PRUNE_EVERY_MS);
    now += CHAT_PRUNE_EVERY_MS;
    tick!();
    expect(calls.map((d) => d.getTime())).toEqual([chatCutoff(NOW).getTime(), chatCutoff(now).getTime()]);
  });
});

describe("retención del chat en la sala", () => {
  let colyseus: ColyseusTestServer;
  beforeAll(async () => {
    colyseus = await bootServer(new MemoryRepository());
  });
  afterAll(async () => {
    await colyseus.shutdown();
  });
  beforeEach(async () => {
    await colyseus.cleanup();
  });

  it("al crear la sala se borran los mensajes viejos", async () => {
    const repo = new MemoryRepository();
    repo.chat = [msg("viejo", Date.now() - 120 * DAY), msg("nuevo", Date.now() - DAY)];
    OfficeRoom.repo = repo;
    await colyseus.createRoom<OfficeState>(ROOM_NAME, {});
    await until(() => repo.chat.length === 1, "que se pode el chat");
    expect(repo.chat[0]!.id).toBe("nuevo");
  });
});
