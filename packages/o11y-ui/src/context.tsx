import React, { useContext } from "react";

export interface O11yUiContext {
  /** A react-router (or similar) Link component. */
  Link: React.FC<{ "to": string }>
}

const ctxInstance = React.createContext<O11yUiContext | undefined>(undefined);

export function O11yUiContextProvider(props: React.PropsWithChildren<{ ctx: O11yUiContext }>) {
  return (
    <ctxInstance.Provider value={props.ctx}>
      {props.children}
    </ctxInstance.Provider>
  );
}

export function useO11yUiContext() {
  const maybeCtx = useContext(ctxInstance);
  if (maybeCtx == null) {
    throw new Error("useO11yUiContext must be used within a O11yUiContext.");
  }

  return maybeCtx;
}
