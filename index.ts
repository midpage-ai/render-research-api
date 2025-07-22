import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Resend } from 'resend';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS headers matching the original function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Types
interface LegalResearchRequest {
  prompt: string;
  email?: string;
  isPlaintiff?: boolean;
  fileData?: {
    name: string;
    base64: string;
  };
}



// Main legal research endpoint
app.post('/api/legal-research', async (req, res) => {
  try {
    const { prompt, email, isPlaintiff, fileData }: LegalResearchRequest = req.body;
    const apiToken = process.env.API_TOKEN;
    
    console.log('Request received:', { 
      prompt: prompt?.substring(0, 100) + '...', 
      hasEmail: !!email, 
      isPlaintiff,
      timestamp: new Date().toISOString()
    });

    if (!apiToken) {
      console.error('API_TOKEN not found in environment variables');
      return res.status(500).json({ error: 'API token not configured' });
    }

    console.log('Calling legal research API with prompt:', prompt);
    const response = await fetch('https://webapp-git-valsai-midpage.vercel.app/api/legal_research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        prompt
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Legal research API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `API request failed: ${response.status}`
      });
    }

    const result = await response.text();
    console.log('Legal research API response received, length:', result.length);

    // Send email if requested
    if (email) {
      try {
        console.log('Attempting to send email to:', email);
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          
          // Create HTML content for the response attachment
          const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Legal ${isPlaintiff ? 'Plaintiff' : 'Defendant'} Review Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .content { white-space: pre-wrap; }
        .meta { color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Legal ${isPlaintiff ? 'Plaintiff' : 'Defendant'} Review Results</h1>
        <p><strong>Document:</strong> ${fileData?.name || 'Unknown'}</p>
        <p><strong>Role:</strong> ${isPlaintiff ? 'Plaintiff' : 'Defendant'}</p>
    </div>
    <div class="content">${result.replace(/\n/g, '<br>')}</div>
    <div class="meta">
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

          // Convert HTML to base64
          const htmlBase64 = Buffer.from(htmlContent, 'utf8').toString('base64');
          
          const emailData: any = {
            from: 'Legal Review <noreply@resend.dev>',
            to: [email],
            subject: `Legal ${isPlaintiff ? 'Plaintiff' : 'Defendant'} Review Results`,
            html: `
              <h2>Your Legal Review is Complete</h2>
              <p>Role: ${isPlaintiff ? 'Plaintiff' : 'Defendant'}</p>
              <p><strong>Document:</strong> ${fileData?.name || 'Uploaded Document'}</p>
              <p>Your analysis has been completed and is attached to this email along with your original document.</p>
              <p><strong>Attachments:</strong></p>
              <ul>
                <li>Original PDF document</li>
                <li>HTML report with detailed analysis</li>
              </ul>
              <p style="margin-top: 20px; color: #666; font-size: 12px;">
                Generated on ${new Date().toLocaleString()}
              </p>
            `
          };

          // Create attachments array
          const attachments = [];
          
          // Add original PDF if available
          if (fileData) {
            attachments.push({
              filename: fileData.name,
              content: fileData.base64,
              type: 'application/pdf',
              disposition: 'attachment'
            });
          }
          
          // Add HTML report
          attachments.push({
            filename: `legal-review-${isPlaintiff ? 'plaintiff' : 'defendant'}-${new Date().toISOString().split('T')[0]}.html`,
            content: htmlBase64,
            type: 'text/html',
            disposition: 'attachment'
          });
          
          emailData.attachments = attachments;
          const emailResult = await resend.emails.send(emailData);
          console.log('Email sent successfully with dual attachments:', emailResult);
        } else {
          console.warn('RESEND_API_KEY not configured, email not sent');
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the main request if email fails
      }
    }

    // Return the result as plain text
    res.set({
      'Content-Type': 'text/plain',
      ...corsHeaders
    });
    res.send(result);

  } catch (error) {
    console.error('Error in legal-research function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    res.status(500).json({
      error: errorMessage
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Legal Research API Server',
    version: '1.0.0',
    endpoints: {
      'POST /api/legal-research': 'Perform legal research',
      'GET /health': 'Health check'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Legal Research API Server running on port ${PORT}`);
  console.log(`📧 Email functionality: ${process.env.RESEND_API_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`🔑 API Token: ${process.env.API_TOKEN ? 'Configured' : 'Missing'}`);
});

export default app; 