# Video instruction-following study

A static questionnaire with 15 video comparisons and a separate 1–5 instruction-following rating for each video. Methods are displayed anonymously in balanced randomized positions. Progress is saved in the participant’s browser.

## GitHub Pages

In **Settings → Pages**, select **Deploy from a branch**, **main**, and **/(root)**, then save.

The site will be available at https://adam-duan.github.io/UserStudy/ after deployment succeeds.

## Collecting responses

This deployment has no remote collection endpoint. Participants complete all comparisons, select **导出我的评分**, and send the downloaded JSON file to the study organizer. Do not upload participant response files to this public repository.

To enable automatic collection later, configure `submit_url` in `config.json` with a compatible HTTPS collector. The collector must allow this site's origin and acknowledge durable storage before the page shows submission success.

## Files

Only questionnaire assets are included. Video files are bundled locally; no training server is needed for playback. Organizer-only method mappings, pre-scores, experiment metadata and responses are excluded.
