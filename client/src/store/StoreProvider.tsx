import { ReactNode } from 'react';
import { useLifeHubStore } from './store';

export function StoreProvider({ children }: { children: ReactNode }) {
  void useLifeHubStore;
  return children;
}
