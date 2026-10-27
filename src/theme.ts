import { Platform } from 'react-native';

export const ink = {
  stage: '#141312',
  raised: '#1E1C1A',
  rule: '#2E2B28',
  paper: '#EEE9DF',
  dim: '#8C877E',
  bloom: '#FF7090',
  leaf: '#8BD17C',
  amber: '#F2B54B',
  miss: '#7A3B46',
};

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });
export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Menlo, monospace' });
