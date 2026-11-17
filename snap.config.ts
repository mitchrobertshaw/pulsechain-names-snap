import type { SnapConfig } from '@metamask/snaps-cli';

const config: SnapConfig = {
  input: 'src/index.ts',
  server: { port: 8080 },
  // The bundle never uses Node's Buffer (only the standard ArrayBuffer): the check flags code the
  // build leaves out.
  stats: { buffer: false },
};

export default config;
