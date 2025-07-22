import { Resend } from 'resend';
import jsPDF from 'jspdf';

interface EmailAttachment {
  filename: string;
  content: string;
  type: string;
  disposition: string;
}

interface EmailData {
  prompt: string;
  result: string;
  email: string;
  isPlaintiff: boolean;
  fileData?: {
    name: string;
    base64: string;
  };
}

export class EmailService {
  private resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  private parseMarkdownToText(markdown: string): string {
    let text = markdown;
    
    // Convert markdown links to readable format: [text](url) -> text (url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
    
    // Convert headers to plain text with prefix
    text = text.replace(/^### (.*$)/gm, '### $1\n');
    text = text.replace(/^## (.*$)/gm, '## $1\n');
    text = text.replace(/^# (.*$)/gm, '# $1\n');
    
    // Convert bold to readable format: **text** -> **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '**$1**');
    
    // Convert italic to readable format: *text* -> *text*
    text = text.replace(/\*(.*?)\*/g, '*$1*');
    
    // Handle outline structure - ensure proper breaks for lettered items
    // More specific approach: look for "A. ... B." pattern
    text = text.replace(/([A-Z]\.\s+[^.]*?\.)\s+([A-Z]\.\s+)/g, '$1\n$2');
    
    // Handle Roman numeral items - ensure proper breaks
    text = text.replace(/([IVX]+\.\s+[^.]*?\.)\s+([IVX]+\.\s+)/g, '$1\n$2');
    
    // Ensure proper paragraph breaks
    text = text.replace(/\n\n+/g, '\n\n');
    
    // Convert list items to bullet points
    text = text.replace(/^[-*+] (.*$)/gm, '• $1\n');
    text = text.replace(/^\d+\. (.*$)/gm, '• $1\n');
    
    return text;
  }

  private generatePDF(data: EmailData): string {
    const { prompt, result, isPlaintiff, fileData } = data;
    
    // Parse markdown content to properly formatted text
    const parsedResult = this.parseMarkdownToText(result);
    
    // Create new PDF document
    const pdf = new jsPDF();
    
    // Set font
    pdf.setFont('helvetica');
    
    // Add title
    pdf.setFontSize(18);
    pdf.text(`Legal ${isPlaintiff ? 'Plaintiff' : 'Defendant'} Review Results`, 20, 20);
    
    // Add document info
    pdf.setFontSize(12);
    pdf.text(`Document: ${fileData?.name || 'Unknown'}`, 20, 35);
    pdf.text(`Role: ${isPlaintiff ? 'Plaintiff' : 'Defendant'}`, 20, 45);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 55);
    
    // Add prompt
    pdf.setFontSize(14);
    pdf.text('Original Prompt:', 20, 75);
    pdf.setFontSize(10);
    
    // Split prompt into lines that fit the page width
    const promptLines = this.splitTextToFit(prompt, 170);
    let yPosition = 85;
    
    for (const line of promptLines) {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, 20, yPosition);
      yPosition += 5;
    }
    
    // Add result
    yPosition += 10;
    pdf.setFontSize(14);
    pdf.text('Analysis Results:', 20, yPosition);
    pdf.setFontSize(10);
    yPosition += 10;
    
    // Split parsed result into lines that fit the page width
    const resultLines = this.splitTextToFit(parsedResult, 170);
    
    for (const line of resultLines) {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, 20, yPosition);
      yPosition += 5;
    }
    
    // Convert PDF to base64
    return pdf.output('datauristring').split(',')[1];
  }

  private splitTextToFit(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length * 2.5 <= maxWidth) { // Rough estimate of character width
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  async sendLegalResearchEmail(data: EmailData): Promise<void> {
    try {
      // Log the response before sending email
      console.log('=== LEGAL RESEARCH RESPONSE ===');
      console.log('Response length:', data.result.length);
      console.log('Response preview (first 500 chars):', data.result.substring(0, 500));
      console.log('Response preview (last 500 chars):', data.result.substring(Math.max(0, data.result.length - 500)));
      console.log('=== END RESPONSE LOG ===');
      
      console.log('Generating PDF for email...');
      const pdfBase64 = this.generatePDF(data);
      
      console.log('Preparing email with PDF attachment...');
      const emailData: any = {
        from: 'Legal Review <noreply@resend.dev>',
        to: [data.email],
        subject: `Legal ${data.isPlaintiff ? 'Plaintiff' : 'Defendant'} Review Results`,
        html: `
          <h2>Your Legal Review is Complete</h2>
          <p>Role: ${data.isPlaintiff ? 'Plaintiff' : 'Defendant'}</p>
          <p><strong>Document:</strong> ${data.fileData?.name || 'Uploaded Document'}</p>
          <p>Your analysis has been completed and is attached to this email along with your original document.</p>
          <p><strong>Attachments:</strong></p>
          <ul>
            <li>Original PDF document</li>
            <li>PDF report with detailed analysis</li>
          </ul>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            Generated on ${new Date().toLocaleString()}
          </p>
        `
      };

      // Create attachments array
      const attachments: EmailAttachment[] = [];
      
      // Add original PDF if available
      if (data.fileData) {
        attachments.push({
          filename: data.fileData.name,
          content: data.fileData.base64,
          type: 'application/pdf',
          disposition: 'attachment'
        });
      }
      
      // Add generated PDF report
      attachments.push({
        filename: `legal-review-${data.isPlaintiff ? 'plaintiff' : 'defendant'}-${new Date().toISOString().split('T')[0]}.pdf`,
        content: pdfBase64,
        type: 'application/pdf',
        disposition: 'attachment'
      });
      
      emailData.attachments = attachments;
      
      console.log('Sending email...');
      const emailResult = await this.resend.emails.send(emailData);
      console.log('Email sent successfully with PDF attachments:', emailResult);
      
    } catch (error) {
      console.error('Error in email service:', error);
      throw error;
    }
  }
} 