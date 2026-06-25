# Third-Party Notices

This project is licensed under MIT. Some included dependencies may have different licenses.

## Playwright

- Package: `playwright`
- License: Apache-2.0
- Purpose: Headless Chromium browser automation for website screenshots.

Playwright downloads browser binaries during `pnpm install` (via the `postinstall` script). See the [Playwright license](https://github.com/microsoft/playwright/blob/main/LICENSE) for details.

## monq

- Package: `monq` (git dependency)
- License: See upstream repository
- Purpose: MongoDB-backed job queue for processing `processUrlDemo` jobs.

## AWS SDK

- Packages: `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`
- License: Apache-2.0
- Purpose: Upload generated screenshot images to S3.

## OpenAI / Google GenAI SDKs

- Packages: `openai`, `@google/genai`
- Purpose: Vision API calls to generate demo step text from screenshots.
