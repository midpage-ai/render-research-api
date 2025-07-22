import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

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
app.use(express.json({ limit: '50mb' })); // Increase limit to handle large file uploads
app.use(express.urlencoded({ limit: '50mb', extended: true })); // Handle URL-encoded data

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

interface EmailAttachment {
  filename: string;
  content: string;
  type: string;
  disposition: string;
}

// Function to create DOCX document
async function createDocxDocument(content: string, documentName: string, isPlaintiff: boolean): Promise<string> {
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: `Legal ${isPlaintiff ? 'Plaintiff' : 'Defendant'} Review Results`,
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: {
            after: 400,
            before: 400
          }
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Document: ${documentName}`,
              bold: true
            })
          ],
          spacing: {
            after: 200
          }
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Role: ${isPlaintiff ? 'Plaintiff' : 'Defendant'}`,
              bold: true
            })
          ],
          spacing: {
            after: 400
          }
        }),
        new Paragraph({
          text: content,
          spacing: {
            after: 400
          }
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on ${new Date().toLocaleString()}`,
              size: 20,
              color: '666666'
            })
          ],
          spacing: {
            before: 400
          }
        })
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer.toString('base64');
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
      }),
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(600000) // 10 minute timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Legal research API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `API request failed: ${response.status}`,
        details: errorText
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
          
          // Create DOCX content for the response attachment
          const docxContent = await createDocxDocument(result, fileData?.name || 'Unknown', isPlaintiff || false);
          
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
                <li>DOCX report with detailed analysis</li>
              </ul>
              <p style="margin-top: 20px; color: #666; font-size: 12px;">
                Generated on ${new Date().toLocaleString()}
              </p>
            `
          };

          // Create attachments array
          const attachments: EmailAttachment[] = [];
          
          // Add original PDF if available
          if (fileData) {
            attachments.push({
              filename: fileData.name,
              content: fileData.base64,
              type: 'application/pdf',
              disposition: 'attachment'
            });
          }
          
          // Add DOCX report
          attachments.push({
            filename: `legal-review-${isPlaintiff ? 'plaintiff' : 'defendant'}-${new Date().toISOString().split('T')[0]}.docx`,
            content: docxContent,
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
const server = app.listen(PORT, () => {
  console.log(`🚀 Legal Research API Server running on port ${PORT}`);
  console.log(`📧 Email functionality: ${process.env.RESEND_API_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`🔑 API Token: ${process.env.API_TOKEN ? 'Configured' : 'Missing'}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;
