import { FusionBackend } from './FusionBackend';
import { WebBackend } from './WebBackend';
import { Backend } from './types';
export * from './types';

export const initBackend: () => Promise<Backend> = async () => {
  if (window.adsk === undefined) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (window.adsk === undefined) {
      return new WebBackend();
    }
  }
  return new FusionBackend();
};
