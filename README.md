# Video instruction-following study

A static questionnaire with 15 video comparisons and a separate 1–5 instruction-following rating for each video. Methods are displayed anonymously in balanced randomized positions. Progress is saved in the participant’s browser.

## GitHub Pages

In **Settings → Pages**, select **Deploy from a branch**, **main**, and **/(root)**, then save.

The site will be available at https://adam-duan.github.io/UserStudy/ after deployment succeeds.

## Collecting responses

Completed responses are submitted automatically to the HTTPS collector configured in `config.json`. The page shows success only after the server confirms storage. A failed submission can be retried, and JSON export remains available as a backup. Responses and method mappings are never published in this repository.

Previously completed participants can reopen this URL in the same browser to submit their saved answers. Questionnaire IDs and browser storage keys have not changed.

The current collector uses a persistent SQLite database on the organizer's server through a Cloudflare Quick Tunnel. The server and tunnel must remain running. If the tunnel is recreated, update `config.json` with the new HTTPS endpoint and redeploy; participants keep using the same GitHub Pages URL. This temporary tunnel is not an uptime-guaranteed hosting service.

## Files

Only questionnaire assets are included. Video files are bundled locally; no training server is needed for playback. Organizer-only method mappings, pre-scores, experiment metadata and responses are excluded.
