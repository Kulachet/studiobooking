/**
 * Sends an email directly from the browser using the Gmail REST API.
 * This completely eliminates the need for a backend server (Cloud Run).
 */
export async function sendEmail(accessToken: string, to: string, subject: string, body: string) {
  // 1. Construct the email in RFC 2822 format
  const emailLines = [];
  emailLines.push(`To: ${to}`);
  emailLines.push('Content-type: text/html;charset=utf-8');
  emailLines.push('MIME-Version: 1.0');
  
  // Encode subject to handle Thai characters properly
  const encodedSubject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  emailLines.push(`Subject: ${encodedSubject}`);
  emailLines.push('');
  emailLines.push(body);

  const email = emailLines.join('\r\n');

  // 2. Base64url encode the email string
  const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 3. Send directly to Google's Gmail API
  const response = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: base64EncodedEmail,
    }),
  });

  if (!response.ok) {
    let errorMessage = 'Unknown error';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || JSON.stringify(errorData);
    } catch (e) {
      errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    }
    throw new Error(`Gmail API Error: ${errorMessage}`);
  }

  return response.json();
}
