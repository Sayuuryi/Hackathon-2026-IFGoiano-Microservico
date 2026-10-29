export type Profile = {
  userDisplayName: string;
  userAge: number;
  petName: string;
  petColor: number;
  accessory: string;
  environment: string;
  preferences: { voice: boolean; reducedMotion: boolean };
};
export type User = { id: string; name: string; email: string; age: number };
export type Session = { user: User; profile: Profile };
export type Kind = "fishing" | "cooking" | "park";
export type Game = {
  id: string;
  kind: Kind;
  definitionId: string;
  state: string;
  progress: number;
  selected: string[];
  readyAt: number;
  resultId: string | null;
  version: number;
  local?: boolean;
};
export type Memory = {
  id: string;
  kind: string;
  createdAt: number;
  pending?: boolean;
};
export type Message = { id: string; role: "user" | "assistant"; text: string };
export type Friend = {
  id: string;
  name: string;
  role: "host" | "guest";
  status: string;
  available: boolean;
  blockedByMe: boolean;
};
export const baseProfile: Profile = {
  userDisplayName: "",
  userAge: 18,
  petName: "Mimo",
  petColor: 0,
  accessory: "leaf",
  environment: "garden",
  preferences: { voice: false, reducedMotion: false },
};
