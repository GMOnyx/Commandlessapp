import type { Client, Message, Interaction } from "discord.js";
import { RelayClient } from "../relayClient.js";
import type { Decision } from "../types.js";
export interface DiscordAdapterOptions {
    client: Client;
    relay: RelayClient;
    execute?: (dec: Decision, ctx: {
        message?: Message;
        interaction?: Interaction;
    }) => Promise<void>;
    onCommand?: (spec: {
        slash?: string;
        name?: string;
        args?: Record<string, unknown>;
    }, ctx: {
        message?: Message;
        interaction?: Interaction;
    }) => Promise<void>;
    mentionRequired?: boolean;
}
export declare function useDiscordAdapter(opts: DiscordAdapterOptions): void;
