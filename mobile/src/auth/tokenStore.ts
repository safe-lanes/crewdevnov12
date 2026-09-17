import { readAuthState, writeAuthState, clearAuthState, getDeviceId, StoredAuthState } from "./secureStore";

// Module-level (non-React) store so the fetch interceptor in api/client.ts can
// read/write the current tokens outside the component tree. AuthContext
// subscribes to this to drive screen state.

type State = StoredAuthState & { deviceId: string | null; hydrated: boolean };

let state: State = {
  accessToken: null,
  refreshToken: null,
  domain: null,
  mustResetPassword: false,
  crewUuid: null,
  userType: null,
  firstName: null,
  familyName: null,
  deviceId: null,
  hydrated: false,
};

type Listener = (state: State) => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l(state));
}

export const tokenStore = {
  get(): State {
    return state;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  async hydrate(): Promise<State> {
    const [stored, deviceId] = await Promise.all([readAuthState(), getDeviceId()]);
    state = { ...stored, deviceId, hydrated: true };
    notify();
    return state;
  },

  async set(next: Partial<StoredAuthState>): Promise<void> {
    state = { ...state, ...next };
    await writeAuthState({
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
      domain: state.domain,
      mustResetPassword: state.mustResetPassword,
      crewUuid: state.crewUuid,
      userType: state.userType,
      firstName: state.firstName,
      familyName: state.familyName,
    });
    notify();
  },

  async clear(): Promise<void> {
    state = {
      ...state,
      accessToken: null,
      refreshToken: null,
      domain: null,
      mustResetPassword: false,
      crewUuid: null,
      userType: null,
      firstName: null,
      familyName: null,
    };
    await clearAuthState();
    notify();
  },
};
