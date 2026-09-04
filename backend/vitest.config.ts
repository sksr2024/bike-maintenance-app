import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './test/globalSetup.ts',
    // Integration tests share one real Postgres instance and call resetDb() in
    // beforeEach; running test files in parallel lets one file's TRUNCATE wipe
    // state another file is mid-assertion on.
    fileParallelism: false,
  },
});
