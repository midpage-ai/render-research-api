# Legal Research API Server

A TypeScript Express server that provides legal research functionality, replacing the Supabase edge function.

## Features

- Legal research API endpoint
- Email functionality using Resend
- CORS enabled for cross-origin requests
- Health check endpoint
- TypeScript support

## Local Development

1. Install dependencies:
```bash
bun install
```


3. Add your environment variables to `.env`:
```env
API_TOKEN=your_legal_research_api_token_here
RESEND_API_KEY=your_resend_api_key_here
PORT=3000
```

4. Run the development server:
```bash
bun run dev
```

## Deployment to Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure the service:
   - **Build Command**: `bun install && bun run build`
   - **Start Command**: `bun start`
   - **Environment**: Node

4. Add environment variables in Render dashboard:
   - `API_TOKEN`: Your legal research API token
   - `RESEND_API_KEY`: Your Resend API key (optional)

## API Endpoints

### POST /api/legal-research
Perform legal research with optional email delivery.

**Request Body:**
```json
{
  "prompt": "Your legal research question",
  "email": "user@example.com", // optional
  "isPlaintiff": true // optional
}
```

**Response:** Plain text with research results

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /
API information endpoint.

## Environment Variables

- `API_TOKEN`: Required. Token for the legal research service
- `RESEND_API_KEY`: Optional. API key for Resend email service
- `PORT`: Optional. Server port (default: 3000)

## Updating Frontend

After deploying to Render, update your frontend to use the new API URL:

```typescript
// Replace the Supabase edge function URL with your Render URL
const response = await fetch("https://your-app-name.onrender.com/api/legal-research", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    prompt: "Your prompt",
    email: sendEmail ? email : null,
    isPlaintiff
  }),
});
``` 