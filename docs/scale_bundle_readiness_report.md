# Scale Bundle Readiness Report

Generated at: 2026-06-09T22:33:27.317Z

Review status: default_route_budget_passed_optional_assets_need_monitoring

## Default Route Budget

- Legacy simulator lazy-loaded: true
- Legacy simulator static import present: false
- Dist present: true
- Initial JS: 397.81 KB
- Initial CSS: 46.97 KB
- Initial budget passed: true

## Optional Heavy Assets

- Optional assets over 500 KB: 5
- Largest optional asset: ort-wasm-simd-threaded.asyncify-e0c0c6d3.wasm (23014.7 KB)

## Next Actions

- Keep the default ClinicalFlowboard route free of legacy simulator, local PDF ingestion, embedding model, and patient TTS imports.
- Add manualChunks or deeper lazy-loading for legacy-only PDF, transformer, and Kokoro assets if the legacy route becomes part of national deployment.
- Run Lighthouse/WebPageTest-style checks on representative campus networks before national launch.
- Add load testing and CDN cache validation for multi-school cohorts.
