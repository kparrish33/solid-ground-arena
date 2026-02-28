<?php
// api/submit.php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
  exit;
}

$to = defined('FORM_TO_EMAIL') ? FORM_TO_EMAIL : 'info@solidgroundarena.com';

// Basic anti-spam honeypot (add <input name="website" ...> hidden in forms if you want)
if (!empty($_POST['website'])) {
  echo json_encode(['ok' => true, 'message' => 'Submitted.']);
  exit;
}

$subject = trim($_POST['_subject'] ?? 'Website Form Submission');
$submissionType = trim($_POST['submission_type'] ?? 'online_form');

function clean($v) {
  if (is_array($v)) $v = implode(', ', $v);
  $v = (string)$v;
  $v = trim($v);
  $v = str_replace(["\r", "\n"], ' ', $v);
  return $v;
}

function wantsSkipKey($k) {
  return in_array($k, ['_subject', 'submission_type'], true);
}

// Try to find a reply-to email from common field names
$replyTo = '';
foreach (['email', 'Email', 'applicant_email', 'contact_email'] as $k) {
  if (!empty($_POST[$k])) {
    $candidate = filter_var($_POST[$k], FILTER_VALIDATE_EMAIL);
    if ($candidate) { $replyTo = $candidate; break; }
  }
}

// Build message body from POST
$lines = [];
$lines[] = "Submission type: {$submissionType}";
$lines[] = "Page: " . ($_SERVER['HTTP_REFERER'] ?? 'unknown');
$lines[] = "Time: " . date('Y-m-d H:i:s');
$lines[] = "";
$lines[] = "---- Form Fields ----";

foreach ($_POST as $k => $v) {
  if (wantsSkipKey($k)) continue;
  $lines[] = $k . ": " . clean($v);
}

$textBody = implode("\n", $lines);

// Email headers
$fromEmail = defined('FORM_FROM_EMAIL') ? FORM_FROM_EMAIL : $to;
$fromName  = defined('FORM_FROM_NAME')  ? FORM_FROM_NAME  : 'Solid Ground Arena Website';
$ccEmail   = defined('FORM_CC_EMAIL')   ? trim(FORM_CC_EMAIL) : '';

$headers = [];
$headers[] = 'From: ' . $fromName . ' <' . $fromEmail . '>';
if ($replyTo) $headers[] = 'Reply-To: ' . $replyTo;
if ($ccEmail) $headers[] = 'Cc: ' . $ccEmail;
$headers[] = 'MIME-Version: 1.0';

// Handle optional PDF upload
$file = $_FILES['pdf'] ?? null; // IMPORTANT: make sure your <input type="file"> uses name="pdf"
$hasFile = $file && isset($file['tmp_name']) && is_uploaded_file($file['tmp_name']) && ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK;

if ($hasFile) {
  $maxBytes = 12 * 1024 * 1024; // 12MB
  if (($file['size'] ?? 0) > $maxBytes) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'File too large (max 12MB).']);
    exit;
  }

  $filename = $file['name'] ?? 'upload.pdf';
  $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
  if ($ext !== 'pdf') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Only PDF files are allowed.']);
    exit;
  }

  $fileData = file_get_contents($file['tmp_name']);
  if ($fileData === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'message' => 'Could not read uploaded file.']);
    exit;
  }

  $boundary = '----sga-' . md5((string)microtime(true));
  $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';

  $body  = "--{$boundary}\r\n";
  $body .= "Content-Type: text/plain; charset=utf-8\r\n";
  $body .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
  $body .= $textBody . "\r\n\r\n";

  $body .= "--{$boundary}\r\n";
  $body .= "Content-Type: application/pdf; name=\"" . addslashes($filename) . "\"\r\n";
  $body .= "Content-Transfer-Encoding: base64\r\n";
  $body .= "Content-Disposition: attachment; filename=\"" . addslashes($filename) . "\"\r\n\r\n";
  $body .= chunk_split(base64_encode($fileData)) . "\r\n";
  $body .= "--{$boundary}--";

  $ok = @mail($to, $subject, $body, implode("\r\n", $headers));

} else {
  $headers[] = 'Content-Type: text/plain; charset=utf-8';
  $ok = @mail($to, $subject, $textBody, implode("\r\n", $headers));
}

if ($ok) {
  echo json_encode(['ok' => true, 'message' => 'Thanks! Your submission was received.']);
} else {
  http_response_code(500);
  echo json_encode(['ok' => false, 'message' => 'Mail failed to send. Please try again or contact us.']);
}
