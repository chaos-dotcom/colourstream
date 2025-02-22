interface OvenPlayerInstance {
  create: (
    elementId: string,
    config: {
      autoStart?: boolean;
      mute?: boolean;
      sources: Array<{
        label: string;
        type: string;
        file: string;
      }>;
    }
  ) => void;
}

declare global {
  interface Window {
    OvenPlayer: OvenPlayerInstance;
  }
}

export {}; 