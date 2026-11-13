import { createContext, useContext } from "react";
import type { Me } from "../api/types";

export interface MeContextValue {
  me: Me;
  reload: () => Promise<void>;
}

export const MeContext = createContext<MeContextValue | null>(null);

/** The signed-in user's profile (role, name); App loads it once after sign-in. */
export function useMe(): MeContextValue {
  const value = useContext(MeContext);
  if (!value) throw new Error("useMe() outside MeContext");
  return value;
}
