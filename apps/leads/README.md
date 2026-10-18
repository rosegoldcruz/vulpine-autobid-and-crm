<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2d50a612-5f43-4a4b-89a4-45dc8b29b9d1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Set integration variables in `.env.local`:
   - `VISION_API_URL`
   - `VISION_INTEGRATION_KEY`
4. Set LLM provider variables in `.env.local`:
   - `LLM_PROVIDER` (`gemini` or `openai-compatible`)
   - `LLM_MODEL`
   - `LLM_API_KEY`
   - `LLM_BASE_URL` (required for `openai-compatible`)
4. Run the app:
5. Run the app:
   `npm run dev`

## Vision Handoff API

This app now includes a server route to hand qualified leads into Vision:

- `POST /api/integrations/vision/handoff`

Request body:

```json
{
  "businessId": "biz_01",
  "opportunityId": "opp_01",
  "projectName": "Apex Heating & Air - Bid Package",
  "notes": "Priority lead for immediate bid preparation.",
  "attachmentRefs": ["drive://opps/apex/plan-set.zip"]
}
```

The endpoint calls Vision's `POST /api/integrations/leads/handoff` using the integration key.
