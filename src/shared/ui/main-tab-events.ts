type MainTabListener = (index: number) => void;

const listeners = new Set<MainTabListener>();

export function requestMainTab(index: number) {
  listeners.forEach((listener) => listener(index));
}

export function subscribeMainTabRequests(listener: MainTabListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
